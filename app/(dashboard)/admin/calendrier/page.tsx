import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCalendrierData } from '@/lib/calendrier/getCalendrierData'
import CalendrierFiltres from '@/components/calendrier/CalendrierFiltres'
import CalendrierAdminWrapper from '@/components/calendrier/CalendrierAdminWrapper'
import CorrectionsEnAttenteWidget from '@/components/admin/CorrectionsEnAttenteWidget'
import { getCorrectionsEnAttenteAdmin } from '@/lib/pointage/correction-actions'
import { formatLocalDate } from '@/lib/utils/dates'

function getLundiSemaine(d: Date): string {
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const lundi = new Date(d)
  lundi.setDate(d.getDate() + diff)
  return formatLocalDate(lundi)
}

function getPremierDuMois(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

type SearchParams = {
  vue?: string
  date?: string
  service?: string
  bureau?: string
}

export default async function AdminCalendrierPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!myProfile?.is_admin_rh) redirect('/')

  const { vue: vueParam, date: dateParam, service, bureau } = await searchParams

  const vue = vueParam === 'mois' ? 'mois' : 'semaine'
  const today = new Date()

  const defaultDate = vue === 'semaine'
    ? getLundiSemaine(today)
    : getPremierDuMois(today)

  const date = dateParam ?? defaultDate
  const serviceId = service
  const bureauId = bureau

  let dateDebut: string
  let dateFin: string

  if (vue === 'semaine') {
    dateDebut = getLundiSemaine(new Date(date))
    const fin = new Date(dateDebut)
    fin.setDate(fin.getDate() + 6)
    dateFin = formatLocalDate(fin)
  } else {
    const d = new Date(date)
    dateDebut = getPremierDuMois(d)
    const nbJours = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    dateFin = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(nbJours).padStart(2, '0')}`
  }

  const correctionsPromise = getCorrectionsEnAttenteAdmin()

  const { travailleurs, services, bureaux } = await getCalendrierData({
    dateDebut,
    dateFin,
    serviceId,
    bureauId,
  })

  const corrections = await correctionsPromise

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-sm font-bold text-[#1a2332] mb-4">📅 Calendrier RH</h1>
      <p className="text-[10px] text-gray-400 -mt-3 mb-4">
        Cliquez sur une cellule pour modifier le statut d&apos;un travailleur.
      </p>
      <CorrectionsEnAttenteWidget corrections={corrections} />
      <CalendrierFiltres
        vue={vue}
        date={dateDebut}
        serviceId={serviceId}
        bureauId={bureauId}
        services={services}
        bureaux={bureaux}
      />
      <CalendrierAdminWrapper
        vue={vue}
        travailleurs={travailleurs}
        dateDebut={dateDebut}
        bureaux={bureaux}
        pendingCorrections={corrections.map((c) => `${c.user_id}:${c.date}`)}
      />
    </div>
  )
}
