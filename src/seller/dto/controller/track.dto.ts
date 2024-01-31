import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

const TrackOndcSchema = z.object({
  subscriberId: z.string(),
  orderId: z.string(),
});
export class TrackOndc extends createZodDto(TrackOndcSchema) {}
