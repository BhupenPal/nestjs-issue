import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

const CancelOndcSchema = z.object({
  subscriberId: z.string(),
  orderId: z.string(),
});
export class CancelOndc extends createZodDto(CancelOndcSchema) {}
