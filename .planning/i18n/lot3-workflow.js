export const meta = {
  name: 'i18n-ui-chrome',
  description: 'Internationaliser FR/EN tous les composants & pages (UI chrome) par zone',
  phases: [{ title: 'i18n-zones', detail: 'un agent par sous-zone + son namespace de dico' }],
}

const RESULT = {
  type: 'object',
  additionalProperties: false,
  required: ['zone', 'status', 'filesEdited', 'keysAdded'],
  properties: {
    zone: { type: 'string' },
    status: { type: 'string', enum: ['done', 'partial', 'error'] },
    filesEdited: { type: 'number' },
    keysAdded: { type: 'number' },
    leftoverFrench: {
      type: 'array',
      items: { type: 'string' },
      description: 'chaînes FR qu’il n’a pas pu traiter (à reprendre)',
    },
    notes: { type: 'string' },
  },
}

const GUIDE = `
# Mission : internationaliser FR → bilingue FR/EN une sous-zone d'Ocean (Next.js 16, preview front).

L'infra i18n EXISTE déjà (ne la recrée pas). Tu dois remplacer chaque chaîne française
visible par l'utilisateur par un appel de traduction, et ajouter les clés au dictionnaire
de TA zone uniquement.

## API i18n disponible
- Client component ("use client") :
    import { useT, useFormat, useLabels, useLocale, pick } from "@/lib/i18n"
    const t = useT()                 // t("ns.key") ou t("ns.key", { name, count })
    const f = useFormat()            // f.date(iso, tz) f.time f.dateTime f.dayMonth f.weekday f.relative f.followers
    const lbl = useLabels()          // lbl.contentStatus(s) lbl.targetStatus lbl.accountStatus lbl.reviewState
                                     //   lbl.approvalMode lbl.activityKind lbl.format(f) lbl.platform(p) lbl.platformShort(p)
    const { locale } = useLocale()   // pour résoudre le contenu mock : pick(item.title, locale)
- Server component (page/layout sans "use client") :
    import { getT, getFormat, getLabels, getLocale } from "@/lib/i18n/server"
    const t = await getT(); const f = await getFormat(); const lbl = await getLabels(); const locale = await getLocale()
    et pick(item.title, locale) (import pick depuis "@/lib/i18n")
- Pluriels / interpolation : mini-ICU. Ex. clé = "Vous avez {count, plural, one {# publication} other {# publications}} à valider"
  appelée t("ns.toReview", { count }). Variables simples : "Bonjour {name}".
- tone/colorVar/short ne changent pas ; seuls les LIBELLÉS passent par lbl.*.

## Contenu mock = L<string>
Beaucoup de champs mock (title, caption, bio, category, notes, name de pilier, calendarName,
event title, notification title/body, altText, comment body, version note/caption, saved view name…)
sont maintenant \`L<string>\` = { fr, en }. Tu DOIS les résoudre à l'affichage avec
\`pick(field, locale)\`. Le compilateur te le signalera (Type 'L<string>' is not assignable to 'ReactNode').
Les NOMS PROPRES restent string : client.name, handle, username, hashtags, email → ne PAS pick().

## Règles
1. Traduis TOUT texte FR destiné à l'utilisateur : textes visibles, placeholders, aria-label, alt,
   title (tooltip), sr-only, toasts (sonner: toast.success/error/message), titres de metadata.
2. Clés nommées \`{NS}.sousCle\` où NS = le namespace de TA zone (indiqué plus bas).
   Groupe par composant/section pour rester lisible. Réutilise les clés communes existantes si pertinent
   (common.cancel, common.save, common.delete, common.edit, common.duplicate, common.close, common.back,
   common.search, common.previewSuffix "(aperçu)"…).
3. Ajoute les clés dans les DEUX fichiers de ta zone :
   apps/web/lib/i18n/dictionaries/zones/{NS}.fr.ts  (objet {NS}Fr, valeurs FR)
   apps/web/lib/i18n/dictionaries/zones/{NS}.en.ts  (objet {NS}En, MÊMES clés, valeurs EN idiomatiques)
   La structure des deux objets doit être IDENTIQUE (le build vérifie la parité de type). Garde la racine \`{ {NS}: { … } }\`.
4. NE PAS toucher : les locales techniques \`fr-CA\` et \`en-US\` utilisées comme CLÉS internes
   (isSameDay, tz.ts, *-utils keyFormatter, composer-utils parsing) → ce sont des identifiants, PAS de l'affichage.
   Si tu vois Intl.DateTimeFormat("fr-CA") servant à fabriquer une clé YYYY-MM-DD : NE PAS modifier.
   Les autres Intl.DateTimeFormat("fr-FR")/NumberFormat("fr-FR") d'AFFICHAGE → remplace par f.* (useFormat) ou
   passe la locale active (Intl...(INTL_LOCALE[locale])) selon le cas.
5. EN idiomatique, registre produit SaaS marketing. Pas de mot-à-mot.
6. N'édite QUE les fichiers de ta liste + tes 2 fichiers de dico de zone. Ne touche pas aux fichiers d'une autre zone.
7. Émojis, ponctuation française (« », …) : en FR garde « » et apostrophes typographiques ; en EN utilise "..." et apostrophes droites naturelles.
8. Si une chaîne est ambiguë ou trop risquée, traite-la quand même au mieux et liste-la dans leftoverFrench.

## Vérification avant de rendre
- Relis chaque fichier édité : plus aucune string FR littérale visible ne doit rester (hors clés techniques, noms propres, hashtags).
- Les fichiers .ts utilitaires sans JSX qui contiennent des libellés FR doivent aussi être traités
  (souvent en exportant des clés MessageKey plutôt que des strings, ou en prenant un Translator en argument — adapte au cas).
`

