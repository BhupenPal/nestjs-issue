import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

const InitOndcSchema = z.object({
  subscriberId: z.string(),
});
export class InitOndc extends createZodDto(InitOndcSchema) {}
