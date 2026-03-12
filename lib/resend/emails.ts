import { Resend } from 'resend'
import InvitationEmail from '@/emails/InvitationEmail'
import ResetPasswordEmail from '@/emails/ResetPasswordEmail'
import WelcomeEmail from '@/emails/WelcomeEmail'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendInvitationEmail(params: {
  email: string
  prenom: string
  otpCode: string
}) {
  const FROM = process.env.RESEND_FROM!
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL!
  return getResend().emails.send({
    from: FROM,
    to: params.email,
    subject: 'Votre invitation — Portail RH ACCG',
    react: InvitationEmail({
      prenom: params.prenom,
      otpCode: params.otpCode,
      activationUrl: `${APP_URL}/activation`,
    }),
  })
}

export async function sendResetPasswordEmail(params: {
  email: string
  prenom: string
  otpCode: string
}) {
  const FROM = process.env.RESEND_FROM!
  return getResend().emails.send({
    from: FROM,
    to: params.email,
    subject: 'Réinitialisation de votre mot de passe',
    react: ResetPasswordEmail({
      prenom: params.prenom,
      otpCode: params.otpCode,
    }),
  })
}

export async function sendWelcomeEmail(params: { email: string; prenom: string }) {
  const FROM = process.env.RESEND_FROM!
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL!
  return getResend().emails.send({
    from: FROM,
    to: params.email,
    subject: 'Bienvenue sur le portail RH ACCG',
    react: WelcomeEmail({ prenom: params.prenom, appUrl: APP_URL }),
  })
}
