import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

const OnSubscribeHookSchema = z.object({
  challenge: z.string(),
  subscriber_id: z.string(),
});
export type IOnSubscribeHook = z.infer<typeof OnSubscribeHookSchema>;
export class OnSubscribeHook extends createZodDto(OnSubscribeHookSchema) {}
