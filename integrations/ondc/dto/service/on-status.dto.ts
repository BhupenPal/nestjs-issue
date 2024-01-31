import { z } from 'zod';
import { CreateReqContextSchema } from './create-req-context.dto';
import { OndcReqContextSchema } from '@integrations/ondc/types';

const OnStatusSchema = z.object({
  context: CreateReqContextSchema.omit({ action: true }),
  subscriber: z.object({
    id: z.string(),
    uniqueKeyId: z.string(),
    privateKey: z.string(),
  }),
});

export type IOnStatus = z.infer<typeof OnStatusSchema>;

const FulfillmentSchema = z.object({
  id: z.string(),
  type: z.enum(['Delivery', 'Pickup', 'Delivery and Pickup', 'Reverse QC']),
});

const QuoteSchema = z.object({
  price: z.object({
    currency: z.string(),
    value: z.string(),
  }),
});

const BillingSchema = z.object({
  name: z.string(),
  phone: z.string(),
  tax_number: z.string(),
});

const MessageSchema = z.object({
  order: z.object({
    items: z.array(
      z.object({
        id: z.string(),
      }),
    ),
    billing: BillingSchema,
    fulfillments: z.array(FulfillmentSchema),
    quote: QuoteSchema,
  }),
});

const OnStatusRequestSchema = z.object({
  context: OndcReqContextSchema,
  message: MessageSchema,
});

export type IOnStatusRequest = z.infer<typeof OnStatusRequestSchema>;
