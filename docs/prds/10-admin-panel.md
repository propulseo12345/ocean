> Template générique bibliothèque Propul'SEO — à adapter à Ocean (voir docs/PRD.md).

# PRD - ADMIN PANEL pour [PROJET] E-COMMERCE/ERP

> Implementation de reference : voir aussi templates/claude-md/03-crm-dashboard.md section 4 (resource registry).

## 1. VIBE & GOAL
**Vibe** : Back-office dense, navigable au clavier, zero clic perdu. Inspiration Linear/Retool, pas WordPress wp-admin. **Goal** : un seul shell admin qui gère N ressources (products, orders, users, invoices, leads…) via un **resource registry pattern** — tu ajoutes une table, tu déclares 30 lignes de config, le CRUD complet apparaît : liste filtrable, create, edit, delete, audit. Refaire un back-office par projet est la définition de la dette technique.

## 2. USER STORIES
- **As admin**, I want a single sidebar listing all resources grouped by domain, so that je navigue sans réfléchir.
- **As admin**, I want des breadcrumbs dynamiques cliquables (`Accueil > Produits > Edit "T-shirt"`), so that je remonte d'un cran sans recharger.
- **As admin**, I want chaque ressource avec liste + détail + edit générés depuis une config TS, so that je ne réécris pas le même formulaire 12 fois.
- **As admin**, I want voir un audit trail (qui a changé quoi quand) sur chaque entité, so that je débogue les comportements clients qui jurent qu'ils n'ont rien fait.
- **As superadmin**, I want impersonate un user pour reproduire son bug, so that je ne demande pas son mot de passe.

## 3. TECH SPECS

### Composants shadcn
`Sidebar` (sticky, collapsible, command-palette compatible) · `Breadcrumb` · `Tabs` (Details/Activity/Audit) · `Sheet` (édition latérale rapide) · `Dialog` (confirm destructive) · `Command` (Cmd+K palette globale) · `Form` · `DataTable` (réutilise prds/02-sales-data-table.md) · `Avatar` · `DropdownMenu`.

### Resource Registry pattern (cœur du système)
```ts
// /lib/admin/resources/index.ts
export const resources = {
  products: {
    label: 'Produits',
    icon: Package,
    group: 'Catalogue',
    table: 'products',
    listColumns: ['name', 'sku', 'price', 'stock', 'is_active'],
    searchFields: ['name', 'sku'],
    filters: [{ field: 'category_id', type: 'select', source: 'categories' }],
    formSchema: productSchema, // Zod
    formFields: productFormFields,
    permissions: { read: ['admin','editor'], write: ['admin'] },
    actions: [
      { id: 'duplicate', label: 'Dupliquer', icon: Copy, handler: duplicateProduct },
      { id: 'export-pdf', label: 'Fiche PDF', icon: FileText, handler: exportProductPdf },
    ],
  },
  // orders, users, invoices, leads… même contrat
} satisfies Record<string, ResourceConfig>;
```

### DB Schema Supabase
```sql
-- Audit générique sur toutes les tables admin
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations,
  user_id uuid references auth.users,
  resource text not null,           -- 'products', 'orders'...
  resource_id uuid not null,
  action text not null check (action in ('create','update','delete','restore')),
  diff jsonb,                       -- { before: {...}, after: {...} }
  ip inet, user_agent text,
  created_at timestamptz default now()
);
create index on audit_log (resource, resource_id, created_at desc);
create index on audit_log (org_id, created_at desc);

-- Soft delete sur ressources critiques
alter table products add column deleted_at timestamptz;
create index on products (deleted_at) where deleted_at is null;

-- Saved views par user (filtres mémorisés)
create table admin_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  resource text not null,
  name text not null,
  filters jsonb not null,
  is_default boolean default false
);
```

### Trigger audit générique
```sql
create or replace function log_audit() returns trigger language plpgsql security definer as $$
begin
  insert into audit_log (org_id, user_id, resource, resource_id, action, diff)
  values (
    coalesce(new.org_id, old.org_id),
    auth.uid(),
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    case tg_op
      when 'INSERT' then jsonb_build_object('after', to_jsonb(new))
      when 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
      when 'DELETE' then jsonb_build_object('before', to_jsonb(old))
    end
  );
  return coalesce(new, old);
end $$;

-- À appliquer sur chaque table admin
create trigger audit_products after insert or update or delete on products
  for each row execute function log_audit();
```

