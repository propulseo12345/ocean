# 11c — Auth, RLS, portail Reviewer & leak tests (2026-07-07)

> Plan complet de la couche sécurité du câblage : Supabase Auth, middleware, org-context, helpers `private.*`, policies RLS par famille de tables, invitation Reviewer, isolation portail, checklist pgTAP. Source : CLAUDE.md §2/§3/§9 + PRD §8.1 + 09-securite. **READ-ONLY — patterns proposés, non appliqués.**

## 1. Supabase Auth

- **Desktop** : magic link. **Mobile** : OTP 6 chiffres (le magic link ouvert depuis Mail crée la session dans Safari, pas dans la PWA installée — §8.5).
- **SMTP custom Supabase → Brevo** : magic link et OTP partent via Brevo (jamais Resend). Configuré au Lot 0.
- **Reviewer** = vrai user Supabase Auth, invité par `inviteUserByEmail` + `signInWithOtp`. Possède UNIQUEMENT des lignes `client_members` → ne passe aucune policy org-level par construction (§2.6).
- **Trigger `handle_new_user`** : insère **uniquement** dans `profiles` (name, email, initials, timezone). Rien d'autre (§2 règle 9). Ni org, ni rôle, ni membership.

Écrans front à câbler (aujourd'hui mock) :
- `login/page.tsx` : RHF+Zod, `supabase.auth.signInWithOtp({email})` (magic link desktop) ; transporter l'email vers `/otp` ; gérer `?next=` (valider la cible, éviter open redirect).
- `otp/page.tsx` : saisie 6 chiffres, `supabase.auth.verifyOtp({email, token, type:'email'})` ; redirection `next` ou `/dashboard`.

## 2. Middleware (`proxy.ts` en Next 16)

**Décision D-3 (actée §08 T-4) : réécrire le matcher pour la topologie réelle, fail-closed.**

```ts
// apps/web/proxy.ts  (Next 16 : middleware.ts → proxy.ts)
export async function proxy(req: NextRequest) {
  const { response, user } = await updateSession(req)
  const { pathname } = req.nextUrl

  const PUBLIC = ['/login','/otp','/api/health','/api/oauth']  // + '/' exact
  const isPublic = pathname === '/' || PUBLIC.some(p => pathname.startsWith(p))

  if (isPublic) {
    if (user && pathname.startsWith('/login'))
      return NextResponse.redirect(new URL('/dashboard', req.url))
    return response
  }
  // Portail : authentifié, PAS membre d'org (scoping client_members via RLS)
  if (pathname.startsWith('/portal')) {
    if (!user) return NextResponse.redirect(new URL('/login?next='+pathname, req.url))
    return response
  }
  // TOUT le reste (dashboard, clients, agenda, notifications, settings) = session requise
  if (!user) return NextResponse.redirect(new URL('/login?next='+pathname, req.url))
  return response
}
```

Différence clé avec le §9 du CLAUDE.md : le CLAUDE.md protège `startsWith('/app')` (préfixe inexistant) — **on protège par défaut** (tout ce qui n'est pas dans `PUBLIC`), ce qui couvre `/dashboard` et `/clients/*` réels. Fail-closed.

## 3. Org-context (jamais depuis le client)

```ts
// lib/auth/org-context.ts
export const getActiveOrg = cache(async () => {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const orgId = (await cookies()).get('active_org_id')?.value   // httpOnly, posé serveur
  const { data: m } = await supabase.from('organization_members')
    .select('org_id, role, organizations(*)')
    .eq('user_id', user.id).eq('org_id', orgId).single()
  return m ? { org: m.organizations, role: m.role } : null
})

// Contexte Reviewer (portail) — remplace DEMO_REVIEWER_CLIENT_ID
export const getReviewerContext = cache(async () => {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('client_members')
    .select('client_id, role, clients(*)').eq('user_id', user.id)
  return data ?? []   // clients accessibles (multi-clients possible)
})
```

Cookie `active_org_id` : `httpOnly, secure, sameSite:'lax'`, posé **serveur uniquement** (`switchOrg` Server Action). Jamais lu depuis un composant untrusted.

## 4. Helpers `private.*` (SECURITY DEFINER, schéma non exposé)

Pas de claims JWT d'autorisation au MVP → révocation d'un reviewer **immédiate** (pas au refresh du token). Les policies lisent 2 tables d'appartenance indexées, sans jointure.

```sql
create schema if not exists private;

create or replace function private.is_org_member(_org uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.organization_members
    where org_id = _org and user_id = (select auth.uid()));
$$;

create or replace function private.is_client_member(_client uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.client_members
    where client_id = _client and user_id = (select auth.uid()));
$$;
```

## 5. Policies RLS par famille de tables

**Famille A — tables org-level** (organizations, clients, notifications, calendar_accounts…) :
```sql
alter table clients enable row level security;
create policy clients_select on clients for select to authenticated
  using ((select private.is_org_member(org_id)));            -- wrap (select …), TO authenticated
create policy clients_write on clients for all to authenticated
  using ((select private.is_org_member(org_id)))
  with check ((select private.is_org_member(org_id)));
```

**Famille B — tables filles de Client** (content_items, content_targets, comments, media_assets, library_assets, pillars, review_requests…) : accès **soit** org-member **soit** client-member (le reviewer passe par client_members) :
```sql
create policy content_items_read on content_items for select to authenticated
  using ((select private.is_org_member(org_id)) or (select private.is_client_member(client_id)));
-- écriture : org-member uniquement (le reviewer ne modifie pas le contenu)
create policy content_items_write on content_items for all to authenticated
  using ((select private.is_org_member(org_id)))
  with check ((select private.is_org_member(org_id)));
```

**Famille C — `approvals` (INSERT-ONLY)** : le reviewer INSÈRE sa décision, tout le monde du tenant LIT, personne ne modifie :
```sql
create policy approvals_insert on approvals for insert to authenticated
  with check ((select private.is_client_member(client_id)));  -- le reviewer approuve
create policy approvals_read on approvals for select to authenticated
  using ((select private.is_org_member(org_id)) or (select private.is_client_member(client_id)));
-- AUCUNE policy UPDATE/DELETE (immuable — piste d'audit)
```

**Famille D — `*_secrets` (DENY-ALL)** : RLS activée, **zéro policy** → seuls worker/serveur (service role) y accèdent. Aucun token vers le navigateur.
```sql
alter table social_account_secrets enable row level security;
-- (aucune policy — deny-all)
```

**Famille E — user-scoped** (push_subscriptions) : `using (user_id = (select auth.uid()))`.

**Vues** (`unified_agenda`) : `security_invoker = true` (héritent des policies des tables sous-jacentes).

## 6. Storage (policies par chemin)

Chemins `{org_id}/{client_id}/{content_item_id}/{asset_id}/…` → isolation par `storage.foldername()` :
```sql
create policy media_originals_read on storage.objects for select to authenticated
  using (bucket_id = 'media-originals'
    and (select private.is_org_member( (storage.foldername(name))[1]::uuid ))
    -- ou is_client_member sur le 2e segment pour le reviewer
  );
```
- `media-originals` PRIVÉ (exposition uniquement par URL signée TTL 48 h générée par le worker à la publication).
- `media-thumbs` PUBLIC (vignettes ~400px WebP).
- Jamais de DELETE SQL sur `storage.objects` (Edge Function `media-cleanup`, API Storage).

## 7. Invitation Reviewer (Lot 3)

1. Owner invite : `supabase.auth.admin.inviteUserByEmail(email)` (service role serveur) → email via Brevo (template `reviewer-invitation`).
2. Créer la ligne `client_members(client_id, user_id, role='reviewer')` — c'est CE qui donne l'accès (pas l'invitation elle-même).
3. Reviewer clique → `signInWithOtp` → portail. `getReviewerContext()` résout ses clients.
4. Révocation = DELETE de la ligne `client_members` → effet **immédiat** (pas de claim JWT à attendre).

## 8. Checklist leak tests pgTAP (§2 règle 8 — CI bloquante)

Pour **chaque** ressource, deux tests minimum :

```
□ org_isolation_content_items    : user org A insère → user org B ne voit PAS (select = 0)
□ org_isolation_content_items_w  : user org B ne peut PAS insérer avec org_id de A (RLS reject)
□ reviewer_isolation_cross_client: reviewer client 1 ne voit PAS le contenu du client 2 (même org)
□ reviewer_cannot_write_content  : reviewer ne peut PAS UPDATE un content_item (write refusé)
□ secrets_deny_all               : aucun rôle authenticated ne lit social_account_secrets (0 ligne)
□ approvals_immutable            : UPDATE/DELETE sur approvals → refusé
□ media_path_isolation           : accès storage cross-tenant refusé via foldername()
□ fk_composite_anti_leak         : insérer un content_target pointant un content_item d'un autre client → échec contrainte
```

+ `get_advisors` clean après **chaque** migration (aucune table sans RLS, aucune policy manquante).

## 9. Impact concret sur les écrans existants

| Écran mock actuel | Ce qui change au câblage |
|---|---|
| `login`/`otp` (toast) | vrais `signInWithOtp`/`verifyOtp`, RHF+Zod, transport email, `?next=` |
| `(app)/*` (ouvert) | `proxy.ts` fail-closed exige une session |
| shell (lit mocks côté client) | contexte léger chargé serveur, passé en props/provider |
| `portal` (DEMO_REVIEWER_CLIENT_ID) | `getReviewerContext()` → clients réels via client_members |
| `portal/[cid]` (pas de règle visibilité) | applique statuts publics + hors corbeille (comme la liste) |
| détail contenu (getters enfants non scopés) | RLS + clientId explicite dans chaque getter |
| `settings/accounts` (reconnect simulé) | vrais flux OAuth custom + health check tokens |

> Rien de tout ceci ne change l'apparence de l'UI validée : ce sont des coutures de sécurité **sous** l'UI. Le seul changement de comportement voulu est la fermeture des fuites (détail portail, IDOR getters enfants).
