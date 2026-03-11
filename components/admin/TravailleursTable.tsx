'use client'

import Link from 'next/link'
import { Profile, Service } from '@/types/database'
import { deactivateTravailleurAction } from '@/lib/auth/admin-actions'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

type Worker = Profile & { service?: Service }

export default function TravailleursTable({ workers }: { workers: Worker[] }) {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleDeactivate(userId: string, name: string) {
    if (!confirm(`Désactiver ${name} ? Cette action peut être annulée par l'administrateur.`)) return
    setLoading(userId)
    await deactivateTravailleurAction(userId)
    setLoading(null)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Travailleur
            </th>
            <th className="text-left px-4 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Service
            </th>
            <th className="text-left px-4 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Contrat
            </th>
            <th className="text-left px-4 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Option
            </th>
            <th className="text-left px-4 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Statut
            </th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {workers.map((w) => (
            <tr key={w.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="font-semibold text-[#1a2332]">
                  {w.prenom} {w.nom}
                </div>
                <div className="text-[10px] text-gray-400">{w.email}</div>
              </td>
              <td className="px-4 py-3 text-gray-600">{w.service?.nom ?? '—'}</td>
              <td className="px-4 py-3 text-gray-600">{w.type_contrat ?? '—'}</td>
              <td className="px-4 py-3">
                {w.option_horaire ? (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold">
                    {w.option_horaire} · {w.option_horaire === 'A' ? '36,5h' : '34h'}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                    w.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  {w.is_active ? 'Actif' : 'Inactif'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 justify-end">
                  <Link href={`/admin/travailleurs/${w.id}`}>
                    <Button variant="outline" size="sm" className="text-[10px] h-7">
                      Voir
                    </Button>
                  </Link>
                  {w.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={loading === w.id}
                      onClick={() => handleDeactivate(w.id, `${w.prenom} ${w.nom}`)}
                    >
                      {loading === w.id ? '…' : 'Désactiver'}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {workers.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-xs italic">
                Aucun travailleur
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
