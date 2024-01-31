import { z } from 'zod';

const SubscribeContextSchema = z.object({
  operation: z.object({
    ops_no: z.number(),
  }),
});

const KeyPairSchema = z.object({
  signing_public_key: z.string(),
  encryption_public_key: z.string(),
  valid_from: z.string(),
  valid_until: z.string(),
});

const PanSchema = z.object({
  name_as_per_pan: z.string(),
  pan_no: z.string(),
  date_of_incorporation: z.string(),
});

const GstSchema = z.object({
  legal_entity_name: z.string(),
  business_address: z.string(),
  city_code: z.array(z.string()),
  gst_no: z.string(),
});

export const EntitySchema = z.object({
  callback_url: z.string(),
  gst: GstSchema,
  pan: PanSchema,
  name_of_authorised_signatory: z.string(),
  address_of_authorised_signatory: z.string(),
  email_id: z.string(),
  mobile_no: z.number(),
  country: z.string(),
  subscriber_id: z.string(),
  unique_key_id: z.string(),
  key_pair: KeyPairSchema,
});

export const NetworkParticipantSchema = z.object({
  subscriber_url: z.string(),
  domain: z.string(),
  type: z.string(),
  msn: z.boolean(),
  city_code: z.array(z.string()),
});

export const SubscribeRequestSchema = z.object({
  context: SubscribeContextSchema,
  message: z.object({
    request_id: z.string(),
    timestamp: z.string(),
    entity: EntitySchema,
    network_participant: z.array(NetworkParticipantSchema),
  }),
});
