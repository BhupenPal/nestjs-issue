import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

const UpdateOndcSchema = z.object({
  subscriberId: z.string(),
  orderId: z.string(),
});
export class UpdateOndc extends createZodDto(UpdateOndcSchema) {}
