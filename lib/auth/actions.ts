'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  sendInvitationEmail,
  sendResetPasswordEmail,
  sendWelcomeEmail,
} from '@/lib/resend/emails'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/auth/rate-limit'

function generateOTP(): string {
  return String(randomInt(100000, 999999))
}

// --- Connexion ---
export async function signIn(_prev: unknown, formData: FormData) {
  const email = (formData.get('email') as string)?.trim()
  if (!email) return { error: 'Email requis.' }

  const allowed = await checkRateLimit(email)
  if (!allowed) return { error: 'Trop de tentatives. Réessayez dans 15 minutes.' }

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: formData.get('password') as string,
  })
  if (error) {
    await recordFailedAttempt(email)
    return { error: 'Email ou mot de passe incorrect.' }
  }
  await resetRateLimit(email)
  redirect('/profil')
}

// --- Déconnexion ---
export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// --- Invitation (admin uniquement, via createAdminClient) ---
export async function inviteWorker(data: {
  prenom: string
  nom: string
  email: string
  service_id: string
  option_horaire: 'A' | 'B'
  type_contrat?: string
  date_entree?: string
}) {
  const admin = createAdminClient()

  // 1. Créer l'utilisateur dans auth.users
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: data.email,
    email_confirm: false,
    app_metadata: { is_admin_rh: false },
  })
  if (authError) return { error: authError.message }

  // 2. Créer le profil
  const { error: profileError } = await admin.from('profiles').insert({
    id: authUser.user.id,
    prenom: data.prenom,
    nom: data.nom,
    email: data.email,
    service_id: data.service_id,
    option_horaire: data.option_horaire,
    type_contrat: data.type_contrat ?? null,
    date_entree: data.date_entree ?? null,
  })
  if (profileError) return { error: profileError.message }

  // 3. Générer OTP et stocker le hash (jamais en clair)
  const otp = generateOTP()
  const otpHash = await bcrypt.hash(otp, 10)
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { error: tokenError } = await admin.from('invitation_tokens').insert({
    user_id: authUser.user.id,
    otp_hash: otpHash,
    expires_at: expiresAt,
  })
  if (tokenError) return { error: tokenError.message }

  // 4. Envoyer email d'invitation
  await sendInvitationEmail({
    email: data.email,
    prenom: data.prenom,
    otpCode: otp,
  })

  return { success: true }
}

// --- Activation de compte ---
export async function activateAccount(_prev: unknown, formData: FormData) {
  const email = formData.get('email') as string
  const otp = formData.get('otp') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (password !== confirmPassword)
    return { error: 'Les mots de passe ne correspondent pas.' }
  if (password.length < 8)
    return { error: 'Le mot de passe doit comporter au moins 8 caractères.' }

  const admin = createAdminClient()
  const minDelay = new Promise((r) => setTimeout(r, 300))

  const { data: profile } = await admin
    .from('profiles')
    .select('id, prenom')
    .eq('email', email)
    .single()

  if (!profile) {
    await minDelay
    return { error: 'Code incorrect ou expiré.' }
  }

  const { data: token } = await admin
    .from('invitation_tokens')
    .select('id, otp_hash, expires_at, used_at')
    .eq('user_id', profile.id)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!token) {
    await minDelay
    return { error: 'Code incorrect ou expiré.' }
  }
  if (new Date(token.expires_at) < new Date()) {
    await minDelay
    return { error: 'Code expiré (valable 48h). Contactez votre administrateur.' }
  }

  const isValid = await bcrypt.compare(otp, token.otp_hash)
  await minDelay
  if (!isValid) return { error: 'Code incorrect ou expiré.' }

  // Définir le mot de passe et confirmer l'email
  const { error: pwError } = await admin.auth.admin.updateUserById(profile.id, {
    password,
    email_confirm: true,
  })
  if (pwError) return { error: pwError.message }

  // Marquer le token comme utilisé
  await admin
    .from('invitation_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', token.id)

  // Envoyer email de bienvenue
  await sendWelcomeEmail({ email, prenom: profile.prenom })

  // Connecter l'utilisateur
  const supabase = createClient()
  await supabase.auth.signInWithPassword({ email, password })

  redirect('/profil')
}

// --- Mot de passe oublié ---
export async function forgotPassword(_prev: unknown, formData: FormData) {
  const email = (formData.get('email') as string)?.trim()
  if (!email) return { error: 'Email requis.' }

  const allowed = await checkRateLimit(`reset:${email}`)
  if (!allowed) return { error: 'Trop de tentatives. Réessayez dans 15 minutes.' }

  const admin = createAdminClient()
  const minDelay = new Promise((r) => setTimeout(r, 300))

  const { data: profile } = await admin
    .from('profiles')
    .select('id, prenom')
    .eq('email', email)
    .single()

  if (!profile) {
    await recordFailedAttempt(`reset:${email}`)
    await minDelay
    return { success: true } // anti-énumération
  }

  const otp = generateOTP()
  const otpHash = await bcrypt.hash(otp, 10)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await admin.from('invitation_tokens').insert({
    user_id: profile.id,
    otp_hash: otpHash,
    expires_at: expiresAt,
  })

  await sendResetPasswordEmail({ email, prenom: profile.prenom, otpCode: otp })
  await minDelay
  return { success: true }
}

// --- Réinitialisation du mot de passe ---
export async function resetPassword(_prev: unknown, formData: FormData) {
  const email = formData.get('email') as string
  const otp = formData.get('otp') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (password !== confirmPassword)
    return { error: 'Les mots de passe ne correspondent pas.' }
  if (password.length < 8)
    return { error: 'Le mot de passe doit comporter au moins 8 caractères.' }

  const admin = createAdminClient()
  const minDelay = new Promise((r) => setTimeout(r, 300))

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (!profile) {
    await minDelay
    return { error: 'Code incorrect ou expiré.' }
  }

  const { data: token } = await admin
    .from('invitation_tokens')
    .select('id, otp_hash, expires_at')
    .eq('user_id', profile.id)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!token) {
    await minDelay
    return { error: 'Code incorrect ou expiré.' }
  }
  if (new Date(token.expires_at) < new Date()) {
    await minDelay
    return { error: 'Code expiré (10 min). Recommencez la procédure.' }
  }

  const isValid = await bcrypt.compare(otp, token.otp_hash)
  await minDelay
  if (!isValid) return { error: 'Code incorrect ou expiré.' }

  await admin.auth.admin.updateUserById(profile.id, { password })
  await admin
    .from('invitation_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', token.id)

  redirect('/login?reset=success')
}
