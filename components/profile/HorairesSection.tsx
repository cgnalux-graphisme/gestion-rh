// components/profile/HorairesSection.tsx

import { Profile, UserBureauSchedule } from '@/types/database'
import { minutesParJour, formatMinutes, isEte, labelOptionHoraire } from '@/lib/horaires/utils'

const JOURS: { label: string; jour: 1 | 2 | 3 | 4 | 5 }[] = [
  { label: 'Lundi',    jour: 1 },
  { label: 'Mardi',    jour: 2 },
  { label: 'Mercredi', jour: 3 },
  { label: 'Jeudi',    jour: 4 },
  { label: 'Vendredi', jour: 5 },
]

export default function HorairesSection({
  profile,
  schedules,
}: {
  profile: Profile
  schedules: UserBureauSchedule[]
}) {
  const option = profile.option_horaire
  const minutesJour = option ? minutesParJour(option) : null
  const today = new Date()
  const ete = isEte(today)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">🕐 Mes horaires</span>
        {ete && (
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold">
            ☀️ Horaires été
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Option horaire */}
        {option && minutesJour ? (
          <div className="flex items-center gap-6 p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                Option active
              </div>
              <div className="text-xs font-semibold text-[#1a2332]">
                {labelOptionHoraire(option)}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                Heures théoriques / jour
              </div>
              <div className="text-xs font-semibold text-[#1a2332]">
                {formatMinutes(minutesJour)}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">Option horaire non définie</p>
        )}

        {/* Horaires par jour */}
        <div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Horaires par jour
          </div>
          <div className="space-y-1.5">
            {JOURS.map(({ label, jour }) => {
              const sch = schedules.find((s) => s.jour === jour)
              const bureau = sch?.bureau
              const horairesHebdo = bureau
                ? (ete ? bureau.horaires_ete : bureau.horaires_normaux)
                : null
              const h = horairesHebdo
                ? horairesHebdo[String(jour) as keyof typeof horairesHebdo]
                : null

              return (
                <div
                  key={jour}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0"
                >
                  <span className="text-gray-500 w-20 font-medium">{label}</span>
                  <span className="text-[#1a2332] flex-1">
                    {bureau?.nom ?? (
                      <span className="text-gray-300 italic">Sur la route</span>
                    )}
                  </span>
                  <span className="text-gray-400 text-[11px]">
                    {h ? `${h.ouverture} – ${h.fermeture}` : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Option prochaine année */}
        {profile.option_horaire_prochaine && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-[10px] text-yellow-700 font-semibold">
              ⚠️ Changement planifié pour l&apos;année prochaine : Option{' '}
              {profile.option_horaire_prochaine} (
              {profile.option_horaire_prochaine === 'A' ? '36,5h/sem' : '34h/sem'})
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
