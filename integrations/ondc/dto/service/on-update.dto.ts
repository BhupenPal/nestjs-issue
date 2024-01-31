import { z } from 'zod';
import { CreateReqContextSchema } from './create-req-context.dto';
import { OndcReqContextSchema } from '@integrations/ondc/types';

const OnUpdateSchema = z.object({
  context: CreateReqContextSchema.omit({ action: true }),
  subscriber: z.object({
    id: z.string(),
    uniqueKeyId: z.string(),
    privateKey: z.string(),
  }),
});

export type IOnUpdate = z.infer<typeof OnUpdateSchema>;

const LocationSchema = z.object({
  id: z.string(),
});

const ItemSchema = z.object({
  id: z.string(),
});

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

const ProviderSchema = z.object({
  id: z.string(),
  locations: z.array(LocationSchema),
});

const MessageSchema = z.object({
  order: z.object({
    id: z.string(),
    state: z.enum([
      'Created',
      'Packed',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'RTO initiated',
      'RTO delivered',
      'Cancelled',
    ]),
    provider: ProviderSchema,
    items: z.array(ItemSchema),
    billing: BillingSchema,
    fulfillments: z.array(FulfillmentSchema),
    quote: QuoteSchema,
  }),
});

const OnUpdateRequestSchema = z.object({
  context: OndcReqContextSchema,
  message: MessageSchema,
});

export type IOnUpdateRequest = z.infer<typeof OnUpdateRequestSchema>;
