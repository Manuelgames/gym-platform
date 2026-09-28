import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasswordRecoveryUseCases } from '../../src/application/use-cases/password-recovery';
import { createPasswordUser } from '../../src/domain/users/user';
import { FileDataStore } from '../../src/infrastructure/persistence/file/file-data-store';
import { createEmptyDatabase, parsePersistedDatabase } from '../../src/infrastructure/persistence/file/schema';
import { CryptoRecoveryTokenService } from '../../src/infrastructure/security/recovery-token-service';
import { ScryptPasswordHasher } from '../../src/infrastructure/security/scrypt-password-hasher';

const directories: string[] = [];

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'recovery-'));
  directories.push(directory);
  const file = join(directory, 'database.json');
  const store = new FileDataStore(file);
  const passwords = new ScryptPasswordHasher();
  let now = '2026-09-27T12:00:00.000Z';
  const user = {
    ...createPasswordUser({
    id: 'user-1', name: 'Usuario', email: 'usuario@example.com',
    passwordHash: await passwords.hash('primera-clave'), birthDate: '1990-01-01',
    sex: 'prefiero no decirlo', now,
    }),
    emailVerifiedAt: now,
  };
  await store.create(user);
  const mailer = {
    sendResetLink: vi.fn(async (_to: string, _url: string) => undefined),
    sendPasswordChanged: vi.fn(async (_to: string) => undefined),
  };
  const recovery = new PasswordRecoveryUseCases(
    store, passwords, { now: () => now }, new CryptoRecoveryTokenService(),
    mailer, 'https://gym.example',
  );
  return { store, file, passwords, mailer, recovery, setNow: (value: string) => { now = value; } };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('recuperación de contraseña', () => {
  it('mantiene genérica la respuesta y nunca persiste el token recibido por correo', async () => {
    const { recovery, mailer, file, store } = await fixture();
    await expect(recovery.request('inexistente@example.com')).resolves.toBeUndefined();
    expect(mailer.sendResetLink).not.toHaveBeenCalled();

    await recovery.request('usuario@example.com');
    expect(mailer.sendResetLink).toHaveBeenCalledTimes(1);
    const link = new URL(mailer.sendResetLink.mock.calls[0]![1]);
    const token = link.searchParams.get('token')!;
    expect(link.origin).toBe('https://gym.example');
    expect(await readFile(file, 'utf8')).not.toContain(token);
    expect((await store.findById('user-1'))?.passwordReset?.tokenDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('cambia la clave una sola vez e invalida las sesiones anteriores', async () => {
    const { recovery, mailer, store, passwords } = await fixture();
    await recovery.request('usuario@example.com');
    const link = new URL(mailer.sendResetLink.mock.calls[0]![1]);
    const token = link.searchParams.get('token')!;
    const userId = link.searchParams.get('userId')!;

    const outcomes = await Promise.allSettled([
      recovery.reset(userId, token, 'segunda-clave', 'segunda-clave'),
      recovery.reset(userId, token, 'tercera-clave', 'tercera-clave'),
    ]);
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    const user = (await store.findById(userId))!;
    expect(user.passwordReset).toBeNull();
    expect(user.sessionVersion).toBe(1);
    expect(await passwords.verify('primera-clave', user.identities[0]?.provider === 'password' ? user.identities[0].credentialHash : '')).toBe(false);
    await expect(recovery.reset(userId, token, 'cuarta-clave', 'cuarta-clave')).rejects.toMatchObject({ code: 'RESET_LINK_INVALID' });
    expect(mailer.sendPasswordChanged).toHaveBeenCalledTimes(1);
  });

  it('rechaza un enlace vencido y conserva la clave original', async () => {
    const { recovery, mailer, store, setNow } = await fixture();
    await recovery.request('usuario@example.com');
    const link = new URL(mailer.sendResetLink.mock.calls[0]![1]);
    setNow('2026-09-27T12:31:00.000Z');
    await expect(recovery.reset(
      link.searchParams.get('userId')!, link.searchParams.get('token')!,
      'segunda-clave', 'segunda-clave',
    )).rejects.toMatchObject({ code: 'RESET_LINK_INVALID' });
    expect((await store.findById('user-1'))?.sessionVersion).toBe(0);
  });

  it('retira un enlace cuando el proveedor rechaza el envío', async () => {
    const { recovery, mailer, store } = await fixture();
    mailer.sendResetLink.mockRejectedValueOnce(new Error('fallo del proveedor'));
    await expect(recovery.request('usuario@example.com')).resolves.toBeUndefined();
    expect((await store.findById('user-1'))?.passwordReset).toBeNull();
  });

  it('informa que falta configurar el correo sin un proveedor', async () => {
    const { store, passwords } = await fixture();
    const recovery = new PasswordRecoveryUseCases(
      store, passwords, { now: () => '2026-09-27T12:00:00.000Z' },
      new CryptoRecoveryTokenService(), null, 'https://gym.example',
    );
    await expect(recovery.request('usuario@example.com')).rejects.toMatchObject({ code: 'RECOVERY_UNAVAILABLE' });
  });

  it('migra usuarios v7 sin tocar credenciales ni identidad', async () => {
    const { store } = await fixture();
    const user = (await store.findById('user-1'))!;
    const {
      passwordReset: _reset,
      sessionVersion: _version,
      emailVerification: _verification,
      emailVerifiedAt: _verifiedAt,
      ...legacyUser
    } = user;
    const migrated = parsePersistedDatabase({
      ...createEmptyDatabase(), schemaVersion: 7, users: [legacyUser],
    });
    expect(migrated.schemaVersion).toBe(9);
    expect(migrated.users[0]).toMatchObject({
      id: 'user-1', identities: user.identities, passwordReset: null, sessionVersion: 0,
      emailVerification: null, emailVerifiedAt: null,
    });
  });
});
