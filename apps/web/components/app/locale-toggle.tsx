"use client"

import { Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LOCALE_LABEL, LOCALES, useLocale } from "@/lib/i18n"

// Bascule FR ⇄ EN. Affiche la langue VERS laquelle on bascule (ex. en FR, montre « EN »).
export function LocaleToggle() {
  const { locale, toggle, t } = useLocale()
  const nextLocale = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length]
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 px-2 font-medium uppercase"
      aria-label={t("locale.switchTo", { lang: LOCALE_LABEL[nextLocale] })}
      title={t("locale.switchTo", { lang: LOCALE_LABEL[nextLocale] })}
      onClick={toggle}
    >
      <Languages className="size-4" />
      {locale}
    </Button>
  )
}
