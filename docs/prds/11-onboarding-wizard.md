> Template générique bibliothèque Propul'SEO — à adapter à Ocean (voir docs/PRD.md).

# PRD - ONBOARDING WIZARD pour [PROJET] E-COMMERCE/ERP/SaaS

## 1. VIBE & GOAL
**Vibe** : Stepper minimal, progress sauvegardée DB (pas localStorage), reprise possible 3 jours après. Inspiration Stripe/Linear, pas un Typeform-bottin. **Goal** : amener le user de "compte créé" à "premier moment de valeur" (first order, first patient, first task done) en < 3 minutes, avec **drop-off mesurable par étape**. L'onboarding est le seul moment où tu as 100% d'attention — gâche-le et tu perds le client.

## 2. USER STORIES
- **As new user**, I want voir où j'en suis (étape 2/5) en permanence, so that je sais combien de temps il me reste.
- **As new user**, I want pouvoir skip une étape non-critique et y revenir, so that je ne suis pas pris en otage par un champ optionnel.
- **As new user**, I want que mes saisies soient sauvegardées à chaque étape, so that si je ferme l'onglet je reprends pile au même endroit.
- **As new user**, I want une étape finale "Tu peux commencer" avec 3 actions concrètes, so that je sais quoi faire après le wizard.
- **As product owner**, I want voir le funnel de complétion par étape, so that je sais où les users décrochent et corrige l'UX.

## 3. TECH SPECS

### Composants shadcn
`Card` (container étape) · `Progress` (barre haut) · `Button` (Continuer/Retour/Skip/Terminer) · `Form` · `Input`/`Select`/`Checkbox`/`Switch` · `RadioGroup` · `Stepper` (custom, pas dans shadcn — voir skeleton).

### DB Schema Supabase
```sql
create table onboarding_progress (
  user_id uuid primary key references auth.users on delete cascade,
  org_id uuid references organizations,
  flow_version text not null default 'v1',  -- pour gérer migrations futures
  current_step text not null,
  completed_steps text[] not null default '{}',
  skipped_steps text[] not null default '{}',
  data jsonb not null default '{}',          -- payload accumulé étape par étape
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index on onboarding_progress (org_id, completed_at) where completed_at is null;

-- Analytics funnel
create table onboarding_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users,
  step text not null,
  event text not null check (event in ('view','complete','skip','back','abandon')),
  metadata jsonb,
  created_at timestamptz default now()
);
create index on onboarding_events (step, event, created_at desc);
```

### Définition du flow (config-driven)
```ts
// /lib/onboarding/flow.ts
export const flow = [
  { id: 'welcome',    title: 'Bienvenue',        component: WelcomeStep,    optional: false },
  { id: 'profile',    title: 'Profil',           component: ProfileStep,    optional: false,
    schema: z.object({ display_name: z.string().min(2), avatar_url: z.string().url().optional() }) },
  { id: 'organization', title: 'Ton équipe',     component: OrgStep,        optional: false,
    condition: (data) => data.account_type === 'team' },  // step conditionnel
  { id: 'preferences', title: 'Préférences',     component: PrefStep,       optional: true },
  { id: 'invite',      title: 'Inviter',         component: InviteStep,     optional: true },
  { id: 'first-action', title: 'Première action', component: FirstActionStep, optional: false },
] as const;
```

### Server Actions
```ts
'use server';
export async function saveStep(stepId: string, payload: unknown) {
  const user = await requireUser();
  const config = flow.find(s => s.id === stepId);
  if (config?.schema) config.schema.parse(payload);
  const supabase = createServerClient();
  await supabase.from('onboarding_progress').upsert({
    user_id: user.id,
    current_step: nextStepId(stepId, payload),
    completed_steps: arrayAppend('completed_steps', stepId),
    data: jsonbMerge('data', payload),
    updated_at: new Date().toISOString(),
  });
  await logEvent(user.id, stepId, 'complete', payload);
  revalidatePath('/onboarding');
}
export async function skipStep(stepId: string) { /* idem, ajoute skipped_steps */ }
export async function completeOnboarding() {
  const user = await requireUser();
  await supabase.from('onboarding_progress').update({ completed_at: new Date() }).eq('user_id', user.id);
  // déclenche side effects : email bienvenue, création workspace par défaut, sample data
  await sendWelcomeEmail(user.email);
}
```

