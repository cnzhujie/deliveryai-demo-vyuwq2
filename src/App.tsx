import { useCallback, useEffect, useReducer, useState } from 'react'
import i18next from 'i18next'
import { useTranslation } from 'react-i18next'
import { ClipboardList, ConciergeBell, LayoutDashboard, Menu as MenuIcon, ShoppingBasket } from 'lucide-react'
import { HomeView } from '@/components/HomeView'
import { WelcomeView } from '@/components/WelcomeView'
import { CartPanel } from '@/components/CartPanel'
import { CheckoutView } from '@/components/CheckoutView'
import { DemoConsole } from '@/components/DemoConsole'
import { LogPanel } from '@/components/LogPanel'
import { MenuView } from '@/components/MenuView'
import { OrderView } from '@/components/OrderView'
import { ServiceSheet } from '@/components/ServiceSheet'
import { TopBar } from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useElderlyMode } from '@/hooks/useElderlyMode'
import { initialViewFromHash, useViewRoute } from '@/hooks/useViewRoute'
import { orderReducer, initialState } from '@/state/orderReducer'
import { products } from '@/data/menu'
import { logger } from '@/lib/logger'
import { money } from '@/lib/utils'
import type { AppAction, AppState, ViewName } from '@/types'

function createInitialState(): AppState {
  const search = new URLSearchParams(window.location.search)
  const requestedView = initialViewFromHash()

  // preview=menu：预置一桌带购物车的点餐态，供设计/截图预览
  if (search.get('preview') === 'menu') {
    const product = products[2]
    const spec = [i18next.t('menu.option.full'), i18next.t('menu.option.original')].join(' · ')
    return {
      ...initialState,
      table: 'A08',
      view: 'menu',
      cart: [{ uid: 'preview-item', productId: product.id, name: i18next.t(product.name), price: product.price, quantity: 1, image: product.image, spec, orderedBy: '姚乾' }],
      lastMessage: initialState.lastMessage,
    }
  }

  // 深链接：直接以 #/welcome 等地址打开时，先绑定示例桌台再进入对应视图；
  // home 无需桌台，其余流程视图（welcome/menu/order/checkout）需要桌台上下文。
  if (requestedView && requestedView !== 'home') {
    return { ...initialState, table: 'A08', view: requestedView }
  }

  return initialState
}

/**
 * dispatch 中间件：在 action 分发到 reducer 的同时，记录关键用户行为日志。
 * 纯日志采集，不改变 action 内容或 reducer 逻辑。
 */
const actionLogMap: Record<AppAction['type'], { category: string; getMessage: (action: AppAction) => string; getData?: (action: AppAction) => Record<string, unknown> }> = {
  BIND_TABLE: { category: 'table', getMessage: (a) => `绑定桌台: ${(a as Extract<AppAction, { type: 'BIND_TABLE' }>).table}` },
  SET_VIEW: { category: 'nav', getMessage: (a) => `切换视图: ${(a as Extract<AppAction, { type: 'SET_VIEW' }>).view}` },
  ADD_CART: {
    category: 'cart',
    getMessage: (a) => `加购物车: ${(a as Extract<AppAction, { type: 'ADD_CART' }>).item.name}`,
    getData: (a) => {
      const item = (a as Extract<AppAction, { type: 'ADD_CART' }>).item
      return { productId: item.productId, orderedBy: item.orderedBy, quantity: item.quantity, price: item.price }
    },
  },
  CHANGE_QTY: { category: 'cart', getMessage: (a) => { const act = a as Extract<AppAction, { type: 'CHANGE_QTY' }>; return `修改数量: ${act.uid} (${act.delta > 0 ? '+' : ''}${act.delta})` } },
  SUBMIT_ORDER: { category: 'order', getMessage: () => '提交订单' },
  SET_STAGE: { category: 'order', getMessage: (a) => `切换履约阶段: ${(a as Extract<AppAction, { type: 'SET_STAGE' }>).stage}` },
  TOGGLE_SOLD_OUT: { category: 'menu', getMessage: (a) => `切换售罄: ${(a as Extract<AppAction, { type: 'TOGGLE_SOLD_OUT' }>).productId}` },
  CALL_SERVICE: { category: 'service', getMessage: (a) => `呼叫服务: ${(a as Extract<AppAction, { type: 'CALL_SERVICE' }>).service}` },
  RESPOND_SERVICES: { category: 'service', getMessage: () => '响应所有服务呼叫' },
  REQUEST_CANCEL: { category: 'order', getMessage: (a) => `申请退菜: ${(a as Extract<AppAction, { type: 'REQUEST_CANCEL' }>).uid}` },
  PAY: { category: 'checkout', getMessage: () => '完成支付' },
  RESET: { category: 'system', getMessage: () => '重置演示' },
  SET_MESSAGE: { category: 'system', getMessage: () => '设置消息' },
}

