import { Resend } from 'resend'
import InvitationEmail from '@/emails/InvitationEmail'
import ResetPasswordEmail from '@/emails/ResetPasswordEmail'
import WelcomeEmail from '@/emails/WelcomeEmail'
import CongeApprouveEmail from '@/emails/CongeApprouveEmail'
import CongeRefuseEmail from '@/emails/CongeRefuseEmail'
import ReassignationEmail from '@/emails/ReassignationEmail'

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

export async function sendCongeDecisionEmail(params: {
  email: string
  prenom: string
  decision: 'approuve' | 'refuse'
  type: string
  date_debut: string
  date_fin: string
  nb_jours: number
  commentaire_admin?: string
}) {
  const FROM = process.env.RESEND_FROM!
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL!
  const commonProps = {
    prenom: params.prenom,
    type: params.type,
    date_debut: params.date_debut,
    date_fin: params.date_fin,
    nb_jours: params.nb_jours,
    commentaire_admin: params.commentaire_admin,
    appUrl: APP_URL,
  }
  return getResend().emails.send({
    from: FROM,
    to: params.email,
    subject: params.decision === 'approuve'
      ? 'Votre demande de congé a été approuvée'
      : "Votre demande de congé n'a pas été accordée",
    react: params.decision === 'approuve'
      ? CongeApprouveEmail(commonProps)
      : CongeRefuseEmail(commonProps),
  })
}

export async function sendReassignationEmail(params: {
  email: string
  prenom: string
  bureauNom: string
  date: string
  raisonPrenom: string
  raisonNom: string
}) {
  try {
    const FROM = process.env.RESEND_FROM!
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL!
    return await getResend().emails.send({
      from: FROM,
      to: params.email,
      subject: `Demande de réaffectation — Bureau ${params.bureauNom} le ${params.date}`,
      react: ReassignationEmail({
        prenom: params.prenom,
        bureauNom: params.bureauNom,
        date: params.date,
        raisonPrenom: params.raisonPrenom,
        raisonNom: params.raisonNom,
        appUrl: APP_URL,
      }),
    })
  } catch (err) {
    console.error('[sendReassignationEmail] Erreur envoi email:', err)
    return null
  }
}
