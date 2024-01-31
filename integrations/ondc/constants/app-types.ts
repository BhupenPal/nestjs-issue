export const ONDC_SUBSCRIPTION_APP_TYPES = {
  BUYER_APP: 'BUYER_APP',
  SELLER_APP: 'SELLER_APP',
  BUYER_AND_SELLER_APP: 'BUYER_AND_SELLER_APP',
} as const;

export type IOndcSubscriptionApp = keyof typeof ONDC_SUBSCRIPTION_APP_TYPES;

export const OndcSubscriptionApps = Object.keys(
  ONDC_SUBSCRIPTION_APP_TYPES,
) as IOndcSubscriptionApp[];
