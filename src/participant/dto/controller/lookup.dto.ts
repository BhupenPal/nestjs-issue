import { CITY_CODES } from '@integrations/ondc';
import { constructZodLiteralUnionType } from '@libs/utilities';
import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

const LookupSchema = z.object({
  subscriberId: z.string(),
  uniqueKeyId: z.string(),
  country: z.string(),
  city: constructZodLiteralUnionType(
    CITY_CODES.map((literal) => z.literal(literal)),
  ),
  domain: z.string(),
  type: z.enum(['BAP', 'BPP']),
});
export class LookupBody extends createZodDto(LookupSchema) {}
