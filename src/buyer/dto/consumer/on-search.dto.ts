import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

const OnSearchSchema = z.object({
  requestPayload: z.object({}),
  subscriberId: z.string(),
});
export class OnSearchPayload extends createZodDto(OnSearchSchema) {}
