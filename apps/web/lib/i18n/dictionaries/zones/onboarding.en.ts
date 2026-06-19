import type { onboardingFr } from "./onboarding.fr"
// Namespace i18n « onboarding » (EN) — doit refléter les clés de onboardingFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const onboardingEn: Widen<typeof onboardingFr> = {
  onboarding: {},
}