### Step conditionnels
Logique pure côté serveur — JAMAIS d'hydration mismatch.
```ts
function nextStepId(currentId: string, data: Record<string, unknown>): string {
  const idx = flow.findIndex(s => s.id === currentId);
  for (let i = idx + 1; i < flow.length; i++) {
    const step = flow[i];
    if (step.condition && !step.condition(data)) continue;
    return step.id;
  }
  return 'completed';
}
```

### UI Flow
```
┌────────────────────────────────────────────┐
│ [Logo]              Étape 2/5    [Skip]   │
│ ████████░░░░░░░░░░░░░  40%                 │
├────────────────────────────────────────────┤
│                                            │
│        Comment t'appelles-tu ?             │
│        On va te tutoyer, ok ?              │
│                                            │
│        [Champ nom        ]                 │
│        [Champ avatar     ]                 │
│                                            │
│                                            │
│   [← Retour]              [Continuer →]   │
└────────────────────────────────────────────┘
```

### Edge Cases
- **User refresh à l'étape 3** : reload depuis DB, repart sur step 3, données préremplies.
- **User ferme et revient 2 jours plus tard** : email reminder J+1 (Edge Function cron) avec lien direct vers son étape.
- **Skip non autorisé** sur étape `optional: false` → bouton Skip masqué.
- **Validation échoue** → toast + champ rouge + scrollIntoView, pas de submit.
- **Onboarding déjà complété** → redirect `/dashboard` direct, pas re-show.
- **Réseau coupé** : sauvegarde locale en queue, retry au reconnect (optimistic UI).

### Intégrations
- **PostHog/Mixpanel** ou table `onboarding_events` propre : funnel par step.
- **Brevo** : email J+1 si abandon, email félicitations à completion.
- **Sample data seeder** : à completion, génère 3 produits demo / 2 patients demo / 5 tâches demo selon métier — l'app vide = mort instantanée.

## 4. ADAPTATION PLACEHOLDERS
- **[FLOW_STEPS]** : Liste des étapes spécifiques (Tao → goals/3-priorités/notifications/widgets ; DocAgora → spécialité/horaires/cabinet/Stripe Connect ; LOCAGAME → catégories produits/zone livraison/SIRET).
- **[ACCOUNT_TYPES]** : `solo` / `team` / `enterprise` → conditional steps.
- **[FIRST_VALUE_ACTION]** : action de fin qui crée le "aha moment" (créer 1ère commande, ajouter 1er patient, planifier 1ère tâche).
- **[SAMPLE_DATA]** : seed par métier (produits demo, patients fictifs, leads exemples).
- **[REMINDER_CADENCE]** : J+1, J+3, J+7 emails de relance (Edge Function `pg_cron`).

