import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

const RatingOndcSchema = z.object({
  subscriberId: z.string(),
});
export class RatingOndc extends createZodDto(RatingOndcSchema) {}
