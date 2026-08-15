"use client"

import { useCallback, useRef, useState } from "react"

import { recordUploadedAsset } from "@/lib/actions/media"
import type { CropPresetKey } from "@/lib/media/image-plan"
import { type UploadedAsset, type UploadPhase, uploadMediaFile } from "@/lib/media/upload"
import { createClient } from "@/lib/supabase/client"

// File d'attente de téléversements — un seul fichier à la fois.
//
// POURQUOI SÉQUENTIEL ET PAS EN PARALLÈLE
// ----------------------------------------
// Deux raisons, et aucune n'est esthétique. La mémoire d'abord : préparer une
// image décode un bitmap plein format (12 Mpx ≈ 48 Mo) plus deux encodages ;
// trois en vol font tomber un onglet mobile. La bande passante ensuite : sur un
// réseau mobile, trois transferts concurrents ne vont pas plus vite, ils
// rendent seulement chaque barre de progression menteuse.

export interface UploadItem {
  id: string
  fileName: string
  state: "attente" | "en_cours" | "termine" | "echec" | "annule"
  phase: UploadPhase
  sent: number
  total: number
  error?: string
  asset?: UploadedAsset
}

export interface UseMediaUploadOptions {
  orgId: string
  clientId: string
  /**
   * Appelé à chaque fichier réellement enregistré en base. `meta` est ce que
   * l'appelant a passé à `enqueue` — il sert à distinguer « ajouter un média »
   * de « remplacer celui-ci par sa version recadrée » sans deux files séparées.
   */
  onUploaded?: (asset: UploadedAsset, meta?: unknown) => void
  /** Appelé une fois la file vidée, si au moins un fichier a abouti. */
  onSettled?: (assets: UploadedAsset[]) => void
}

export interface UseMediaUploadResult {
  items: UploadItem[]
  busy: boolean
  enqueue: (files: File[], options?: { crop?: CropPresetKey; meta?: unknown }) => void
  cancel: (id: string) => void
  dismiss: (id: string) => void
  reset: () => void
}

export function useMediaUpload(options: UseMediaUploadOptions): UseMediaUploadResult {
  const { orgId, clientId, onUploaded, onSettled } = options
  const [items, setItems] = useState<UploadItem[]>([])
  const [busy, setBusy] = useState(false)
  const contrôleurs = useRef(new Map<string, AbortController>())
  // Une seule boucle de traitement, quelle que soit la vitesse des dépôts.
  const enCours = useRef(false)
  const file = useRef<
    Array<{ item: UploadItem; file: File; crop?: CropPresetKey; meta?: unknown }>
  >([])

  const patch = useCallback((id: string, partial: Partial<UploadItem>) => {
    setItems((liste) => liste.map((i) => (i.id === id ? { ...i, ...partial } : i)))
  }, [])

  const drainer = useCallback(async () => {
    if (enCours.current) return
    enCours.current = true
    setBusy(true)
    const aboutis: UploadedAsset[] = []

    const supabase = createClient()
    const deps = {
      supabase,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      record: recordUploadedAsset,
    }

    while (file.current.length > 0) {
      const tâche = file.current.shift()
      if (!tâche) break
      const contrôleur = new AbortController()
      contrôleurs.current.set(tâche.item.id, contrôleur)
      patch(tâche.item.id, { state: "en_cours" })

      const res = await uploadMediaFile(deps, {
        file: tâche.file,
        orgId,
        clientId,
        crop: tâche.crop,
        signal: contrôleur.signal,
        onState: (s) => patch(tâche.item.id, { phase: s.phase, sent: s.sent, total: s.total }),
      })
      contrôleurs.current.delete(tâche.item.id)

      if (res.ok) {
        patch(tâche.item.id, { state: "termine", asset: res.asset })
        aboutis.push(res.asset)
        onUploaded?.(res.asset, tâche.meta)
      } else {
        patch(tâche.item.id, {
          state: res.annulé ? "annule" : "echec",
          error: res.error,
        })
      }
    }

    enCours.current = false
    setBusy(false)
    if (aboutis.length > 0) onSettled?.(aboutis)
  }, [orgId, clientId, onUploaded, onSettled, patch])

  const enqueue = useCallback(
    (fichiers: File[], opts?: { crop?: CropPresetKey; meta?: unknown }) => {
      if (fichiers.length === 0) return
      const nouveaux = fichiers.map((f) => ({
        item: {
          id: crypto.randomUUID(),
          fileName: f.name,
          state: "attente" as const,
          phase: "preparation" as UploadPhase,
          sent: 0,
          total: f.size,
        },
        file: f,
        crop: opts?.crop,
        meta: opts?.meta,
      }))
      file.current.push(...nouveaux)
      setItems((liste) => [...liste, ...nouveaux.map((n) => n.item)])
      void drainer()
    },
    [drainer]
  )

  const cancel = useCallback((id: string) => {
    // Un fichier encore en file n'a pas de contrôleur : on le retire avant
    // qu'il ne démarre, sinon « annuler » n'annulerait que le transfert en vol.
    file.current = file.current.filter((t) => t.item.id !== id)
    contrôleurs.current.get(id)?.abort()
    setItems((liste) =>
      liste.map((i) => (i.id === id && i.state !== "termine" ? { ...i, state: "annule" } : i))
    )
  }, [])

  const dismiss = useCallback((id: string) => {
    setItems((liste) => liste.filter((i) => i.id !== id))
  }, [])

  const reset = useCallback(() => {
    for (const c of contrôleurs.current.values()) c.abort()
    contrôleurs.current.clear()
    file.current = []
    setItems([])
  }, [])

  return { items, busy, enqueue, cancel, dismiss, reset }
}
