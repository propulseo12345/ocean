# Plan i18n Ocean — Bilingue FR/EN (preview front)

> Objectif: rendre toute la plateforme de démo disponible en **français ET anglais**,
> avec un **toggle FR/EN dans le header** (défaut FR, persisté), sans changement d'URL.
> Périmètre validé par Étienne (19/06/2026): **interface + contenu démo** traduits.
> Livrable: tout traduit, build vert, vérification visuelle Playwright FR/EN.

## Chiffres de l'audit
- **1984 chaînes FR** sur **231 fichiers** (sur 300 audités).
- 185/260 fichiers UI sont des client components.
- Toutes les pages `app/` sont server components (titres, metadata, interpolations).
- Aucun état serveur par requête aujourd'hui (app statique/mock).

## Décisions d'architecture

### 1. Mécanisme de traduction (server + client)
- **Locale source de vérité = cookie `ocean_locale`** (`fr` | `en`), lu par les server
  components via `cookies()` et par le client via un `LocaleProvider` seedé depuis la racine.
- **`LocaleProvider`** (client context, calqué sur `ShellProvider`/`next-themes`) posé dans
  **`app/layout.tsx`** autour de `ThemeProvider` → couvre `(app)`, `(auth)`, `(portal)`.
- **Toggle** dans le header (à côté de `ThemeToggle`) : écrit le cookie + `router.refresh()`
  pour re-rendre les server components, et met à jour le context pour les client components.
- Pas de préfixe d'URL, pas de middleware, pas de `app/[lang]/`.
- Détection navigateur (`Accept-Language` / `navigator.language`) **au premier rendu seulement**,
  si aucun cookie posé. Défaut `fr`.

### 2. API du traducteur — `lib/i18n/`
- `lib/i18n/config.ts` : `LOCALES = ['fr','en']`, `DEFAULT_LOCALE='fr'`, `type Locale`.
- `lib/i18n/dictionaries/fr.ts` + `en.ts` : objets plats imbriqués typés (clé → message ICU léger).
- `lib/i18n/format-message.ts` : mini-formatter ICU **sans dépendance** supportant
  `{var}` et `{var, plural, one {…} other {…}}` (FR + EN). Couvre les ~50 sites de pluriel.
- `lib/i18n/get-locale.ts` (server) : `getLocale()` lit le cookie via `cookies()`.
- `lib/i18n/server.ts` : `getT()` → `(key, params?) => string` pour server components.
- `lib/i18n/provider.tsx` (`"use client"`) : `LocaleProvider`, `useLocale()`, `useT()`.
- Le dictionnaire complet est importé des deux côtés (léger, statique) — pas de fetch.
- Type-safety : `en.ts` doit avoir **exactement** les mêmes clés que `fr.ts` (test de parité).

### 3. Dates / nombres (locale-aware vs clés internes)
- **À rendre locale-aware** (suivre la locale active): `format.ts` (formatDate, formatDayMonth,
  formatWeekday, formatTime, formatDateTime, formatRelative, formatFollowers), tout
  `Intl.DateTimeFormat("fr-FR"|"fr-CA")` et `Intl.NumberFormat("fr-FR")` **d'affichage**,
  `react-day-picker` locale (`fr` ↔ `en-US`), `ratioLabel`/`toLocaleString("fr-FR")`.
  → Ces fonctions prennent désormais un `locale: Locale` (ou lisent le context côté client).
- **À NE PAS toucher** (clés techniques stables): `tz.ts` (`en-US` parsing), `isSameDay`
  (`fr-CA` comme clé `YYYY-MM-DD`), `calendar-utils` keyFormatter (`fr-CA` interne),
  `composer-utils` (`en-US` parsing). Ces locales sont des **identifiants**, pas de l'affichage.

### 4. Contenu démo (mocks bilingues)
Périmètre validé: traduire aussi le contenu. Stratégie **par fichier**, la plus simple qui marche:
- Données **statiques** (clients, brand, copy, hashtags, pillars, planning, views, agenda,
  history, interactions, notifications, library alt-texts, content-extra labels/captions,
  marronniers) → champ qui devient `{ fr: string; en: string }` (helper `localized()`),
  résolu à l'affichage avec la locale active. OU table de traduction parallèle indexée par id.
  **Choix retenu**: introduire un type `L<T> = { fr: T; en: T }` et un resolver `pick(value, locale)`.
  Les sélecteurs mock (`getClients`, etc.) restent inchangés ; la résolution se fait au point
  d'affichage via `pick()` (composant client) ou via locale passée (server).
