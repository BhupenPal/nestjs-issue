import { z } from 'zod';
import { CreateReqContextSchema } from './create-req-context.dto';
import { OndcReqContextSchema } from '@integrations/ondc/types';

const OnTrackSchema = z.object({
  context: CreateReqContextSchema.omit({ action: true }),
  subscriber: z.object({
    id: z.string(),
    uniqueKeyId: z.string(),
    privateKey: z.string(),
  }),
});

export type IOnTrack = z.infer<typeof OnTrackSchema>;

const MessageSchema = z.object({
  tracking: z.object({
    url: z.string().url(),
    status: z.enum(['active', 'inactive']),
  }),
});

const OnTrackRequestSchema = z.object({
  context: OndcReqContextSchema,
  message: MessageSchema,
});

export type IOnTrackRequest = z.infer<typeof OnTrackRequestSchema>;
