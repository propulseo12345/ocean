import type { notificationsFr } from "./notifications.fr"
// Namespace i18n « notifications » (EN) — doit refléter les clés de notificationsFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const notificationsEn: Widen<typeof notificationsFr> = {
  notifications: {},
}
