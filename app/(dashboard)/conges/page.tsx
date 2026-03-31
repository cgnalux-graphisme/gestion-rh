'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Conge, SoldeConges, PotHeures, AnnulationConge } from '@/types/database'
import { getSoldesCongesAction, getMesCongesAction, getAnnulationsEnCoursAction } from '@/lib/conges/actions'
import { getPotHeuresAction } from '@/lib/heures-sup/actions'
import SoldesCards from '@/components/conges/SoldesCards'
import DemandesEnCours from '@/components/conges/DemandesEnCours'
import DemandeCongeForm from '@/components/conges/DemandeCongeForm'
import SignalementMaladieForm from '@/components/conges/SignalementMaladieForm'
import HistoriqueConges from '@/components/conges/HistoriqueConges'
import HeuresSupSection from '@/components/conges/HeuresSupSection'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

// ─── Accordion Section ───

function AccordionSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string
  icon: string
  badge?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/50 transition-colors"
      >
        <span className="text-[12px] font-bold text-[#1a2332] flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          {title}
          {badge != null && badge > 0 && (
            <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`transition-all duration-200 ease-in-out overflow-hidden ${
          open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Page ───

export default function CongesPage() {
  const searchParams = useSearchParams()
  const [soldes, setSoldes] = useState<SoldeConges | null>(null)
  const [pot, setPot] = useState<PotHeures | null>(null)
  const [conges, setConges] = useState<Conge[]>([])
  const [annulations, setAnnulations] = useState<AnnulationConge[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetConge, setSheetConge] = useState(searchParams.get('nouveau') === '1')
  const [sheetMaladie, setSheetMaladie] = useState(false)

  const reload = useCallback(async () => {
    const [s, p, c, a] = await Promise.all([
      getSoldesCongesAction(),
      getPotHeuresAction(),
      getMesCongesAction(),
      getAnnulationsEnCoursAction(),
    ])
    setSoldes(s)
    setPot(p)
    setConges(c)
    setAnnulations(a)
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  function handleCongeSuccess() {
    setSheetConge(false)
    reload()
  }

  function handleMaladieSuccess() {
    setSheetMaladie(false)
    reload()
  }

  // Compteurs
  const congesEnAttente = conges.filter((c) => c.statut === 'en_attente').length
  const today = new Date().toISOString().slice(0, 10)
  const congesAVenir = conges.filter(
    (c) => c.statut === 'approuve' && c.date_debut > today
  ).length

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-xs text-gray-400">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold text-[#1a2332]">Congés &amp; Absences</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setSheetMaladie(true)}
            className="text-[11px] font-semibold px-3 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Signaler maladie
          </button>
          <button
            onClick={() => setSheetConge(true)}
            className="text-[11px] font-semibold px-3 py-1.5 bg-[#e53e3e] text-white rounded-lg hover:bg-[#c53030] transition-colors"
          >
            + Demander un congé
          </button>
        </div>
      </div>

      {/* Soldes (toujours visible) */}
      <SoldesCards soldes={soldes} pot={pot} />

      {/* Demandes en cours */}
      <AccordionSection
        title="Demandes en cours"
        icon="&#128203;"
        badge={congesEnAttente + congesAVenir}
        defaultOpen={true}
      >
        <DemandesEnCours
          conges={conges}
          annulations={annulations}
          onRefresh={reload}
        />
      </AccordionSection>

      {/* Historique VA / RC */}
      <AccordionSection
        title="Historique congés VA &amp; RC"
        icon="&#128197;"
      >
        <HistoriqueConges />
      </AccordionSection>

      {/* Heures sup + Pot d'heures */}
      <AccordionSection
        title="Heures supplémentaires &amp; Pot d'heures"
        icon="&#9201;"
      >
        <HeuresSupSection />
      </AccordionSection>

      {/* Signalement maladie */}
      <AccordionSection title="Signaler une absence maladie" icon="&#127973;">
        <SignalementMaladieForm onSuccess={handleMaladieSuccess} />
      </AccordionSection>

      {/* Sheet: Nouvelle demande de congé */}
      <Sheet open={sheetConge} onOpenChange={setSheetConge}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-sm font-bold text-[#1a2332]">
              Nouvelle demande de congé
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <DemandeCongeForm onSuccess={handleCongeSuccess} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: Signalement maladie */}
      <Sheet open={sheetMaladie} onOpenChange={setSheetMaladie}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-sm font-bold text-[#1a2332]">
              Signaler une absence maladie
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <SignalementMaladieForm onSuccess={handleMaladieSuccess} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
