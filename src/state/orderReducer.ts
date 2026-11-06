import i18next from 'i18next'
import { uid } from '@/lib/utils'
import { logger } from '@/lib/logger'
import type { AppAction, AppState } from '@/types'

export const initialState: AppState = {
  view: 'home',
  table: null,
  diners: ['姚乾', '林溪', '陈默'],
  cart: [],
  orderItems: [],
  orderStage: 'submitted',
  soldOut: ['p8'],
  services: [],
  paid: false,
  lastMessage: i18next.t('message.welcome'),
}

const stageMessages: Record<string, string> = {
  submitted: 'message.stage_submitted',
  accepted: 'message.stage_accepted',
  cooking: 'message.stage_cooking',
  served: 'message.stage_served',
}

const localeForLanguage = (lang: string) => (lang === 'en' ? 'en-US' : 'zh-CN')

/** 提取 action 中适合日志的关键字段（避免序列化全部 state） */
function actionLogData(action: AppAction): Record<string, unknown> {
  switch (action.type) {
    case 'BIND_TABLE':
      return { table: action.table }
    case 'SET_VIEW':
      return { view: action.view }
    case 'ADD_CART':
      return { productId: action.item.productId, name: action.item.name, quantity: action.item.quantity, orderedBy: action.item.orderedBy, spec: action.item.spec }
    case 'CHANGE_QTY':
      return { uid: action.uid, delta: action.delta }
    case 'SUBMIT_ORDER':
      return {}
    case 'SET_STAGE':
      return { stage: action.stage }
    case 'TOGGLE_SOLD_OUT':
      return { productId: action.productId }
    case 'CALL_SERVICE':
      return { service: action.service }
    case 'RESPOND_SERVICES':
      return {}
    case 'REQUEST_CANCEL':
      return { uid: action.uid }
    case 'PAY':
      return {}
    case 'RESET':
      return {}
    case 'SET_MESSAGE':
      return { message: action.message }
    default:
      return {}
  }
}

export function orderReducer(state: AppState, action: AppAction): AppState {
  logger.debug('reducer', `action: ${action.type}`, actionLogData(action))

  switch (action.type) {
    case 'BIND_TABLE':
      return { ...state, table: action.table, view: 'welcome', lastMessage: i18next.t('message.bind_table', { table: action.table }) }
    case 'SET_VIEW':
      return { ...state, view: action.view }
    case 'ADD_CART': {
      const same = state.cart.find((item) => item.productId === action.item.productId && item.spec === action.item.spec && item.orderedBy === action.item.orderedBy)
      const cart = same
        ? state.cart.map((item) => item.uid === same.uid ? { ...item, quantity: item.quantity + 1 } : item)
        : [...state.cart, action.item]
      return { ...state, cart, lastMessage: i18next.t('message.add_cart', { name: action.item.orderedBy, dish: action.item.name }) }
    }
    case 'CHANGE_QTY': {
      const cart = state.cart
        .map((item) => item.uid === action.uid ? { ...item, quantity: item.quantity + action.delta } : item)
        .filter((item) => item.quantity > 0)
      return { ...state, cart }
    }
    case 'SUBMIT_ORDER': {
      if (!state.cart.length) return state
      const additions = state.cart.map((item) => ({ ...item, stage: 'submitted' as const }))
      const orderCount = state.orderItems.length + additions.length
      logger.info('order', '订单提交', { itemCount: additions.length, totalOrders: orderCount, table: state.table })
      return {
        ...state,
        orderItems: [...state.orderItems, ...additions],
        cart: [],
        orderStage: 'submitted',
        view: 'order',
        lastMessage: state.orderItems.length ? i18next.t('message.order_additional') : i18next.t('message.order_submitted'),
      }
    }
    case 'SET_STAGE': {
      logger.info('order', '订单阶段变更', { stage: action.stage, orderCount: state.orderItems.length })
      return {
        ...state,
        orderStage: action.stage,
        orderItems: state.orderItems.map((item) => ({ ...item, stage: action.stage })),
        lastMessage: i18next.t(stageMessages[action.stage]),
      }
    }
    case 'TOGGLE_SOLD_OUT': {
      const soldOut = state.soldOut.includes(action.productId)
        ? state.soldOut.filter((id) => id !== action.productId)
        : [...state.soldOut, action.productId]
      logger.info('menu', '售罄状态切换', { productId: action.productId, soldOut: soldOut.includes(action.productId) })
      return {
        ...state,
        soldOut,
        lastMessage: i18next.t('message.soldout_updated'),
      }
    }
    case 'CALL_SERVICE': {
      const serviceName = i18next.t(`${action.service}.name`)
      logger.info('service', '呼叫服务', { service: serviceName })
      return {
        ...state,
        services: [...state.services, { id: uid(), type: serviceName, createdAt: new Date().toLocaleTimeString(localeForLanguage(i18next.language), { hour: '2-digit', minute: '2-digit' }), status: 'waiting' }],
        lastMessage: i18next.t('message.service_called', { service: serviceName }),
      }
    }
    case 'RESPOND_SERVICES':
      logger.info('service', '响应服务请求', { count: state.services.filter((s) => s.status === 'waiting').length })
      return { ...state, services: state.services.map((service) => ({ ...service, status: 'responded' })), lastMessage: i18next.t('message.service_responded') }
    case 'REQUEST_CANCEL':
      logger.info('order', '请求取消订单项', { uid: action.uid })
      return {
        ...state,
        orderItems: state.orderItems.map((item) => item.uid === action.uid ? { ...item, cancelState: 'requested' } : item),
        lastMessage: i18next.t('message.cancel_requested'),
      }
    case 'PAY':
      logger.info('checkout', '支付完成', { table: state.table, orderCount: state.orderItems.length })
      return { ...state, paid: true, lastMessage: i18next.t('message.paid') }
    case 'RESET':
      logger.info('app', '重置应用状态')
      return { ...initialState, lastMessage: i18next.t('message.reset') }
    case 'SET_MESSAGE':
      return { ...state, lastMessage: action.message }
    default:
      return state
  }
}
