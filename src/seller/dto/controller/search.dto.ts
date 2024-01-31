import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

const SearchOndcSchema = z.object({
  searchQuery: z.string(),
  subscriberId: z.string(),
});
export class SearchOndc extends createZodDto(SearchOndcSchema) {}
