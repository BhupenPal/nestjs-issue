import { z } from 'zod';
import { CreateReqContextSchema } from './create-req-context.dto';
import { OndcReqContextSchema } from '@integrations/ondc/types';

const OnConfirmSchema = z.object({
  context: CreateReqContextSchema.omit({ action: true }),
  subscriber: z.object({
    id: z.string(),
    uniqueKeyId: z.string(),
    privateKey: z.string(),
  }),
});

export type IOnConfirm = z.infer<typeof OnConfirmSchema>;

const MessageSchema = z.object({
  order: z.object({
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
    items: z.array(
      z.object({
        id: z.string(),
      }),
    ),
    billing: z.object({
      name: z.string(),
      phone: z.string(),
      tax_number: z.string(),
    }),
    fulfillments: z.array(
      z.object({
        id: z.string(),
        type: z.enum([
          'Delivery',
          'Pickup',
          'Delivery and Pickup',
          'Reverse QC',
        ]),
      }),
    ),
    quote: z.object({
      price: z.object({
        currency: z.string(),
        value: z.string(),
      }),
    }),
  }),
});

const OnConfirmRequestSchema = z.object({
  context: OndcReqContextSchema,
  message: MessageSchema,
});

export type IOnConfirmRequest = z.infer<typeof OnConfirmRequestSchema>;
