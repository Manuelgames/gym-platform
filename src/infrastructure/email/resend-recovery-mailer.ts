import type { EmailVerificationMailer, PasswordRecoveryMailer } from '../../application/ports/services';

/** Resend usa HTTPS, compatible con el plan Hobby de Railway. */
export class ResendRecoveryMailer implements PasswordRecoveryMailer, EmailVerificationMailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  private async send(to: string, subject: string, message: string): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to: [to], subject, text: message }),
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
