"use client"

import { useRouter } from "next/navigation"
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react"
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
  LOCALES,
} from "./config"
import { type Format, makeFormat } from "./format-bound"
import { type Labels, makeLabels } from "./labels"
import { createTranslator, type Translator } from "./translator"

interface LocaleState {
  locale: Locale
  setLocale: (locale: Locale) => void
  toggle: () => void
  t: Translator
}

const LocaleContext = createContext<LocaleState | null>(null)

function writeCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale
  children: ReactNode
}) {
  const router = useRouter()
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next)
      writeCookie(next)
      // Re-render des Server Components (titres, metadata, données mock dépendantes).
      router.refresh()
    },
    [router]
  )

  const toggle = useCallback(() => {
    const idx = LOCALES.indexOf(locale)
    setLocale(LOCALES[(idx + 1) % LOCALES.length])
  }, [locale, setLocale])

  const value = useMemo<LocaleState>(
    () => ({ locale, setLocale, toggle, t: createTranslator(locale) }),
    [locale, setLocale, toggle]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleState {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    // Sécurité : hors provider, fallback non-réactif sur la locale par défaut.
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      toggle: () => {},
      t: createTranslator(DEFAULT_LOCALE),
    }
  }
  return ctx
}

export function useT(): Translator {
  return useLocale().t
}

export function useLabels(): Labels {
  return makeLabels(useLocale().t)
}

export function useFormat(): Format {
  return makeFormat(useLocale().locale)
}
