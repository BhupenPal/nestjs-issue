import { z } from 'zod';
import { CreateReqContextSchema } from './create-req-context.dto';
import { OndcReqContextSchema } from '@integrations/ondc/types';

const OnInitSchema = z.object({
  context: CreateReqContextSchema.omit({ action: true }),
  subscriber: z.object({
    id: z.string(),
    uniqueKeyId: z.string(),
    privateKey: z.string(),
  }),
});

export type IOnInit = z.infer<typeof OnInitSchema>;

const MessageSchema = z.object({
  order: z.object({
    billing: z.object({
      name: z.string(),
      phone: z.string(),
      tax_number: z.string(),
    }),
    fulfillment: z.object({
      id: z.string(),
      type: z.enum(['Delivery', 'Pickup', 'Delivery and Pickup', 'Reverse QC']),
      tracking: z.boolean(),
    }),
    quote: z.object({
      price: z.object({
        currency: z.string(),
        value: z.string(),
      }),
    }),
  }),
});

const OnInitRequestSchema = z.object({
  context: OndcReqContextSchema,
  message: MessageSchema,
});

export type IOnInitRequest = z.infer<typeof OnInitRequestSchema>;
