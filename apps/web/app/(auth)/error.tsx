"use client"

import { ErrorState, RetryButton } from "@/components/shared/error-state"

export default function AuthError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="Authentification indisponible."
      description="Le parcours de connexion n'a pas pu etre charge."
      action={<RetryButton onClick={reset} />}
    />
  )
}
