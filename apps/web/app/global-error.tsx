"use client"

import { ErrorDigest } from "@/components/shared/error-digest"
import { ErrorState, RetryButton } from "@/components/shared/error-state"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="fr">
      <body>
        <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
          <ErrorState
            title="Ocean a rencontre une erreur."
            description="La page n'a pas pu etre affichee. Tu peux relancer le rendu."
            action={
              <>
                <RetryButton onClick={reset} />
                <ErrorDigest digest={error.digest} />
              </>
            }
          />
        </main>
      </body>
    </html>
  )
}