export default function App() {
  const { t, i18n } = useTranslation()
  const [state, rawDispatch] = useReducer(orderReducer, undefined, createInitialState)
  const { enabled: elderly, toggle: toggleElderly } = useElderlyMode()
  const [serviceOpen, setServiceOpen] = useState(false)
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const cartTotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const waitingServices = state.services.filter((service) => service.status === 'waiting').length

  // 带日志采集的 dispatch
  const dispatch = useCallback((action: AppAction) => {
    const config = actionLogMap[action.type]
    if (config) {
      logger.info(config.category, config.getMessage(action), config.getData?.(action))
    }
    rawDispatch(action)
  }, [])

  // 视图 ↔ URL hash 双向同步；未绑定桌台时只有 home 可达，其余地址回落到 home
  const canView = useCallback((view: ViewName) => view === 'home' || !!state.table, [state.table])
  const navigate = useCallback((view: ViewName) => dispatch({ type: 'SET_VIEW', view }), [dispatch])
  useViewRoute(state.view, { onNavigate: navigate, canView })

  useEffect(() => {
    document.documentElement.lang = i18n.language === 'zh' ? 'zh-CN' : 'en'
    document.title = t('common.title')
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute('content', t('common.meta_desc'))
    try {
      localStorage.setItem('i18nextLng', i18n.language)
    } catch {
      // localStorage 不可用时降级为内存态，不报错不阻塞
    }
  }, [i18n.language, t])

  // 记录语言切换日志
  const toggleLanguage = useCallback(() => {
    const next = i18n.language === 'zh' ? 'en' : 'zh'
    logger.info('system', `切换语言: ${i18n.language} → ${next}`)
    i18n.changeLanguage(next)
  }, [i18n])

  const changeView = useCallback((view: ViewName) => dispatch({ type: 'SET_VIEW', view }), [dispatch])
  const submitOrder = useCallback(() => {
    dispatch({ type: 'SUBMIT_ORDER' })
    setCartOpen(false)
  }, [dispatch])
  const handleToggleElderly = useCallback(() => {
    toggleElderly()
    dispatch({ type: 'SET_MESSAGE', message: elderly ? '已切换为常规模式' : '已切换为老人模式' })
  }, [dispatch, elderly, toggleElderly])

  if (state.view === 'home' || !state.table) {
    return (
      <>
        <HomeView onBind={(table) => dispatch({ type: 'BIND_TABLE', table })} />
        <LogPanel open={logOpen} onOpenChange={setLogOpen} />
      </>
    )
  }

  if (state.view === 'welcome') {
    return (
      <>
        <WelcomeView table={state.table!} onEnter={() => dispatch({ type: 'SET_VIEW', view: 'menu' })} />
        <LogPanel open={logOpen} onOpenChange={setLogOpen} />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-rice-100 paper-noise">
      <TopBar
        table={state.table}
        view={state.view}
        serviceCount={waitingServices}
        language={i18n.language}
        elderly={elderly}
        onToggleLanguage={toggleLanguage}
        onToggleElderly={handleToggleElderly}
        onView={changeView}
        onService={() => setServiceOpen(true)}
        onConsole={() => setConsoleOpen(true)}
        onLogPanel={() => setLogOpen(true)}
      />

      {state.view === 'menu' && (
        <main className="mx-auto grid max-w-7xl gap-6 px-4 py-5 pb-28 lg:grid-cols-3 lg:px-6 lg:py-7 lg:pb-8">
          <div className="lg:col-span-2">
            <MenuView diners={state.diners} soldOut={state.soldOut} onAdd={(item) => dispatch({ type: 'ADD_CART', item })} />
          </div>
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <CartPanel items={state.cart} onQuantity={(uid, delta) => dispatch({ type: 'CHANGE_QTY', uid, delta })} onSubmit={submitOrder} />
              <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-100/70 p-4 text-sm text-charcoal-700">
                <p className="font-bold">{t('common.collab_title')}</p>
                <p className="mt-1 leading-6 text-charcoal-500">{t('common.collab_desc')}</p>
              </div>
            </div>
          </aside>
        </main>
      )}

      {state.view === 'order' && (
        <OrderView
          items={state.orderItems}
          stage={state.orderStage}
          onAddMore={() => changeView('menu')}
          onCancel={(uid) => dispatch({ type: 'REQUEST_CANCEL', uid })}
          onCheckout={() => changeView('checkout')}
        />
      )}

      {state.view === 'checkout' && (
        <CheckoutView items={state.orderItems} paid={state.paid} onPay={() => dispatch({ type: 'PAY' })} onBack={() => changeView('order')} />
      )}

      <ServiceSheet open={serviceOpen} requests={state.services} onOpenChange={setServiceOpen} onCall={(service) => dispatch({ type: 'CALL_SERVICE', service })} />
      <DemoConsole
        open={consoleOpen}
        table={state.table}
        stage={state.orderStage}
        soldOut={state.soldOut}
        services={state.services}
        onOpenChange={setConsoleOpen}
        onStage={(stage) => dispatch({ type: 'SET_STAGE', stage })}
        onSoldOut={(productId) => dispatch({ type: 'TOGGLE_SOLD_OUT', productId })}
        onRespond={() => dispatch({ type: 'RESPOND_SERVICES' })}
        onReset={() => { dispatch({ type: 'RESET' }); setConsoleOpen(false) }}
        onViewLog={() => { setConsoleOpen(false); setLogOpen(true) }}
      />

      <LogPanel open={logOpen} onOpenChange={setLogOpen} />

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent title={t('cart.dialog_title')}>
          <div className="mt-5"><CartPanel compact items={state.cart} onQuantity={(uid, delta) => dispatch({ type: 'CHANGE_QTY', uid, delta })} onSubmit={submitOrder} /></div>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 lg:hidden">
        {state.view === 'menu' && state.cart.length > 0 && (
          <Button onClick={() => setCartOpen(true)} className="h-12 rounded-full px-5 shadow-float">
            <span className="relative"><ShoppingBasket size={19} /><span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-xs text-charcoal-900">{state.cart.length}</span></span>
            {t('common.view_cart')} · {money(cartTotal)}
          </Button>
        )}
      </div>

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-charcoal-900/5 bg-white/95 px-2 pt-2 backdrop-blur lg:hidden">
        <MobileNav active={state.view === 'menu'} icon={MenuIcon} label={t('common.nav_menu')} onClick={() => changeView('menu')} />
        <MobileNav active={state.view === 'order'} icon={ClipboardList} label={t('common.nav_order')} onClick={() => changeView('order')} />
        <MobileNav active={serviceOpen} icon={ConciergeBell} label={t('common.nav_service')} badge={waitingServices} onClick={() => setServiceOpen(true)} />
        <MobileNav active={consoleOpen} icon={LayoutDashboard} label={t('common.nav_demo')} onClick={() => setConsoleOpen(true)} />
      </nav>

      <div className="pointer-events-none fixed left-1/2 top-24 z-40 -translate-x-1/2 rounded-full bg-charcoal-900/90 px-4 py-2 text-xs font-semibold text-white shadow-float">
        {state.lastMessage}
      </div>
    </div>
  )
}

function MobileNav({ active, icon: Icon, label, badge, onClick }: { active: boolean; icon: typeof MenuIcon; label: string; badge?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`relative flex flex-col items-center gap-1 rounded-xl py-2 text-xs font-semibold transition ${active ? 'bg-chili-50 text-chili-500' : 'text-charcoal-500'}`}>
      <Icon size={20} />{label}{badge ? <span className="absolute right-4 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-chili-500 px-1 text-white">{badge}</span> : null}
    </button>
  )
}
