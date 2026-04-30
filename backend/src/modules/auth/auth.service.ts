import crypto from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import type { SentMessageInfo, Transporter } from "nodemailer";
import { User, RefreshToken } from "../../models";
import { AppError } from "../../middleware/errorHandler";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshExpiryDate,
} from "../../utils/jwt";

function hashRefreshToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildRefreshTokenLookup(token: string) {
  const hashedToken = hashRefreshToken(token);
  return {
    $or: [{ token: hashedToken }, { token }],
  };
}

interface MailTransportContext {
  transporter: Transporter;
  from: string;
  usingEthereal: boolean;
}

let mailTransportPromise: Promise<MailTransportContext> | null = null;

function hasSmtpCredentials() {
  return env.SMTP_USER.trim().length > 0 && env.SMTP_PASS.trim().length > 0;
}

async function createMailTransport(): Promise<MailTransportContext> {
  if (hasSmtpCredentials()) {
    return {
      transporter: nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      }),
      from: env.SMTP_FROM,
      usingEthereal: false,
    };
  }

  const testAccount = await nodemailer.createTestAccount();

  return {
    transporter: nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    }),
    from: env.SMTP_FROM,
    usingEthereal: true,
  };
}

async function getMailTransport(): Promise<MailTransportContext> {
  if (!mailTransportPromise) {
    mailTransportPromise = createMailTransport().catch((error) => {
      mailTransportPromise = null;
      throw error;
    });
  }

  return mailTransportPromise;
}

function buildPasswordResetEmail(resetUrl: string, name?: string | null) {
  const displayName = name?.trim() || "there";
  const subject = "Reset your AsaLingo password";
  const text = [
    `Hi ${displayName},`,
    "",
    "We received a request to reset your AsaLingo password.",
    `Reset your password: ${resetUrl}`,
    "",
    "This link expires in 1 hour. If you did not request this, you can ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 16px; font-size: 14px; color: #475569;">AsaLingo</p>
        <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0f172a;">Reset your password</h1>
        <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #334155;">
          Hi ${displayName}, we received a request to reset your AsaLingo password.
        </p>
        <div style="margin: 0 0 24px;">
          <a
            href="${resetUrl}"
            style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 22px; border-radius: 14px; font-weight: 700;"
          >
            Reset password
          </a>
        </div>
        <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #475569;">
          This link expires in 1 hour. If the button does not work, copy and paste this URL into your browser:
        </p>
        <p style="margin: 0 0 24px; word-break: break-all; font-size: 14px; line-height: 1.6; color: #4f46e5;">
          ${resetUrl}
        </p>
        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">
          If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;

  return { subject, text, html };
}

function logPasswordResetPreview(info: SentMessageInfo, usingEthereal: boolean) {
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    logger.info(`Password reset email preview URL: ${previewUrl}`);
  }

  if (usingEthereal) {
    logger.info("Password reset email sent using Ethereal test SMTP account");
  }
}

async function sendPasswordResetEmail(
  user: { email: string; name?: string | null },
  resetUrl: string
) {
  const { transporter, from, usingEthereal } = await getMailTransport();
  const message = buildPasswordResetEmail(resetUrl, user.name);
  const info = await transporter.sendMail({
    from,
    to: user.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  logPasswordResetPreview(info, usingEthereal);
}

export async function registerUser(name: string, email: string, password: string) {
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) throw new AppError("Email already in use", 409);

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  const user = await User.create({
    name,
    email,
    passwordHash,
    authProvider: "EMAIL",
  });

  return { tokens: await issueTokens(user._id, user.email), user };
}

export async function loginUser(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !user.passwordHash) {
    throw new AppError("Invalid credentials", 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError("Invalid credentials", 401);

  return { tokens: await issueTokens(user._id, user.email), user };
}

export async function issueTokens(userId: string, email: string) {
  const accessToken = signAccessToken({ sub: userId, email });
  const refreshToken = signRefreshToken({ sub: userId, email });

  await RefreshToken.create({
    token: hashRefreshToken(refreshToken),
    userId,
    expiresAt: getRefreshExpiryDate(),
  });

  return { accessToken, refreshToken };
}

export async function refreshTokens(oldRefreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const stored = await RefreshToken.findOne(buildRefreshTokenLookup(oldRefreshToken));

  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await RefreshToken.deleteOne({ _id: stored._id });
    throw new AppError("Invalid or expired refresh token", 401);
  }

  // Rotate token
  await RefreshToken.deleteOne({ _id: stored._id });

  return issueTokens(payload.sub, payload.email);
}

export async function logoutUser(userId: string, refreshToken?: string) {
  if (refreshToken) {
    await RefreshToken.deleteOne({
      userId,
      ...buildRefreshTokenLookup(refreshToken),
    });
  } else {
    // Delete all refresh tokens for this user (logout all devices)
    await RefreshToken.deleteMany({ userId });
  }
}

// ─── Password reset ───────────────────────────────────────────────────────────

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "+passwordResetTokenHash +passwordResetExpires name email"
  );

  // Return silently regardless — prevents email enumeration
  if (!user || user.authProvider !== "EMAIL") return;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(
    {
      email: user.email,
      name: user.name,
    },
    resetUrl
  );
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpires");

  if (!user) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // Revoke all existing sessions for this user
  await RefreshToken.deleteMany({ userId: user._id });
}
