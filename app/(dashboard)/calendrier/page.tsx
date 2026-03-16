import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCalendrierData } from '@/lib/calendrier/getCalendrierData'
import CalendrierFiltres from '@/components/calendrier/CalendrierFiltres'
import CalendrierVueSemaine from '@/components/calendrier/CalendrierVueSemaine'
import CalendrierVueMois from '@/components/calendrier/CalendrierVueMois'

function getLundiSemaine(d: Date): string {
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const lundi = new Date(d)
  lundi.setDate(d.getDate() + diff)
  return lundi.toISOString().slice(0, 10)
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

export default async function CalendrierPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { vue: vueParam, date: dateParam, service, bureau } = await searchParams

  const vue = vueParam === 'mois' ? 'mois' : 'semaine'
  const today = new Date()

  // Date de référence par défaut selon la vue
  const defaultDate = vue === 'semaine'
    ? getLundiSemaine(today)
    : getPremierDuMois(today)

  const date = dateParam ?? defaultDate
  const serviceId = service
  const bureauId = bureau

  // Calcul de la plage selon la vue
  let dateDebut: string
  let dateFin: string

  if (vue === 'semaine') {
    dateDebut = getLundiSemaine(new Date(date))
    const fin = new Date(dateDebut)
    fin.setDate(fin.getDate() + 6)
    dateFin = fin.toISOString().slice(0, 10)
  } else {
    const d = new Date(date)
    dateDebut = getPremierDuMois(d)
    const nbJours = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    dateFin = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(nbJours).padStart(2, '0')}`
  }

  const { travailleurs, services, bureaux } = await getCalendrierData({
    dateDebut,
    dateFin,
    serviceId,
    bureauId,
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-sm font-bold text-[#1a2332] mb-4">📅 Calendrier de présence</h1>
      <CalendrierFiltres
        vue={vue}
        date={dateDebut}
        serviceId={serviceId}
        bureauId={bureauId}
        services={services}
        bureaux={bureaux}
      />
      {vue === 'semaine' ? (
        <CalendrierVueSemaine travailleurs={travailleurs} dateDebut={dateDebut} />
      ) : (
        <CalendrierVueMois travailleurs={travailleurs} dateDebut={dateDebut} />
      )}
    </div>
  )
}
