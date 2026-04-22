import nodemailer from "nodemailer";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private isConfigured: boolean;
  private mailtrapApiToken?: string;
  private smtpHost: string;
  private smtpPort: number;
  private smtpSecure: boolean;

  constructor() {
    this.mailtrapApiToken = process.env.MAILTRAP_API_TOKEN || undefined;
    this.isConfigured = Boolean(
      this.mailtrapApiToken || (process.env.SMTP_USER && process.env.SMTP_PASS),
    );
    this.smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    this.smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
    this.smtpSecure =
      process.env.SMTP_SECURE === "true" || this.smtpPort === 465;

    this.transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpSecure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  canSendEmails(): boolean {
    return this.isConfigured;
  }

  private isMailtrapApiConfigured(): boolean {
    return Boolean(this.mailtrapApiToken);
  }

  getTransportDescription(): string {
    if (this.isMailtrapApiConfigured()) {
      return "mailtrap-api";
    }

    if (this.isConfigured) {
      return `smtp:${this.smtpHost}:${this.smtpPort}`;
    }

    return "unconfigured";
  }

  async verifyConnection(): Promise<void> {
    if (!this.isConfigured) {
      console.warn("[EmailService] Email transport is not configured");
      return;
    }

    if (this.isMailtrapApiConfigured()) {
      console.log("[EmailService] Mailtrap API transport configured");
      return;
    }

    await this.transporter.verify();
    console.log(
      `[EmailService] SMTP connection verified for ${this.smtpHost}:${this.smtpPort}`,
    );
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.isConfigured) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "Email delivery is not configured. Set MAILTRAP_API_TOKEN or SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and FROM_EMAIL in backend/.env",
        );
      }

      console.warn(
        `[EmailService] Email delivery is not configured. Skipping email to ${options.to} with subject: ${options.subject}`,
      );
      return;
    }

    try {
      if (this.isMailtrapApiConfigured()) {
        const response = await fetch(
          process.env.MAILTRAP_API_URL ||
            "https://send.api.mailtrap.io/api/send",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.mailtrapApiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: {
                email: process.env.FROM_EMAIL || "hello@demomailtrap.co",
                name: process.env.FROM_NAME || "MemoHub",
              },
              to: [{ email: options.to }],
              subject: options.subject,
              text: options.text,
              html: options.html,
              category: "MemoHub",
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Mailtrap API send failed: ${errorText}`);
        }

        console.log(
          `Email sent successfully to ${options.to} via Mailtrap API`,
        );
        return;
      }

      const mailOptions = {
        from: `"${process.env.FROM_NAME || "MemoHub"}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${options.to}`);
    } catch (error) {
      console.error("Failed to send email:", error);
      throw new Error("Failed to send email");
    }
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 36px 40px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">MemoHub</h1>
        </div>
        <div style="padding: 40px;">
          <h2 style="color: #111827; margin: 0 0 12px; font-size: 20px; font-weight: 600;">Reset your password</h2>
          <p style="color: #6b7280; margin: 0 0 28px; font-size: 15px; line-height: 1.6;">We received a request to reset the password for your MemoHub account. Click the button below to choose a new password.</p>
          <div style="text-align: center; margin: 0 0 28px;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 15px; font-weight: 600; letter-spacing: 0.2px;">Click here to reset your password</a>
          </div>
          <p style="color: #9ca3af; margin: 0; font-size: 13px; line-height: 1.6;">This link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email &mdash; your password will not change.</p>
        </div>
        <div style="background: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #f3f4f6;">
          <p style="color: #9ca3af; margin: 0; font-size: 12px;">MemoHub &mdash; Secure Memo Management</p>
        </div>
      </div>
    `;

    const text = `
Reset your password

We received a request to reset the password for your MemoHub account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.
    `;

    await this.sendEmail({
      to: email,
      subject: "Reset your MemoHub password",
      html,
      text,
    });
  }

  async sendWelcomeEmail(email: string, userName: string): Promise<void> {
    const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to MemoHub!</h2>
        <p>Hi ${userName},</p>
        <p>Welcome to MemoHub! Your account has been successfully created.</p>
        <p>You can now start creating and sharing memos with your team.</p>
        <a href="${loginUrl}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Get Started</a>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Need help? Contact our support team.</p>
      </div>
    `;

    const text = `
      Welcome to MemoHub!

      Hi ${userName},

      Welcome to MemoHub! Your account has been successfully created.
      You can now start creating and sharing memos with your team.

      Get started: ${loginUrl}

      Need help? Contact our support team.
    `;

    await this.sendEmail({
      to: email,
      subject: "Welcome to MemoHub!",
      html,
      text,
    });
  }

  async sendTwoFactorCodeEmail(email: string, code: string): Promise<void> {
    if (!this.isConfigured && process.env.NODE_ENV !== "production") {
      console.warn(
        `[2FA DEV FALLBACK] Email delivery not configured. Verification code for ${email}: ${code}`,
      );
      return;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Your MemoHub Verification Code</h2>
        <p>Use the code below to complete sign in:</p>
        <p style="font-size: 28px; letter-spacing: 4px; font-weight: bold; color: #111;">${code}</p>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not attempt to sign in, you can ignore this email.</p>
      </div>
    `;

    const text = `Your MemoHub verification code is ${code}. It expires in 10 minutes.`;

    await this.sendEmail({
      to: email,
      subject: "MemoHub verification code",
      html,
      text,
    });
  }
}
