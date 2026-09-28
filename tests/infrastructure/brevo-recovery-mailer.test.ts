import { describe, expect, it, vi } from 'vitest';
import { BrevoRecoveryMailer } from '../../src/infrastructure/email/brevo-recovery-mailer';

describe('correo de recuperación mediante Brevo', () => {
  it('envía el enlace por la API HTTPS con el remitente configurado', async () => {
    const http = vi.fn(async () => new Response(null, { status: 201 }));
    const mailer = new BrevoRecoveryMailer('clave-de-prueba', 'propietario@example.com', http as typeof fetch);
    const link = 'https://gym.example/restablecer-contrasena?userId=1&token=secreto';
    await mailer.sendResetLink('usuario@example.com', link);

    const [url, options] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({ 'api-key': 'clave-de-prueba' });
    expect(JSON.parse(String(options.body))).toMatchObject({
      sender: { email: 'propietario@example.com', name: 'Roman Colosseum' },
      to: [{ email: 'usuario@example.com' }],
      textContent: expect.stringContaining(link),
    });
  });

  it('rechaza una entrega que el proveedor no aceptó', async () => {
    const http = vi.fn(async () => new Response(null, { status: 401 }));
    const mailer = new BrevoRecoveryMailer('clave', 'propietario@example.com', http as typeof fetch);
    await expect(mailer.sendPasswordChanged('usuario@example.com')).rejects.toThrow('rechazó');
  });

  it('envía enlaces de confirmación con la misma identidad verificada', async () => {
    const http = vi.fn(async () => new Response(null, { status: 201 }));
    const mailer = new BrevoRecoveryMailer('clave', 'propietario@example.com', http as typeof fetch);
    const link = 'https://gym.example/verificar-correo?userId=1&token=secreto';
    await mailer.sendVerificationLink('usuario@example.com', link);

    const [, options] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toMatchObject({
      sender: { email: 'propietario@example.com', name: 'Roman Colosseum' },
      subject: 'Confirma tu correo de Roman Colosseum',
      textContent: expect.stringContaining(link),
    });
  });
});
