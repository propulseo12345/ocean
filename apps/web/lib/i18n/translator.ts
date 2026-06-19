import type { Locale } from "./config"
import { getMessage, type MessageKey } from "./dictionaries"
import { formatMessage, type MessageParams } from "./format-message"

// Fonction de traduction : t("dashboard.title") ou t("portal.toReview", { count: 3 }).
export type Translator = (key: MessageKey, params?: MessageParams) => string

export function createTranslator(locale: Locale): Translator {
  return (key, params) => formatMessage(getMessage(locale, key), locale, params)
}
