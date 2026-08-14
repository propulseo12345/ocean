"use client"

import { ErrorDigest } from "@/components/shared/error-digest"
import { ErrorState, RetryButton } from "@/components/shared/error-state"

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="Impossible de charger le portail."
      description="L'espace de validation n'a pas pu etre recupere."
      action={
        <>
          <RetryButton onClick={reset} />
          <ErrorDigest digest={error.digest} />
        </>
      }
    />
  )
}
