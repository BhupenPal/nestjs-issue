import { z } from 'zod';
import {
  ONDC_CONTEXT_ACTIONS,
  ONDC_CONTEXT_CITY,
  ONDC_CONTEXT_COUNTRIES,
  ONDC_CONTEXT_DOMAINS,
} from '../../types';

export const CreateReqContextSchema = z.object({
  domain: ONDC_CONTEXT_DOMAINS,
  country: ONDC_CONTEXT_COUNTRIES,
  city: ONDC_CONTEXT_CITY,
  action: ONDC_CONTEXT_ACTIONS,
  bapId: z.string(),
  bapUri: z.string().url(),
  bppId: z.string().optional(),
  bppUri: z.string().url().optional(),
});

export type CreateReqContext = z.infer<typeof CreateReqContextSchema>;
