import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { IOnSubscribeHook } from '../dto/hook/on-subscribe-hook.dto';

@Schema({ _id: false })
export class NetworkParticipantKeyPairs {
  constructor({
    signingPublicKey,
    signingPrivateKey,
    encryptionPublicKey,
    encryptionPrivateKey,
  }: {
    signingPublicKey: string;
    signingPrivateKey: string;
    encryptionPublicKey: string;
    encryptionPrivateKey: string;
  }) {
    this.signingPublicKey = signingPublicKey;
    this.signingPrivateKey = signingPrivateKey;
    this.encryptionPublicKey = encryptionPublicKey;
    this.encryptionPrivateKey = encryptionPrivateKey;
  }

  @Prop({
    type: String,
    required: true,
  })
  signingPublicKey: string;

  @Prop({
    type: String,
    required: true,
  })
  signingPrivateKey: string;

  @Prop({
    type: String,
    required: true,
  })
  encryptionPublicKey: string;

  @Prop({
    type: String,
    required: true,
  })
  encryptionPrivateKey: string;
}

@Schema()
export class NetworkParticipant {
  constructor({
    _id,
    subscriberId,
    keyPairs,
    webhookPayload,
    requestId,
    webhookResponse,
  }: {
    _id?: Types.ObjectId;
    subscriberId: string;
    keyPairs: NetworkParticipantKeyPairs;
    webhookPayload?: IOnSubscribeHook;
    requestId: string;
    webhookResponse?: { answer: string };
  }) {
    this._id = _id ?? new Types.ObjectId();
    this.subscriberId = subscriberId;
    this.keyPairs = keyPairs;
    this.webhookPayload = webhookPayload ?? null;
    this.requestId = requestId;
    this.webhookResponse = webhookResponse ?? null;
  }

  _id: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
  })
  subscriberId: string;

  @Prop({
    type: NetworkParticipantKeyPairs,
    required: true,
  })
  keyPairs: NetworkParticipantKeyPairs;

  @Prop({
    type: String,
    required: true,
  })
  requestId: string;

  @Prop({
    type: Object,
    required: false,
  })
  webhookPayload: IOnSubscribeHook | null;

  @Prop({
    type: Object,
    required: false,
  })
  webhookResponse: { answer: string } | null;
}

export const NetworkParticipantSchema =
  SchemaFactory.createForClass(NetworkParticipant);

export type NetworkParticipantDocument = NetworkParticipant & Document;
