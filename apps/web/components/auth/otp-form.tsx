"use client"

import { ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { routes } from "@/lib/routes"
import { cn } from "@/lib/utils"

const CODE_LENGTH = 6
const SLOTS = Array.from({ length: CODE_LENGTH }, (_, i) => i)

export function OtpForm() {
  const router = useRouter()
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: CODE_LENGTH }, () => "")
  )
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const code = digits.join("")
  const isComplete = code.length === CODE_LENGTH

  function focusSlot(index: number) {
    inputs.current[index]?.focus()
    inputs.current[index]?.select()
  }

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "")
    setDigits((prev) => {
      const next = [...prev]
      if (clean.length > 1) {
        // collage d'un code complet
        clean
          .slice(0, CODE_LENGTH - index)
          .split("")
          .forEach((d, k) => {
            next[index + k] = d
          })
      } else {
        next[index] = clean
      }
      return next
    })
    if (clean.length > 0) {
      const target = Math.min(index + clean.length, CODE_LENGTH - 1)
      focusSlot(target)
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && digits[index] === "" && index > 0) {
      focusSlot(index - 1)
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault()
      focusSlot(index - 1)
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      e.preventDefault()
      focusSlot(index + 1)
    }
  }

  function verify() {
    if (!isComplete) {
      toast.error("Code incomplet", {
        description: "Saisis les 6 chiffres reçus par e-mail.",
      })
      return
    }
    toast.success("Code vérifié (preview)", {
      description: "Action simulée — redirection vers le tableau de bord.",
    })
    router.push(routes.dashboard)
  }

  function resend() {
    toast.success("Nouveau code envoyé (preview)", {
      description: "Action simulée — un code a été renvoyé.",
    })
    setDigits(Array.from({ length: CODE_LENGTH }, () => ""))
    focusSlot(0)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        verify()
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="otp-0">Code à 6 chiffres</Label>
        <div className="flex justify-between gap-1.5 sm:gap-2">
          {SLOTS.map((i) => (
            <Input
              key={i}
              ref={(el) => {
                inputs.current[i] = el
              }}
              id={`otp-${i}`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              autoFocus={i === 0}
              aria-label={`Chiffre ${i + 1} sur ${CODE_LENGTH}`}
              value={digits[i]}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              className={cn(
                "h-12 flex-1 px-0 text-center font-heading text-lg font-semibold tabular-nums sm:h-14 sm:text-xl"
              )}
            />
          ))}
        </div>
      </div>

      <Button type="submit" size="lg" className="h-10 w-full" disabled={!isComplete}>
        <ShieldCheck />
        Vérifier
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Tu n'as rien reçu ?{" "}
        <button
          type="button"
          onClick={resend}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Renvoyer le code
        </button>
      </p>
    </form>
  )
}
