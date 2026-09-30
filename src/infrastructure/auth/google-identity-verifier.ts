import { OAuth2Client } from 'google-auth-library';
import { ApplicationError } from '../../application/errors';
import type {
  ExternalIdentityVerifier,
  VerifiedExternalIdentity,
} from '../../application/ports/services';

/** Verifica ID tokens de Google sin conservar credenciales ni tokens remotos. */
export class GoogleIdentityVerifier implements ExternalIdentityVerifier {
  readonly provider = 'google' as const;
  private readonly client = new OAuth2Client();

  constructor(private readonly clientId: string) {
    if (!clientId.trim()) throw new Error('PUBLIC_GOOGLE_CLIENT_ID es obligatorio para habilitar Google.');
  }

  async verifyIdToken(idToken: string): Promise<VerifiedExternalIdentity> {
    if (!idToken.trim() || idToken.length > 8192) {
      throw new ApplicationError('EXTERNAL_IDENTITY_INVALID', 'La credencial de Google no es válida.');
    }
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      const payload = ticket.getPayload();
      if (
        !payload?.sub
        || !payload.email
        || payload.email_verified !== true
        || payload.sub.length > 255
      ) {
        throw new ApplicationError('EXTERNAL_IDENTITY_INVALID', 'La cuenta de Google no pudo verificarse.');
      }
      return {
        provider: 'google',
        subject: payload.sub,
        email: payload.email,
        emailVerified: true,
        ...(payload.name ? { displayName: payload.name } : {}),
      };
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw new ApplicationError('EXTERNAL_IDENTITY_INVALID', 'La cuenta de Google no pudo verificarse.');
    }
  }
}
