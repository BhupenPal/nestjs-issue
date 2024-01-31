import { z } from 'zod';
import { CreateReqContextSchema } from './create-req-context.dto';
import { OndcReqContextSchema } from '@integrations/ondc/types';

const OnSelectSchema = z.object({
  context: CreateReqContextSchema.omit({ action: true }),
  subscriber: z.object({
    id: z.string(),
    uniqueKeyId: z.string(),
    privateKey: z.string(),
  }),
});

export type IOnSelect = z.infer<typeof OnSelectSchema>;

const DescriptorSchema = z.object({
  name: z.string(),
  code: z.string(),
  symbol: z.string(),
  short_desc: z.string(),
  long_desc: z.string(),
  images: z.array(z.string()),
});

const PriceSchema = z.object({
  currency: z.string(),
  value: z.string(),
  estimated_value: z.string(),
  computed_value: z.string(),
  listed_value: z.string(),
  offered_value: z.string(),
  minimum_value: z.string(),
  maximum_value: z.string(),
});

const StatutoryReqsPackagedCommoditiesSchema = z.object({
  manufacturer_or_packer_name: z.string(),
  manufacturer_or_packer_address: z.string(),
  common_or_generic_name_of_commodity: z.string(),
  multiple_products_name_number_or_qty: z.string(),
  net_quantity_or_measure_of_commodity_in_pkg: z.string(),
  month_year_of_manufacture_packing_import: z.string(),
  imported_product_country_of_origin: z.string(),
});

const StatutoryReqsPrepackagedFoodSchema = z.object({
  ingredients_info: z.string(),
  nutritional_info: z.string(),
  additives_info: z.string(),
  manufacturer_or_packer_name: z.string(),
  manufacturer_or_packer_address: z.string(),
  brand_owner_name: z.string(),
  brand_owner_address: z.string(),
  brand_owner_FSSAI_logo: z.string(),
  brand_owner_FSSAI_license_no: z.string(),
  other_FSSAI_license_no: z.string(),
  net_quantity: z.string(),
  importer_name: z.string(),
  importer_address: z.string(),
  importer_FSSAI_logo: z.string(),
  importer_FSSAI_license_no: z.string(),
  imported_product_country_of_origin: z.string(),
  other_importer_name: z.string(),
  other_importer_address: z.string(),
  other_premises: z.string(),
  other_importer_country_of_origin: z.string(),
});

const MandatoryReqsVeggiesFruitsSchema = z.object({
  net_quantity: z.string(),
});

const ItemSchema = z.object({
  id: z.string(),
  parent_item_id: z.string(),
  descriptor: DescriptorSchema,
  price: PriceSchema,
  category_id: z.string(),
  fulfillment_id: z.string(),
  rating: z.number(),
  location_id: z.string(),
  rateable: z.boolean(),
  matched: z.boolean(),
  related: z.boolean(),
  recommended: z.boolean(),
  '@ondc/org/returnable': z.boolean(),
  '@ondc/org/seller_pickup_return': z.boolean(),
  '@ondc/org/return_window': z.string(),
  '@ondc/org/cancellable': z.boolean(),
  '@ondc/org/time_to_ship': z.string(),
  '@ondc/org/available_on_cod': z.boolean(),
  '@ondc/org/contact_details_consumer_care': z.string(),
  '@ondc/org/statutory_reqs_packaged_commodities':
    StatutoryReqsPackagedCommoditiesSchema,
  '@ondc/org/statutory_reqs_prepackaged_food':
    StatutoryReqsPrepackagedFoodSchema,
  '@ondc/org/mandatory_reqs_veggies_fruits': MandatoryReqsVeggiesFruitsSchema,
});

const ProviderSchema = z.object({
  id: z.string(),
  descriptor: DescriptorSchema,
  category_id: z.string(),
  '@ondc/org/fssai_license_no': z.string(),
  rating: z.number(),
  ttl: z.string(),
});

const QuotePriceSchema = z.object({
  currency: z.string(),
  value: z.string(),
});

const QuoteSchema = z.object({
  price: QuotePriceSchema,
});

const OrderSchema = z.object({
  provider: ProviderSchema,
  items: z.array(ItemSchema),
  quote: QuoteSchema,
});

const MessageSchema = z.object({
  order: OrderSchema,
});

const OnSelectRequestSchema = z.object({
  context: OndcReqContextSchema,
  message: MessageSchema,
});

export type IOnSelectRequest = z.infer<typeof OnSelectRequestSchema>;
