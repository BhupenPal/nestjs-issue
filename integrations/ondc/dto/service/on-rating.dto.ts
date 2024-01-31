import { z } from 'zod';
import { CreateReqContextSchema } from './create-req-context.dto';
import { OndcReqContextSchema } from '@integrations/ondc/types';

const OnRatingSchema = z.object({
  context: CreateReqContextSchema.omit({ action: true }),
  subscriber: z.object({
    id: z.string(),
    uniqueKeyId: z.string(),
    privateKey: z.string(),
  }),
});

export type IOnRating = z.infer<typeof OnRatingSchema>;

const MessageSchema = z.object({
  feedback_ack: z.boolean(),
  rating_ack: z.boolean(),
});

const OnRatingRequestSchema = z.object({
  context: OndcReqContextSchema,
  message: MessageSchema,
});

export type IOnRatingRequest = z.infer<typeof OnRatingRequestSchema>;
