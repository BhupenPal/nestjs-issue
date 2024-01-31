import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

const ConfirmOndcSchema = z.object({
  subscriberId: z.string(),
});
export class ConfirmOndc extends createZodDto(ConfirmOndcSchema) {}
