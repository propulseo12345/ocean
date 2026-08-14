"use client"

import { ErrorDigest } from "@/components/shared/error-digest"
import { ErrorState, RetryButton } from "@/components/shared/error-state"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="Impossible de charger cet espace."
      description="Les donnees de l'application n'ont pas pu etre recuperees."
      action={
        <>
          <RetryButton onClick={reset} />
          <ErrorDigest digest={error.digest} />
        </>
      }
    />
  )
}
