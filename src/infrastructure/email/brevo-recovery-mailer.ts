import type { EmailVerificationMailer, PasswordRecoveryMailer } from '../../application/ports/services';

/** Correo transaccional por HTTPS; admite un remitente verificado sin dominio propio. */
export class BrevoRecoveryMailer implements PasswordRecoveryMailer, EmailVerificationMailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly http: typeof fetch = fetch,
  ) {}

  private async send(to: string, subject: string, message: string): Promise<void> {
    const response = await this.http('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.from, name: 'Roman Colosseum' },
        to: [{ email: to }],
        subject,
        textContent: message,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('El servicio de correo rechazó el envío.');
  }

  sendResetLink(to: string, url: string): Promise<void> {
    return this.send(
      to,
      'Restablece tu contraseña de Roman Colosseum',
      `Recibimos una solicitud para restablecer tu contraseña. Abre este enlace durante los próximos 30 minutos:\n\n${url}\n\nSi no solicitaste el cambio, ignora este mensaje.`,
    );
  }

  sendVerificationLink(to: string, url: string): Promise<void> {
    return this.send(
      to,
      'Confirma tu correo de Roman Colosseum',
      `Confirma tu correo para activar tu cuenta. Este enlace vence en 24 horas:\n\n${url}\n\nSi no creaste una cuenta, ignora este mensaje.`,
    );
  }

  sendPasswordChanged(to: string): Promise<void> {
    return this.send(
      to,
      'Tu contraseña de Roman Colosseum cambió',
      'La contraseña de tu cuenta se restableció correctamente. Si no fuiste tú, contacta al equipo de la plataforma.',
    );
  }
}
