import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type DeliveryMode = 'simulation' | 'smtp';
type MailTransport = {
  sendMail(input: {
    disableFileAccess: boolean;
    disableUrlAccess: boolean;
    from: string;
    html: string;
    subject: string;
    text: string;
    to: string;
  }): Promise<{ messageId: string }>;
};
type SmtpTransportConfiguration = {
  auth: { pass: string; user: string };
  host: string;
  pool: boolean;
  port: number;
  secure: boolean;
  tls: { minVersion: string };
};

@Injectable()
export class EmailDeliveryService {
  private transporter: MailTransport | null = null;

  mode(): DeliveryMode {
    if (process.env.NODE_ENV === 'production') return 'smtp';
    const configured = process.env.EMAIL_DELIVERY_MODE?.trim().toLowerCase();
    if (configured === 'smtp' || configured === 'simulation') return configured;
    return 'simulation';
  }

  assertReady() {
    if (this.mode() === 'simulation') return;
    this.smtpConfiguration();
  }

  async send(input: { html: string; subject: string; to: string }) {
    this.assertMessage(input);
    if (this.mode() === 'simulation') {
      return { messageId: 'simulation', mode: 'simulation' as const };
    }

    const configuration = this.smtpConfiguration();
    const createTransport = nodemailer.createTransport as unknown as (
      options: SmtpTransportConfiguration,
    ) => MailTransport;
    this.transporter ??= createTransport({
      auth: {
        pass: configuration.password,
        user: configuration.user,
      },
      host: configuration.host,
      port: configuration.port,
      pool: true,
      secure: configuration.secure,
      tls: { minVersion: 'TLSv1.2' },
    });
    const result = await this.transporter.sendMail({
      disableFileAccess: true,
      disableUrlAccess: true,
      from: configuration.from,
      html: input.html,
      subject: input.subject,
      text: input.html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
      to: input.to,
    });
    return { messageId: result.messageId, mode: 'smtp' as const };
  }

  private assertMessage(input: { html: string; subject: string; to: string }) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to) || input.to.length > 254) {
      throw new BadRequestException('El destinatario del correo no es valido.');
    }
    if (
      !input.subject ||
      input.subject.length > 180 ||
      /[\r\n]/.test(input.subject)
    ) {
      throw new BadRequestException('El asunto del correo no es valido.');
    }
    if (!input.html || input.html.length > 250_000) {
      throw new BadRequestException('El contenido del correo no es valido.');
    }
  }

  private smtpConfiguration() {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASSWORD?.trim();
    const from = process.env.SMTP_FROM?.trim();
    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure = process.env.SMTP_SECURE === 'true';

    if (
      !host ||
      !user ||
      !password ||
      !from ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65_535 ||
      /[\r\n]/.test(host) ||
      /[\r\n]/.test(from)
    ) {
      throw new ServiceUnavailableException(
        'El envio SMTP no esta configurado. Los correos permanecen pendientes.',
      );
    }
    return { from, host, password, port, secure, user };
  }
}
