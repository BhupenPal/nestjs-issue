import { constructZodLiteralUnionType } from '@libs/utilities';
import { CITY_CODES } from '../constants';
import { z } from 'zod';

export const ONDC_CONTEXT_COUNTRIES = z.enum(['IND']);

export const ONDC_CONTEXT_ACTIONS = z.enum([
  'search',
  'select',
  'init',
  'confirm',
  'update',
  'status',
  'track',
  'cancel',
  'rating',
  'support',
  'on_search',
  'on_select',
  'on_init',
  'on_confirm',
  'on_update',
  'on_status',
  'on_track',
  'on_cancel',
  'on_rating',
  'on_support',
]);

export const ONDC_CONTEXT_DOMAINS = z.enum(['ONDC:RET10', 'nic2004:52110']);

export const ONDC_CONTEXT_CITY = constructZodLiteralUnionType([
  ...CITY_CODES.map((literal) => z.literal(literal)),
  z.literal('*'),
]);

export const OndcReqContextSchema = z.object({
  domain: z.string(),
  country: z.string(),
  city: ONDC_CONTEXT_CITY,
  action: ONDC_CONTEXT_ACTIONS,
  core_version: z.string(),
  bap_id: z.string(),
  bap_uri: z.string().url(),
  bpp_id: z.string().optional(),
  bpp_uri: z.string().url().optional(),
  transaction_id: z.string(),
  message_id: z.string(),
  timestamp: z.string().datetime(),
  key: z.string().optional(),
  ttl: z.string().optional(),
});

export type OndcRequestContext = z.infer<typeof OndcReqContextSchema>;
