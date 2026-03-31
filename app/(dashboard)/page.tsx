import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTodayPointage } from '@/lib/pointage/actions'
import { getSoldeHeuresAction } from '@/lib/pot-heures/actions'
import { getSoldesCongesAction } from '@/lib/conges/actions'
import { getMesCongesAction } from '@/lib/conges/actions'
import { Profile, Service, UserBureauSchedule, Bureau } from '@/types/database'
import PointageWidget from '@/components/dashboard/PointageWidget'
import HeuresSupWidget from '@/components/dashboard/HeuresSupWidget'
import SoldesWidget from '@/components/dashboard/SoldesWidget'
import CongesWidget from '@/components/dashboard/CongesWidget'
import { getCongesEnAttenteAdmin } from '@/lib/conges/admin-actions'
import { getDemandesHSEnAttenteAdmin } from '@/lib/heures-sup/admin-actions'
import AvatarUpload from '@/components/profile/AvatarUpload'
import Link from 'next/link'
import NotificationsBanner from '@/components/dashboard/NotificationsBanner'
import { getUnreadDecisions } from '@/lib/notifications/actions'

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

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date()
  const dow = today.getDay()

  const [pointage, schedulesRes, soldeData, soldesConges, profileRes, mesConges, unreadDecisions] = await Promise.all([
    getTodayPointage(),
    supabase
      .from('user_bureau_schedule')
      .select('*, bureau:bureaux(*)')
      .eq('user_id', user.id)
      .eq('jour', dow)
      .single(),
    getSoldeHeuresAction(),
    getSoldesCongesAction(),
    supabase.from('profiles').select('*, service:services(*)').eq('id', user.id).single(),
    getMesCongesAction(),
    getUnreadDecisions(),
  ])

  const bureauDuJour = schedulesRes.data as (UserBureauSchedule & { bureau: Bureau }) | null
  const profile = profileRes.data as (Profile & { service: Service | null }) | null
  const isAdmin = profile?.is_admin_rh ?? false

  // Données admin
  const [congesEnAttente, demandesHSEnAttente] = isAdmin
    ? await Promise.all([getCongesEnAttenteAdmin(), getDemandesHSEnAttenteAdmin()])
    : [[], []]

  const initiales = profile
    ? `${profile.prenom[0]}${profile.nom[0]}`.toUpperCase()
    : '?'

  // Congés en attente du travailleur
  const mesCongesEnAttente = mesConges.filter((c) => c.statut === 'en_attente')

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      {/* Bandeau profil */}
      {profile && (
        <div className="bg-gradient-to-r from-[#1a2332] to-[#2d3748] rounded-xl p-4 flex items-center gap-4">
          <AvatarUpload
            avatarUrl={profile.avatar_url}
            initiales={initiales}
            editable
          />

          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-base">
              {profile.prenom} {profile.nom}
            </div>
            <div className="text-white/60 text-xs mt-0.5">{profile.email}</div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {profile.service && (
                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {profile.service.nom}
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
      )}

      {unreadDecisions.length > 0 && (
        <NotificationsBanner decisions={unreadDecisions} />
      )}

      <PointageWidget pointage={pointage} />

      {/* Congés du travailleur + bouton nouvelle demande */}
      <CongesWidget congesEnAttente={mesCongesEnAttente} />

      {/* Heures supplémentaires - fusionné worker + admin */}
      <HeuresSupWidget
        isAdmin={isAdmin}
        demandesAdmin={demandesHSEnAttente}
      />

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          Bureau du jour
        </p>
        <p className="text-sm font-semibold text-[#1a2332]">
          {dow === 0 || dow === 6
            ? 'Week-end'
            : bureauDuJour?.bureau?.nom ?? 'Sur la route'}
        </p>
      </div>

      <SoldesWidget
        soldeHeures={soldeData?.solde_minutes ?? null}
        soldesConges={soldesConges}
      />

      {isAdmin && congesEnAttente.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Congés en attente (admin)
              <span className="ml-2 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {congesEnAttente.length}
              </span>
            </p>
            <Link
              href="/admin/conges"
              className="text-xs text-[#e53e3e] font-semibold hover:underline"
            >
              Voir tout
            </Link>
          </div>
          <div className="space-y-2">
            {congesEnAttente.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#1a2332] truncate">
                    {(c as any).profile.prenom} {(c as any).profile.nom}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {c.type} — {c.date_debut}{c.date_fin !== c.date_debut ? ` → ${c.date_fin}` : ''} ({c.nb_jours}j){c.demi_journee ? ` ${c.demi_journee === 'matin' ? 'Matin' : 'Après-midi'}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
