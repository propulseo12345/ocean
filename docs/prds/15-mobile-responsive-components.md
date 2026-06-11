> Template générique bibliothèque Propul'SEO — à adapter à Ocean (voir docs/PRD.md).

# PRD - MOBILE RESPONSIVE COMPONENTS SYSTEM pour [PROJET] E-COMMERCE/ERP

## 1. VIBE & GOAL
**Vibe** : Design tokens centralisés (CSS variables Tailwind v4), composants qui s'adaptent vraiment (pas juste `flex-col md:flex-row`), patterns mobile-first systématisés. **Goal** : un seul système design partagé entre tous tes projets (Lutins Farceurs / DocAgora / LOCAGAME / Tao), zéro couleur hardcodée, zéro breakpoint magique en dur, tables qui deviennent cards en mobile **sans dupliquer le code**. Le "responsive après coup" est mort en 2026 — **adaptive design ou rien.**

## 2. USER STORIES
- **As mobile user (375px)**, I want que rien ne déborde horizontalement, que les boutons fassent 44px minimum, et que la navigation soit accessible au pouce, so que j'utilise l'app dans le métro sans frustration.
- **As tablet user (768px)**, I want une mise en page qui exploite la largeur (2 colonnes au lieu de 1), so que je ne sois pas traité comme un grand smartphone.
- **As desktop user**, I want des hovers, raccourcis clavier, modales centrées, so que je sois traité comme un power user.
- **As dev**, I want UN composant qui s'adapte (`<ResponsiveTable>`), pas deux composants (`<DesktopTable>` + `<MobileList>`), so que je n'écrive pas tout en double.
- **As designer**, I want changer un token couleur en 1 endroit (`--color-brand`) et voir l'app entière s'adapter, so que je ne chasse pas `#bd060c` dans 47 fichiers.

## 3. TECH SPECS

### Design tokens — Tailwind v4 (CSS-first config)
```css
/* /app/globals.css */
@import "tailwindcss";

@theme {
  /* Brand */
  --color-brand-50:  oklch(0.97 0.02 25);
  --color-brand-500: oklch(0.55 0.22 25);   /* primaire */
  --color-brand-900: oklch(0.25 0.18 25);
  --color-accent:    oklch(0.78 0.18 90);   /* doré Lutins, override par projet */

  /* Sémantiques */
  --color-success: oklch(0.65 0.18 145);
  --color-warning: oklch(0.78 0.18 75);
  --color-danger:  oklch(0.58 0.24 27);
  --color-info:    oklch(0.65 0.18 240);

  /* Spacing échelle 4px */
  --spacing: 0.25rem;

  /* Typography */
  --font-display: "Charmonman", system-ui, serif;
  --font-heading: "The Seasons", Georgia, serif;
  --font-sans:    "Inter", system-ui, sans-serif;
  --font-body:    "Kurale", Georgia, serif;

  /* Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
  --radius-pill: 9999px;

  /* Shadows (mode light) */
  --shadow-card: 0 1px 3px oklch(0 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.04);
  --shadow-pop:  0 8px 24px oklch(0 0 0 / 0.12);

  /* Breakpoints (Tailwind v4 syntax) */
  --breakpoint-xs:  375px;     /* iPhone SE */
  --breakpoint-sm:  640px;
  --breakpoint-md:  768px;
  --breakpoint-lg:  1024px;
  --breakpoint-xl:  1280px;
  --breakpoint-2xl: 1536px;
}

/* Dark mode override */
@media (prefers-color-scheme: dark) {
  @theme {
    --color-brand-500: oklch(0.65 0.22 25);
    --shadow-card: 0 1px 3px oklch(1 0 0 / 0.05);
  }
}

/* Touch targets — règle système */
@layer base {
  button, a[role="button"], [role="button"] {
    min-height: 2.75rem;  /* 44px iOS/Android guideline */
    min-width: 2.75rem;
  }
}
```

### Hook breakpoint typé
```ts
// /hooks/use-breakpoint.ts
'use client';
import { useEffect, useState } from 'react';

const breakpoints = { xs: 375, sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 } as const;
type Bp = keyof typeof breakpoints;

export function useBreakpoint(min: Bp): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${breakpoints[min]}px)`);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [min]);
  return matches;
}
```

### Container queries pour composants vraiment adaptatifs
```css
/* /components/card.css */
@container (min-width: 320px) { .card-title { font-size: 1rem; } }
@container (min-width: 480px) { .card-title { font-size: 1.25rem; } .card { grid-template-columns: 1fr 1fr; } }
```
```tsx
<div className="@container">
  <div className="card grid grid-cols-1 @lg:grid-cols-2">…</div>