### Server Actions génériques
```ts
// /app/admin/[resource]/actions.ts
'use server';
export async function createResource(resource: string, formData: FormData) {
  const config = resources[resource];
  const parsed = config.formSchema.parse(Object.fromEntries(formData));
  await assertPermission(resource, 'write');
  const supabase = createServerClient();
  const { data, error } = await supabase.from(config.table).insert(parsed).select().single();
  if (error) throw error;
  revalidatePath(`/admin/${resource}`);
  return data;
}
export async function updateResource(resource: string, id: string, data: unknown) { /* idem */ }
export async function deleteResource(resource: string, id: string) {
  // Soft delete par défaut si colonne deleted_at existe
}
export async function bulkAction(resource: string, ids: string[], action: string) { /* … */ }
```

### Impersonation (superadmin only)
- Server Action `impersonateUser(userId)` génère un JWT scoped courte durée via Supabase admin API.
- Banner rouge sticky en haut : `🔴 Impersonation : alice@example.com — [Quitter]`.
- Toutes les actions sont loguées avec `impersonated_by` dans `audit_log`.

### UI Flow
```
┌─────────────────────────────────────────────────────┐
│ Sidebar │ Breadcrumb            🔔 [Cmd+K] [Avatar] │
│ ─────── │ ─────────────────────────────────────────│
│ DASHBOARD│ Produits                  [+ Nouveau]    │
│ CATALOGUE│ ┌──────────────────────────────────────┐│
│  Produits│ │ 🔍 search  [Filtres] [Vues ▾]        ││
│  Catégories│ ├──────────────────────────────────────┤│
│ VENTES   │ │ DataTable (prds/02-sales-data-table.md)                   ││
│  Commandes│ │  ☐  Nom    SKU   Prix   Stock  •••   ││
│  Factures│ │  ☐  T-shirt TS-01 29€   142    [Edit]││
│ CRM      │ └──────────────────────────────────────┘│
│  Leads   │ Pagination · 1 234 résultats             │
│  Deals   │                                          │
│ ─────── │  Sheet latéral si edit rapide            │
│ Settings│                                          │
└─────────────────────────────────────────────────────┘
```

