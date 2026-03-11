import { Profile, Service } from '@/types/database'

export default function DonneesRHSection({
  profile,
  service,
}: {
  profile: Profile
  service: Service | null
}) {
  const fields = [
    { label: 'Service', value: service?.nom ?? '—' },
    { label: 'Type de contrat', value: profile.type_contrat ?? '—' },
    {
      label: "Date d'entrée",
      value: profile.date_entree
        ? new Date(profile.date_entree).toLocaleDateString('fr-BE')
        : '—',
    },
    {
      label: 'Option horaire',
      value: profile.option_horaire
        ? `Option ${profile.option_horaire} (${profile.option_horaire === 'A' ? '36,5h/sem' : '34h/sem'})`
        : '—',
    },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">🏢 Données RH</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">
          🔒 Géré par l'administration
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-4">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              {label}
            </div>
            <div className="text-xs font-medium text-[#1a2332] mt-0.5">{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
