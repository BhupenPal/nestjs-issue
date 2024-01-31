import { z } from 'zod';
import { CreateReqContextSchema } from './create-req-context.dto';
import { OndcReqContextSchema } from '@integrations/ondc/types';

const OnSupportSchema = z.object({
  context: CreateReqContextSchema.omit({ action: true }),
  subscriber: z.object({
    id: z.string(),
    uniqueKeyId: z.string(),
    privateKey: z.string(),
  }),
});

export type IOnSupport = z.infer<typeof OnSupportSchema>;

const MessageSchema = z.object({
  phone: z.string(),
  email: z.string().email(),
  uri: z.string().url(),
});

const OnSupportRequestSchema = z.object({
  context: OndcReqContextSchema,
  message: MessageSchema,
});

export type IOnSupportRequest = z.infer<typeof OnSupportRequestSchema>;
