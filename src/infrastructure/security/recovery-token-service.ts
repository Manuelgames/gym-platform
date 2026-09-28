import { createHash, randomBytes } from 'node:crypto';
import type { RecoveryTokenService } from '../../application/ports/services';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** 256 bits aleatorios; el token original solo viaja en el enlace del correo. */
export class CryptoRecoveryTokenService implements RecoveryTokenService {
  issue(): { token: string; digest: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, digest: this.digest(token)! };
  }

  digest(token: string): string | null {
    if (!TOKEN_PATTERN.test(token)) return null;
    return createHash('sha256').update(token).digest('hex');
  }
}
