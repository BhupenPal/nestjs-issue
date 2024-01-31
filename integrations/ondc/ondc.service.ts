import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { EnvService } from '@libs/environment';
import axios from 'axios';
import crypto from 'crypto';
import { Types } from 'mongoose';
import {
  CITY_CODES,
  IOndcSubscriptionApp,
  PROTOCOL_VERSION,
} from './constants';
import { OndcUtilService } from './ondc-util.service';
import { LookupResponse } from './types';
import { OndcRequestContext } from './types/ondc-request-context';
import { IOnSearchRequestPayload } from './dto/service/on-search.dto';
import { CreateReqContext } from './dto/service/create-req-context.dto';
import { IOnSelect, IOnSelectRequest } from './dto/service/on-select.dto';
import { IOnInit, IOnInitRequest } from './dto/service/on-init.dto';
import { IOnConfirm, IOnConfirmRequest } from './dto/service/on-confirm.dto';
import { IOnTrack, IOnTrackRequest } from './dto/service/on-track.dto';
import { IOnSupport, IOnSupportRequest } from './dto/service/on-support.dto';
import { IOnRating, IOnRatingRequest } from './dto/service/on-rating.dto';
import { IOnCancel, IOnCancelRequest } from './dto/service/on-cancel.dto';
import { IOnUpdate, IOnUpdateRequest } from './dto/service/on-update.dto';
import { IOnStatus, IOnStatusRequest } from './dto/service/on-status.dto';

@Injectable()
export class OndcService {
  private readonly ONDC_REGISTRY_URL: string;
  private readonly ONDC_GATEWAY_URL = 'https://staging.gateway.proteantech.in';

  constructor(
    private readonly envService: EnvService,
    private readonly httpService: HttpService,
    private readonly ondcUtilService: OndcUtilService,
  ) {
    this.ONDC_REGISTRY_URL = this.envService.get('ONDC_REGISTRY_URL');
  }

  private createOndcRequestContext({
    action,
    bapId,
    bapUri,
    bppId,
    bppUri,
    city,
    country,
    domain,
  }: CreateReqContext): OndcRequestContext {
    return {
      action,
      domain,
      country,
      city,
      bap_id: bapId,
      bap_uri: bapUri,
      ...(bppId && { bpp_id: bppId }),
      ...(bppUri && { bpp_uri: bppUri }),
      core_version: PROTOCOL_VERSION,
      transaction_id: new Types.ObjectId().toString(),
      message_id: new Types.ObjectId().toString(),
      timestamp: new Date().toISOString(),
      ttl: 'PT30S',
    };
  }

  generateRequestId({ privateKey }: { privateKey: string }) {
    return this.ondcUtilService.generateRequestId({ privateKey });
  }

  generateSigningAndEncryptionKeyPairs() {
    return this.ondcUtilService.generateSigningAndEncryptionKeyPairs();
  }

