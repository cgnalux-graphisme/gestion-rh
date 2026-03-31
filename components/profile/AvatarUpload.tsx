'use client'

import { useRef, useState, useTransition } from 'react'
import { uploadAvatarAction, removeAvatarAction } from '@/lib/profile/actions'

export default function AvatarUpload({
  avatarUrl,
  initiales,
  editable = false,
}: {
  avatarUrl: string | null
  initiales: string
  editable?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(avatarUrl)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setPreview(URL.createObjectURL(file))

    const formData = new FormData()
    formData.append('avatar', file)

    startTransition(async () => {
      const result = await uploadAvatarAction(formData)
      if (result.error) {
        setError(result.error)
        setPreview(avatarUrl)
      } else if (result.avatarUrl) {
        setPreview(result.avatarUrl)
      }
    })
  }

  function handleRemove() {
    setError(null)
    startTransition(async () => {
      const result = await removeAvatarAction()
      if (result.error) {
        setError(result.error)
      } else {
        setPreview(null)
      }
    })
  }

  return (
    <div className="relative group flex-shrink-0">
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-black border-2 border-white/20 overflow-hidden ${
          editable ? 'cursor-pointer' : ''
        } ${isPending ? 'opacity-60' : ''}`}
        onClick={editable ? () => inputRef.current?.click() : undefined}
      >
        {preview ? (
          <img
            src={preview}
            alt="Photo de profil"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#e53e3e] to-[#9b2c2c] flex items-center justify-center">
            {initiales}
          </div>
        )}
      </div>

      {editable && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          {/* Edit overlay */}
          <div
            className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            onClick={() => inputRef.current?.click()}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          {/* Remove button */}
          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isPending}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              title="Supprimer la photo"
            >
              ✕
            </button>
          )}
        </>
      )}

      {error && (
        <div className="absolute top-full left-0 mt-1 text-[9px] text-red-400 whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  )
}