### Edge Cases
- **Resource inexistante** dans l'URL → 404 propre, pas crash.
- **Permission refusée** → page 403 avec lien retour, pas redirect silencieux (frustrant pour l'admin).
- **Audit énorme** (>10k entrées sur 1 ressource) → pagination + filtre date obligatoire.
- **Soft-deleted visible** seulement avec toggle `Voir supprimés` (admin only).
- **Edition concurrente** : optimistic locking via `updated_at` envoyé au form, conflit 409 → toast "Modifié par X, recharger".

### Intégrations
- Cmd+K palette (`cmdk` lib) : recherche cross-resources, raccourcis actions, navigation.
- Export ressource → réutilise prds/13-csv-pdf-export.md.
- Notifications realtime → bell réutilise prds/09-notifications-realtime.md.

## 4. ADAPTATION PLACEHOLDERS
- **[RESOURCES_LIST]** : Liste des ressources spécifiques au projet (DocAgora → patients/appointments/practitioners ; LOCAGAME → products/reservations/customers/delivery ; Lutins Farceurs → orders/products/customers).
- **[GROUPS]** : Domaines métier dans la sidebar (Catalogue / Ventes / CRM / Compta / Réglages).
- **[ROLES]** : `admin`, `editor`, `viewer`, `superadmin`, ou métier-spécifique (`praticien`, `secrétaire`…).
- **[IMPERSONATION=on/off]** : Risque RGPD/sécurité, off par défaut sauf besoin support client.
- **[AUDIT_RETENTION]** : 90 jours par défaut, 7 ans si secteur réglementé (santé, finance).
- **[CMDK_SHORTCUTS]** : Actions globales projet-spécifiques.

## 5. ACCEPTANCE CRITERIA
- [ ] Ajout d'une nouvelle ressource = 1 fichier config TS, **zéro page écrite**.
- [ ] Cmd+K ouvre la palette < 100ms, fuzzy search sur toutes ressources.
- [ ] Sidebar collapsible mémorise l'état en localStorage.
- [ ] Breadcrumb cliquable, ne casse jamais sur ressources nested.
- [ ] Audit log capture create/update/delete sur toutes les tables critiques.
- [ ] Impersonation bannière visible 100% du temps, exit en 1 clic.
- [ ] Mobile 375px : sidebar devient Sheet, tables deviennent cards (voir prds/15-mobile-responsive-components.md).
- [ ] Permissions RLS testées : viewer ne peut PAS écrire même via API directe.
- [ ] Optimistic locking : conflit détecté, message clair.
- [ ] Lighthouse mobile/desktop > 90 sur liste + édition.

## 6. TODO IMPLEMENTATION
1. **DB** : `audit_log` + triggers sur toutes les tables admin + `admin_saved_views` + colonnes `deleted_at` où pertinent.
2. **Types** : `ResourceConfig` strict + `resources` registry avec satisfies.
3. **Layout** : `/app/admin/layout.tsx` avec Sidebar + Breadcrumb + Cmd+K + permission middleware.
4. **Pages dynamiques** : `/app/admin/[resource]/page.tsx` (list), `[resource]/[id]/page.tsx` (detail), `[resource]/new/page.tsx`, `[resource]/[id]/edit/page.tsx`.
5. **Server Actions** : CRUD générique + bulk actions + impersonation.
6. **Cmd+K palette** avec `cmdk`, indexée sur registry + actions custom.
7. **Audit timeline UI** dans tab "Activity" sur chaque détail.
8. **Tests** : permissions par rôle, optimistic locking, soft delete, audit trigger sur insert/update/delete.

## 7. CODE SKELETON
```tsx
// /app/admin/layout.tsx
import { AdminSidebar } from '@/components/admin/sidebar';
import { CommandPalette } from '@/components/admin/command-palette';
import { ImpersonationBanner } from '@/components/admin/impersonation-banner';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !['admin','editor','viewer','superadmin'].includes(user.role)) redirect('/');
  return (
    <div className="flex h-screen">
      <AdminSidebar user={user} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ImpersonationBanner />
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>
      <CommandPalette />
    </div>
  );
}
```

```tsx
// /app/admin/[resource]/page.tsx
import { notFound } from 'next/navigation';
import { resources } from '@/lib/admin/resources';
import { ResourceList } from '@/components/admin/resource-list';

export default async function ResourcePage({
  params, searchParams,
}: { params: { resource: string }; searchParams: Record<string, string> }) {
  const config = resources[params.resource];
  if (!config) notFound();
  return <ResourceList config={config} searchParams={searchParams} />;
}
```

## 8. NOTES SENIOR / GOTCHAS

❌ **Never** : générer un back-office ad hoc par ressource → tu rééditeras 14 fichiers à chaque tweak UI. **Registry ou rien.**
❌ **Never** : audit_log dans la même requête qu'une mutation critique sans trigger DB → l'app peut crash entre les deux. **Trigger Postgres = atomique.**
❌ **Never** : hard delete sur products/orders/invoices/users → tu casses des FK + tu perds l'historique légal (factures = 10 ans en France).
❌ **Never** : impersonation sans bannière permanente + audit trail dédié → faille RGPD + procès.

⚠️ **Warning** : Cmd+K mal indexée = inutilisable. Précalcule l'index au mount, debounce 50ms, max 8 résultats par groupe.
⚠️ **Warning** : sidebar avec 40+ items = ergonomie morte. Groupe par domaine, collapse les groupes par défaut, sticky le groupe actif.
⚠️ **Warning** : audit_log sans index → DB en feu à 100k lignes. Index composé (resource, resource_id, created_at desc) obligatoire.

✅ **Best practice** : déclare `ResourceConfig` avec `satisfies` (pas `as`) pour garder l'inférence stricte.
✅ **Best practice** : actions custom par ressource (duplicate, export, send-email) au niveau registry, pas hardcodées.
✅ **Best practice** : permissions check **double** (côté route + côté Server Action + RLS DB) — defense in depth.
✅ **Best practice** : test E2E "ajouter une ressource" → ouverture liste, création, édition, suppression, audit visible. Si ça marche pour 1, ça marche pour les 15.

🚀 **Upgrade 2026** : agent admin Claude qui écoute `audit_log` realtime et alerte sur patterns suspects (10 deletes en 5min, login pays inhabituel, montants commandes hors stats). Ajoute aussi un mode "Ask the admin" : input texte qui transforme "donne-moi les 10 commandes les plus rentables de mars" en filtre+tri sur la DataTable via tool-use → game-changer pour clients non techniques.