</div>
```
**Container queries > media queries** quand le composant est réutilisé dans des slots de tailles variables (sidebar, modal, grid).

### Pattern Table → Cards (mobile)
```tsx
// /components/shared/responsive-table.tsx
export function ResponsiveTable<T>({ data, columns, primaryKey }: Props<T>) {
  const isDesktop = useBreakpoint('md');
  if (isDesktop) return <DataTable data={data} columns={columns} />;
  return (
    <div className="space-y-2">
      {data.map(row => (
        <Card key={String(row[primaryKey])} className="p-4">
          {columns.filter(c => !c.hideOnMobile).map(col => (
            <div key={col.id} className="flex justify-between py-1 text-sm">
              <span className="text-muted-foreground">{col.header}</span>
              <span className="font-medium">{col.cell ? col.cell(row) : String(row[col.accessor])}</span>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
```

### Pattern Modal → Sheet (mobile)
```tsx
// /components/ui/adaptive-dialog.tsx
export function AdaptiveDialog({ open, onOpenChange, title, children }: Props) {
  const isDesktop = useBreakpoint('md');
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl">
        <SheetHeader><SheetTitle>{title}</SheetTitle></SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
```

### BottomNav mobile (apps PWA)
```tsx
// /components/layout/bottom-nav.tsx
export function BottomNav() {
  const isDesktop = useBreakpoint('md');
  if (isDesktop) return null;
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-background border-t flex justify-around py-2 z-40 pb-safe">
      {navItems.map(item => (
        <Link key={item.href} href={item.href}
              className="flex flex-col items-center gap-1 min-h-11 min-w-11 px-4 py-1">
          <item.Icon className="size-5" />
          <span className="text-[10px]">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
```
**Important** : `pb-safe` pour respecter safe-area iPhone (notch + barre home).
```css
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }
```

### Sticky form actions mobile
Sur formulaires longs (édition produit, profil), boutons en sticky bottom mobile, inline desktop :
```tsx
<form>
  {/* fields */}
  <div className="md:flex md:justify-end md:gap-2
                  fixed md:static bottom-0 inset-x-0 p-4 md:p-0
                  bg-background md:bg-transparent border-t md:border-0
                  pb-safe md:pb-0 z-20">
    <Button variant="outline" type="button">Annuler</Button>
    <Button type="submit">Enregistrer</Button>
  </div>
</form>
```

### Responsive typography (fluid)
```css
:root {
  --text-h1: clamp(1.75rem, 4vw + 1rem, 3rem);
  --text-h2: clamp(1.5rem, 3vw + 0.5rem, 2.25rem);
  --text-body: clamp(0.9375rem, 1vw + 0.5rem, 1.0625rem);
}
.h1 { font-size: var(--text-h1); }
```

### Edge Cases
- **Orientation landscape mobile** : modals plein écran + scroll interne.
- **iPhone safe area** : `pb-safe`, `pt-safe` partout où sticky.
- **Très grand écran (≥2K)** : `max-w-screen-2xl mx-auto` sinon contenu étiré illisible.
- **Reduce motion** : `@media (prefers-reduced-motion: reduce)` → désactive animations.
- **Print** : `@media print` → masque nav/footer, force `color-adjust: exact` pour brand colors.

### Intégrations
- Tailwind v4 CSS-first, plus de `tailwind.config.ts`.
- shadcn/ui composants overridés via `--color-*` tokens, pas de classes hardcoded.
- `next/font` pour fonts (Charmonman, The Seasons, Kurale) avec `font-display: swap`.

## 4. ADAPTATION PLACEHOLDERS
- **[BRAND_COLORS]** : Override `--color-brand-*` par projet (Lutins green #278c43 / red #bd060c / gold #d5b344 ; DocAgora bleu santé ; Propul'SEO violet #8843E0).
- **[FONTS]** : Stack fonts métier (Lutins = Charmonman/The Seasons/Kurale ; SaaS = Inter only).
- **[BREAKPOINTS_CUSTOM]** : Si app B2B desktop-first, ajout `2xl: 1920px` pour large screens.
- **[BOTTOM_NAV_ITEMS]** : 3-5 items max mobile (sinon overflow ergonomique).
- **[CONTAINER_QUERIES_USE]** : on/off selon support navigateurs cibles (caniuse 95%+ en 2026, on par défaut).

## 5. ACCEPTANCE CRITERIA
- [ ] Zéro couleur hardcoded (`#xxx`, `rgb()`) dans le code app — **uniquement tokens**.
- [ ] Aucun composant > 250 lignes (règle Propul'SEO).
- [ ] Mobile 375px : zéro overflow horizontal sur 100% des pages (test au DevTools).
- [ ] Boutons / liens cliquables : 44px min hauteur ET largeur (audit avec axe DevTools).
- [ ] Dark mode toggle fonctionnel sur 100% des composants, pas de "trous" white-on-white.
- [ ] Container queries utilisées pour composants embeddés dans contextes variables.
- [ ] Safe area iPhone respectée (notch top, home bar bottom).
- [ ] Reduce motion respecté — pas d'animations forcées.
- [ ] Lighthouse Accessibility 100, mobile et desktop.
- [ ] Print stylesheet basique fonctionnel (commande client, facture, fiche patient).

## 6. TODO IMPLEMENTATION
1. **CSS tokens** : `/app/globals.css` avec `@theme` complet, override projet via cascade.
2. **Hook** `useBreakpoint` + `useReducedMotion` + `useIsMobile` typés.
3. **Composants adaptatifs** : `ResponsiveTable`, `AdaptiveDialog`, `BottomNav`, `StickyFormActions`.
4. **Fonts** : `next/font/local` ou `next/font/google` avec preload + display:swap.
5. **Safe area** : utilities CSS `pb-safe`, `pt-safe`, `px-safe`.
6. **Dark mode** : `next-themes` provider + toggle, vérifier tous tokens en dark.
7. **Print stylesheet** dans `globals.css`.
8. **Tests** : Playwright sur 375/768/1280, axe-core a11y en CI, visual regression Chromatic optionnel.

## 7. CODE SKELETON
```tsx
// /components/layout/app-shell.tsx
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { ThemeToggle } from './theme-toggle';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      <Sidebar className="hidden md:flex md:w-64 md:flex-col md:border-r" />
      <main className="flex-1 flex flex-col">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b px-4 py-3 flex justify-between items-center">
          <h1 className="font-display text-xl">[PROJET]</h1>
          <ThemeToggle />
        </header>
        <div className="flex-1 p-4 pb-24 md:pb-6">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
```

```tsx
// /components/shared/kpi-grid.tsx (container-query aware)
export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-4 gap-3">
        {kpis.map(k => <KpiCard key={k.id} {...k} />)}
      </div>
    </div>
  );
}
```

## 8. NOTES SENIOR / GOTCHAS

❌ **Never** : `bg-[#bd060c]` ou `style={{ color: '#278c43' }}` → la première fois que la DA évolue, tu chasses 200 occurrences. **Tokens. Toujours.**
❌ **Never** : deux composants `<DesktopX>` + `<MobileX>` séparés → tu écris la logique métier en double, tu désynchronises au bout d'un sprint. **Un seul composant, conditionnel sur breakpoint.**
❌ **Never** : `useEffect` + `window.innerWidth` pour détecter mobile → SSR mismatch, flash visuel, hell. **`matchMedia` + state, et accepte 1 frame de désync au mount.**
❌ **Never** : safe-area ignorée → bouton "Enregistrer" sous la barre home iPhone, invisible. **`pb-safe` partout où sticky bottom.**

⚠️ **Warning** : container queries pas supportées Firefox < 110 et iOS < 16. En 2026 c'est OK, mais check tes analytics avant.
⚠️ **Warning** : font Charmonman / The Seasons en CDN externe = FOUT (flash of unstyled text). **Self-host via `next/font/local` ou hostez sur Vercel.**
⚠️ **Warning** : `useBreakpoint` au mount renvoie `false` (SSR) → flash desktop sur mobile. Skeleton ou suspense fallback obligatoire.
⚠️ **Warning** : dark mode "automatique seulement" frustrant — toggle explicite + persisted dans cookie (pas localStorage si SSR).

✅ **Best practice** : un design token = un purpose. `--color-brand` (action principale), pas `--color-red` (descriptif technique).
✅ **Best practice** : test ergonomie pouce sur ton vrai téléphone, pas DevTools. La main droite ne touche pas le coin haut-gauche d'un iPhone Pro Max.
✅ **Best practice** : tokens en OKLCH (Tailwind v4 native) pour cohérence perceptuelle entre modes light/dark.
✅ **Best practice** : extraire les patterns adaptatifs (Table→Cards, Dialog→Sheet, sticky actions) dans `/components/shared/` partageable entre projets via monorepo ou package.

🚀 **Upgrade 2026** : design system as a package (`@propulseo/ui`) versionné, partagé entre tous tes projets (DocAgora, LOCAGAME, Lutins Farceurs, Tao). Token override par projet via CSS file injecté au build. Bonus : générateur Claude qui lit un Figma export + génère le token file complet en 1 commande (`bun run tokens:from-figma`). **Game-changer absolu : pas chaque projet sa DA bricolée, mais un système avec personnalité par client via override.** Pour Propul'SEO en mode "agence qui scale" → réduction du temps de setup d'un nouveau projet de 2 jours à 2 heures. ROI = stratosphérique.