// Sous-zones : namespace de dico (NS) + liste de fichiers (relatifs à apps/web/).
// dashboard est EXCLU (déjà fait à la main). shared spec-issues/quota-gauge déjà faits.
const ZONES = [
  {
    ns: 'nav',
    label: 'shell/nav/sidebar',
    files: [
      'components/app/app-sidebar.tsx', 'components/app/nav-user.tsx',
      'components/app/client-switcher.tsx', 'components/app/client-tabs.tsx',
      'components/app/notifications-button.tsx', 'components/app/theme-toggle.tsx',
      'components/app/shell/command-palette.tsx', 'components/app/shell/demo-banner.tsx',
      'components/app/shell/pwa-install-assistant.tsx', 'components/app/shell/quick-capture.tsx',
      'components/app/shell/shortcuts-dialog.tsx', 'components/app/shell/client-health-banner.tsx',
      'components/app/shell/header-search-button.tsx', 'components/app/shell/client-nav.ts',
    ],
  },
  {
    ns: 'agenda',
    label: 'dashboard components + agenda',
    note: 'Le namespace dashboard.* est DÉJÀ rempli (ne le réécris pas, réutilise ses clés pour today-panel/task-list). Tes NOUVELLES clés vont dans agenda.*. Pour today-panel.tsx et task-list.tsx, utilise les clés dashboard.* existantes (dashboard.freeDay, dashboard.allClear, dashboard.group.*, dashboard.allDay…).',
    files: [
      'components/app/dashboard/today-panel.tsx', 'components/app/dashboard/task-list.tsx',
      'components/app/agenda/agenda-utils.ts', 'components/app/agenda/event-block.tsx',
      'components/app/agenda/agenda-day-list.tsx', 'components/app/agenda/unified-agenda.tsx',
      'components/app/agenda/agenda-sidebar.tsx', 'components/app/agenda/week-grid.tsx',
    ],
  },
  {
    ns: 'calendar',
    label: 'calendrier éditorial',
    files: [
      'components/app/calendar/automation-dialog.tsx', 'components/app/calendar/calendar-banners.tsx',
      'components/app/calendar/calendar-controls.tsx', 'components/app/calendar/calendar-filters.tsx',
      'components/app/calendar/calendar-legend.tsx', 'components/app/calendar/calendar-toolbar.tsx',
      'components/app/calendar/calendar-selection-actions.tsx', 'components/app/calendar/day-cell.tsx',
      'components/app/calendar/duplicate-dialog.tsx', 'components/app/calendar/move-dialogs.tsx',
      'components/app/calendar/pillar-mix-panel.tsx', 'components/app/calendar/entry-markers.tsx',
      'components/app/calendar/calendar-actions.ts', 'components/app/calendar/day-sheet.tsx',
      'components/app/calendar/day-sheet-row.tsx', 'components/app/calendar/content-quick-view.tsx',
      'components/app/calendar/entry-shell.tsx', 'components/app/calendar/calendar-schedule.ts',
      'components/app/calendar/editorial-calendar.tsx', 'components/app/calendar/export-dialog.tsx',
      'components/app/calendar/planning-shelf.tsx', 'components/app/calendar/month-grid.tsx',
      'components/app/calendar/week-view.tsx',
    ],
  },
  {
    ns: 'grid',
    label: 'grille feed IG',
    files: [
      'components/app/grid/grid-toolbar.tsx', 'components/app/grid/grid-filters.tsx',
      'components/app/grid/grid-legend.tsx', 'components/app/grid/presentation-mode.tsx',
      'components/app/grid/grid-harmony.tsx', 'components/app/grid/instagram-profile-header.tsx',
      'components/app/grid/demo-profile.ts', 'components/app/grid/validate-grid-dialog.tsx',
      'components/app/grid/grid-selection-bar.tsx', 'components/app/grid/grid-empty-state.tsx',
      'components/app/grid/pending-bar.tsx', 'components/app/grid/cover-compare-dialog.tsx',
      'components/app/grid/sortable-grid-tile.tsx', 'components/app/grid/grid-board.tsx',
      'components/app/grid/tile-quick-view.tsx', 'components/app/grid/quick-view-body.tsx',
      'components/app/grid/locked-grid-tile.tsx', 'components/app/grid/grid-tile.tsx',
      'components/app/grid/tile-overlays.tsx', 'components/app/grid/grid-workspace.tsx',
      'components/app/grid/reels-tab.tsx', 'components/app/grid/grid-shelf.tsx',
      'components/app/grid/feed-grid.tsx', 'components/app/grid/demo-banner.tsx',
      'components/app/grid/grid-dialogs.tsx',
    ],
  },
  {
    ns: 'studio',
    label: 'studio (board + content/detail)',
    note: 'Le composer a son PROPRE namespace composer.* géré par une autre zone — NE touche PAS aux fichiers composer/*. Tes clés vont dans studio.* (et board.* pour les fichiers board-*). Utilise studio.* ; si tu veux séparer le board, tu peux mettre les clés board-* sous board.* (le namespace board existe).',
    files: [
      'components/app/studio/board-kanban.tsx', 'components/app/studio/board-kanban-card.tsx',
      'components/app/studio/board-filters.tsx', 'components/app/studio/board-toolbar.tsx',
      'components/app/studio/board-batch-actions.tsx', 'components/app/studio/board-review-dialog.tsx',
      'components/app/studio/board-review-banner.tsx', 'components/app/studio/board-schedule-dialog.tsx',
      'components/app/studio/board-views.tsx', 'components/app/studio/board-label-popover.tsx',
      'components/app/studio/board-quotas.tsx', 'components/app/studio/board-idea-bank.tsx',
      'components/app/studio/content-board.tsx', 'components/app/studio/content-card.tsx',
      'components/app/studio/content-actions.tsx', 'components/app/studio/detail-header.tsx',
      'components/app/studio/detail-activity.tsx', 'components/app/studio/content-review-panel.tsx',
      'components/app/studio/detail-duplicate-dialog.tsx', 'components/app/studio/content-targets.tsx',
      'components/app/studio/content-detail-media.tsx', 'components/app/studio/detail-diff.ts',
      'components/app/studio/detail-cover-dialog.tsx', 'components/app/studio/detail-manual-center.tsx',
      'components/app/studio/detail-native-preview.tsx', 'components/app/studio/detail-preview-media.tsx',
      'components/app/studio/detail-target-error.tsx', 'components/app/studio/detail-thread.tsx',
      'components/app/studio/detail-thread-items.tsx', 'components/app/studio/detail-versions.tsx',
      'components/app/studio/board-state.ts', 'components/app/studio/board-utils.ts',
    ],
  },
  {
    ns: 'composer',
    label: 'studio/composer',
    files: [
      'components/app/studio/composer/composer-header.tsx', 'components/app/studio/composer/composer-basics.tsx',
      'components/app/studio/composer/composer-caption.tsx', 'components/app/studio/composer/composer-media.tsx',
      'components/app/studio/composer/preflight-panel.tsx', 'components/app/studio/composer/schedule-dialog.tsx',
      'components/app/studio/composer/caption-tools.tsx', 'components/app/studio/composer/composer-advanced.tsx',
      'components/app/studio/composer/composer-targets.tsx', 'components/app/studio/composer/composer-preview.tsx',
      'components/app/studio/composer/composer-screen.tsx', 'components/app/studio/composer/media-picker-dialog.tsx',
      'components/app/studio/composer/hashtag-popover.tsx', 'components/app/studio/composer/preflight.ts',
      'components/app/studio/composer/media-crop-dialog.tsx', 'components/app/studio/composer/media-spec-summary.tsx',
      'components/app/studio/composer/sortable-slide.tsx', 'components/app/studio/composer/composer-utils.ts',
    ],
  },
  {
    ns: 'clientSettings',
    label: 'réglages client',
    note: 'constants.ts contient des listes de valeurs FR prédéfinies (catégories, tons…) — exporte des clés ou des L<string> selon l’usage.',
    files: [
      'components/app/client-settings/constants.ts', 'components/app/client-settings/settings-shell.tsx',
      'components/app/client-settings/section-card.tsx', 'components/app/client-settings/section-profile.tsx',
      'components/app/client-settings/section-accounts.tsx', 'components/app/client-settings/section-brand-kit.tsx',
      'components/app/client-settings/section-approval.tsx', 'components/app/client-settings/section-cadence.tsx',
      'components/app/client-settings/section-slots.tsx', 'components/app/client-settings/section-danger.tsx',
      'components/app/client-settings/palette-editor.tsx', 'components/app/client-settings/string-list-editor.tsx',
      'components/app/client-settings/brand-color-palette.tsx', 'components/app/client-settings/slot-row.tsx',
      'components/app/client-settings/confirm-dialog.tsx', 'components/app/client-settings/delete-client-dialog.tsx',
      'components/app/client-settings/banned-words-editor.tsx', 'components/app/client-settings/trash-list.tsx',
      'components/app/client-settings/slots-week-preview.tsx',
    ],
  },
  {
    ns: 'onboarding',
    label: 'onboarding wizard',
    files: [
      'components/app/onboarding/wizard-types.ts', 'components/app/onboarding/wizard-shell.tsx',
      'components/app/onboarding/wizard-stepper.tsx', 'components/app/onboarding/step-identity.tsx',
      'components/app/onboarding/step-accounts.tsx', 'components/app/onboarding/step-brand.tsx',
      'components/app/onboarding/step-strategy.tsx', 'components/app/onboarding/step-review.tsx',
      'components/app/onboarding/pillar-editor.tsx', 'components/app/onboarding/slot-editor.tsx',
      'components/app/onboarding/string-list-editor.tsx', 'components/app/onboarding/tag-input.tsx',
      'components/app/onboarding/account-connect-card.tsx', 'components/app/onboarding/brand-color-palette.tsx',
    ],
  },
  {
    ns: 'performance',
    label: 'performance + report',
    note: 'perf-data.ts et report-data.ts peuvent contenir du contenu mock (libellés de séries, highlights) — traduis (clés ou L<string>). report.* namespace existe aussi : mets les clés du module report dans report.*, le reste dans performance.*.',
    files: [
      'components/app/performance/perf-best-times.tsx', 'components/app/performance/perf-breakdown.ts',
      'components/app/performance/perf-core.ts', 'components/app/performance/perf-data.ts',
      'components/app/performance/perf-kpis.tsx', 'components/app/performance/perf-pillar-split.tsx',
      'components/app/performance/perf-platform-table.tsx', 'components/app/performance/perf-top-posts.tsx',
      'components/app/performance/perf-trend-chart.tsx', 'components/app/performance/perf-utils.ts',
      'components/app/performance/perf-workspace.tsx', 'components/app/performance/report-actions.tsx',
      'components/app/performance/report-data.ts', 'components/app/performance/report-header.tsx',
      'components/app/performance/report-highlights.tsx', 'components/app/performance/report-kpis.tsx',
      'components/app/performance/report-sections.ts', 'components/app/performance/report-workspace.tsx',
    ],
  },
  {
    ns: 'library',
    label: 'médiathèque',
    files: [
      'components/app/library/asset-card.tsx', 'components/app/library/asset-details.tsx',
      'components/app/library/asset-grid.tsx', 'components/app/library/asset-sheet.tsx',
      'components/app/library/delete-asset-dialog.tsx', 'components/app/library/deposit-link-dialog.tsx',
      'components/app/library/library-selection-bar.tsx', 'components/app/library/library-stats.tsx',
      'components/app/library/library-toolbar.tsx', 'components/app/library/library-types.ts',
      'components/app/library/library-utils.ts', 'components/app/library/library-workspace.tsx',
      'components/app/library/upload-dialog.tsx', 'components/app/library/use-library-assets.ts',
    ],
  },
  {
    ns: 'settings',
    label: 'réglages globaux + notifications',
    note: 'notifications.* namespace existe : mets les clés des composants notifications/ sous notifications.*, le reste sous settings.*.',
    files: [
      'components/app/settings/account-row.tsx', 'components/app/settings/accounts-tab.tsx',
      'components/app/settings/calendar-provider-icon.tsx', 'components/app/settings/calendars-tab.tsx',
      'components/app/settings/profile-tab.tsx', 'components/app/settings/settings-tabs.tsx',
      'components/app/notifications/notification-center.tsx', 'components/app/notifications/notification-row.tsx',
    ],
  },
  {
    ns: 'portal',
    label: 'auth + portail + shared',
    note: 'auth.* namespace existe pour les composants auth/. portal.* pour portal/. Les composants shared/account-alert et shared/selection-bar → mets sous common.* (ajoute à zones? non : common est dans fr.ts/en.ts de base — tu NE peux PAS éditer fr.ts/en.ts ici). Mets plutôt ces clés partagées sous portal.shared.* pour rester dans TES fichiers. spec-issues.tsx et quota-gauge.tsx sont DÉJÀ faits — ne les touche pas.',
    files: [
      'components/auth/login-form.tsx', 'components/auth/otp-form.tsx',
      'components/portal/annotation-viewer.tsx', 'components/portal/media-carousel.tsx',
      'components/portal/portal-card.tsx', 'components/portal/review-actions.tsx',
      'components/shared/account-alert.tsx', 'components/shared/selection-bar.tsx',
    ],
  },
  {
    ns: 'clients',
    label: 'pages app/ + auth + portal (server components)',
    note: 'Ce sont surtout des SERVER components (pages) : utilise await getT()/getFormat()/getLabels()/getLocale() + pick(). Les metadata.title FR → t(). Namespaces : mets les clés des pages sous clients.* (pages clients), mais tu peux aussi utiliser dashboard.* (déjà rempli) pour dashboard/page.tsx, portal.* pour les pages portal, auth.* pour login/otp pages, agenda.* pour agenda/page. Pour app/(app)/layout.tsx skip-link = common.skipToContent (déjà câblé). app/page.tsx + (auth)/layout.tsx = landing : mets sous auth.landing.*. manifest.ts + app/layout.tsx generateMetadata : DÉJÀ faits (meta.*), ne touche pas à layout.tsx/manifest.ts sauf si du FR reste.',
    files: [
      'app/page.tsx',
      'app/(auth)/login/page.tsx', 'app/(auth)/otp/page.tsx',
      'app/(portal)/portal/page.tsx', 'app/(portal)/portal/[contentId]/page.tsx',
      'app/(app)/dashboard/page.tsx', 'app/(app)/clients/page.tsx', 'app/(app)/clients/new/page.tsx',
      'app/(app)/clients/[clientId]/layout.tsx', 'app/(app)/clients/[clientId]/grid/page.tsx',
      'app/(app)/clients/[clientId]/calendar/page.tsx', 'app/(app)/clients/[clientId]/content/page.tsx',
      'app/(app)/clients/[clientId]/content/new/page.tsx', 'app/(app)/clients/[clientId]/content/[contentId]/page.tsx',
      'app/(app)/clients/[clientId]/content/[contentId]/edit/page.tsx', 'app/(app)/clients/[clientId]/ideas/page.tsx',
      'app/(app)/clients/[clientId]/library/page.tsx', 'app/(app)/clients/[clientId]/performance/page.tsx',
      'app/(app)/clients/[clientId]/settings/page.tsx', 'app/(app)/clients/[clientId]/report/page.tsx',
      'app/(app)/agenda/page.tsx', 'app/(app)/notifications/page.tsx', 'app/(app)/settings/accounts/page.tsx',
      'app/(auth)/layout.tsx', 'app/(portal)/layout.tsx',
    ],
  },
]

