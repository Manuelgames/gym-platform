import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthUseCases } from '../../src/application/use-cases/auth';
import { FileDataStore } from '../../src/infrastructure/persistence/file/file-data-store';
import { CryptoRecoveryTokenService } from '../../src/infrastructure/security/recovery-token-service';
import { ScryptPasswordHasher } from '../../src/infrastructure/security/scrypt-password-hasher';

const directories: string[] = [];

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'email-verification-'));
  directories.push(directory);
  const file = join(directory, 'database.json');
  const store = new FileDataStore(file);
  let now = '2026-09-27T12:00:00.000Z';
  let nextId = 0;
  const mailer = {
    sendVerificationLink: vi.fn(async (_to: string, _url: string) => undefined),
  };
  const auth = new AuthUseCases(
    store,
    new ScryptPasswordHasher(),
    { now: () => now },
    { next: () => `user-${nextId += 1}` },
    new CryptoRecoveryTokenService(),
    mailer,
    'https://gym.example',
  );
  const registration = {
    name: 'Usuario de prueba',
    email: 'usuario@example.com',
    password: 'clave-segura-2026',
    birthDate: '1990-01-01',
    sex: 'prefiero no decirlo',
  };
  return { auth, file, mailer, registration, store, setNow: (value: string) => { now = value; } };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('confirmación de correo', () => {
  it('bloquea el acceso hasta consumir una sola vez el enlace recibido', async () => {
    const { auth, file, mailer, registration } = await fixture();
    await expect(auth.register(registration)).resolves.toBe('sent');
    expect(mailer.sendVerificationLink).toHaveBeenCalledTimes(1);

    const link = new URL(mailer.sendVerificationLink.mock.calls[0]![1]);
    const userId = link.searchParams.get('userId')!;
    const token = link.searchParams.get('token')!;
    expect(link.origin).toBe('https://gym.example');
    expect(await readFile(file, 'utf8')).not.toContain(token);
    await expect(auth.login({ email: registration.email, password: registration.password }))
      .rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });

    await auth.verifyEmail(userId, token);
    await expect(auth.login({ email: registration.email, password: registration.password }))
      .resolves.toMatchObject({ id: userId, email: registration.email });
    await expect(auth.verifyEmail(userId, token))
      .rejects.toMatchObject({ code: 'EMAIL_VERIFICATION_INVALID' });
  });

  it('invalida el enlace anterior cuando se solicita uno nuevo', async () => {
    const { auth, mailer, registration } = await fixture();
    await auth.register(registration);
    const first = new URL(mailer.sendVerificationLink.mock.calls[0]![1]);
    await auth.requestEmailVerification(registration.email);
    const second = new URL(mailer.sendVerificationLink.mock.calls[1]![1]);

    await expect(auth.verifyEmail(
      first.searchParams.get('userId')!, first.searchParams.get('token')!,
    )).rejects.toMatchObject({ code: 'EMAIL_VERIFICATION_INVALID' });
    await expect(auth.verifyEmail(
      second.searchParams.get('userId')!, second.searchParams.get('token')!,
    )).resolves.toBeUndefined();
  });

  it('rechaza enlaces vencidos y retira los que el proveedor no entregó', async () => {
    const { auth, mailer, registration, setNow, store } = await fixture();
    await auth.register(registration);
    const link = new URL(mailer.sendVerificationLink.mock.calls[0]![1]);
    setNow('2026-09-28T12:00:01.000Z');
    await expect(auth.verifyEmail(
      link.searchParams.get('userId')!, link.searchParams.get('token')!,
    )).rejects.toMatchObject({ code: 'EMAIL_VERIFICATION_INVALID' });

    mailer.sendVerificationLink.mockRejectedValueOnce(new Error('fallo del proveedor'));
    await expect(auth.requestEmailVerification(registration.email)).resolves.toBeUndefined();
    expect((await store.findByEmail(registration.email))?.emailVerification).toBeNull();
  });
});
