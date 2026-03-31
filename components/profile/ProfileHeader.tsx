import { Profile, Service } from '@/types/database'
import AvatarUpload from '@/components/profile/AvatarUpload'

function calcAnciennete(dateEntree: string | null): string {
  if (!dateEntree) return '—'
  const diff = Date.now() - new Date(dateEntree).getTime()
  const years = Math.floor(diff / (365.25 * 24 * 3600 * 1000))
  const months = Math.floor(
    (diff % (365.25 * 24 * 3600 * 1000)) / (30.44 * 24 * 3600 * 1000)
  )
  if (years === 0) return `${months} mois`
  return `${years} an${years > 1 ? 's' : ''}${months > 0 ? ` ${months} mois` : ''}`
}

export default function ProfileHeader({
  profile,
  service,
  editable = false,
}: {
  profile: Profile
  service: Service | null
  editable?: boolean
}) {
  const initiales = `${profile.prenom[0]}${profile.nom[0]}`.toUpperCase()

  return (
    <div className="mx-4 mt-4 bg-gradient-to-r from-[#1a2332] to-[#2d3748] rounded-xl p-4 flex items-center gap-4">
      <AvatarUpload
        avatarUrl={profile.avatar_url}
        initiales={initiales}
        editable={editable}
      />

      <div className="flex-1 min-w-0">
        <div className="text-white font-bold text-base">
          {profile.prenom} {profile.nom}
        </div>
        <div className="text-white/60 text-xs mt-0.5">{profile.email}</div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {service && (
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {service.nom}
            </span>
          )}
          {profile.option_horaire && (
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-green-500/20 text-green-300 border border-green-500/30">
              Option {profile.option_horaire} ·{' '}
              {profile.option_horaire === 'A' ? '36,5h' : '34h'}
            </span>
          )}
          {profile.is_admin_rh && (
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
              Admin RH
            </span>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-white/40 text-[9px] uppercase tracking-wider">Ancienneté</div>
        <div className="text-[#fc8181] text-2xl font-black leading-tight">
          {calcAnciennete(profile.date_entree)}
        </div>
        {profile.date_entree && (
          <div className="text-white/40 text-[9px]">
            depuis{' '}
            {new Date(profile.date_entree).toLocaleDateString('fr-BE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </div>
        )}
      </div>
    </div>
  )
}
