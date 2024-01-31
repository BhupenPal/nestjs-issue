import { ONDC_SUBSCRIPTION_APP_TYPES } from '@integrations/ondc';
import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

const GstSchema = z.object({
  legalEntityName: z.string(),
  businessAddress: z.string(),
  cityCode: z.array(z.string()),
  gstNo: z.string(),
});

const PanSchema = z.object({
  nameAsPerPan: z.string(),
  panNo: z.string(),
  dateOfIncorporation: z.string(),
});

const EntitySchema = z.object({
  country: z.string(),
  gst: GstSchema,
  pan: PanSchema,
  nameOfAuthorisedSignatory: z.string(),
  addressOfAuthorisedSignatory: z.string(),
  emailId: z.string().email(),
  mobileNo: z.number(),
  subscriberId: z.string(),
});

const SubscribeOndcSchema = z.object({
  registerFor: z.nativeEnum(ONDC_SUBSCRIPTION_APP_TYPES),
  entity: EntitySchema,
});
export class SubscribeBody extends createZodDto(SubscribeOndcSchema) {}