- `labels.ts`, `specs.ts`, `quotas.ts`, `mocks/index.ts` (labels dérivés) → **déplacés dans le
  dictionnaire** (clés par enum), pas de `{fr,en}` inline ; les fonctions prennent un `t`.
- `caption.ts`/`marronniers.ts` détection événementielle: garder la logique, traduire les labels.

### 5. Toggle UI
- Composant `LocaleToggle` (client) dans le header `(app)`, l'écran `(auth)`, le `(portal)`.
- Style cohérent avec `ThemeToggle` (bouton ghost, "FR"/"EN" texte, aria-label traduit).

## Découpage d'exécution (lots)

**Lot 0 — Infra** (séquentiel, fait main, base de tout):
config, dictionaries squelette, format-message, get-locale, server.getT, provider, LocaleToggle,
branchement layout racine + headers, helper `L<T>`/`pick`. Build vert avec FR uniquement câblé.

**Lot 1 — Couche données** (séquentiel après Lot 0):
format.ts locale-aware, labels.ts→dico, specs.ts→dico, quotas.ts, marronniers.ts,
mocks/index.ts labels dérivés. Remplir fr.ts + en.ts pour ces clés.

**Lot 2 — Mocks contenu bilingues** (parallélisable par fichier):
clients, brand, copy, hashtags, content-extra, content, pillars, planning, views, agenda,
history, interactions, notifications, library. Wrapper `L<T>` + traductions EN.

**Lot 3 — UI chrome** (parallélisable par zone — c'est le gros):
- 3a shell/nav/sidebar/command-palette/banners (130)
- 3b pages app/ + auth + portal (93 + portal)
- 3c calendar (184)
- 3d grid (191)
- 3e studio + composer + board (330)
- 3f client-settings + onboarding (329)
- 3g performance + library + settings + notifications (272)
- 3h dashboard + agenda + shared + portal components (90)
Chaque zone: extraire chaînes → clés dico (namespace par zone), remplacer par `t()`/`pick()`,
remplir fr.ts + en.ts.

**Lot 4 — Vérif**: `next build`, parité des clés fr/en, Playwright FR + EN sur 6-8 écrans clés,
screenshots, toggle fonctionnel, dates/nombres corrects dans les 2 langues.

## Décision contenu mock (arrêtée pendant Lot 1)
Les champs textuels des mocks deviennent `L<string>` (ex. `ContentItem.title`,
`caption`, `internalNotes`, `lastError`, `Client.name/bio/category/notes`,
`Notification.title/body`, `Pillar.name`, événements agenda…). La résolution se fait
**au point d'affichage** via `pick(field, locale)` (client: `useLocale().locale` ;
server: `getLocale()`). Avantage: le compilateur liste TOUS les sites à résoudre →
aucune chaîne FR oubliée. Les getters (`getClient`, `getContentItems`…) renvoient les
données brutes inchangées (pas de threading de locale dans 150 appels).
Les libellés dérivés purement UI (`getDashboardTasks`) prennent `(t, locale)`.

## Conventions de clés
`namespace.sousNamespace.cle` — namespaces: `common`, `nav`, `dashboard`, `clients`, `calendar`,
`grid`, `studio`, `composer`, `board`, `settings`, `onboarding`, `performance`, `report`,
`library`, `agenda`, `notifications`, `portal`, `auth`, `status` (labels enum), `platform`,
`format`, `specs`, `quota`, `marronnier`. Pluriels via ICU `{count, plural, one{} other{}}`.

## Garde-fous
- Zéro `any`, fichiers ≤ 250 lignes (découper les dicos par namespace si besoin).
- Biome format/lint après chaque lot.
- Ne pas casser les clés techniques de date (tz/isSameDay/keyFormatter).
- Emojis dans les bios/captions: conserver tels quels dans les deux langues.
