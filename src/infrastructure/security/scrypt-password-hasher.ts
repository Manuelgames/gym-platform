import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { PasswordHasher } from '../../application/ports/services';

const ALGORITHM = 'scrypt';
const FORMAT_VERSION = 'v1';
// OWASP Password Storage Cheat Sheet: N=2^15, r=8, p=3 (mínimo equivalente vigente).
const COST = 32_768;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 3;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;
const DUMMY_HASH = 'scrypt$v1$32768$8$3$Um9tYW5EdW1teVNhbHQwMQ==$YB1arGeqYpPwiHk95JHg0U3LwQ3oXhEiGRnLSEc1qmnIdV0NKmFUpdawbSc5RPExmIXmvHzWIT5OmaMHOYC6XQ==';

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION, maxmem: MAX_MEMORY },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

/**
 * Hash de contraseñas con salt aleatorio y parámetros autocontenidos.
 *
 * Formato: `scrypt$v1$N$r$p$saltBase64$digestBase64`. Esta representación
 * permite elevar parámetros en una versión futura sin invalidar credenciales.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  /** Deriva una credencial de 64 bytes con un salt independiente de 16 bytes. */
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const digest = await derive(password, salt);
    return [
      ALGORITHM,
      FORMAT_VERSION,
      String(COST),
      String(BLOCK_SIZE),
      String(PARALLELIZATION),
      salt.toString('base64'),
      digest.toString('base64'),
    ].join('$');
  }

  /** Rechaza formatos/parametrizaciones desconocidos y compara en tiempo constante. */
  async verify(password: string, encodedHash: string = DUMMY_HASH): Promise<boolean> {
    const [algorithm, version, cost, blockSize, parallelization, saltValue, digestValue, extra] = encodedHash.split('$');
    if (
      extra !== undefined
      || algorithm !== ALGORITHM
      || version !== FORMAT_VERSION
      || cost !== String(COST)
      || blockSize !== String(BLOCK_SIZE)
      || parallelization !== String(PARALLELIZATION)
      || !saltValue
      || !digestValue
    ) {
      return false;
    }

    try {
      const expected = Buffer.from(digestValue, 'base64');
      const salt = Buffer.from(saltValue, 'base64');
      if (expected.length !== KEY_LENGTH || salt.length !== 16) return false;
      const actual = await derive(password, salt);
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}
