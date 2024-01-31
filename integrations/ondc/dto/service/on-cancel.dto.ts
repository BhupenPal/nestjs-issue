import { z } from 'zod';
import { CreateReqContextSchema } from './create-req-context.dto';
import { OndcReqContextSchema } from '@integrations/ondc/types';

const OnCancelSchema = z.object({
  context: CreateReqContextSchema.omit({ action: true }),
  subscriber: z.object({
    id: z.string(),
    uniqueKeyId: z.string(),
    privateKey: z.string(),
  }),
});

export type IOnCancel = z.infer<typeof OnCancelSchema>;

const LocationSchema = z.object({
  id: z.string(),
});

const ItemSchema = z.object({
  id: z.string(),
});

const BillingSchema = z.object({
  name: z.string(),
  phone: z.string(),
  tax_number: z.string(),
});

const PriceSchema = z.object({
  currency: z.string(),
  value: z.string(),
});

const ProviderSchema = z.object({
  id: z.string(),
  locations: z.array(LocationSchema).max(1), // Only one location is allowed
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
    quote: z.object({
      price: PriceSchema,
    }),
  }),
});

const OnCancelRequestSchema = z.object({
  context: OndcReqContextSchema,
  message: MessageSchema,
});

export type IOnCancelRequest = z.infer<typeof OnCancelRequestSchema>;
