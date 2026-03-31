'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function uploadAvatarAction(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const file = formData.get('avatar') as File | null
  if (!file || file.size === 0) return { error: 'Aucun fichier sélectionné' }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Format non supporté. Utilisez JPG, PNG ou WebP.' }
  }

  // Validate file size (2 MB max)
  if (file.size > 2 * 1024 * 1024) {
    return { error: 'Le fichier est trop volumineux (max 2 Mo).' }
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const filePath = `${user.id}/avatar.${ext}`

  // Upload (upsert to replace existing)
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true })

  if (uploadError) {
    return { error: `Erreur upload: ${uploadError.message}` }
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  // Add cache-busting param
  const avatarUrl = `${publicUrl}?t=${Date.now()}`

  // Update profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)

  if (updateError) {
    return { error: `Erreur mise à jour: ${updateError.message}` }
  }

  revalidatePath('/')
  revalidatePath('/profil')
  revalidatePath(`/admin/travailleurs/${user.id}`)

  return { success: true, avatarUrl }
}

export async function removeAvatarAction() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // List files in user folder and remove them
  const { data: files } = await supabase.storage
    .from('avatars')
    .list(user.id)

  if (files && files.length > 0) {
    await supabase.storage
      .from('avatars')
      .remove(files.map((f) => `${user.id}/${f.name}`))
  }

  // Clear avatar_url in profile
  await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id)

  revalidatePath('/')
  revalidatePath('/profil')
  revalidatePath(`/admin/travailleurs/${user.id}`)

  return { success: true }
}
