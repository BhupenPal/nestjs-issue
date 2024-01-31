import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NetworkParticipant, NetworkParticipantDocument } from './model';

@Injectable()
export class ParticipantService {
  constructor(
    @InjectModel('Network Participants')
    private readonly networkParticipants: Model<NetworkParticipantDocument>,
  ) {}

  async createNetworkParticipant({
    subscriberId,
    keyPairs,
    requestId,
  }: {
    subscriberId: string;
    keyPairs: {
      signingPublicKey: string;
      signingPrivateKey: string;
      encryptionPublicKey: string;
      encryptionPrivateKey: string;
    };
    requestId: string;
  }) {
    const newNetworkParticipant = new NetworkParticipant({
      subscriberId,
      keyPairs,
      requestId,
    });

    const participant = await this.networkParticipants.create(
      newNetworkParticipant,
    );

    return participant;
  }

  async findNetworkParticipantBySubscriberId(subscriberId: string) {
    const participant = await this.networkParticipants.findOne({
      subscriberId,
    });

    if (!participant) {
      throw new Error('Participant not found');
    }

    return {
      uniqueKeyId: participant._id.toString(),
      keyPairs: participant.keyPairs,
      subscriberId: participant.subscriberId,
    };
  }

  async saveWebhookPayload({
    challenge,
    subscriberId,
  }: {
    challenge: string;
    subscriberId: string;
  }) {
    const participant = await this.networkParticipants.findOne({
      subscriberId,
    });

    if (!participant) {
      throw new Error('Participant not found');
    }

    participant.webhookPayload = {
      challenge,
      subscriber_id: subscriberId,
    };

    await participant.save();

    return participant;
  }

  async saveWebhookResponse({
    answer,
    subscriberId,
  }: {
    answer: string;
    subscriberId: string;
  }) {
    const participant = await this.networkParticipants.findOne({
      subscriberId,
    });

    if (!participant) {
      throw new Error('Participant not found');
    }

    participant.webhookResponse = { answer };

    await participant.save();

    return participant;
  }
}
