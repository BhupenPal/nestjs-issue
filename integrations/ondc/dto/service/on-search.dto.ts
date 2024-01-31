import { OndcReqContextSchema } from '@integrations/ondc/types/ondc-request-context';
import { z } from 'zod';

const bppDescriptorSchema = z.object({
  name: z.string(),
  code: z.string().optional(),
  symbol: z.string(),
  short_desc: z.string(),
  long_desc: z.string(),
  images: z.array(z.string()),
  audio: z.string().url().optional(),
  '3d_render': z.string().url().optional(),
});

const bppCategories = z.object({
  id: z.enum([
    'Grocery',
    'Packaged Commodities',
    'Package Foods',
    'Fruits and Vegetables',
    'F&B',
    'Home & Decor',
  ]),
  parent_category_id: z.enum(['Grocery', 'F&B', 'Home & Decor']),
  descriptor: bppDescriptorSchema.optional(),
  time: z.object({
    label: z.string(),
    timestamp: z.string(),
    duration: z.number(),
    range: z.object({
      start: z.string(),
      end: z.string(),
    }),
    days: z.string(),
    schedule: z.object({
      frequency: z.string(),
      holidays: z.array(z.string()),
      times: z.array(z.string()),
    }),
    tags: z.object({}),
  }),
});

const bppProviders = z.object({
  id: z.string(),
  descriptor: bppDescriptorSchema,
  category_id: z.string().optional(),
  '@ondc/org/fssai_license_no': z.string().optional(),
  rating: z.number().min(1).max(5),
  ttl: z.string(),
  exp: z.string().datetime(),
  rateable: z.boolean(),
  tags: z.array(z.string()),
});

const OnSearchRequestPayload = z.object({
  context: OndcReqContextSchema,
  message: z.object({
    catalog: z.object({
      'bpp/descriptor': bppDescriptorSchema,
      'bpp/categories': z.array(bppCategories).optional(),
      'bpp/providers': z.array(bppProviders),
      // 'bpp/fulfillments': z.object({}),
      // 'bpp/payments': z.object({}),
      // 'bpp/offers': z.object({}),
      exp: z.string().datetime(),
    }),
  }),
});

export type IOnSearchRequestPayload = z.infer<typeof OnSearchRequestPayload>;
