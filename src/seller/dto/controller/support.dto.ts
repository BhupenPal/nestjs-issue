import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

const supportOndcSchema = z.object({
  subscriberId: z.string(),
});
export class SupportOndc extends createZodDto(supportOndcSchema) {}
