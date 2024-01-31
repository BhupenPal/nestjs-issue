export const RABBIT_CONSUMER = {
  identifier: Symbol('__RABBIT_CONSUMER__'),
  value: true,
} as const;

export const RABBIT_HANDLER = {
  identifier: Symbol('__RABBIT_HANDLER__'),
  value: true,
} as const;

export const RABBIT_MSG_ROUTER = Symbol('__RABBIT_MSG_ROUTER__');
