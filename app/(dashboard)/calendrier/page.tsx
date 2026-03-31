import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCalendrierBureauData } from '@/lib/calendrier/getCalendrierBureauData'
import CalendrierBureauPage from '@/components/calendrier/CalendrierBureauPage'
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

const BUREAUX_ORDER = ['lib', 'nam', 'mar', 'arl']

type SearchParams = {
  vue?: string
  date?: string
}

export default async function CalendrierPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { vue: vueParam, date: dateParam } = await searchParams

  const vue = vueParam === 'mois' ? 'mois' : 'semaine'
  const today = new Date()

  const defaultDate = vue === 'semaine'
    ? getLundiSemaine(today)
    : getPremierDuMois(today)

  const date = dateParam ?? defaultDate

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

  const allData = await Promise.all(
    BUREAUX_ORDER.map(code =>
      getCalendrierBureauData({ bureauCode: code, dateDebut, dateFin })
    )
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-sm font-bold text-[#1a2332] mb-1">Calendrier des présences</h1>
      <p className="text-[10px] text-gray-400 mb-4">
        Vue par bureau — présence de chaque travailleur.
      </p>
      <CalendrierBureauPage
        allData={allData}
        vue={vue}
        dateDebut={dateDebut}
      />
    </div>
  )
}