  async solveWebhookChallenge({
    challenge,
    privateKey,
    ondcRegistryPublicKey,
  }: {
    challenge: string;
    privateKey: string;
    ondcRegistryPublicKey: string;
  }) {
    const cryptoPrivateKey = crypto.createPrivateKey({
      key: Buffer.from(privateKey, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });

    const cryptoPublicKey = crypto.createPublicKey({
      key: Buffer.from(ondcRegistryPublicKey, 'base64'),
      format: 'der',
      type: 'spki',
    });

    const sharedKey = crypto.diffieHellman({
      privateKey: cryptoPrivateKey,
      publicKey: cryptoPublicKey,
    });

    const iv = Buffer.alloc(0); // ECB doesn't use IV
    const decipher = crypto.createDecipheriv('aes-256-ecb', sharedKey, iv);
    let decrypted = decipher.update(challenge, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  async subscribe({
    registerFor,
    requestId,
    entity,
    uniqueKeyId,
    keyPairs,
  }: {
    registerFor: IOndcSubscriptionApp;
    requestId: string;
    entity: {
      gst: {
        legalEntityName: string;
        businessAddress: string;
        cityCode: string[];
        gstNo: string;
      };
      pan: {
        nameAsPerPan: string;
        panNo: string;
        dateOfIncorporation: string;
      };
      nameOfAuthorisedSignatory: string;
      addressOfAuthorisedSignatory: string;
      emailId: string;
      mobileNo: number;
      country: string;
      subscriberId: string;
    };
    uniqueKeyId: string;
    keyPairs: {
      signingPublicKey: string;
      signingPrivateKey: string;
      encryptionPublicKey: string;
      encryptionPrivateKey: string;
    };
  }) {
    let subscribeContext: { operation: { ops_no: number } };
    const networkParticipants = [];

    /**
     * ops_no: 1 - Buyer App Only
     * ops_no: 2 - Seller App Only
     * ops_no: 4 - Buyer and Seller App
     *
     * @deprecated
     * ops_no: 3 - MSN Seller App Registration
     * ops_no: 5 - Buyer & MSN Seller App Registration
     */
    switch (registerFor) {
      case 'BUYER_APP': {
        subscribeContext = {
          operation: {
            ops_no: 1,
          },
        };

        networkParticipants.push({
          subscriber_url: '/bapl',
          domain: 'nic2004:52110',
          type: 'buyerApp',
          msn: false,
          city_code: ['std:080'],
        });

        break;
      }

      case 'SELLER_APP': {
        subscribeContext = {
          operation: {
            ops_no: 2,
          },
        };

        networkParticipants.push({
          subscriber_url: '/bapl',
          domain: 'nic2004:52110',
          type: 'sellerApp',
          msn: false,
          city_code: ['std:080'],
        });

        break;
      }

      case 'BUYER_AND_SELLER_APP': {
        subscribeContext = {
          operation: {
            ops_no: 4,
          },
        };

        networkParticipants.push(
          {
            subscriber_url: '/buyerAppl',
            domain: 'nic2004:52110',
            type: 'buyerApp',
            msn: false,
            city_code: ['std:080'],
          },
          {
            subscriber_url: '/sellerAppl',
            domain: 'nic2004:52110',
            type: 'sellerApp',
            msn: false,
            city_code: ['std:080'],
          },
        );

        break;
      }
    }

    const subscribeRequest = {
      context: subscribeContext,
      message: {
        request_id: requestId,
        timestamp: new Date().toISOString(),
        entity: {
          callback_url: '/participants/hook' as const,
          gst: {
            legal_entity_name: entity.gst.legalEntityName,
            business_address: entity.gst.businessAddress,
            city_code: entity.gst.cityCode,
            gst_no: entity.gst.gstNo,
          },
          pan: {
            name_as_per_pan: entity.pan.nameAsPerPan,
            pan_no: entity.pan.panNo,
            date_of_incorporation: entity.pan.dateOfIncorporation,
          },
          name_of_authorised_signatory: entity.nameOfAuthorisedSignatory,
          address_of_authorised_signatory: entity.addressOfAuthorisedSignatory,
          email_id: entity.emailId,
          mobile_no: entity.mobileNo,
          country: entity.country,
          subscriber_id: entity.subscriberId,
          unique_key_id: uniqueKeyId,
          key_pair: {
            signing_public_key: keyPairs.signingPublicKey,
            encryption_public_key: keyPairs.encryptionPublicKey,
            valid_from: new Date().toISOString(),
            valid_until: new Date(
              new Date().getTime() + 1 * 60000,
            ).toISOString(),
          },
        },
        network_participant: networkParticipants,
      },
    };

    try {
      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_REGISTRY_URL}/subscribe`,
        subscribeRequest,
      );

      return {
        subscribeRequest,
        response,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.log('Error subscribing to registry: ', error.message);
      }

      return false;
    }
  }

  async registryLookup({
    subscriberId,
    uniqueKeyId,
    country,
    city,
    domain,
    type,
  }: {
    subscriberId: string;
    uniqueKeyId: string;
    country: string;
    city: (typeof CITY_CODES)[number];
    domain: string;
    type: 'BPP' | 'BAP' | 'BG';
  }) {
    try {
      const response = await this.httpService.axiosRef.post<LookupResponse>(
        `${this.ONDC_REGISTRY_URL}/lookup`,
        {
          subscriber_id: subscriberId,
          ukId: uniqueKeyId,
          country,
          city,
          domain,
          type,
        },
      );

      const matchedProvider = response.data.find(
        (provider) => provider.ukId === uniqueKeyId.toString(),
      );

      if (!matchedProvider || !matchedProvider.signing_public_key) {
        return false;
      }

      return matchedProvider;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.log('Error looking up provider in registry: ', error.message);
      }

      return false;
    }
  }

  async searchEntities({
    searchQuery,
    providerId,
    providerName,
    categoryId,
    categoryName,
    pickupLocation,
    deliveryLocation,
    buyerAppFinderFeeAmount,
    buyerAppFinderFeeType,
    subscriberId,
    subscriberUniqueKeyId,
    subscriberPrivateKey,
  }: {
    searchQuery: string;
    providerId: string;
    providerName: string;
    categoryId: string;
    categoryName: string;
    pickupLocation?: string;
    deliveryLocation?: string;
    buyerAppFinderFeeAmount?: string;
    buyerAppFinderFeeType?: string;
    subscriberId: string;
    subscriberUniqueKeyId: string;
    subscriberPrivateKey: string;
  }) {
    const requestContext = this.createOndcRequestContext({
      action: 'search',
      domain: 'nic2004:52110',
      country: 'IND',
      city: 'std:080',
      bapId: subscriberId,
      bapUri: '/bapl',
    });

    const searchRequest = {
      context: requestContext,
      message: {
        intent: {
          ...(searchQuery && {
            descriptor: {
              name: searchQuery,
            },
          }),
          ...((providerId || categoryId || providerName) && {
            provider: {
              ...(providerId && {
                id: providerId,
              }),
              ...(categoryId && {
                category_id: categoryId,
              }),
              ...(providerName && {
                descriptor: {
                  name: providerName,
                },
              }),
            },
          }),
          ...(pickupLocation || deliveryLocation
            ? {
                fulfillment: {
                  type: 'Delivery',
                  ...(pickupLocation && {
                    start: {
                      location: {
                        gps: pickupLocation,
                      },
                    },
                  }),
                  ...(deliveryLocation && {
                    end: {
                      location: {
                        gps: deliveryLocation,
                      },
                    },
                  }),
                },
              }
            : {
                fulfillment: {
                  type: 'Delivery',
                },
              }),
          ...((categoryId || categoryName) && {
            category: {
              ...(categoryId && {
                id: categoryId,
              }),
              ...(categoryName && {
                descriptor: {
                  name: categoryName,
                },
              }),
            },
          }),
          payment: {
            '@ondc/org/buyer_app_finder_fee_type': buyerAppFinderFeeType,
            '@ondc/org/buyer_app_finder_fee_amount': buyerAppFinderFeeAmount,
          },
        },
      },
    };

    try {
      const authHeaders = await this.ondcUtilService.createAuthorizationHeader({
        message: searchRequest,
        subscriberId,
        subscriberUniqueKeyId,
        privateKey: subscriberPrivateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/search`,
        searchRequest,
        {
          headers: {
            accept: 'application/json',
            authorization: authHeaders,
          },
        },
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.log(error.response);
      }

      return {
        success: false,
      };
    }
  }

  async selectEntities({
    order,
    subscriberId,
    subscriberUniqueKeyId,
    subscriberPrivateKey,
  }: {
    order: {
      providerId: string;
      locationId: string;
      items: any[]; // @BhupenPal: Figure out types
      fulfillments: any[]; // @BhupenPal: Figure out types
    };
    subscriberId: string;
    subscriberUniqueKeyId: string;
    subscriberPrivateKey: string;
  }) {
    const requestContext = this.createOndcRequestContext({
      action: 'select',
      domain: 'nic2004:52110',
      country: 'IND',
      city: 'std:080',
      bapId: subscriberId,
      bapUri: '/bapl',
    });

    const { providerId, locationId, items = [], fulfillments = [] } = order;

    const selectRequest = {
      context: requestContext,
      message: {
        order: {
          items: items.map((item) => ({
            id: String(item.id),
            quantity: item.quantity,
            location_id: locationId,
          })),
          provider: {
            id: providerId,
            locations: [{ id: locationId }],
          },
          fulfillments,
        },
      },
    };

    try {
      const authHeaders = await this.ondcUtilService.createAuthorizationHeader({
        message: selectRequest,
        subscriberId,
        subscriberUniqueKeyId,
        privateKey: subscriberPrivateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_REGISTRY_URL}/select`,
        selectRequest,
        {
          headers: {
            accept: 'application/json',
            authorization: authHeaders,
          },
        },
      );

      return {
        requestContext,
        selectRequest,
        response,
      };
    } catch (error) {
      console.log(error);
      return {
        // context,
        // searchRequest,
      };
    }
  }

  async init({
    providerId,
    locationId,
    items = [],
    fulfillments = [],
    subscriberId,
    subscriberUniqueKeyId,
    subscriberPrivateKey,
  }: {
    providerId: string;
    locationId: string;
    items: any[]; // @BhupenPal: Figure out types
    fulfillments: any[]; // @BhupenPal: Figure out types
    subscriberId: string;
    subscriberUniqueKeyId: string;
    subscriberPrivateKey: string;
  }) {
    const requestContext = this.createOndcRequestContext({
      action: 'init',
      domain: 'nic2004:52110',
      country: 'IND',
      city: 'std:080',
      bapId: subscriberId,
      bapUri: '/bapl',
    });

    const initRequest = {
      requestContext,
      message: {
        order: {
          items: items.map((item) => ({
            id: String(item.id),
            quantity: item.quantity,
            location_id: locationId,
          })),
          provider: {
            id: providerId,
            locations: [{ id: locationId }],
          },
          fulfillments,
        },
      },
    };

    try {
      const authHeader = await this.ondcUtilService.createAuthorizationHeader({
        message: initRequest,
        subscriberId,
        subscriberUniqueKeyId,
        privateKey: subscriberPrivateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/init`,
        initRequest,
        {
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        },
      );

      return {
        requestContext,
        initRequest,
        response,
      };
    } catch (error) {
      console.log(error);
      return {
        requestContext,
        initRequest,
      };
    }
  }

  async confirm({
    subscriberId,
    subscriberUniqueKeyId,
    subscriberPrivateKey,
  }: {
    subscriberId: string;
    subscriberUniqueKeyId: string;
    subscriberPrivateKey: string;
  }) {
    const requestContext = this.createOndcRequestContext({
      action: 'confirm',
      domain: 'nic2004:52110',
      country: 'IND',
      city: 'std:080',
      bapId: subscriberId,
      bapUri: '/bapl',
    });

    const confirmRequest = {
      context: requestContext,
      message: {
        order: {
          id: 'string',
          state: 'string',
          provider: {
            id: 'string',
            locations: [
              {
                id: 'string',
              },
            ],
          },
          items: [
            {
              id: 'string',
              quantity: {
                count: 0,
                measure: {
                  type: 'CONSTANT',
                  value: 0,
                  estimated_value: 0,
                  computed_value: 0,
                  range: {
                    min: 0,
                    max: 0,
                  },
                  unit: 'string',
                },
              },
            },
          ],
          add_ons: [
            {
              id: 'string',
            },
          ],
          offers: [
            {
              id: 'string',
            },
          ],
          documents: [
            {
              url: 'string',
              label: 'string',
            },
          ],
          billing: {
            name: 'string',
            organization: {
              name: 'string',
              cred: 'string',
            },
            address: {
              door: 'string',
              name: 'string',
              building: 'string',
              street: 'string',
              locality: 'string',
              ward: 'string',
              city: 'string',
              state: 'string',
              country: 'string',
              area_code: 'string',
            },
            email: 'user@example.com',
            phone: 'string',
            time: {
              label: 'string',
              timestamp: '2024-01-11T11:50:43.544Z',
              duration: 'string',
              range: {
                start: '2024-01-11T11:50:43.544Z',
                end: '2024-01-11T11:50:43.544Z',
              },
              days: 'string',
              schedule: {
                frequency: 'string',
                holidays: ['2024-01-11T11:50:43.544Z'],
                times: ['2024-01-11T11:50:43.544Z'],
              },
            },
            tax_number: 'string',
            created_at: '2024-01-11T11:50:43.544Z',
            updated_at: '2024-01-11T11:50:43.544Z',
          },
          fulfillment: {
            id: 'string',
            type: 'string',
            provider_id: 'string',
            rating: 0,
            state: {
              descriptor: {
                name: 'string',
                code: 'string',
                symbol: 'string',
                short_desc: 'string',
                long_desc: 'string',
                images: ['string'],
                audio: 'string',
                '3d_render': 'string',
              },
              updated_at: '2024-01-11T11:50:43.544Z',
              updated_by: 'string',
            },
            tracking: false,
            customer: {
              person: {
                name: "./U`U7w:#.VUNF\\R~}I:5'7Ps/iQ_lk!N9edmKkIx^WGcxh<C^AA~ZZap\\JFIkA5yh\\0m'R%Ci,T0LbZHwVJTM/s63v8?fO[l]o^;o4B[<p{,d=+8}]jA?gvs[Z!*gKt72hPQPLC!|E$hkKGc77!}Ik{~Gp'y^&_YForva(&Id;Fr3ER\"eK_l5@?4PJ/mj^7XOg\\`])4,u#\\iH\"s)nZ]:l7scJttLgo{AhjkKX/,khrqtoo|YVl&(d]5)4]<a2N\\HGEKNiz?{..{zamu,1@o@j5/c'XmqD.n>pQM2s<(%oL7*{NQ!LNiXxiAjR.BHSJ#LZD6w1'ZSyF(miR\"=GN33+#\\h9MK4]?uvjc$FlIf ,4Q",
                image: 'string',
                dob: '2024-01-11',
                gender: 'string',
                cred: 'string',
                tags: {
                  additionalProp1: 'string',
                  additionalProp2: 'string',
                  additionalProp3: 'string',
                },
              },
              contact: {
                phone: 'string',
                email: 'string',
                tags: {
                  additionalProp1: 'string',
                  additionalProp2: 'string',
                  additionalProp3: 'string',
                },
              },
            },
            agent: {
              name: './U+k.lDrQ@{C\'%Nr{t%~RP9WQ{|s6q&P!hyV`d3HGtbAt:v-.k_e:T&}y=I}[]<zoUi~=yg^1Xw/-jp@JEJ510w,/L#u:~v2M_\\iOwcLZtkx\\nkA.:|&jr%m^NA.tkMu=,T#xnP:ySvi,x%WhrG}r*_(HXbHGvNaF_Vb5o#%~I9D8yL/#-?s>D?!Jr>Q$KlvdHek|Y&7\\Xe<`b P-wC$qHPgw`ZOz(EJol"Nv:z!>QQSrxo{8LymR%<0E?VC;P\\i]!Jd7c7<9*Hv05]"wo]r/)+kzP {>yQMPHEf:ToQvO4(x(/AwS,|S.QX.QuhHRCZwX:M3KtV{0<9?GE98)s7s!zx*5qOEXaLyQZ9faj.c98V+!- ZJPd[T2.I6Gr,P\\=N~r* Jnclh<a5?&9Iv4',
              image: 'string',
              dob: '2024-01-11',
              gender: 'string',
              cred: 'string',
              tags: {
                additionalProp1: 'string',
                additionalProp2: 'string',
                additionalProp3: 'string',
              },
              phone: 'string',
              email: 'string',
              rateable: true,
            },
            person: {
              name: "./$Z<hJ=jH,l4+?T3EXH+tbA[!ig3+/3*/UlDX'37)c<jkLgsqgj,>/\"0@T/H@.w~Y<u#U;bd~)1ZWz9v)&UP[,.$E#'Pp`o}t=kEgH@)O6?qY[ng@3~~yL<!|HRV B9\\C&t<-`o5/v,f{hor-9MVbXV&t2YyO0C^U%e7zZFD-bo\\#xc[qS-p6OcWG:h.5ze(!\\d^#?#RBp|a_g6b%D5]lb76AR{G8Y",
              image: 'string',
              dob: '2024-01-11',
              gender: 'string',
              cred: 'string',
              tags: {
                additionalProp1: 'string',
                additionalProp2: 'string',
                additionalProp3: 'string',
              },
            },
            contact: {
              phone: 'string',
              email: 'string',
              tags: {
                additionalProp1: 'string',
                additionalProp2: 'string',
                additionalProp3: 'string',
              },
            },
            vehicle: {
              category: 'string',
              capacity: 0,
              make: 'string',
              model: 'string',
              size: 'string',
              variant: 'string',
              color: 'string',
              energy_type: 'string',
              registration: 'string',
            },
            start: {
              location: {
                id: 'string',
                descriptor: {
                  name: 'string',
                  code: 'string',
                  symbol: 'string',
                  short_desc: 'string',
                  long_desc: 'string',
                  images: ['string'],
                  audio: 'string',
                  '3d_render': 'string',
                },
                gps: '90,                 4.2213744',
                address: {
                  door: 'string',
                  name: 'string',
                  building: 'string',
                  street: 'string',
                  locality: 'string',
                  ward: 'string',
                  city: 'string',
                  state: 'string',
                  country: 'string',
                  area_code: 'string',
                },
                station_code: 'string',
                city: {
                  name: 'string',
                  code: 'string',
                },
                country: {
                  name: 'string',
                  code: 'string',
                },
                circle: {
                  gps: '7,                                                      180.0000000000000000000000000000000000',
                  radius: {
                    type: 'CONSTANT',
                    value: 0,
                    estimated_value: 0,
                    computed_value: 0,
                    range: {
                      min: 0,
                      max: 0,
                    },
                    unit: 'string',
                  },
                },
                polygon: 'string',
                '3dspace': 'string',
                time: {
                  label: 'string',
                  timestamp: '2024-01-11T11:50:43.545Z',
                  duration: 'string',
                  range: {
                    start: '2024-01-11T11:50:43.545Z',
                    end: '2024-01-11T11:50:43.545Z',
                  },
                  days: 'string',
                  schedule: {
                    frequency: 'string',
                    holidays: ['2024-01-11T11:50:43.545Z'],
                    times: ['2024-01-11T11:50:43.545Z'],
                  },
                },
              },
              time: {
                label: 'string',
                timestamp: '2024-01-11T11:50:43.545Z',
                duration: 'string',
                range: {
                  start: '2024-01-11T11:50:43.545Z',
                  end: '2024-01-11T11:50:43.545Z',
                },
                days: 'string',
                schedule: {
                  frequency: 'string',
                  holidays: ['2024-01-11T11:50:43.545Z'],
                  times: ['2024-01-11T11:50:43.545Z'],
                },
              },
              instructions: {
                name: 'string',
                code: 'string',
                symbol: 'string',
                short_desc: 'string',
                long_desc: 'string',
                images: ['string'],
                audio: 'string',
                '3d_render': 'string',
              },
              contact: {
                phone: 'string',
                email: 'string',
                tags: {
                  additionalProp1: 'string',
                  additionalProp2: 'string',
                  additionalProp3: 'string',
                },
              },
              person: {
                name: "./ab'Vz|!n%c9ZQ^.vX=(PxG~j*$\\&xv-A@r?@lW^=mNq6HSb=-Nj9ah)g.vxLAqY|ya+kE^8]U{IY/<h}nZ!oHBg#4$q?oD3Fg,n?&!f>z0Qkz\\A>3+j|@]ZaI=~H8]9>5n-OEl6\"i08r[+W(pd$/_K\"&H4TWL8v#9/[SNBUnVkID9b\\10v#cX-F(wsEr(KI0u[khX7V:J'zmZT< 1L'R-H%:ktJoy6-`^D;>Olh!6{|$HpS$^Pm/~W+|0[~>#IQJmX-Y,gb((7eYQ;/9OiABMDMY*[I!gDeI5L[ @\\m!`:OrU(XF>}duv <4$0?8M0.(C|?^0_L{c)J8",
                image: 'string',
                dob: '2024-01-11',
                gender: 'string',
                cred: 'string',
                tags: {
                  additionalProp1: 'string',
                  additionalProp2: 'string',
                  additionalProp3: 'string',
                },
              },
              authorization: {
                type: 'string',
                token: 'string',
                valid_from: '2024-01-11T11:50:43.545Z',
                valid_to: '2024-01-11T11:50:43.545Z',
                status: 'string',
              },
            },
            end: {
              location: {
                id: 'string',
                descriptor: {
                  name: 'string',
                  code: 'string',
                  symbol: 'string',
                  short_desc: 'string',
                  long_desc: 'string',
                  images: ['string'],
                  audio: 'string',
                  '3d_render': 'string',
                },
                gps: '+11,                                                                                   122',
                address: {
                  door: 'string',
                  name: 'string',
                  building: 'string',
                  street: 'string',
                  locality: 'string',
                  ward: 'string',
                  city: 'string',
                  state: 'string',
                  country: 'string',
                  area_code: 'string',
                },
                station_code: 'string',
                city: {
                  name: 'string',
                  code: 'string',
                },
                country: {
                  name: 'string',
                  code: 'string',
                },
                circle: {
                  gps: '+90,                 145',
                  radius: {
                    type: 'CONSTANT',
                    value: 0,
                    estimated_value: 0,
                    computed_value: 0,
                    range: {
                      min: 0,
                      max: 0,
                    },
                    unit: 'string',
                  },
                },
                polygon: 'string',
                '3dspace': 'string',
                time: {
                  label: 'string',
                  timestamp: '2024-01-11T11:50:43.546Z',
                  duration: 'string',
                  range: {
                    start: '2024-01-11T11:50:43.546Z',
                    end: '2024-01-11T11:50:43.546Z',
                  },
                  days: 'string',
                  schedule: {
                    frequency: 'string',
                    holidays: ['2024-01-11T11:50:43.546Z'],
                    times: ['2024-01-11T11:50:43.546Z'],
                  },
                },
              },
              time: {
                label: 'string',
                timestamp: '2024-01-11T11:50:43.546Z',
                duration: 'string',
                range: {
                  start: '2024-01-11T11:50:43.546Z',
                  end: '2024-01-11T11:50:43.546Z',
                },
                days: 'string',
                schedule: {
                  frequency: 'string',
                  holidays: ['2024-01-11T11:50:43.546Z'],
                  times: ['2024-01-11T11:50:43.546Z'],
                },
              },
              instructions: {
                name: 'string',
                code: 'string',
                symbol: 'string',
                short_desc: 'string',
                long_desc: 'string',
                images: ['string'],
                audio: 'string',
                '3d_render': 'string',
              },
              contact: {
                phone: 'string',
                email: 'string',
                tags: {
                  additionalProp1: 'string',
                  additionalProp2: 'string',
                  additionalProp3: 'string',
                },
              },
              person: {
                name: './CO)5Api:,hK.pK|:U^F6>A%)OeN!\\@f0dohTJ*KlnQ<Gz7:3bkj\'1Ui;)AbB/64{b9)-aXvQ>"5HtLBnz1^K-bR5l"hXEG|yb8JYmD#c}G]q.!|a-^8SB8+\\}tl~lZh[oU<c^f#VQ#APgjz">|A- >OyCaf/e%6L5V3p<%dlGf 0QMnGgg,t>$`B^<FYu<4JaG5azZOG^]Z</^V>\\.#qAv5r"6?,^-1FWx @Ack,#\\,jar*\\uax*pv@.|8n]H /hc/1X}_t1H<-gtcC}xva5^ou7M5^6oZeq4e^%Yg',
                image: 'string',
                dob: '2024-01-11',
                gender: 'string',
                cred: 'string',
                tags: {
                  additionalProp1: 'string',
                  additionalProp2: 'string',
                  additionalProp3: 'string',
                },
              },
              authorization: {
                type: 'string',
                token: 'string',
                valid_from: '2024-01-11T11:50:43.546Z',
                valid_to: '2024-01-11T11:50:43.546Z',
                status: 'string',
              },
            },
            rateable: true,
            tags: {
              additionalProp1: 'string',
              additionalProp2: 'string',
              additionalProp3: 'string',
            },
          },
          quote: {
            price: {
              currency: 'string',
              value: '3550597',
              estimated_value:
                '567521222154113855190467284570903784416897141226557640849483632608990588559058459698958919062382.083769048',
              computed_value: '-182455066460098305063719464509469915672198572',
              listed_value:
                '864961823274672338104450702761130957754171312810945749684994760482237814366636255839145.8527391115607208356096710794494978428054012200897347386369911410454909',
              offered_value:
                '99031726223948263943249046.89106132230130397290477162154835148192',
              minimum_value:
                '-241850180054465027488033128282575036185425032946146608908780885544',
              maximum_value:
                '+63583889800625277142129138197407366527835175722067101706787752050813934459448000103807.2712854507187318562418496198783192428448065207903187627032054560736866699834067925010413',
            },
            breakup: [
              {
                title: 'string',
                price: {
                  currency: 'string',
                  value: '445344858899575299663197021278612',
                  estimated_value:
                    '61630685382263030975961602109708079009408977619649',
                  computed_value:
                    '-5024656204616462019176803126.6124658280297658346293299242810416550014915219180883699286243700007771205596304913187029341',
                  listed_value: '1468891993425235718870917906293',
                  offered_value:
                    '4958654532320551205206654205.511782502170198684942171470461040406247335',
                  minimum_value:
                    '02289007641040816797720350956688719509067237426087718505811770680961036115186990691',
                  maximum_value: '47837865306922089927833442484616',
                },
              },
            ],
            ttl: 'string',
          },
          payment: {
            uri: 'string',
            tl_method: 'http/get',
            params: {
              transaction_id: 'string',
              transaction_status: 'string',
              amount:
                '-44720709303899796807907003066170695183707353482646724307818767262725025188076130344025392783.29564583784467544613584512046917049220384561894602846491600655',
              currency: 'string',
              additionalProp1: 'string',
              additionalProp2: 'string',
              additionalProp3: 'string',
            },
            type: 'ON-ORDER',
            status: 'PAID',
            time: {
              label: 'string',
              timestamp: '2024-01-11T11:50:43.546Z',
              duration: 'string',
              range: {
                start: '2024-01-11T11:50:43.546Z',
                end: '2024-01-11T11:50:43.546Z',
              },
              days: 'string',
              schedule: {
                frequency: 'string',
                holidays: ['2024-01-11T11:50:43.546Z'],
                times: ['2024-01-11T11:50:43.546Z'],
              },
            },
            collected_by: 'BAP',
          },
          created_at: '2024-01-11T11:50:43.546Z',
          updated_at: '2024-01-11T11:50:43.546Z',
        },
      },
    };

    try {
      const authHeader = await this.ondcUtilService.createAuthorizationHeader({
        message: confirmRequest,
        subscriberId,
        subscriberUniqueKeyId,
        privateKey: subscriberPrivateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/init`,
        confirmRequest,
        {
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        },
      );

      return {
        requestContext,
        confirmRequest,
        response,
      };
    } catch (error) {
      console.log(error);
      return {
        requestContext,
        confirmRequest,
      };
    }
  }

  async track({
    orderId,
    subscriberId,
    subscriberUniqueKeyId,
    subscriberPrivateKey,
  }: {
    orderId: string;
    subscriberId: string;
    subscriberUniqueKeyId: string;
    subscriberPrivateKey: string;
  }) {
    const requestContext = this.createOndcRequestContext({
      action: 'track',
      domain: 'nic2004:52110',
      country: 'IND',
      city: 'std:080',
      bapId: subscriberId,
      bapUri: '/bapl',
    });

    const trackRequest = {
      context: requestContext,
      message: {
        order_id: orderId,
        callback_url: 'string', // @BhupenPal: Figure out type
      },
    };

    try {
      const authHeader = await this.ondcUtilService.createAuthorizationHeader({
        message: trackRequest,
        subscriberId,
        subscriberUniqueKeyId,
        privateKey: subscriberPrivateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/track`,
        trackRequest,
        {
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        },
      );

      return {
        requestContext,
        trackRequest,
        response,
      };
    } catch (error) {
      console.log(error);
      return {
        requestContext,
        trackRequest,
      };
    }
  }

  async cancel({
    orderId,
    subscriberId,
    subscriberUniqueKeyId,
    subscriberPrivateKey,
  }: {
    orderId: string;
    subscriberId: string;
    subscriberUniqueKeyId: string;
    subscriberPrivateKey: string;
  }) {
    const requestContext = this.createOndcRequestContext({
      action: 'cancel',
      domain: 'nic2004:52110',
      country: 'IND',
      city: 'std:080',
      bapId: subscriberId,
      bapUri: '/bapl',
    });

    const cancelRequest = {
      context: requestContext,
      message: {
        order_id: orderId,
        cancellation_reason_id: 'string',
        descriptor: {
          name: 'string',
          code: 'string',
          symbol: 'string',
          short_desc: 'string',
          long_desc: 'string',
          images: ['string'],
          audio: 'string',
          '3d_render': 'string',
        },
      },
    };

    try {
      const authHeader = await this.ondcUtilService.createAuthorizationHeader({
        message: cancelRequest,
        subscriberId,
        subscriberUniqueKeyId,
        privateKey: subscriberPrivateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/cancel`,
        cancelRequest,
        {
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        },
      );

      return {
        requestContext,
        cancelRequest,
        response,
      };
    } catch (error) {
      console.log(error);
      return {
        requestContext,
        cancelRequest,
      };
    }
  }

  async update({
    orderId,
    subscriberId,
    subscriberUniqueKeyId,
    subscriberPrivateKey,
  }: {
    orderId: string;
    subscriberId: string;
    subscriberUniqueKeyId: string;
    subscriberPrivateKey: string;
  }) {
    const requestContext = this.createOndcRequestContext({
      action: 'update',
      domain: 'nic2004:52110',
      country: 'IND',
      city: 'std:080',
      bapId: subscriberId,
      bapUri: '/bapl',
    });

    const updateRequest = {
      context: requestContext,
      message: {
        update_target: 'string',
        order: {
          id: orderId,
          state: 'string',
          provider: {
            id: 'string',
            locations: [
              {
                id: 'string',
              },
            ],
          },
          items: [
            {
              id: 'string',
              quantity: {
                count: 0,
                measure: {
                  type: 'CONSTANT',
                  value: 0,
                  estimated_value: 0,
                  computed_value: 0,
                  range: {
                    min: 0,
                    max: 0,
                  },
                  unit: 'string',
                },
              },
            },
          ],
          add_ons: [
            {
              id: 'string',
            },
          ],
          offers: [
            {
              id: 'string',
            },
          ],
          documents: [
            {
              url: 'string',
              label: 'string',
            },
          ],
          billing: {
            name: 'string',
            organization: {
              name: 'string',
              cred: 'string',
            },
            address: {
              door: 'string',
              name: 'string',
              building: 'string',
              street: 'string',
              locality: 'string',
              ward: 'string',
              city: 'string',
              state: 'string',
              country: 'string',
              area_code: 'string',
            },
            email: 'user@example.com',
            phone: 'string',
            time: {
              label: 'string',
              timestamp: '2024-01-12T14:20:24.427Z',
              duration: 'string',
              range: {
                start: '2024-01-12T14:20:24.427Z',
                end: '2024-01-12T14:20:24.427Z',
              },
              days: 'string',
              schedule: {
                frequency: 'string',
                holidays: ['2024-01-12T14:20:24.427Z'],
                times: ['2024-01-12T14:20:24.427Z'],
              },
            },
            tax_number: 'string',
            created_at: '2024-01-12T14:20:24.427Z',
            updated_at: '2024-01-12T14:20:24.427Z',
          },
          fulfillment: {
            id: 'string',
            type: 'string',
            provider_id: 'string',
            rating: 0,
            state: {
              descriptor: {
                name: 'string',
                code: 'string',
                symbol: 'string',
                short_desc: 'string',
                long_desc: 'string',
                images: ['string'],
                audio: 'string',
                '3d_render': 'string',
              },
              updated_at: '2024-01-12T14:20:24.427Z',
              updated_by: 'string',
            },
            tracking: false,
            customer: {
              person: {
                name: './FiOaqW*h8<wzWj.NMxvl,`h\'o_>zs*?pEFpO!7 v;,!nYYbsf%NrZn||<LjI!tPpo>40s&}! zxi7[nX%=/!DaQcww6{?.TZm@;Y.`@F+"k)SUJOlh^a/a|Dazax3G2e7h^,Wr_A#h"=m1/^>)AA`r`\'d=@hBChS|}#OI?t2OQn9w|F)OT2O3nIFe]ym)gG}%<#D!(irx=!NV,vK=^wsCN0__Z#2tC3F&X}v8=>R7nYYp]/>?<I,-5=18y7"w<@0|j/&:O&}|4ONcQ6#6,yC+MD',
                image: 'string',
                dob: '2024-01-12',
                gender: 'string',
                cred: 'string',
                tags: {
                  additionalProp1: 'string',
                  additionalProp2: 'string',
                  additionalProp3: 'string',
                },
              },
              contact: {
                phone: 'string',
                email: 'string',
                tags: {
                  additionalProp1: 'string',
                  additionalProp2: 'string',
                  additionalProp3: 'string',
                },
              },
            },
            agent: {
              name: "./34cA'h[Ft4Y'E`T/3n}K\\c4]gYF(E|M+1hUoMg08+P?/nGm#S*CPY&Lh.KK.(V}FMYQ?dN){mJgUph5QlX,\\^T5m,T<(1HcAQ'/U\"Uvp<#EN5'fzTvDy'v'+PmQ~stoL2A_dm`dIid7-,^^}$FZJ|*JPm\"KsM>gC%^Ym/j@*9mp~+Rh9$y#s:H`#JP<\\+B;\\lYkQOtP`O:<#E?M,32- ,-u|?W`5#!H'ZDH6.W./2M<]Lj9es,7E#(Eqr@p:D?!)",
              image: 'string',
              dob: '2024-01-12',
              gender: 'string',
              cred: 'string',
              tags: {
                additionalProp1: 'string',
                additionalProp2: 'string',
                additionalProp3: 'string',
              },
              phone: 'string',
              email: 'string',
              rateable: true,
            },
            person: {
              name: "./=:#0R'(Rp8Ye&Oe 2gWu5lz!2Zlz'7hu!?]pxmWs<#9UpBd4_ 95#KoTTh3&,xY#s{^_hnJyb!Bl4lzh`? Tg;U/!^*TpSCOCK7bH\"'pM0G$EOeU_u'NNJx\\U}'s75FUYS8\\%a&Ej76/Ks2NVccp6@pT\\/VhzF1(,MlOmz;tDR'N/RH^5|N<-@'Hwu3vv0_[`\\==Za/W#3g-bNjV:Mon9GI\\%c.0`7IXxy2wowJUv}G+?3@AyUu N,gDbVa mv|w2\"+?3~Tt",
              image: 'string',
              dob: '2024-01-12',
              gender: 'string',
              cred: 'string',
              tags: {
                additionalProp1: 'string',
                additionalProp2: 'string',
                additionalProp3: 'string',
              },
            },
            contact: {
              phone: 'string',
              email: 'string',
              tags: {
                additionalProp1: 'string',
                additionalProp2: 'string',
                additionalProp3: 'string',
              },
            },
            vehicle: {
              category: 'string',
              capacity: 0,
              make: 'string',
              model: 'string',
              size: 'string',
              variant: 'string',
              color: 'string',
              energy_type: 'string',
              registration: 'string',
            },
            start: {
              location: {
                id: 'string',
                descriptor: {
                  name: 'string',
                  code: 'string',
                  symbol: 'string',
                  short_desc: 'string',
                  long_desc: 'string',
                  images: ['string'],
                  audio: 'string',
                  '3d_render': 'string',
                },
                gps: '90.0000000000000000000000000000000000000000000000000000000000,      180',
                address: {
                  door: 'string',
                  name: 'string',
                  building: 'string',
                  street: 'string',
                  locality: 'string',
                  ward: 'string',
                  city: 'string',
                  state: 'string',
                  country: 'string',
                  area_code: 'string',
                },
                station_code: 'string',
                city: {
                  name: 'string',
                  code: 'string',
                },
                country: {
                  name: 'string',
                  code: 'string',
                },
                circle: {
                  gps: '-90.000000000000000000000000000000000000000000000000,                                                                           -117',
                  radius: {
                    type: 'CONSTANT',
                    value: 0,
                    estimated_value: 0,
                    computed_value: 0,
                    range: {
                      min: 0,
                      max: 0,
                    },
                    unit: 'string',
                  },
                },
                polygon: 'string',
                '3dspace': 'string',
                time: {
                  label: 'string',
                  timestamp: '2024-01-12T14:20:24.428Z',
                  duration: 'string',
                  range: {
                    start: '2024-01-12T14:20:24.428Z',
                    end: '2024-01-12T14:20:24.428Z',
                  },
                  days: 'string',
                  schedule: {
                    frequency: 'string',
                    holidays: ['2024-01-12T14:20:24.428Z'],
                    times: ['2024-01-12T14:20:24.428Z'],
                  },
                },
              },
              time: {
                label: 'string',
                timestamp: '2024-01-12T14:20:24.428Z',
                duration: 'string',
                range: {
                  start: '2024-01-12T14:20:24.428Z',
                  end: '2024-01-12T14:20:24.428Z',
                },
                days: 'string',
                schedule: {
                  frequency: 'string',
                  holidays: ['2024-01-12T14:20:24.428Z'],
                  times: ['2024-01-12T14:20:24.428Z'],
                },
              },
              instructions: {
                name: 'string',
                code: 'string',
                symbol: 'string',
                short_desc: 'string',
                long_desc: 'string',
                images: ['string'],
                audio: 'string',
                '3d_render': 'string',
              },
              contact: {
                phone: 'string',
                email: 'string',
                tags: {
                  additionalProp1: 'string',
                  additionalProp2: 'string',
                  additionalProp3: 'string',
                },
              },
              person: {
                name: './C;8+DJ^CJeYMcl;M@xSZs!|2xK09]4\\Gf7e*tYZFr>7/qvEZ!p]7Nr-(:=Pc*>\'/|#swEy}j6#N_2`GM.I}kT/j+d3lVV4A]91wDrF?dWnK~&CZ!O$ (k;3!fOVk$gQvC!T(!Bm?9``$y/.U1Eb 6]XxOI$x@g{!xEprp>:a^?}1+k"t\'qx#)BXa,:!K20}_NtUaoivl)yDJ\'*I8tI\')p+B8h;j/XJ`?j3OC~vt&zj"Z;|0"$w+\\\\~z<"?@#_36osr%Qhi<\'O4edZh,K""Z);S~0+OP`pc+~U8#mrv d|k`Y)=JUW;\\V',
                image: 'string',
                dob: '2024-01-12',
                gender: 'string',
                cred: 'string',
                tags: {
                  additionalProp1: 'string',
                  additionalProp2: 'string',
                  additionalProp3: 'string',
                },
              },
              authorization: {
                type: 'string',
                token: 'string',
                valid_from: '2024-01-12T14:20:24.428Z',
                valid_to: '2024-01-12T14:20:24.428Z',
                status: 'string',
              },
            },
            end: {
              location: {
                id: 'string',
                descriptor: {
                  name: 'string',
                  code: 'string',
                  symbol: 'string',
                  short_desc: 'string',
                  long_desc: 'string',
                  images: ['string'],
                  audio: 'string',
                  '3d_render': 'string',
                },
                gps: '+90,                                                         159.54301269473484190',
                address: {
                  door: 'string',
                  name: 'string',
                  building: 'string',
                  street: 'string',
                  locality: 'string',
                  ward: 'string',
                  city: 'string',
                  state: 'string',
                  country: 'string',
                  area_code: 'string',
                },
                station_code: 'string',
                city: {
                  name: 'string',
                  code: 'string',
                },
                country: {
                  name: 'string',
                  code: 'string',
                },
                circle: {
                  gps: '-90.00000000000000000000000,                                         -154.65403757782289182592209258069471947425259654506865590573506507912798',
                  radius: {
                    type: 'CONSTANT',
                    value: 0,
                    estimated_value: 0,
                    computed_value: 0,
                    range: {
                      min: 0,
                      max: 0,
                    },
                    unit: 'string',
                  },
                },
                polygon: 'string',
                '3dspace': 'string',
                time: {
                  label: 'string',
                  timestamp: '2024-01-12T14:20:24.428Z',
                  duration: 'string',
                  range: {
                    start: '2024-01-12T14:20:24.428Z',
                    end: '2024-01-12T14:20:24.428Z',
                  },
                  days: 'string',
                  schedule: {
                    frequency: 'string',
                    holidays: ['2024-01-12T14:20:24.428Z'],
                    times: ['2024-01-12T14:20:24.428Z'],
                  },
                },
              },
              time: {
                label: 'string',
                timestamp: '2024-01-12T14:20:24.428Z',
                duration: 'string',
                range: {
                  start: '2024-01-12T14:20:24.428Z',
                  end: '2024-01-12T14:20:24.428Z',
                },
                days: 'string',
                schedule: {
                  frequency: 'string',
                  holidays: ['2024-01-12T14:20:24.428Z'],
                  times: ['2024-01-12T14:20:24.428Z'],
                },
              },
              instructions: {
                name: 'string',
                code: 'string',
                symbol: 'string',
                short_desc: 'string',
                long_desc: 'string',
                images: ['string'],
                audio: 'string',
                '3d_render': 'string',
              },
              contact: {
                phone: 'string',
                email: 'string',
                tags: {
                  additionalProp1: 'string',
                  additionalProp2: 'string',
                  additionalProp3: 'string',
                },
              },
              person: {
                name: './PvQ8}yvU{^Jgx]5,z0s;BglxepSR8 CHroO^V0hWKjLSre))9XpIY64l"LrWfO#(h`M2]8e2oAw)zp-:>nxRcg:4/z7fWv|PfVb"zYle lT%bU+a\'XZ%@]!s^D6cSv#\'\'/m3(Kc |P>zOl~yq]DtNR+R*:EJjb($<v[/dL%S}R!7[\'S$h*Lvn``b"*dy_h2@"-{CK9a7u3t#%ygs-NN1[l^XI#GY!Ufy+blfj2EN@zf[DoT"z!6~Kvqyj(kKa+6 Usgm9/0c!EK:[#:4?I> #: Epk9^]v32aRQ<)U>_:p*|Cov"-ZldBK{K54?d|V^on XLA0g+vZd2+``/3a5emAhQ1+bi>Ko2<^>+\'=\'2wErpZwCC^c>`cPIm0iPel"kh40"d~4%PLTu ',
                image: 'string',
                dob: '2024-01-12',
                gender: 'string',
                cred: 'string',
                tags: {
                  additionalProp1: 'string',
                  additionalProp2: 'string',
                  additionalProp3: 'string',
                },
              },
              authorization: {
                type: 'string',
                token: 'string',
                valid_from: '2024-01-12T14:20:24.429Z',
                valid_to: '2024-01-12T14:20:24.429Z',
                status: 'string',
              },
            },
            rateable: true,
            tags: {
              additionalProp1: 'string',
              additionalProp2: 'string',
              additionalProp3: 'string',
            },
          },
          quote: {
            price: {
              currency: 'string',
              value:
                '+40679079.9310587587661713755820897327777911052755223476080023856808327985901028114',
              estimated_value: '+3487341374570877219749064454164085',
              computed_value: '75716426275453121',
              listed_value:
                '-978426515836849452111293818918941429355750510277708705045671567813995004784352.65741413705256872',
              offered_value:
                '-75440087761592865321098376554951950204506958853683747106999490',
              minimum_value:
                '+4729004175737417626535967331730283773536695274720734615635805379099442613434696596701',
              maximum_value: '8273852407332339385101167960069830',
            },
            breakup: [
              {
                title: 'string',
                price: {
                  currency: 'string',
                  value:
                    '-7460100044690493818735329969650904043507860128415692910338515130472381548793630007956289442585370102.552438893833906191829868600',
                  estimated_value:
                    '-63991483959.75088987026899328689182429975082220405683776953017655958311064500541107750737212568161708256051210',
                  computed_value:
                    '-45651434776979333835775235735020518325953299951',
                  listed_value: '+7459994',
                  offered_value:
                    '376304994076629658491292515789202657789061237',
                  minimum_value:
                    '43765846958911813252394438112496098804589781498547909913285077619562992005985985900552975659729660.8618609804833316384710325023662103186761565426',
                  maximum_value:
                    '-0084574638502102933399783098888971429200225575563730635855738',
                },
              },
            ],
            ttl: 'string',
          },
          payment: {
            uri: 'string',
            tl_method: 'http/get',
            params: {
              transaction_id: 'string',
              transaction_status: 'string',
              amount:
                '+632181467514467882644817362802381976397077108524608156914571828628688603',
              currency: 'string',
              additionalProp1: 'string',
              additionalProp2: 'string',
              additionalProp3: 'string',
            },
            type: 'ON-ORDER',
            status: 'PAID',
            time: {
              label: 'string',
              timestamp: '2024-01-12T14:20:24.429Z',
              duration: 'string',
              range: {
                start: '2024-01-12T14:20:24.429Z',
                end: '2024-01-12T14:20:24.429Z',
              },
              days: 'string',
              schedule: {
                frequency: 'string',
                holidays: ['2024-01-12T14:20:24.429Z'],
                times: ['2024-01-12T14:20:24.429Z'],
              },
            },
            collected_by: 'BAP',
          },
          created_at: '2024-01-12T14:20:24.429Z',
          updated_at: '2024-01-12T14:20:24.429Z',
        },
      },
    };

