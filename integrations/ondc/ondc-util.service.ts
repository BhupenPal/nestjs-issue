import { Injectable } from '@nestjs/common';
import sodium from 'libsodium-wrappers';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';

@Injectable()
export class OndcUtilService {
  constructor() {}

  private async signMessage({
    msgToSign,
    privateKey,
  }: {
    msgToSign: string;
    privateKey: string;
  }) {
    await sodium.ready;

    const signedMessage = sodium.crypto_sign_detached(
      msgToSign,
      sodium.from_base64(privateKey, sodium.base64_variants.ORIGINAL),
    );

    const signature = sodium.to_base64(
      signedMessage,
      sodium.base64_variants.ORIGINAL,
    );

    return signature;
  }

  async generateSigningAndEncryptionKeyPairs() {
    const signingKey = crypto.generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    const signingPrivateKey = Buffer.from(
      signingKey.privateKey
        .replace(/-----BEGIN PRIVATE KEY-----\r?\n?/, '')
        .replace(/-----END PRIVATE KEY-----\r?\n?/, '')
        .trim(),
    ).toString('base64');
    const signingPublicKey = Buffer.from(
      signingKey.publicKey
        .replace(/-----BEGIN PRIVATE KEY-----\r?\n?/, '')
        .replace(/-----END PRIVATE KEY-----\r?\n?/, '')
        .trim(),
    ).toString('base64');

    const encryptionKey = crypto.generateKeyPairSync('x25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      publicKeyEncoding: { type: 'spki', format: 'der' },
    });

    const encryptionPrivateKey = encryptionKey.privateKey.toString('base64');
    const encryptionPublicKey = encryptionKey.publicKey.toString('base64');

    return {
      signingPrivateKey,
      signingPublicKey,
      encryptionPrivateKey,
      encryptionPublicKey,
    };
  }

  async generateRequestId({ privateKey }: { privateKey: string }) {
    const requestId = uuid();

    const signedRequestId = await this.signMessage({
      msgToSign: requestId,
      privateKey,
    });

    return {
      requestId,
      signedRequestId,
    };
  }

  async createAuthorizationHeader({
    message,
    subscriberId,
    subscriberUniqueKeyId,
    privateKey,
  }: {
    message: object;
    subscriberId: string;
    subscriberUniqueKeyId: string;
    privateKey: string;
  }) {
    await sodium.ready;

    const createdAt = Math.floor(Date.now() / 1000).toString();
    const expiresAt = Math.floor(parseInt(createdAt) + 10 * 60).toString(); // Adds 10 minute

    const digest = sodium.crypto_generichash(
      64,
      sodium.from_string(JSON.stringify(message)),
    );

    const digestBase64 = sodium.to_base64(
      digest,
      sodium.base64_variants.ORIGINAL,
    );

    const signature = await this.signMessage({
      msgToSign: `(created): ${createdAt} \n (expires): ${expiresAt} \n digest: BLAKE-512=${digestBase64}`,
      privateKey,
    });

    const header = `Signature keyId="${subscriberId}|${subscriberUniqueKeyId}|ed25519",algorithm="ed25519",created="${createdAt}",expires="${expiresAt}",headers="(created) (expires) digest",signature="${signature}"`;
    return header;
  }
}