const results = await pipeline(
  ZONES,
  (z) =>
    agent(
      GUIDE +
        `\n\n## TA ZONE : ${z.label}\n` +
        `Namespace dico principal : \`${z.ns}\` → édite ` +
        `apps/web/lib/i18n/dictionaries/zones/${z.ns}.fr.ts et ${z.ns}.en.ts (objets ${z.ns}Fr / ${z.ns}En).\n` +
        (z.note ? `Note importante : ${z.note}\n` : '') +
        `\nFichiers à internationaliser (édite-les en place) :\n` +
        z.files.map((x) => '  - apps/web/' + x).join('\n') +
        `\n\nProcède fichier par fichier. À la fin, réponds via le schéma structuré (zone="${z.ns}").`,
      { label: `i18n:${z.ns}`, phase: 'i18n-zones', schema: RESULT }
    )
)

const clean = results.filter(Boolean)
const keys = clean.reduce((n, r) => n + (r.keysAdded || 0), 0)
const filesN = clean.reduce((n, r) => n + (r.filesEdited || 0), 0)
const leftovers = clean.flatMap((r) => (r.leftoverFrench || []).map((s) => `[${r.zone}] ${s}`))
log(`UI i18n : ${clean.filter((r) => r.status === 'done').length}/${ZONES.length} zones, ${filesN} fichiers, ${keys} clés`)
if (leftovers.length) log(`Restes FR non traités : ${leftovers.length}`)
return { zones: clean, totals: { files: filesN, keys }, leftovers }