    try {
      const authHeader = await this.ondcUtilService.createAuthorizationHeader({
        message: updateRequest,
        subscriberId,
        subscriberUniqueKeyId,
        privateKey: subscriberPrivateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/update`,
        updateRequest,
        {
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        },
      );

      return {
        requestContext,
        updateRequest,
        response,
      };
    } catch (error) {
      console.log(error);
      return {
        requestContext,
        updateRequest,
      };
    }
  }

  async rating({
    subscriberId,
    subscriberUniqueKeyId,
    subscriberPrivateKey,
  }: {
    subscriberId: string;
    subscriberUniqueKeyId: string;
    subscriberPrivateKey: string;
  }) {
    const requestContext = this.createOndcRequestContext({
      action: 'rating',
      domain: 'nic2004:52110',
      country: 'IND',
      city: 'std:080',
      bapId: subscriberId,
      bapUri: '/bapl',
    });

    const ratingRequest = {
      context: requestContext,
      message: {
        rating_category: 'string',
        id: 'string',
        value: 0,
        feedback_form: [
          {
            id: 'string',
            parent_id: 'string',
            question: 'string',
            answer: 'string',
            answer_type: 'radio',
          },
        ],
        feedback_id: 'string',
      },
    };

    try {
      const authHeader = await this.ondcUtilService.createAuthorizationHeader({
        message: ratingRequest,
        subscriberId,
        subscriberUniqueKeyId,
        privateKey: subscriberPrivateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/rating`,
        ratingRequest,
        {
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.log(error);

      return {
        requestContext,
        ratingRequest,
      };
    }
  }

  async support({
    // supportReferenceId,
    subscriberId,
    subscriberUniqueKeyId,
    subscriberPrivateKey,
  }: {
    // supportReferenceId: string;
    subscriberId: string;
    subscriberUniqueKeyId: string;
    subscriberPrivateKey: string;
  }) {
    const requestContext = this.createOndcRequestContext({
      action: 'support',
      domain: 'nic2004:52110',
      country: 'IND',
      city: 'std:080',
      bapId: subscriberId,
      bapUri: '/bapl',
    });

    const supportRequest = {
      context: requestContext,
      message: {
        ref_id: new Types.ObjectId(),
      },
    };

    try {
      const authHeader = await this.ondcUtilService.createAuthorizationHeader({
        message: supportRequest,
        subscriberId,
        subscriberUniqueKeyId,
        privateKey: subscriberPrivateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/support`,
        supportRequest,
        {
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.log(error);

      return {
        success: false,
      };
    }
  }

  async onSearch({
    subscriberId,
    subscriberUniqueKeyId,
    subscriberPrivateKey,
  }: {
    subscriberId: string;
    subscriberUniqueKeyId: string;
    subscriberPrivateKey: string;
    catalog: {
      'bpp/descriptor': {
        images: string[];
        longDescription: string;
        name: string;
        shortDescription: string;
        symbol: string;
      };
      'bpp/provider': {
        descriptor: {
          images: string[];
          longDescription: string;
          name: string;
          shortDescription: string;
          symbol: string;
        };
        exp: string; // DATESTRING
        ttl: string;
        id: string;
        rateable: boolean;
        rating: number;
        tags: string[];
      }[];
    };
  }) {
    const searchRequest: IOnSearchRequestPayload = {
      context: this.createOndcRequestContext({
        action: 'on_search',
        domain: 'nic2004:52110',
        country: 'IND',
        city: 'std:080',
        bapId: subscriberId,
        bapUri: '/bapl',
      }),
      message: {
        catalog: {
          'bpp/descriptor': {
            images: ['cdn.bhupenpal.com/1234'],
            long_desc: 'Test Category Long Description',
            name: 'Test Category',
            short_desc: 'Test Category Short Description',
            symbol: '13241234',
          },
          'bpp/providers': [
            {
              descriptor: {
                images: ['cdn.namaste.com/13241234'],
                long_desc: 'Test Product',
                name: 'Test Product',
                short_desc: 'Test Product',
                symbol: '12341243',
              },
              exp: new Date(
                new Date().getTime() + 1 * 60 * 60 * 24 * 100,
              ).toDateString(),
              ttl: 'P7D',
              id: '1234124312341234',
              rateable: false,
              rating: 5,
              tags: [],
            },
          ],
          exp: new Date().toISOString(),
        },
      },
    };

    try {
      const authHeaders = await this.ondcUtilService.createAuthorizationHeader({
        message: searchRequest,
        subscriberId,
        subscriberUniqueKeyId,
        privateKey: subscriberPrivateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/on_search`,
        searchRequest,
        {
          headers: {
            accept: 'application/json',
            authorization: authHeaders,
          },
        },
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.log(error.response);
      } else {
        console.log(error);
      }

      return {
        success: false,
      };
    }
  }

  async onSelect({ context, subscriber }: IOnSelect) {
    const onSelectRequest: IOnSelectRequest = {
      context: this.createOndcRequestContext({
        action: 'on_search',
        bapId: context.bapId,
        bapUri: context.bapUri,
        bppId: context.bppId,
        bppUri: context.bppUri,
        city: context.city,
        country: context.country,
        domain: context.domain,
      }),
      message: {
        order: {
          provider: {
            id: 'string',
            descriptor: {
              name: 'string',
              code: 'string',
              symbol: 'string',
              short_desc: 'string',
              long_desc: 'string',
              images: ['string'],
              // audio: 'http://example.com',
              // '3d_render': 'http://example.com',
            },
            category_id: 'string',
            '@ondc/org/fssai_license_no': 'string',
            rating: 1,
            // time: {
            //   label: 'string',
            //   timestamp: '2019-08-24T14:15:22Z',
            //   duration: 'string',
            //   range: {
            //     start: '2019-08-24T14:15:22Z',
            //     end: '2019-08-24T14:15:22Z',
            //   },
            //   days: 'string',
            //   schedule: {
            //     frequency: 'string',
            //     holidays: ['2019-08-24T14:15:22Z'],
            //     times: ['2019-08-24T14:15:22Z'],
            //   },
            // },
            // categories: [
            //   {
            //     id: 'Grocery',
            //     parent_category_id: 'Grocery',
            //     descriptor: {
            //       name: 'string',
            //       code: 'string',
            //       symbol: 'string',
            //       short_desc: 'string',
            //       long_desc: 'string',
            //       images: ['string'],
            //       audio: 'http://example.com',
            //       '3d_render': 'http://example.com',
            //     },
            //     time: {
            //       label: 'string',
            //       timestamp: '2019-08-24T14:15:22Z',
            //       duration: 'string',
            //       range: {
            //         start: '2019-08-24T14:15:22Z',
            //         end: '2019-08-24T14:15:22Z',
            //       },
            //       days: 'string',
            //       schedule: {
            //         frequency: 'string',
            //         holidays: ['2019-08-24T14:15:22Z'],
            //         times: ['2019-08-24T14:15:22Z'],
            //       },
            //     },
            //     tags: {
            //       property1: 'string',
            //       property2: 'string',
            //     },
            //   },
            // ],
            // fulfillments: [
            //   {
            //     id: 'string',
            //     type: 'Delivery',
            //     '@ondc/org/category': 'string',
            //     '@ondc/org/TAT': 'string',
            //     provider_id: 'string',
            //     '@ondc/org/provider_name': 'string',
            //     rating: 1,
            //     state: {
            //       descriptor: {
            //         name: 'string',
            //         code: 'string',
            //         symbol: 'string',
            //         short_desc: 'string',
            //         long_desc: 'string',
            //         images: ['string'],
            //         audio: 'http://example.com',
            //         '3d_render': 'http://example.com',
            //       },
            //       updated_at: '2019-08-24T14:15:22Z',
            //       updated_by: 'string',
            //     },
            //     tracking: false,
            //     customer: {
            //       person: {
            //         name: 'string',
            //         image: 'string',
            //         dob: '2019-08-24',
            //         gender: 'string',
            //         cred: 'string',
            //         tags: {
            //           property1: 'string',
            //           property2: 'string',
            //         },
            //         phone: 'string',
            //         email: 'string',
            //         rateable: true,
            //       },
            //       contact: {
            //         phone: 'string',
            //         email: 'string',
            //         tags: {
            //           property1: 'string',
            //           property2: 'string',
            //         },
            //       },
            //     },
            //     agent: {
            //       name: 'string',
            //       image: 'string',
            //       dob: '2019-08-24',
            //       gender: 'string',
            //       cred: 'string',
            //       tags: {
            //         property1: 'string',
            //         property2: 'string',
            //       },
            //       phone: 'string',
            //       email: 'string',
            //       rateable: true,
            //     },
            //     person: {
            //       name: 'string',
            //       image: 'string',
            //       dob: '2019-08-24',
            //       gender: 'string',
            //       cred: 'string',
            //       tags: {
            //         property1: 'string',
            //         property2: 'string',
            //       },
            //       phone: 'string',
            //       email: 'string',
            //       rateable: true,
            //     },
            //     contact: {
            //       phone: 'string',
            //       email: 'string',
            //       tags: {
            //         property1: 'string',
            //         property2: 'string',
            //       },
            //     },
            //     vehicle: {
            //       category: 'string',
            //       capacity: 0,
            //       make: 'string',
            //       model: 'string',
            //       size: 'string',
            //       variant: 'string',
            //       color: 'string',
            //       energy_type: 'string',
            //       registration: 'string',
            //     },
            //     start: {
            //       location: {
            //         id: 'string',
            //         descriptor: {
            //           name: 'string',
            //           code: 'string',
            //           symbol: 'string',
            //           short_desc: 'string',
            //           long_desc: 'string',
            //           images: ['string'],
            //           audio: 'http://example.com',
            //           '3d_render': 'http://example.com',
            //         },
            //         gps: 'string',
            //         address: {
            //           door: 'string',
            //           name: 'string',
            //           building: 'string',
            //           street: 'string',
            //           locality: 'string',
            //           ward: 'string',
            //           city: 'string',
            //           state: 'string',
            //           country: 'string',
            //           area_code: 'string',
            //         },
            //         station_code: 'string',
            //         city: {
            //           name: 'string',
            //           code: 'string',
            //         },
            //         country: {
            //           name: 'string',
            //           code: 'string',
            //         },
            //         circle: {
            //           gps: 'string',
            //           radius: {
            //             type: 'CONSTANT',
            //             value: 0,
            //             estimated_value: 0,
            //             computed_value: 0,
            //             range: {
            //               min: 0,
            //               max: 0,
            //             },
            //             unit: 'string',
            //           },
            //         },
            //         polygon: 'string',
            //         '3dspace': 'string',
            //         time: {
            //           label: 'string',
            //           timestamp: '2019-08-24T14:15:22Z',
            //           duration: 'string',
            //           range: {
            //             start: '2019-08-24T14:15:22Z',
            //             end: '2019-08-24T14:15:22Z',
            //           },
            //           days: 'string',
            //           schedule: {
            //             frequency: 'string',
            //             holidays: ['2019-08-24T14:15:22Z'],
            //             times: ['2019-08-24T14:15:22Z'],
            //           },
            //         },
            //         rateable: true,
            //       },
            //       time: {
            //         label: 'string',
            //         timestamp: '2019-08-24T14:15:22Z',
            //         duration: 'string',
            //         range: {
            //           start: '2019-08-24T14:15:22Z',
            //           end: '2019-08-24T14:15:22Z',
            //         },
            //         days: 'string',
            //         schedule: {
            //           frequency: 'string',
            //           holidays: ['2019-08-24T14:15:22Z'],
            //           times: ['2019-08-24T14:15:22Z'],
            //         },
            //       },
            //       instructions: {
            //         name: 'string',
            //         code: 'string',
            //         symbol: 'string',
            //         short_desc: 'string',
            //         long_desc: 'string',
            //         images: ['string'],
            //         audio: 'http://example.com',
            //         '3d_render': 'http://example.com',
            //       },
            //       contact: {
            //         phone: 'string',
            //         email: 'string',
            //         tags: {
            //           property1: 'string',
            //           property2: 'string',
            //         },
            //       },
            //       person: {
            //         name: 'string',
            //         image: 'string',
            //         dob: '2019-08-24',
            //         gender: 'string',
            //         cred: 'string',
            //         tags: {
            //           property1: 'string',
            //           property2: 'string',
            //         },
            //         phone: 'string',
            //         email: 'string',
            //         rateable: true,
            //       },
            //       authorization: {
            //         type: 'string',
            //         token: 'string',
            //         valid_from: '2019-08-24T14:15:22Z',
            //         valid_to: '2019-08-24T14:15:22Z',
            //         status: 'string',
            //       },
            //     },
            //     end: {
            //       location: {
            //         id: 'string',
            //         descriptor: {
            //           name: 'string',
            //           code: 'string',
            //           symbol: 'string',
            //           short_desc: 'string',
            //           long_desc: 'string',
            //           images: ['string'],
            //           audio: 'http://example.com',
            //           '3d_render': 'http://example.com',
            //         },
            //         gps: 'string',
            //         address: {
            //           door: 'string',
            //           name: 'string',
            //           building: 'string',
            //           street: 'string',
            //           locality: 'string',
            //           ward: 'string',
            //           city: 'string',
            //           state: 'string',
            //           country: 'string',
            //           area_code: 'string',
            //         },
            //         station_code: 'string',
            //         city: {
            //           name: 'string',
            //           code: 'string',
            //         },
            //         country: {
            //           name: 'string',
            //           code: 'string',
            //         },
            //         circle: {
            //           gps: 'string',
            //           radius: {
            //             type: 'CONSTANT',
            //             value: 0,
            //             estimated_value: 0,
            //             computed_value: 0,
            //             range: {
            //               min: 0,
            //               max: 0,
            //             },
            //             unit: 'string',
            //           },
            //         },
            //         polygon: 'string',
            //         '3dspace': 'string',
            //         time: {
            //           label: 'string',
            //           timestamp: '2019-08-24T14:15:22Z',
            //           duration: 'string',
            //           range: {
            //             start: '2019-08-24T14:15:22Z',
            //             end: '2019-08-24T14:15:22Z',
            //           },
            //           days: 'string',
            //           schedule: {
            //             frequency: 'string',
            //             holidays: ['2019-08-24T14:15:22Z'],
            //             times: ['2019-08-24T14:15:22Z'],
            //           },
            //         },
            //         rateable: true,
            //       },
            //       time: {
            //         label: 'string',
            //         timestamp: '2019-08-24T14:15:22Z',
            //         duration: 'string',
            //         range: {
            //           start: '2019-08-24T14:15:22Z',
            //           end: '2019-08-24T14:15:22Z',
            //         },
            //         days: 'string',
            //         schedule: {
            //           frequency: 'string',
            //           holidays: ['2019-08-24T14:15:22Z'],
            //           times: ['2019-08-24T14:15:22Z'],
            //         },
            //       },
            //       instructions: {
            //         name: 'string',
            //         code: 'string',
            //         symbol: 'string',
            //         short_desc: 'string',
            //         long_desc: 'string',
            //         images: ['string'],
            //         audio: 'http://example.com',
            //         '3d_render': 'http://example.com',
            //       },
            //       contact: {
            //         phone: 'string',
            //         email: 'string',
            //         tags: {
            //           property1: 'string',
            //           property2: 'string',
            //         },
            //       },
            //       person: {
            //         name: 'string',
            //         image: 'string',
            //         dob: '2019-08-24',
            //         gender: 'string',
            //         cred: 'string',
            //         tags: {
            //           property1: 'string',
            //           property2: 'string',
            //         },
            //         phone: 'string',
            //         email: 'string',
            //         rateable: true,
            //       },
            //       authorization: {
            //         type: 'string',
            //         token: 'string',
            //         valid_from: '2019-08-24T14:15:22Z',
            //         valid_to: '2019-08-24T14:15:22Z',
            //         status: 'string',
            //       },
            //     },
            //     rateable: true,
            //     tags: {
            //       property1: 'string',
            //       property2: 'string',
            //     },
            //   },
            // ],
            // payments: [
            //   {
            //     uri: 'http://example.com',
            //     tl_method: 'http/get',
            //     params: {
            //       transaction_id: 'string',
            //       transaction_status: 'string',
            //       amount: 'string',
            //       currency: 'string',
            //       property1: 'string',
            //       property2: 'string',
            //     },
            //     type: 'ON-ORDER',
            //     status: 'PAID',
            //     time: {
            //       label: 'string',
            //       timestamp: '2019-08-24T14:15:22Z',
            //       duration: 'string',
            //       range: {
            //         start: '2019-08-24T14:15:22Z',
            //         end: '2019-08-24T14:15:22Z',
            //       },
            //       days: 'string',
            //       schedule: {
            //         frequency: 'string',
            //         holidays: ['2019-08-24T14:15:22Z'],
            //         times: ['2019-08-24T14:15:22Z'],
            //       },
            //     },
            //     collected_by: 'BAP',
            //     '@ondc/org/collected_by_status': 'Assert',
            //     '@ondc/org/buyer_app_finder_fee_type': 'Amount',
            //     '@ondc/org/buyer_app_finder_fee_amount': 'string',
            //     '@ondc/org/withholding_amount': 'string',
            //     '@ondc/org/withholding_amount_status': 'Assert',
            //     '@ondc/org/return_window': 'string',
            //     '@ondc/org/return_window_status': 'Assert',
            //     '@ondc/org/settlement_basis': 'Collection',
            //     '@ondc/org/settlement_basis_status': 'Assert',
            //     '@ondc/org/settlement_window': 'string',
            //     '@ondc/org/settlement_window_status': 'Assert',
            //     '@ondc/org/settlement_details': [
            //       {
            //         settlement_counterparty: 'buyer',
            //         settlement_phase: 'sale-amount',
            //         settlement_amount: 0,
            //         settlement_type: 'neft',
            //         settlement_bank_account_no: 'string',
            //         settlement_ifsc_code: 'string',
            //         upi_address: 'string',
            //         bank_name: 'string',
            //         branch_name: 'string',
            //         beneficiary_address: 'string',
            //         settlement_status: 'PAID',
            //         settlement_reference: 'string',
            //         settlement_timestamp: '2019-08-24T14:15:22Z',
            //       },
            //     ],
            //   },
            // ],
            // locations: [
            //   {
            //     id: 'string',
            //     descriptor: {
            //       name: 'string',
            //       code: 'string',
            //       symbol: 'string',
            //       short_desc: 'string',
            //       long_desc: 'string',
            //       images: ['string'],
            //       audio: 'http://example.com',
            //       '3d_render': 'http://example.com',
            //     },
            //     gps: 'string',
            //     address: {
            //       door: 'string',
            //       name: 'string',
            //       building: 'string',
            //       street: 'string',
            //       locality: 'string',
            //       ward: 'string',
            //       city: 'string',
            //       state: 'string',
            //       country: 'string',
            //       area_code: 'string',
            //     },
            //     station_code: 'string',
            //     city: {
            //       name: 'string',
            //       code: 'string',
            //     },
            //     country: {
            //       name: 'string',
            //       code: 'string',
            //     },
            //     circle: {
            //       gps: 'string',
            //       radius: {
            //         type: 'CONSTANT',
            //         value: 0,
            //         estimated_value: 0,
            //         computed_value: 0,
            //         range: {
            //           min: 0,
            //           max: 0,
            //         },
            //         unit: 'string',
            //       },
            //     },
            //     polygon: 'string',
            //     '3dspace': 'string',
            //     time: {
            //       label: 'string',
            //       timestamp: '2019-08-24T14:15:22Z',
            //       duration: 'string',
            //       range: {
            //         start: '2019-08-24T14:15:22Z',
            //         end: '2019-08-24T14:15:22Z',
            //       },
            //       days: 'string',
            //       schedule: {
            //         frequency: 'string',
            //         holidays: ['2019-08-24T14:15:22Z'],
            //         times: ['2019-08-24T14:15:22Z'],
            //       },
            //     },
            //     rateable: true,
            //   },
            // ],
            // offers: [
            //   {
            //     id: 'string',
            //     descriptor: {
            //       name: 'string',
            //       code: 'string',
            //       symbol: 'string',
            //       short_desc: 'string',
            //       long_desc: 'string',
            //       images: ['string'],
            //       audio: 'http://example.com',
            //       '3d_render': 'http://example.com',
            //     },
            //     location_ids: ['string'],
            //     category_ids: ['Grocery'],
            //     item_ids: ['string'],
            //     time: {
            //       label: 'string',
            //       timestamp: '2019-08-24T14:15:22Z',
            //       duration: 'string',
            //       range: {
            //         start: '2019-08-24T14:15:22Z',
            //         end: '2019-08-24T14:15:22Z',
            //       },
            //       days: 'string',
            //       schedule: {
            //         frequency: 'string',
            //         holidays: ['2019-08-24T14:15:22Z'],
            //         times: ['2019-08-24T14:15:22Z'],
            //       },
            //     },
            //   },
            // ],
            // items: [
            //   {
            //     id: 'string',
            //     // parent_item_id: 'string',
            //     descriptor: {
            //       name: 'string',
            //       code: 'string',
            //       symbol: 'string',
            //       short_desc: 'string',
            //       long_desc: 'string',
            //       images: ['string'],
            //       // audio: 'http://example.com',
            //       // '3d_render': 'http://example.com',
            //     },
            //     price: {
            //       currency: 'string',
            //       value: 'string',
            //       // estimated_value: 'string',
            //       // computed_value: 'string',
            //       // listed_value: 'string',
            //       // offered_value: 'string',
            //       // minimum_value: 'string',
            //       // maximum_value: 'string',
            //     },
            //     category_id:
            //       'Grocery | Packaged Commodities | Packaged Foods | Fruits and Vegetables | F&B | Home & Decor',
            //     fulfillment_id: 'string',
            //     // rating: 1,
            //     location_id: 'string',
            //     // time: {
            //     //   label: 'string',
            //     //   timestamp: '2019-08-24T14:15:22Z',
            //     //   duration: 'string',
            //     //   range: {
            //     //     start: '2019-08-24T14:15:22Z',
            //     //     end: '2019-08-24T14:15:22Z',
            //     //   },
            //     //   days: 'string',
            //     //   schedule: {
            //     //     frequency: 'string',
            //     //     holidays: ['2019-08-24T14:15:22Z'],
            //     //     times: ['2019-08-24T14:15:22Z'],
            //     //   },
            //     // },
            //     // rateable: true,
            //     matched: true,
            //     // related: true,
            //     // recommended: true,
            //     '@ondc/org/returnable': true,
            //     '@ondc/org/seller_pickup_return': true,
            //     '@ondc/org/return_window': 'string',
            //     '@ondc/org/cancellable': true,
            //     '@ondc/org/time_to_ship': 'string',
            //     '@ondc/org/available_on_cod': true,
            //     '@ondc/org/contact_details_consumer_care': 'string',
            //     '@ondc/org/statutory_reqs_packaged_commodities': {
            //       manufacturer_or_packer_name: 'string',
            //       manufacturer_or_packer_address: 'string',
            //       common_or_generic_name_of_commodity: 'string',
            //       multiple_products_name_number_or_qty: 'string',
            //       net_quantity_or_measure_of_commodity_in_pkg: 'string',
            //       month_year_of_manufacture_packing_import: 'string',
            //       imported_product_country_of_origin: 'string',
            //     },
            //     '@ondc/org/statutory_reqs_prepackaged_food': {
            //       ingredients_info: 'string',
            //       nutritional_info: 'string',
            //       additives_info: 'string',
            //       manufacturer_or_packer_name: 'string',
            //       manufacturer_or_packer_address: 'string',
            //       brand_owner_name: 'string',
            //       brand_owner_address: 'string',
            //       brand_owner_FSSAI_logo: 'string',
            //       brand_owner_FSSAI_license_no: 'string',
            //       other_FSSAI_license_no: 'string',
            //       net_quantity: 'string',
            //       importer_name: 'string',
            //       importer_address: 'string',
            //       importer_FSSAI_logo: 'string',
            //       importer_FSSAI_license_no: 'string',
            //       imported_product_country_of_origin: 'string',
            //       other_importer_name: 'string',
            //       other_importer_address: 'string',
            //       other_premises: 'string',
            //       other_importer_country_of_origin: 'string',
            //     },
            //     '@ondc/org/mandatory_reqs_veggies_fruits': {},
            //     // tags: {
            //     //   property1: 'string',
            //     //   property2: 'string',
            //     // },
            //   },
            // ],
            ttl: 'string',
            // exp: '2019-08-24T14:15:22Z',
            // rateable: true,
            // tags: {
            //   property1: 'string',
            //   property2: 'string',
            // },
          },
          // provider_location: {
          //   id: 'string',
          //   descriptor: {
          //     name: 'string',
          //     code: 'string',
          //     symbol: 'string',
          //     short_desc: 'string',
          //     long_desc: 'string',
          //     images: ['string'],
          //     audio: 'http://example.com',
          //     '3d_render': 'http://example.com',
          //   },
          //   gps: 'string',
          //   address: {
          //     door: 'string',
          //     name: 'string',
          //     building: 'string',
          //     street: 'string',
          //     locality: 'string',
          //     ward: 'string',
          //     city: 'string',
          //     state: 'string',
          //     country: 'string',
          //     area_code: 'string',
          //   },
          //   station_code: 'string',
          //   city: {
          //     name: 'string',
          //     code: 'string',
          //   },
          //   country: {
          //     name: 'string',
          //     code: 'string',
          //   },
          //   circle: {
          //     gps: 'string',
          //     radius: {
          //       type: 'CONSTANT',
          //       value: 0,
          //       estimated_value: 0,
          //       computed_value: 0,
          //       range: {
          //         min: 0,
          //         max: 0,
          //       },
          //       unit: 'string',
          //     },
          //   },
          //   polygon: 'string',
          //   '3dspace': 'string',
          //   time: {
          //     label: 'string',
          //     timestamp: '2019-08-24T14:15:22Z',
          //     duration: 'string',
          //     range: {
          //       start: '2019-08-24T14:15:22Z',
          //       end: '2019-08-24T14:15:22Z',
          //     },
          //     days: 'string',
          //     schedule: {
          //       frequency: 'string',
          //       holidays: ['2019-08-24T14:15:22Z'],
          //       times: ['2019-08-24T14:15:22Z'],
          //     },
          //   },
          //   rateable: true,
          // },
          items: [
            {
              id: 'string',
              parent_item_id: 'string',
              descriptor: {
                name: 'string',
                code: 'string',
                symbol: 'string',
                short_desc: 'string',
                long_desc: 'string',
                images: ['string'],
                // audio: 'http://example.com',
                // '3d_render': 'http://example.com',
              },
              price: {
                currency: 'string',
                value: 'string',
                estimated_value: 'string',
                computed_value: 'string',
                listed_value: 'string',
                offered_value: 'string',
                minimum_value: 'string',
                maximum_value: 'string',
              },
              category_id: 'Grocery',
              fulfillment_id: 'string',
              rating: 1,
              location_id: 'string',
              // time: {
              //   label: 'string',
              //   timestamp: '2019-08-24T14:15:22Z',
              //   duration: 'string',
              //   range: {
              //     start: '2019-08-24T14:15:22Z',
              //     end: '2019-08-24T14:15:22Z',
              //   },
              //   days: 'string',
              //   schedule: {
              //     frequency: 'string',
              //     holidays: ['2019-08-24T14:15:22Z'],
              //     times: ['2019-08-24T14:15:22Z'],
              //   },
              // },
              rateable: true,
              matched: true,
              related: true,
              recommended: true,
              '@ondc/org/returnable': true,
              '@ondc/org/seller_pickup_return': true,
              '@ondc/org/return_window': 'string',
              '@ondc/org/cancellable': true,
              '@ondc/org/time_to_ship': 'string',
              '@ondc/org/available_on_cod': true,
              '@ondc/org/contact_details_consumer_care': 'string',
              '@ondc/org/statutory_reqs_packaged_commodities': {
                manufacturer_or_packer_name: 'string',
                manufacturer_or_packer_address: 'string',
                common_or_generic_name_of_commodity: 'string',
                multiple_products_name_number_or_qty: 'string',
                net_quantity_or_measure_of_commodity_in_pkg: 'string',
                month_year_of_manufacture_packing_import: 'string',
                imported_product_country_of_origin: 'string',
              },
              '@ondc/org/statutory_reqs_prepackaged_food': {
                ingredients_info: 'string',
                nutritional_info: 'string',
                additives_info: 'string',
                manufacturer_or_packer_name: 'string',
                manufacturer_or_packer_address: 'string',
                brand_owner_name: 'string',
                brand_owner_address: 'string',
                brand_owner_FSSAI_logo: 'string',
                brand_owner_FSSAI_license_no: 'string',
                other_FSSAI_license_no: 'string',
                net_quantity: 'string',
                importer_name: 'string',
                importer_address: 'string',
                importer_FSSAI_logo: 'string',
                importer_FSSAI_license_no: 'string',
                imported_product_country_of_origin: 'string',
                other_importer_name: 'string',
                other_importer_address: 'string',
                other_premises: 'string',
                other_importer_country_of_origin: 'string',
              },
              '@ondc/org/mandatory_reqs_veggies_fruits': {
                net_quantity: 'string',
              },
              // tags: {
              //   property1: 'string',
              //   property2: 'string',
              // },
              // quantity: {
              //   allocated: {
              //     count: 0,
              //     measure: {
              //       type: 'CONSTANT',
              //       value: 0,
              //       estimated_value: 0,
              //       computed_value: 0,
              //       range: {
              //         min: 0,
              //         max: 0,
              //       },
              //       unit: 'string',
              //     },
              //   },
              //   available: {
              //     count: 0,
              //     measure: {
              //       type: 'CONSTANT',
              //       value: 0,
              //       estimated_value: 0,
              //       computed_value: 0,
              //       range: {
              //         min: 0,
              //         max: 0,
              //       },
              //       unit: 'string',
              //     },
              //   },
              //   maximum: {
              //     count: 1,
              //     measure: {
              //       type: 'CONSTANT',
              //       value: 0,
              //       estimated_value: 0,
              //       computed_value: 0,
              //       range: {
              //         min: 0,
              //         max: 0,
              //       },
              //       unit: 'string',
              //     },
              //   },
              //   minimum: {
              //     count: 0,
              //     measure: {
              //       type: 'CONSTANT',
              //       value: 0,
              //       estimated_value: 0,
              //       computed_value: 0,
              //       range: {
              //         min: 0,
              //         max: 0,
              //       },
              //       unit: 'string',
              //     },
              //   },
              //   selected: {
              //     count: 0,
              //     measure: {
              //       type: 'CONSTANT',
              //       value: 0,
              //       estimated_value: 0,
              //       computed_value: 0,
              //       range: {
              //         min: 0,
              //         max: 0,
              //       },
              //       unit: 'string',
              //     },
              //   },
              // },
            },
          ],
          // add_ons: [
          //   {
          //     id: 'string',
          //     descriptor: {
          //       name: 'string',
          //       code: 'string',
          //       symbol: 'string',
          //       short_desc: 'string',
          //       long_desc: 'string',
          //       images: ['string'],
          //       audio: 'http://example.com',
          //       '3d_render': 'http://example.com',
          //     },
          //     price: {
          //       currency: 'string',
          //       value: 'string',
          //       estimated_value: 'string',
          //       computed_value: 'string',
          //       listed_value: 'string',
          //       offered_value: 'string',
          //       minimum_value: 'string',
          //       maximum_value: 'string',
          //     },
          //   },
          // ],
          // offers: [
          //   {
          //     id: 'string',
          //     descriptor: {
          //       name: 'string',
          //       code: 'string',
          //       symbol: 'string',
          //       short_desc: 'string',
          //       long_desc: 'string',
          //       images: ['string'],
          //       audio: 'http://example.com',
          //       '3d_render': 'http://example.com',
          //     },
          //     location_ids: ['string'],
          //     category_ids: ['Grocery'],
          //     item_ids: ['string'],
          //     time: {
          //       label: 'string',
          //       timestamp: '2019-08-24T14:15:22Z',
          //       duration: 'string',
          //       range: {
          //         start: '2019-08-24T14:15:22Z',
          //         end: '2019-08-24T14:15:22Z',
          //       },
          //       days: 'string',
          //       schedule: {
          //         frequency: 'string',
          //         holidays: ['2019-08-24T14:15:22Z'],
          //         times: ['2019-08-24T14:15:22Z'],
          //       },
          //     },
          //   },
          // ],
          quote: {
            price: {
              currency: 'string',
              value: 'string',
              // estimated_value: 'string',
              // computed_value: 'string',
              // listed_value: 'string',
              // offered_value: 'string',
              // minimum_value: 'string',
              // maximum_value: 'string',
            },
            // breakup: [
            //   {
            //     '@ondc/org/item_id': 'string',
            //     '@ondc/org/item_quantity': {
            //       count: 0,
            //       measure: {
            //         type: 'CONSTANT',
            //         value: 0,
            //         estimated_value: 0,
            //         computed_value: 0,
            //         range: {
            //           min: 0,
            //           max: 0,
            //         },
            //         unit: 'string',
            //       },
            //     },
            //     '@ondc/org/title_type': 'item',
            //     title: 'string',
            //     price: {
            //       currency: 'string',
            //       value: 'string',
            //       estimated_value: 'string',
            //       computed_value: 'string',
            //       listed_value: 'string',
            //       offered_value: 'string',
            //       minimum_value: 'string',
            //       maximum_value: 'string',
            //     },
            //   },
            // ],
            // ttl: 'string',
          },
        },
      },
    };

    try {
      const authHeaders = await this.ondcUtilService.createAuthorizationHeader({
        message: onSelectRequest,
        subscriberId: subscriber.id,
        subscriberUniqueKeyId: subscriber.uniqueKeyId,
        privateKey: subscriber.privateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/on_select`,
        onSelectRequest,
        {
          headers: {
            accept: 'application/json',
            authorization: authHeaders,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async onInit({ context, subscriber }: IOnInit) {
    const onInitRequest: IOnInitRequest = {
      context: this.createOndcRequestContext({
        action: 'on_search',
        bapId: context.bapId,
        bapUri: context.bapUri,
        bppId: context.bppId,
        bppUri: context.bppUri,
        city: context.city,
        country: context.country,
        domain: context.domain,
      }),
      message: {
        order: {
          billing: {
            name: 'string',
            phone: 'string',
            tax_number: 'string',
          },
          fulfillment: {
            id: 'string',
            type: 'Delivery',
            tracking: false,
          },
          quote: {
            price: {
              currency: 'string',
              value: 'string',
            },
          },
        },
      },
    };

    try {
      const authHeaders = await this.ondcUtilService.createAuthorizationHeader({
        message: onInitRequest,
        subscriberId: subscriber.id,
        subscriberUniqueKeyId: subscriber.uniqueKeyId,
        privateKey: subscriber.privateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/on_init`,
        onInitRequest,
        {
          headers: {
            accept: 'application/json',
            authorization: authHeaders,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async onConfirm({ context, subscriber }: IOnConfirm) {
    const onConfirmRequest: IOnConfirmRequest = {
      context: this.createOndcRequestContext({
        action: 'on_search',
        bapId: context.bapId,
        bapUri: context.bapUri,
        bppId: context.bppId,
        bppUri: context.bppUri,
        city: context.city,
        country: context.country,
        domain: context.domain,
      }),
      message: {
        order: {
          state: 'Created',
          items: [
            {
              id: 'string',
            },
          ],
          billing: {
            name: 'string',
            phone: 'string',
            tax_number: 'string',
          },
          fulfillments: [
            {
              id: 'string',
              type: 'Delivery',
            },
          ],
          quote: {
            price: {
              currency: 'string',
              value: 'string',
            },
          },
        },
      },
    };

    try {
      const authHeaders = await this.ondcUtilService.createAuthorizationHeader({
        message: onConfirmRequest,
        subscriberId: subscriber.id,
        subscriberUniqueKeyId: subscriber.uniqueKeyId,
        privateKey: subscriber.privateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/on_confirm`,
        onConfirmRequest,
        {
          headers: {
            accept: 'application/json',
            authorization: authHeaders,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async onTrack({ context, subscriber }: IOnTrack) {
    const onTrackRequest: IOnTrackRequest = {
      context: this.createOndcRequestContext({
        action: 'on_search',
        bapId: context.bapId,
        bapUri: context.bapUri,
        bppId: context.bppId,
        bppUri: context.bppUri,
        city: context.city,
        country: context.country,
        domain: context.domain,
      }),
      message: {
        tracking: {
          url: 'http://example.com',
          status: 'active',
        },
      },
    };

    try {
      const authHeaders = await this.ondcUtilService.createAuthorizationHeader({
        message: onTrackRequest,
        subscriberId: subscriber.id,
        subscriberUniqueKeyId: subscriber.uniqueKeyId,
        privateKey: subscriber.privateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/on_track`,
        onTrackRequest,
        {
          headers: {
            accept: 'application/json',
            authorization: authHeaders,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async onCancel({ context, subscriber }: IOnCancel) {
    const onCancelRequest: IOnCancelRequest = {
      context: this.createOndcRequestContext({
        action: 'on_cancel',
        bapId: context.bapId,
        bapUri: context.bapUri,
        bppId: context.bppId,
        bppUri: context.bppUri,
        city: context.city,
        country: context.country,
        domain: context.domain,
      }),
      message: {
        order: {
          id: 'string',
          state: 'Created',
          provider: {
            id: 'string',
            locations: [
              {
                id: 'string',
              },
            ], // Only one element is allowed
          },
          items: [
            {
              id: 'string',
            },
          ],
          billing: {
            name: 'string',
            phone: 'string',
            tax_number: 'string',
          },
          quote: {
            price: {
              currency: 'string',
              value: 'string',
            },
          },
        },
      },
    };

    try {
      const authHeaders = await this.ondcUtilService.createAuthorizationHeader({
        message: onCancelRequest,
        subscriberId: subscriber.id,
        subscriberUniqueKeyId: subscriber.uniqueKeyId,
        privateKey: subscriber.privateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/on_cancel`,
        onCancelRequest,
        {
          headers: {
            accept: 'application/json',
            authorization: authHeaders,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async onUpdate({ context, subscriber }: IOnUpdate) {
    const onUpdateRequest: IOnUpdateRequest = {
      context: this.createOndcRequestContext({
        action: 'on_cancel',
        bapId: context.bapId,
        bapUri: context.bapUri,
        bppId: context.bppId,
        bppUri: context.bppUri,
        city: context.city,
        country: context.country,
        domain: context.domain,
      }),
      message: {
        order: {
          id: 'string',
          state: 'Created',
          provider: {
            id: 'string',
            locations: [
              {
                id: 'string',
              },
            ],
          },
          items: [
            {
              id: 'string',
            },
          ],
          billing: {
            name: 'string',
            phone: 'string',
            tax_number: 'string',
          },
          fulfillments: [
            {
              id: 'string',
              type: 'Delivery',
            },
          ],
          quote: {
            price: {
              currency: 'string',
              value: 'string',
            },
          },
        },
      },
    };

    try {
      const authHeaders = await this.ondcUtilService.createAuthorizationHeader({
        message: onUpdateRequest,
        subscriberId: subscriber.id,
        subscriberUniqueKeyId: subscriber.uniqueKeyId,
        privateKey: subscriber.privateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/on_update`,
        onUpdateRequest,
        {
          headers: {
            accept: 'application/json',
            authorization: authHeaders,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async onStatus({ context, subscriber }: IOnStatus) {
    const onStatusRequest: IOnStatusRequest = {
      context: this.createOndcRequestContext({
        action: 'on_status',
        bapId: context.bapId,
        bapUri: context.bapUri,
        bppId: context.bppId,
        bppUri: context.bppUri,
        city: context.city,
        country: context.country,
        domain: context.domain,
      }),
      message: {
        order: {
          items: [
            {
              id: 'string',
            },
          ],
          billing: {
            name: 'string',
            phone: 'string',
            tax_number: 'string',
          },
          fulfillments: [
            {
              id: 'string',
              type: 'Reverse QC',
            },
          ],
          quote: {
            price: {
              currency: 'string',
              value: 'string',
            },
          },
        },
      },
    };

    try {
      const authHeaders = await this.ondcUtilService.createAuthorizationHeader({
        message: onStatusRequest,
        subscriberId: subscriber.id,
        subscriberUniqueKeyId: subscriber.uniqueKeyId,
        privateKey: subscriber.privateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/on_status`,
        onStatusRequest,
        {
          headers: {
            accept: 'application/json',
            authorization: authHeaders,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async onRating({ context, subscriber }: IOnRating) {
    const onRatingRequest: IOnRatingRequest = {
      context: this.createOndcRequestContext({
        action: 'on_search',
        bapId: context.bapId,
        bapUri: context.bapUri,
        bppId: context.bppId,
        bppUri: context.bppUri,
        city: context.city,
        country: context.country,
        domain: context.domain,
      }),
      message: {
        feedback_ack: true,
        rating_ack: true,
      },
    };

    try {
      const authHeaders = await this.ondcUtilService.createAuthorizationHeader({
        message: onRatingRequest,
        subscriberId: subscriber.id,
        subscriberUniqueKeyId: subscriber.uniqueKeyId,
        privateKey: subscriber.privateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/on_rating`,
        onRatingRequest,
        {
          headers: {
            accept: 'application/json',
            authorization: authHeaders,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async onSupport({ context, subscriber }: IOnSupport) {
    const onSupportRequest: IOnSupportRequest = {
      context: this.createOndcRequestContext({
        action: 'on_search',
        bapId: context.bapId,
        bapUri: context.bapUri,
        bppId: context.bppId,
        bppUri: context.bppUri,
        city: context.city,
        country: context.country,
        domain: context.domain,
      }),
      message: {
        phone: 'string',
        email: 'user@example.com',
        uri: 'http://example.com',
      },
    };

    try {
      const authHeaders = await this.ondcUtilService.createAuthorizationHeader({
        message: onSupportRequest,
        subscriberId: subscriber.id,
        subscriberUniqueKeyId: subscriber.uniqueKeyId,
        privateKey: subscriber.privateKey,
      });

      const response = await this.httpService.axiosRef.post(
        `${this.ONDC_GATEWAY_URL}/on_support`,
        onSupportRequest,
        {
          headers: {
            accept: 'application/json',
            authorization: authHeaders,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }
}
