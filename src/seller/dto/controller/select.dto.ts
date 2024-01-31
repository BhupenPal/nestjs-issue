import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

const SelectOndcSchema = z.object({
  subscriberId: z.string(),
});
export class SelectOndc extends createZodDto(SelectOndcSchema) {}
