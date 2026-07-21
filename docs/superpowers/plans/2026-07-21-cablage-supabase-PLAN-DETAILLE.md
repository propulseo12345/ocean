> Genere le 2026-07-21 par audit multi-agents (12 domaines, refutation adversariale
> sur 10/12 — `write-paths` et `pages-contract` audites mais non refutes, limite de
> session). Decision proprietaire integree : auth MOT DE PASSE uniquement.
> Le plan court d'orientation est dans 2026-07-21-cablage-supabase.md.

> **DECISIONS TRANCHEES (2026-07-21, proprietaire)** :
> - D1 = **text monolingue**. Le contenu client est du `text` simple ; l'i18n ne porte que l'UI.
> - D4 = **table `client_settings` fille org-only**. Les reglages de cadence/relance ne sont
>   jamais lisibles par le reviewer. Ces reglages NE vont PAS sur `clients` (migration 011 a ajuster).
> - Auth = **mot de passe uniquement** (pas d'OTP, pas de magic link).

# Plan d'exécution consolidé — Câblage Supabase d'Ocean (zéro mock)

Document de travail issu de la consolidation des 12 audits de domaine et de leurs réfutations adversariales. Sert de base à l'écriture du SQL (migrations 010+) et du code (DAL, Server Actions, câblage).

**Verdict global de consolidation** : les 12 audits convergent sur un jeu de **24 tables nouvelles** (après dédup depuis ~40 propositions redondantes) + `publish_jobs` différé au Lot 2. Onze domaines rendent `CORRECTIONS_MINEURES`, **un seul rend `REFONTE_NECESSAIRE` (types-i18n)** — non pas sur les tables mais sur les **policies RLS** : la moitié des tables filles de `content_item` étaient proposées sans le prédicat `is_reviewer_visible_content`, ce qui ouvre une fuite reviewer systématique. C'est la correction structurante n°1 de tout le plan.

---

## 1. Déduplication : le jeu canonique de tables

| Canonique | Proposée aussi comme | Domaines | Décision & motif |
|---|---|---|---|
| **media_assets** | library_assets, MediaAsset inline | media, pages-contract, types-i18n, write-paths | **1 seule table pool, fille de client.** Motif : « TOUT MEDIA DE CONTENU PASSE PAR LA MEDIATHEQUE » (media, vérifié composer-media.tsx : unique entrée = MediaPickerDialog). Le split library/media est rejeté ; `library_asset_usages` est **refusée** (type-i18n vérif : 2e source de vérité, dérivable de content_media). |
| **content_media** | content_item_media | media, pages-contract, write-paths | Liaison N-N + `position`. **PK surrogate `id uuid`** (pas `(content_item_id, media_asset_id)`) — motif média : les annotations doivent ancrer sur un id stable au réordonnancement, et un même asset peut légitimement apparaître 2× dans un carrousel. |
| **content_pillars** | — | content-extra, calendar-editorial, client-config, pages-contract, write-paths, types-i18n | 6 audits. Table transverse (pas « du calendrier »), consommée par 7 pages. |
| **content_versions** | — | portal, content-extra, write-paths, pages-contract, types-i18n | Snapshot légende. `version_number smallint` (trie au-delà de v10) + libellé dérivé. |
| **approvals** | content_approvals | portal, write-paths, pages-contract, types-i18n | Immuable. Porte `version_label text` **dénormalisé** (voir décision D5). |
| **content_comments** | comments | portal, write-paths, pages-contract, types-i18n | 2 couches `visibility` (client/internal). Annotation ancrée sur **content_media**, pas sur media_asset+slide. |
| **content_activity** | content_activity_entries | portal, content-extra, write-paths, pages-contract, types-i18n | Append-only. **`kind` + `payload jsonb`**, pas de phrase figée (motif i18n). |
| **review_requests** | — | portal, write-paths, pages-contract, types-i18n | **Sans index unique partiel** (motif : casse `sendReviewRequest`, board-state.ts, 23505 au 2e envoi). `state` **dérivé**, non persisté. |
| **review_request_items** | — | portal, write-paths, pages-contract, types-i18n | N-N triple FK composite. |
| **review_request_recipients** | — | portal, types-i18n | FK composite `(client_id, recipient_user_id) → client_members` (unique(client_id,user_id) existe en 004). |
| **client_invitations** | — | portal, auth-session | **P0** : sans elle aucun reviewer réel ne peut exister (client_members.user_id → auth.users). |
| **imported_posts** | — | analytics, pages-contract, write-paths | Feed IG existant. `media_product_type` (pas `media_type`), `deleted_on_platform_at`. |
| **post_metrics** | — | analytics, pages-contract, write-paths, types-i18n(oublié) | Polymorphe **content_target_id XOR imported_post_id** (grain par plateforme, motif analytics). |
| **social_account_quota_usage** | platform_quota_usage | analytics, pages-contract | **PK composite `(social_account_id, quota_kind)`** (motif : IG a 2 compteurs, FB a 2 — CLAUDE.md §6, une ligne unique ne peut pas les porter). |
| **recurring_slots** | — | client-config, calendar-editorial, content-extra, write-paths, pages-contract, types-i18n | Dépend de content_pillars. |
| **client_events** | — | client-config, calendar-editorial, write-paths, pages-contract, types-i18n | `event_date DATE` (jamais timestamptz — consensus total). |
| **brand_kits** | — | client-config, write-paths, pages-contract, types-i18n | PK `client_id` (1-1). **P1** (motif : preflight banned words = warning, jamais bloquant — preflight.ts:204). |
| **hashtag_groups** | — | content-extra, client-config, write-paths, pages-contract, types-i18n | **Config-domain** (client-config vérif : orphelin entre deux audits). Vide tant qu'aucun éditeur UI. |
| **saved_views** | — | client-config, write-paths, pages-contract, types-i18n | Par-user (`owner_user_id`). `filters.label_ids uuid[]` (pas des noms — corrige un bug EN). **Sans `sort_order`** (spéculatif). |
| **calendar_accounts** | — | agenda, write-paths, types-i18n, pages-contract(calendar_subscriptions) | **USER-scopé** (motif : agenda « Perso » — yoga, déjeuner famille — fuirait à tous les admins via platform_connections.is_org_member ; PRD:445). |
| **calendar_account_secrets** | — | agenda | Deny-all + `revoke all` (GUARD-05). |
| **calendar_calendars** | calendar_subscriptions | agenda, pages-contract | Le niveau « calendrier » que le mock aplatit. Porte le toggle `is_enabled`. |
| **calendar_events** | — | agenda, pages-contract, types-i18n | Cache. `user_id` dénormalisé (motif : policy-avec-jointure interdite). |
| **media_deposit_links** | deposit_links | media, write-paths | **P2**. |
| ~~publish_jobs~~ | — | write-paths | **Différé Lot 2** (worker) — non requis pour le câblage front. |

**Tables explicitement REFUSÉES** (ne pas créer) :
- `library_asset_usages` → dérivé de `content_media` (ajouter `library_asset_id` sur media_assets).
- `client_automation_rules` → `publish_on_approval` doublonne `clients.approval_mode` (double source sur l'invariant « pas de publication sans approbation ») ; `quota_defer` est un filet non-négociable (CLAUDE.md §5) ; `remind_*` sont des préférences de notification.
- `reviewers` → jointure `client_members × profiles`.
- Toute table de `dashboard_tasks`, KPI, trend, mix, best-times → **dérivés** (vues/RPC).

---

## 2. Corrections des vérificateurs intégrées (delta vs audits bruts)

**Colonnes spéculatives supprimées** (aucun consommateur code) :
- media_assets : `checksum`, `derived_from_id`, `variant` (applyCrop est un mock pur en mémoire).
- content_media : `rendered_media_asset_id` (doublon de derived_from_id).
- post_metrics : `impressions`, `video_views`, `shares` (EngagementStats = likes/comments/reach/saves seulement).
- imported_posts : `caption`, `media_count` (grid hardcode `mediaCount:1`).
- saved_views : `sort_order`. brand_kits : `unique(id,client_id)` (redondant avec PK client_id). content_activity : `detail_override`.

**Nullabilité corrigée** (motifs vérifiés) :
- media_assets : `width/height/byte_size/mime_type` **nullable** — `source='import'` (feed IG) ne fournit ni dims ni MIME, et specs.ts tolère l'absence (l.82/87/105). `thumb_path` nullable (import + dépôt sans vignette client).
- post_metrics : `external_post_id` **nullable** (content_targets.external_post_id l'est en 006), `reach` **nullable** (default 0 fait plonger la moyenne KPI d'un rapport client — rateOf divise par reach).
- calendar_accounts : `email` **not null** (rendu sans garde agenda-sidebar.tsx:55).

**RLS — la REFONTE (types-i18n V1)** : toute policy SELECT reviewer sur une table fille de `content_item` **DOIT** porter le prédicat de visibilité, jamais `is_client_member(client_id)` nu :
```sql
using (
  (select private.is_org_member(org_id))
  or ((select private.is_client_member(client_id))
      and (select private.is_reviewer_visible_content(content_item_id)))
)
```
Concerné : content_comments, content_media, media_assets, content_versions, review_request_items, approvals. Sans ce prédicat, un reviewer lit les brouillons masqués via la table fille (motif documenté dans 006). **6 leak tests pgTAP passeraient au rouge** sans cette correction.

**GRANTS — discipline GUARD-05** (agenda V-A, analytics rule_violations) : `RLS on + zéro policy` ne suffit pas — Supabase accorde TRUNCATE/REFERENCES à `authenticated` par ALTER DEFAULT PRIVILEGES, et **TRUNCATE n'est pas soumis à la RLS**. Toute table en lecture-seule pour authenticated (post_metrics, imported_posts, social_account_quota_usage, calendar_*, *_secrets) exige :
```sql
revoke all on public.<table> from anon, authenticated;
grant select on public.<table> to authenticated;         -- ou rien pour les secrets
grant select, insert, update, delete on public.<table> to service_role;
```
Sinon n'importe quel authentifié `TRUNCATE public.post_metrics` détruit les métriques de tous les tenants. **Étendre le garde CI GUARD-05 à ces tables.**

**Immuabilité vs RGPD (types-i18n V6)** : `reviewer_user_id`/`author_user_id references profiles(id) on delete restrict` est un bug — profiles→auth.users est `on delete cascade`, le RESTRICT en aval **rend impossible la suppression d'un compte** qui a commenté/décidé. Correctif partout : `on delete set null` + colonne dénormalisée snapshot (`decided_by_display_name`, `author_name`, `actor_name`).

**FK composite `set null` sur pillar_id** (client-config + calendar-editorial) : `on delete set null` **nu** sur `(pillar_id, client_id)` tenterait de nuller `client_id` (not null) → 23502 en prod. Syntaxe PG15 obligatoire : `on delete set null (pillar_id)`.

**Enum account_status** : ajouter `'expired'` (AccountStatus front = connected|needs_reauth|expired ; labels.ts, client-health-banner.tsx:46 teste `=== "expired"` → branche morte sinon). `ALTER TYPE public.account_status ADD VALUE 'expired'`.

**Quota PK** : `social_account_quota_usage` en `(social_account_id, quota_kind)`, enum `quota_kind`. `quota_limit` devient informatif nullable (les limites 100/30/5 vivent dans `packages/shared`, pas en base — sinon double source de vérité que l'audit rejette lui-même).

---

## 3. Migration 010 — Fondations (enums, helpers, bootstrap, policies transverses)

**Enums nouveaux** (+ `grant usage to authenticated, service_role`) :
`media_source`(upload|depot_client|import), `comment_visibility`(client|internal), `comment_author_role`(owner|reviewer), `approval_decision`(approved|changes_requested), `activity_kind`(11 valeurs), `client_event_kind`(note|event), `invitation_status`(pending|accepted|revoked|expired), `quota_kind`(ig_publish|ig_container|fb_buc|fb_reels|tt_draft).
**Enum modifié** : `ALTER TYPE account_status ADD VALUE 'expired'`.

**Helper P0 — lecture des profils partagés** (portal missing_tables + auth-session, **bidirectionnel** — auth-session vérif : le sens reviewer→agence doit passer alors que le reviewer n'est membre d'aucune org) :
```sql
create function private.shares_scope_with(_other uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists ( -- même org
    select 1 from public.organization_members a
    join public.organization_members b on a.org_id = b.org_id
    where a.user_id = (select auth.uid()) and b.user_id = _other)
  or exists (     -- même client (couvre reviewer↔agence dans les deux sens)
    select 1 from public.client_members cm
    join public.clients c on c.id = cm.client_id
    where cm.user_id = _other
      and (cm.client_id in (select client_id from public.client_members where user_id = (select auth.uid()))
           or c.org_id in (select org_id from public.organization_members where user_id = (select auth.uid()))));
$$;
revoke all on function private.shares_scope_with(uuid) from public;
grant execute on function private.shares_scope_with(uuid) to authenticated, service_role;

create policy profiles_select_shared on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.shares_scope_with(id)));
```
Sans cette policy : nom/email/initiales du reviewer vides partout (section-approval, portal, thread, activity) — **blocage fonctionnel silencieux, aucune erreur**.

**RPC bootstrap org** (dead-broken, confirmée) : `public.create_organization(_name text, _slug text)` SECURITY DEFINER, insère organizations + organization_members(role='owner', user_id=auth.uid()) en une tx. Motif : 003 n'a **aucune** policy INSERT sur organizations, handle_new_user n'écrit que profiles → un user password sans org tombe sur getActiveOrg()=null → 18 pages plantent.

**Autres 010** : `platform_connections` ADD `check (provider in ('instagram','facebook','tiktok'))` (motif : bloque une connexion Google d'agenda dans la table org-visible). `content_labels` ADD `system_key text` + `unique(client_id, system_key)` (filtre evergreen use-calendar-derived.ts:41) + `check (color_token ~ '^var\(--[a-z0-9-]+\)$')` (rétro).

**pgTAP 010** : `shares_scope_with` — user A (org 1) lit le profil d'un reviewer du client de l'org 1 ✓ ; user A ne lit pas un user de l'org 2 ✗ ; reviewer du client 1 lit le profil owner de l'agence ✓ ; reviewer du client 1 ne lit pas un reviewer du client 2 ✗.

---

## 4. Lots de migration (011–016)

Ordre imposé par les FK. Chaque lot : `revoke all` + grants explicites, wrapping `(select fn())`, `TO authenticated`, triggers `set_updated_at`, et **leak tests pgTAP obligatoires**.

### Migration 011 — Configuration éditoriale
**Tables** : `content_pillars` → `recurring_slots` (dépend pillars) → `hashtag_groups`, `brand_kits`, `client_events`, `saved_views`.
**ALTER content_items** : `pillar_id uuid` + `foreign key (pillar_id, client_id) references content_pillars(id, client_id) on delete set null (pillar_id)` ; `first_comment text` ; `pinned boolean not null default false` ; `exclude_from_grid boolean not null default false` ; `platform_options jsonb not null default '{}'` (igLocation/fbLink) ; `updated_by uuid`.
**ALTER clients** (voir décision D4 sur l'exposition reviewer) : `review_reminder_days smallint`, `cadence_gap_days smallint`, `cadence_max_per_day smallint`, `cadence_alerts jsonb`.
**Points durs intégrés** : `content_pillars.color_token` check couvre **chart-1..chart-5** (5 couleurs, MAX_PILLARS=6) ; pas de `banned_words` lowercase check (casse l'onboarding, tag-input.tsx stocke la casse brute) ; pas de `palette <= 12` check (violable par 2 listes UI) ; `recurring_slots.platforms` : `check (platforms <@ array['instagram','facebook','tiktok']::platform[] and cardinality(platforms) >= 1)` (motif : `array_length('{}',1)` = NULL passe le check) ; **pas** de `unique(client_id, weekday, time_of_day)` (casse le bouton Ajouter, cl_brulerie a déjà mardi 11:30).
**Débloque** : calendar, board studio, composer (pilier/hashtags/slots), settings client (brand kit/cadence/slots), ideas, grid (palette).
**pgTAP** : org A vs org B sur pillars/events/slots/brand_kits/hashtag_groups/saved_views ; reviewer client 1 → **0 ligne** sur tous (org-only) ; `set null (pillar_id)` : supprimer un pilier laisse content_items.client_id intact ; supprimer un client cascade sans 23502.

### Migration 012 — Médias & Storage
**Tables** : `media_assets` (fille client) → `content_media` (liaison, `id uuid` PK, `unique(id,client_id)`, `unique(content_item_id, position) deferrable initially deferred` — **contrainte** `add constraint`, pas `create index` ; upsert = delete+insert en tx car ON CONFLICT indispo).
**Helper** : `private.is_reviewer_visible_media(_media uuid)` (asset rattaché à ≥1 content visible reviewer OU dépôt propre) — sur le modèle exact de is_reviewer_visible_content.
**ALTER content_items** : `cover_media_asset_id uuid` + FK composite ; `cover_frame_ms integer` + `check` mutuelle exclusion.
**ALTER media_assets** : `library_asset_id`… non — media_assets EST le pool ; l'usage vient de content_media (pas de colonne).
**Storage** : buckets `media-originals` (privé, 300MB, MIME whitelist = specs.ts) + `media-thumbs` (public, 1MB, webp). Helper `private.can_write_client_media(_org,_client)` couplant `storage.foldername()[1]` ET `[2]` (motif : membre org A écrivant dans `{orgA}/{clientDeOrgB}/`). Chemin **sans** segment content_item_id (décision D2).
**Trigger cardinalité** : AFTER INS/UPD sur content_media couvrant **les 4 formats** (post/reel/story = 1 média, carousel ≤ 10, reel = 1er média vidéo) — motif : l'enforcement UI-only est interdit ; l'auditeur ne couvrait que carousel.
**Débloque** : library, composer médias, content detail, grid vignettes, portail carrousel.
**Prérequis code** : corriger `draftFromContent` (composer-types.ts) pour reporter `libraryAssetId` — sinon `content_media.media_asset_id not null` rend toute ré-édition impossible.
**pgTAP** : org A vs org B ; **reviewer client 1** ne voit que les médias de contenus visibles (pas les rushes/brouillons), 0 ligne du client 2 ; storage : membre org A ne peut PAS uploader dans `{orgA}/{clientOrgB}/`.

### Migration 013 — Collaboration, validation, invitations
**Tables** (ordre FK) : `content_versions` → `approvals` (FK content_version_id) ; `content_comments` (FK annotation → **content_media**, donc après 012) ; `content_activity` ; `review_requests` → `review_request_items`, `review_request_recipients` ; `client_invitations`.
**Corrections intégrées** :
- `content_comments` : annotation = `annotation_content_media_id uuid` + `annotation_x/y real (check 0..1)` (**drop slide_index**, dérivé de content_media.position ; motif média : ancre stable au réordonnancement). Coordonnées relatives à la boîte intrinsèque (bug studio-carré vs portail-4/5 à corriger côté rendu). `author_user_id on delete set null` + `author_name text`. Grant colonne : `grant update (resolved_at, resolved_by, deleted_at)` (motif : RLS ne restreint pas la colonne, sinon l'owner réécrit `body` d'un retour client).
- `approvals` : append-only (zéro update/delete authenticated) ; `version_label text` **dénormalisé** (D5) ; `decided_by on delete set null` + `decided_by_display_name`.
- `content_activity` : `kind`+`payload jsonb`+`actor_name` (pas de `detail`) ; **SELECT org-only** ; INSERT par triggers SECURITY DEFINER + service_role.
- `review_requests` : `state` dérivé, **pas d'index unique partiel** ; `closed_at` optionnel.
- `client_invitations` : `unique(client_id, lower(email)) where accepted_at is null and revoked_at is null` (immutable, pas de prédicat `now()`) ; token en `token_hash` seulement ; `revoke select(token_hash) from authenticated`.
**ALTER content_items** : `client_comments_count integer not null default 0` + trigger comptant `visibility='client' AND deleted_at is null` (motif : count naïf révèle le volume interne au reviewer) ; trigger `approval_stale=true` sur mutation caption/hashtags/format/médias quand approved existe.
**ALTER content_targets** : `last_error jsonb` (motif dead-broken : l'erreur est **par plateforme**, pas sur content_items) ; `manual_published_by/at` ; `retry_requested_at`, `skipped_reason` ; **trigger garde de transition** analogue à 008 (motif write-paths : `content_targets_update` laisse tout is_org_member fabriquer `status='published'` + permalink → publication fantôme).
**ALTER client_members** : `last_active_at timestamptz`.
**RPC** :
- `submit_review_decision(content_item_id, decision, message)` SECURITY DEFINER — valide is_client_member + statut courant `in_review`, insère approvals, met à jour content_items.status, insère comment si message, émet notification. **Motif B1** : content_items_update est org-only, le reviewer ne peut PAS changer le statut par PostgREST.
- `touch_client_member_seen(_client)` — pose last_active_at (bornée à >5 min ; motif : sinon 1 write/navigation ; une policy UPDATE ouvrirait `role`).
- `emit_notification(...)` — **motif B2** : notifications n'a aucune policy INSERT ; une policy ouverte laisserait forger un destinataire. La RPC valide que le destinataire partage le tenant.
**Route Handler** `/api/invitations/[token]/accept` (service_role) : `update ... set status='accepted' where token_hash=$1 and status='pending' and expires_at>now() returning *` (one-shot atomique) + **vérifie que l'email du compte créé = invitation.email** (angle mort auth-session).
**Débloque** : detail contenu (thread/versions/activity/review-panel), portail (approuver/demander modifs/annoter), board review, invitation reviewer, l'invariant approval_mode.
**pgTAP (les plus critiques du projet)** : (a) reviewer ne lit **aucune** ligne `visibility='internal'` ; (b) reviewer ne lit pas les commentaires d'un contenu `draft`/`idea`/corbeille ; (c) reviewer ne peut INSERT ni `visibility='internal'` ni un `author_user_id` d'autrui ; (d) reviewer ne peut PAS `PATCH content_items {status}` en direct (seule la RPC passe) ; (e) reviewer client 1 → 0 ligne approvals/comments/activity du client 2 ; (f) content_targets : is_org_member ne peut PAS poser `status='published'` (garde trigger).

### Migration 014 — Feed & Performance
**Tables** : `imported_posts` → `post_metrics` (FK imported_post_id) → `social_account_quota_usage`.
**Corrections** : `post_metrics` polymorphe `check ((content_target_id is not null) <> (imported_post_id is not null))`, `engagement_total` colonne générée, `reach` nullable, pas d'`unique(social_account_id, external_post_id)` sur post_metrics (motif : un doublon d'hygiène deviendrait un crash de batch ; le dédoublonnage est à l'import). `imported_posts` : `media_product_type` (FEED|REELS|STORY, pas media_type), `deleted_on_platform_at`, `unique(social_account_id, external_post_id)`, pas de `platform` (dérivé du compte). Quota : PK `(social_account_id, quota_kind)`. **Écriture service_role exclusive** sur les 3 + `revoke all`/grant select (GUARD-05).
**ALTER social_accounts** : `avatar_url text`, `following_count integer`, `feed_synced_at`, `feed_sync_error text` (motifs : avatar client = hack `importedPosts[0].thumbUrl` ; following consommé grid/page.tsx:210).
**Prérequis code** : `perf-data.ts`, `perf-breakdown.ts`, `report-data.ts` importent `@/lib/mocks` en **synchrone** → passer async + orgId (les 2 seules pages hors substitution de façade). Corriger la signature `getPostMetrics(_orgId, clientId)` → le 2e param est en réalité un **refId** (piège actif grid/page.tsx). Supprimer le N+1 (1 requête `where content_target_id in (...)`).
**Débloque** : grid (importés + top post + badges), performance (toute la page), report.
**pgTAP** : org A vs org B ; `TRUNCATE post_metrics` par authenticated **échoue** ; reviewer → 0 ligne (org-only, décision D-imported).

### Migration 015 — Agenda unifié
**Tables** : `calendar_accounts` (**user-scopé**) + `calendar_account_secrets` (deny-all) **dans la même migration** (règle 11) → `calendar_calendars` → `calendar_events`.
**Corrections** : FK composite `(org_id, user_id) references organization_members(org_id, user_id)` (motif : rien ne garantit sinon que le user est membre de l'org) ; `unique(id, user_id)` + `unique(id, org_id)` comme ancres ; `calendar_events` porte `user_id` dénormalisé (motif : policy-avec-jointure interdite) et **ne référence que** calendar_calendars (drop `calendar_account_id` denorm — jamais lu, corrige l'incohérence de cohérence FK) ; `provider_color`, `last_sync_error` dupliqués supprimés ; `external_calendar_id` = identité stable (remplace `calendarKey(name.fr)`, bug de renommage Google) ; all-day = `start_date/end_date date` + timed = `starts_at/ends_at timestamptz` + check strict des 2 branches ; `grant update (is_enabled)` **précédé de** `revoke update ... from authenticated` (sinon no-op).
**Vue** `unified_agenda` en `security_invoker = true` — tuple mince (kind, source_id, org_id, starts_at, ...). **Bug corrigé** : content_items n'a **pas** de user_id → la vue expose `owner_user_id` nullable avec filtre par branche (`kind='publication' or owner_user_id = auth.uid()`), sinon un `.eq('user_id')` défensif fait disparaître toutes les publications.
**ALTER content_items** : index `(org_id, scheduled_at) where deleted_at is null and scheduled_at is not null` (agenda org-wide fenêtré).
**Débloque** : agenda, TodayPanel dashboard, settings/accounts calendriers.
**pgTAP (régression spécifique)** : **deux membres de la MÊME org ne voient PAS leurs agendas respectifs** (le test classique org A/org B ne couvre pas ce cas) ; reviewer → 0 ligne ; TRUNCATE calendar_events par authenticated échoue.

### Migration 016 — Dépôt client (P2)
`media_deposit_links` + `ALTER media_assets add deposit_link_id + FK`. Résolution token via Route Handler service_role. **Décision D9** sur le ré-affichage.
**pgTAP** : org A vs org B ; reviewer → 0 ligne.

---

## 5. Décisions à trancher par le propriétaire (avec recommandation)

| # | Décision | Recommandation | Impact si repoussé |
|---|---|---|---|
| **D1** | **i18n : `L<string>` → `text` monolingue** pour le contenu (27 champs) ? | **OUI, text.** Cohérent CLAUDE.md §1 « FR only au MVP ». Système (notifications/activity/last_error) reste `kind+payload`. Chemin d'écriture déjà monolingue (ComposerDraft). | Conditionne le **type de la moitié des colonnes**. Bloque toute migration. À trancher AVANT 011. |
| **D2** | **Chemin Storage** `{org}/{client}/{media_asset_id}/` (sans content_item_id, contre règle 21) ? | **OUI.** Un asset de médiathèque n'a pas de content_item_id à l'upload et en a N ensuite ; les 2 premiers segments restent l'isolation. | Touche une règle écrite du CLAUDE.md — arbitrage explicite requis. |
| **D3** | **media-thumbs bucket PUBLIC** (vignettes de contenus non publiés world-readable, 3 UUID non énumérables) ? | **Reconfirmer** (PRD L409 acté). Alternative : thumbs privé + URL signée 15 min, au prix du cache CDN. | Fuite de bas niveau assumée. |
| **D4** | **Cadence/reminder sur `clients`** = lisibles par le reviewer (clients_select autorise is_client_member) ? | **Table `client_settings` fille org-only** OU column grants. Le reviewer verrait les seuils de prod internes et le délai de relance. | Fuite de contexte interne au client. À trancher AVANT 011. |
| **D5** | **content_versions** org-only + `approvals.version_label` dénormalisé ? | **OUI.** `content_versions.note` est interne (« suite au retour de Camille ») ; le portail n'a besoin que du libellé. | Sinon fuite de la note OU perte du libellé au portail. |
| **D6** | **post_metrics** grain par **content_target** (pas content_item) ? | **content_target.** Un post IG+FB a 2 jeux de chiffres ; le comparatif plateformes l'exige. | Refonte si changé après coup. |
| **D7** | **is_reviewer_visible_content** : ajouter `'publishing'` et `'failed'` ? | **OUI** + garder le masquage UI (portal-card neutralise en 'scheduled'). Sinon le contenu **disparaît** du portail en publication. | Le client voit sa liste rétrécir sans explication. |
| **D8** | **Reset mot de passe self-service** (incompatible avec « password only, pas de magic link ») ? | **Pas de self-service en phase solo** (reset via dashboard Supabase). Un lien recovery EST un lien à usage unique. | Aucun code. |
| **D9** | **Lien de dépôt** : token re-affichable vs minté à la demande ? | **Minté à la demande** (bouton « générer »), hash stocké, affiché une fois. | Le dialog actuel ré-affiche l'URL à chaque ouverture — à retravailler. |
| **D10** | **Portail à >1 client** : sélecteur de client ou scope mono-client ? | **Sélecteur de client** dans le portail. Aujourd'hui getReviewerContext rend tout au fuseau de clients[0] (dates fausses). | Bug latent (invisible car 1 client/reviewer en mock). |
| **D11** | **Suppression asset servant UNIQUEMENT de cover Reel** | Compter la cover dans `usedInContentIds` (sinon « Inédit » → supprimé sans dialogue → cover d'un Reel publié détruite). `cover_media_asset_id on delete restrict`. | Trou de suppression concret (ct_cl_brulerie_9…). |

---

## 6. Plan par phases — critères de sortie vérifiables, effort, risques

> Règle transverse : `getActiveOrg()` en 1re ligne de chaque Server Action, injection `org_id: ctx.org.id`, parse Zod calé sur les **enums SQL** (pas les types front, plus larges), `revalidatePath` après mutation, events PostHog critiques **côté serveur**.

### Phase 0 — Fondations Supabase + auth mot de passe · **Effort L**
Migration 010. Installer `@supabase/ssr`, `@supabase/supabase-js`, `zod`. Créer `lib/supabase/{server,client,admin}.ts` (admin avec `import "server-only"`), `lib/auth/dal.ts` (`verifySession` via **getUser()**, jamais getSession), réécrire `org-context.ts` (cookie `active_org_id` validé contre organization_members) et `proxy.ts` (**fail-closed** + refresh de session via createServerClient — motif : allowlist actuelle rend toute route future publique, et aucun refresh = déconnexion en boucle). Server Actions `signIn/signOut/switchOrg` + `create_organization`. **Supprimer** `/otp`, otp-form, magic link, « entrer en démo » (bypass d'auth réel). Câbler le logout de nav-user.tsx (aujourd'hui un `<Link>`). **Tuer la collision de port CoProFlex** (PID sur :3001, fausse le diagnostic 404).
**Sortie vérifiable** : un user s'inscrit (password) → `select count(*) from organization_members where user_id=<u>` = 1 ; login → atterrit `/dashboard` sans boucle ; un 2e user d'une autre org : `select * from clients` sous son JWT = **0 ligne de l'org 1** ; `curl 127.0.0.1:<port>/portal` sans session → 307 `/login`.
**Risques** : proxy fail-open actuel = tout ce qui n'est pas listé est public ; profiles illisible sans 010.

### Phase 1 — Lot 011 + câblage config éditoriale · **Effort M**
Migration 011. Câbler pillars/hashtags/brand kit/events/slots/saved views en lecture (6 pages). Server Actions : createPillar, updateBrandKit, addRecurringSlot, addClientEvent, saveView, updateCadence, updateApprovalMode, updateApprovalReminderDays. Basculer content_labels (composer/board/saved_views) sur les tables existantes (id, pas noms) + system_key evergreen. Corriger `pillarMeta` (map globale tous-clients → couleur de la ligne scopée). Corriger `section-approval.tsx:61 dirty` (ignore reminderDays).
**Sortie** : créer un pilier via UI → `select * from content_pillars where id=<x>` le renvoie ; toggler en anglais → le pilier garde son nom FR (D1 vérifié) ; **leak** : JWT reviewer client 1 → `select from content_pillars where client_id=<client2>` = 0.
**Risques** : color_token chart-1..5 (pas 4) ; banned_words sans lowercase-check.

### Phase 2 — Lot 012 + câblage médias + Storage · **Effort XL**
Migration 012 + buckets + policies. Câbler library, MediaPickerDialog, content-detail-media, grid, portail carousel. Server Actions : uploadLibraryAssets (TUS 6MB, conversion JPEG IG, thumb WebP client), attachMedia, reorderMedia (delete+insert tx), applyCrop (réécrit l'objet Storage), deleteAsset (soft + refus si content_media référence). **Corriger draftFromContent** (report libraryAssetId — prérequis dur). Portail : Server Component génère les **URL signées 1h** après lecture RLS (jamais de policy storage directe au reviewer sur media-originals).
**Sortie** : upload → `select storage_path from media_assets where id=<x>` non nul + fichier présent via API Storage ; attacher → `content_media` a la ligne à la bonne position ; réordonner → positions permutées en DB ; **leak** : reviewer voit les médias d'un contenu `in_review`, 0 ligne d'un `draft` ; storage : `insert` par membre org A dans `{orgA}/{clientB}/…` **refusé**.
**Risques** : HEIC iPhone ; deferrable + delete-then-insert ; cover deletion (D11).

### Phase 3 — Lot 013 + câblage collaboration + portail · **Effort XL**
Migration 013. Câbler detail (thread/versions/activity/review-panel), portail (review-actions/annotation-viewer), board review. RPC submit_review_decision, touch_client_member_seen, emit_notification. Server Actions : postComment, addInternalNote, sendReviewRequest, remindReviewer, inviteReviewer + Route Handler accept. Réécrire getReviewerContext sur client_members+auth.uid(). Portail : gérer ctx.clients vide (notFound, pas `as Client`), sélecteur client (D10).
**Sortie** : reviewer approuve via portail → `content_items.status='approved'` + 1 ligne approvals (via RPC) ; **le reviewer ne peut PAS** `update content_items set status` en direct (pgTAP 42501 hors RPC) ; `select body from content_comments where visibility='internal'` sous JWT reviewer = **0 ligne** ; owner lit `full_name` du reviewer (shares_scope_with) ≠ null ; invitation → un reviewer réel se connecte au password et voit `/portal`.
**Risques** : garde 008 (trigger invisible à get_advisors — seul pgTAP la voit) ; conflits UI/008 (voir Phase 6) ; RPC porte les claims reviewer donc 008 s'applique (voulu).

### Phase 4 — Lot 014 + câblage feed/performance · **Effort L**
Migration 014. Passer perf-data/perf-breakdown/report-data en async+orgId. Câbler grid importés, performance, report. Server/worker `syncFeed` (service_role, exclut les external_post_id déjà dans content_targets → anti double-comptage). Supprimer la mise à l'échelle mock (PERIOD_FACTOR, DELTA_SHAPE — deltas inventés dans un rapport client).
**Sortie** : performance rend depuis `post_metrics` (`grep "@/lib/mocks" perf-data.ts` = 0) ; `TRUNCATE public.post_metrics` sous rôle authenticated → **permission denied** ; 1 seule requête métriques pour toute la grille (plus de N+1).
**Risques** : heatmap best-times = décor sans donnée (calculer ou retirer, jamais persister en l'état) ; reach nullable propagé « non disponible ».

### Phase 5 — Lot 015 + câblage agenda · **Effort L**
Migration 015 + vue. Câbler agenda, TodayPanel, settings/accounts. OAuth calendrier custom (Route Handlers Google/Microsoft, rotation refresh MS sous advisory lock) — **différable** : câbler d'abord le toggle Server Action + lecture, OAuth au Lot 4. calendarKey → uuid (external_calendar_id).
**Sortie** : `select * from unified_agenda where starts_at between $from and $to` renvoie events + publications triés ; **2 membres même org** : agenda de l'un = 0 ligne sous le JWT de l'autre ; toggle → `is_enabled` persiste.
**Risques** : vue user_id (bug publications qui disparaissent) ; all-day date-only (glissement de jour) ; secrets deny-all + revoke.

### Phase 6 — Complétude Server Actions & transitions de statut · **Effort L**
Résoudre les conflits UI/008 : **C1** resendReview `changes_requested→draft→in_review` (2 updates + nouvelle version) ; **C2** retirer `approved` de TO_REVIEW_FROM ; **C3** décider `draft→idea` (ajouter à 008 ou retirer le bouton) ; **in_review→scheduled** interdit aussi (isMovable trop permissif). RPC `mark_target_published_manually` (statut agrégé published/partially — interdits à authenticated). emit_notification sur review_requested/changes_requested/content_approved/approved_date_changed. content_targets retry (règle 15 : interroger le container si publish_started_at).
**Sortie** : chaque transition câblée soit réussit soit est rejetée proprement (**aucun 42501 surprise** — matrice testée) ; `select` après resendReview montre v(n+1) créée ; drag calendrier d'un `approved` → approval_stale=true.
**Risques** : matrice 008 + insert policy (naissance idea/draft only) ; manual publish = déclaration humaine (colonnes manual_*).

### Phase 7 — Aplatissement i18n (L<string> → text) · **Effort M**
Stratégie 4 temps (build vert à chaque étape) : T1 shim `pick()` tolérant (1 fichier) ; T2 bascule des types (10 fichiers : 4 types/ + 6 locaux — UsageRef, PostRow, PillarSlice, CalendarFilter, Marronnier, board-state) ; T3 cas SYSTÈME (notifications type+payload, content_activity kind+payload, last_error jsonb) ; T4 nettoyage des 144 `pick()` + retrait `L`/`loc`/`pick`. Ne touche **pas** `lib/i18n/dictionaries/**` (38 zones), labels.ts, translator.
**Sortie** : `pnpm build` vert avec types `string` ; `grep -r "pick(" apps/web/components apps/web/app` = 0 ; toggle EN traduit l'UI, pas les légendes.
**Risques** : 70 fichiers (dont 45 client) — d'où le shim T1 qui découple ; les gabarits i18n de content_activity (11 kinds) n'existent pas encore (à écrire en T3).

### Phase 8 — Suppression des mocks + vérification finale · **Effort M**
Supprimer l'implémentation de `lib/data/mock.ts`, les 8 re-exports morts (l.155-164), `__tz_repro.mjs`, orphelins UI (aspect-ratio, breadcrumb). **Dégeler l'horloge** : `lib/clock.ts` + les **5 composants** important `fromNow/hours/days` directement (board-kanban:112/116, board-schedule-dialog:63… sinon publie éternellement le 12/06/2026). Déplacer `lib/mocks/types` → `lib/domain`, `labels.ts` → `lib/labels.ts`, `images.ts` → `lib/placeholders.ts`, extraire `hours/days` → `lib/duration.ts` (motif : `lib/mocks/` contient du code de PRODUCTION importé par 156 fichiers). Seed SQL généré depuis les mocks (volumes : 4 clients, 69 contenus, 9 comptes…).
**Sortie** : `grep -rE "@/lib/(mocks|data/mock)" apps/web/app apps/web/components` = **0** (hors imports de types relocalisés) ; `get_advisors` clean ; **tous les leak tests pgTAP verts** ; passe de vérification visuelle post-dégel (les mocks calibrés au 11/06/2026 → tout devient « passé »).
**Risques** : dégel = régression silencieuse (kanban classe tout en passé) ; DEFAULT_TZ='Europe/Paris' dans format.ts (audit appel par appel).

---

## 7. Risques transverses (à surveiller en continu)

1. **La garde 008 est un trigger, pas une policy** → invisible à `get_advisors`. Seul le test pgTAP 008 la couvre. Tout nouvel enum content_status doit être ajouté au `case`, sinon 42501 explicite. Nommer les nouveaux triggers de statut pour s'ordonner avant `set_updated_at` (tri alpha `g < s`).
2. **profiles illisible** = noms/emails vides partout sans erreur. Le helper `shares_scope_with` doit être **bidirectionnel** — le sens reviewer→agence est le plus facile à rater.
3. **TRUNCATE cross-tenant** (GUARD-05) sur les tables lecture-seule : `revoke all` obligatoire, garde CI à étendre.
4. **3 fichiers contournent la façade** (perf-data, perf-breakdown, report-data, import synchrone `@/lib/mocks`) → refactor async préalable, hors des « 19 pages ».
5. **Storage originals privé + portail lit fullUrl** → URL signées côté Server Component, jamais de policy storage reviewer.
6. **calendar_events / content_items asymétrie user_id** → vue unified_agenda à owner_user_id nullable, sinon publications disparues.
7. **Enums front > enums DB** (AccountStatus, MemberRole owner|reviewer vs 4 valeurs DB) → Zod calé sur SQL, pas sur les types mock ; 22P02 sinon à l'insert.
8. **Zéro Server Action aujourd'hui** (`grep "use server"` = vide) : les 77 mutations recensées sont toutes à écrire ; le contrat de lecture établi ne dit rien de l'écriture.

**Chemin critique** : D1 (i18n) et D4 (exposition reviewer) doivent être tranchés **avant la migration 011**. Le reste des décisions peut suivre le lot concerné.