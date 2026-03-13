'use client'

import { useState, useEffect } from 'react'
import { Conge, SoldeConges } from '@/types/database'
import { getSoldesCongesAction, getMesCongesAction } from '@/lib/conges/actions'
import SoldesCongesWidget from '@/components/conges/SoldesCongesWidget'
import DemandeCongeForm from '@/components/conges/DemandeCongeForm'
import ListeDemandesWorker from '@/components/conges/ListeDemandesWorker'

// Note: on utilise 'use client' car on a besoin d'un formulaire interactif
// Les données initiales sont chargées via Server Actions
export default function CongesPage() {
  const [soldes, setSoldes] = useState<SoldeConges | null>(null)
  const [conges, setConges] = useState<Conge[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  async function reload() {
    const [s, c] = await Promise.all([getSoldesCongesAction(), getMesCongesAction()])
    setSoldes(s)
    setConges(c)
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  function handleFormSuccess() {
    setShowForm(false)
    reload()
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-xs text-gray-400">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold text-[#1a2332]">Mes congés</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-[11px] font-semibold px-3 py-1.5 bg-[#e53e3e] text-white rounded-lg hover:bg-[#c53030] transition-colors"
        >
          {showForm ? '✕ Fermer' : '+ Demander un congé'}
        </button>
      </div>

      <SoldesCongesWidget soldes={soldes} />

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-[12px] font-bold text-[#1a2332] mb-4">Nouvelle demande</h2>
          <DemandeCongeForm onSuccess={handleFormSuccess} />
        </div>
      )}

      <div>
        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
          Mes demandes
        </h2>
        <ListeDemandesWorker conges={conges} />
      </div>
    </div>
  )
}