## 5. ACCEPTANCE CRITERIA
- [ ] Progress bar reflète exactement étapes complétées / total non-skipped.
- [ ] Refresh page = reprise exacte (current_step + data DB).
- [ ] Skip d'une étape optionnelle = reste accessible plus tard via `/onboarding/[step]`.
- [ ] Email J+1 envoyé si `completed_at IS NULL AND started_at < now() - interval '1 day'`.
- [ ] Funnel analytics : événements `view`/`complete`/`skip`/`abandon` enregistrés systématiquement.
- [ ] Mobile 375px : pas de scroll horizontal, champs lisibles, boutons sticky bas d'écran.
- [ ] Validation Zod côté Server Action, pas que côté client.
- [ ] Onboarding completé → `completed_at` set + redirect dashboard + first-value action triggerée.
- [ ] Step conditionnel calculé côté serveur, pas de flash UI.
- [ ] Lighthouse > 95 sur la page onboarding (c'est ta vitrine).

## 6. TODO IMPLEMENTATION
1. **DB** : `onboarding_progress` + `onboarding_events` + index + RLS (user ne voit que son propre progress).
2. **Flow config** : `/lib/onboarding/flow.ts` typé strict avec satisfies.
3. **Route group** : `/app/(onboarding)/onboarding/[step]/page.tsx` avec layout dédié (pas la nav app standard).
4. **Server Actions** : `saveStep`, `skipStep`, `goBack`, `completeOnboarding`.
5. **Middleware** : redirige vers `/onboarding/[current_step]` tant que `completed_at IS NULL` (sauf pages publiques).
6. **Edge Function cron** : `onboarding-reminders` quotidien, envoi emails J+1/J+3/J+7.
7. **Sample data seeder** : Server Action `seedSampleData(metier)` exécuté à completion.
8. **Tests** : refresh à chaque étape, skip+retour, validation échec, complétion full, conditionnel branch.

## 7. CODE SKELETON
```tsx
// /app/(onboarding)/onboarding/[step]/page.tsx
import { notFound, redirect } from 'next/navigation';
import { flow } from '@/lib/onboarding/flow';
import { getProgress } from '@/lib/onboarding/queries';
import { OnboardingShell } from '@/components/onboarding/shell';

export default async function StepPage({ params }: { params: { step: string } }) {
  const progress = await getProgress();
  if (progress.completed_at) redirect('/dashboard');
  const config = flow.find(s => s.id === params.step);
  if (!config) notFound();
  // Empêche skip d'étapes non atteintes
  if (!progress.completed_steps.includes(config.id) && progress.current_step !== config.id) {
    redirect(`/onboarding/${progress.current_step}`);
  }
  const StepComponent = config.component;
  return (
    <OnboardingShell currentStep={config.id} flow={flow} progress={progress}>
      <StepComponent initialData={progress.data} />
    </OnboardingShell>
  );
}
```

```tsx
// /components/onboarding/shell.tsx
'use client';
export function OnboardingShell({ currentStep, flow, progress, children }: Props) {
  const visibleSteps = flow.filter(s => !s.condition || s.condition(progress.data));
  const currentIdx = visibleSteps.findIndex(s => s.id === currentStep);
  const pct = Math.round(((currentIdx + 1) / visibleSteps.length) * 100);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 flex justify-between items-center">
        <Logo />
        <span className="text-sm text-muted-foreground">Étape {currentIdx + 1}/{visibleSteps.length}</span>
      </header>
      <Progress value={pct} className="h-1 rounded-none" />
      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-8">{children}</main>
    </div>
  );
}
```

## 8. NOTES SENIOR / GOTCHAS

❌ **Never** : stocker le progress en localStorage uniquement. User change de device, refresh en mode privé, vide cache → tout perdu, dropoff garanti. **DB ou rien.**
❌ **Never** : forcer 10 étapes avant valeur. Si tu peux skip 6, **supprime-les** du flow, n'autorise pas skip. Skip = échec de design.
❌ **Never** : "Comment as-tu connu le produit ?" en étape 2. C'est pour toi, pas pour le user. Mets-le en post-onboarding optionnel.
❌ **Never** : flash de contenu non-traduit ou re-render serveur-client divergent → tu paniques le user à l'instant T-zéro.

⚠️ **Warning** : conditional steps doivent être calculés côté serveur uniquement. Sinon hydration mismatch + experience cassée.
⚠️ **Warning** : trop d'analytics events = lag input. Throttle ou Edge Function async (fire-and-forget).
⚠️ **Warning** : sample data trop générique = fake-feeling. Adapte au métier déclaré ("Cabinet médical à Paris" → patients FR avec adresses parisiennes plausibles).

✅ **Best practice** : étape finale = "Voici 3 actions concrètes" avec CTA primaires, pas "Bienvenue dans le dashboard !" générique.
✅ **Best practice** : mesure le temps moyen par étape, optimise les outliers (étape qui prend > 60s = problème UX).
✅ **Best practice** : A/B test sur la première étape, c'est là que ça décroche.
✅ **Best practice** : autoriser navigation backward via flèche browser — `usePathname` + redirect serveur si étape pas atteignable.

🚀 **Upgrade 2026** : onboarding adaptatif piloté par Claude. Au lieu d'un flow figé, agent qui pose 2-3 questions ouvertes ("Décris ton activité en 2 lignes"), parse via tool-use vers un schéma `OnboardingPayload`, propose un setup pré-rempli ("Tu sembles être un cabinet dentaire, j'ai pré-créé 5 actes type, 3 plages horaires, et activé Stripe Connect. Confirme ou ajuste"). Réduit le temps to-first-value de 3min à 45s. Tao en a particulièrement besoin pour calibrer les 3 priorités quotidiennes selon le profil détecté.
