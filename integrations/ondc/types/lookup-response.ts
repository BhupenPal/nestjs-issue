export type LookupResponse = {
  subscriber_id: string;
  ukId: string;
  br_id: string;
  country: string;
  city: `${string}:${string}`;
  domain: `${string}:${string}`;
  signing_public_key: string;
  encr_public_key: string;
  valid_from: string; // DATE STRING
  valid_until: string; // DATE STRING
  created: string; // DATE STRING
  updated: string; // DATE STRING
}[];
