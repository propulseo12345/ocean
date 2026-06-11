> Template générique bibliothèque Propul'SEO — à adapter à Ocean (voir docs/PRD.md).

# PRD - USERS, ROLES & RLS pour [PROJET] E-COMMERCE/ERP

## 1. VIBE & GOAL
**Vibe** : Auth pro type Linear/Clerk. Magic link + OAuth + SSO. Roles granulaires, permissions par feature, audit complet, no leaks.

**Goal** : Système auth + autorisations multi-tenant pour `[PROJET]`, avec rôles (admin/manager/staff/client/viewer), RLS Postgres sur toutes les tables, OAuth providers, magic link, 2FA optionnel, invitations équipe, audit log.

## 2. USER STORIES
- As user, I want sign-in par magic link so que pas de password à retenir.
- As user, I want OAuth Google/GitHub so que je gagne 30s.
- As admin, I want inviter membre par email + role so que onboarding rapide.
- As admin, I want voir audit log connexions so que je détecte anomalies.
- As admin, I want changer rôle d'un user instant so que permissions immédiates.
- As user, I want activer 2FA so que mon compte sécurisé.

## 3. TECH SPECS

### Stack
- **Supabase Auth** : email + magic link + OAuth (Google, GitHub, LinkedIn)
- **RLS Postgres** : sur 100% des tables (zero exception)
- **Middleware Next.js** : protected routes + role check
- **Cookies httpOnly** : session côté server (jamais localStorage)
- **2FA** : TOTP via Supabase Auth (otpAuth)

### DB Schema Supabase
```sql
-- Table publique liée à auth.users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'manager', 'staff', 'client', 'viewer')),
  organization_id UUID REFERENCES organizations(id), -- multi-tenant si applicable
  locale TEXT DEFAULT 'fr',
  timezone TEXT DEFAULT 'Europe/Paris',
  is_active BOOLEAN DEFAULT true,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Multi-tenant (optionnel)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions granulaires (optionnel, au-delà des rôles)
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  resource TEXT NOT NULL, -- 'invoices', 'products', 'users'
  action TEXT NOT NULL, -- 'read', 'create', 'update', 'delete', '*'
  UNIQUE(role, resource, action)
);

-- Invitations
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  event TEXT NOT NULL, -- 'sign_in', 'sign_out', 'password_change', 'role_change', '2fa_enabled', 'failed_login'
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user_event ON auth_audit_log(user_id, event, created_at DESC);

-- Trigger : profile auto-créé à signup
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Helper functions pour RLS
CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::json->>'role', ''),
    'client'
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.org_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'organization_id', '')::uuid;
$$ LANGUAGE sql STABLE;

-- RLS profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own_read" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_own_update" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON profiles FOR ALL USING (auth.role() = 'admin');
CREATE POLICY "profiles_org_read" ON profiles FOR SELECT USING (organization_id = auth.org_id());
```

### Middleware Next.js
```ts
// /middleware.ts
import { createMiddlewareClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(req: Request) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  const { data: { session } } = await supabase.auth.getSession();
  const path = new URL(req.url).pathname;
  
  // Routes publiques
  const publicPaths = ['/', '/login', '/signup', '/forgot-password', '/about'];
  if (publicPaths.some(p => path.startsWith(p))) return res;
  
  // Routes admin
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    if (!session) return NextResponse.redirect(new URL('/login', req.url));
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', session.user.id)
      .single();
      
    if (!profile?.is_active || !['admin', 'manager'].includes(profile.role)) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  }
  
  // Routes authentifiées
  if (path.startsWith('/dashboard') || path.startsWith('/account')) {
    if (!session) return NextResponse.redirect(new URL('/login', req.url));
  }
  
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

### Server Actions
```ts
'use server'
import { z } from 'zod';

export async function signInWithMagicLink(email: string) {
  const validated = z.string().email().parse(email);
  const supabase = createServerClient();
  
  const { error } = await supabase.auth.signInWithOtp({
    email: validated,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });
  
  if (error) {
    // Log failed attempt (rate limit)
    await logAuthEvent(null, 'failed_login', { email: validated, error: error.message });
    throw new Error('Erreur d\'envoi');
  }
}

export async function inviteUser(input: { email: string; role: string }) {
  const supabase = createServerClient();
  const session = await requireAdmin();
  
  const data = InviteSchema.parse(input);
  
  const { data: invitation } = await supabase
    .from('invitations')
    .insert({ ...data, invited_by: session.user.id })
    .select()
    .single();
  
  await brevo.emails.send({
    from: 'noreply@propulseo.fr',
    to: data.email,
    subject: 'Invitation à rejoindre [PROJET]',
    react: <InviteEmail token={invitation.token} role={data.role} />,
  });
  
  return invitation;
}

export async function updateUserRole(userId: string, newRole: string) {
  await requireAdmin();
  const supabase = createServerClient();
  
  const { data: oldProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  
  await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
  
  await logAuthEvent(userId, 'role_change', { 
    old_role: oldProfile?.role, 
    new_role: newRole 
  });
  
  revalidatePath('/admin/users');
}
```

### Helper auth utils
```ts
// /lib/auth/utils.ts
export async function requireUser() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  const supabase = createServerClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') redirect('/unauthorized');
  return { user, profile };
}

export async function requireRole(roles: string[]) {
  const user = await requireUser();
  const supabase = createServerClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !roles.includes(profile.role)) redirect('/unauthorized');
  return { user, profile };
}
```

### UI Flow
```
[/login]
  ├ Tabs : Magic link | Password | OAuth
  ├ Email input + "Recevoir lien" btn
  ├ "Continue with Google/GitHub" buttons
  └ Link "Pas de compte ? Signup"

[/admin/users]
  ├ Toolbar : search + filter role + "Inviter membre" btn
  ├ DataTable : Avatar | Nom | Email | Role select inline | Last sign-in | Status (toggle) | Actions
  └ Bulk : change role, deactivate

[/account/settings]
  ├ Profile : avatar upload, name, email (locked), locale
  ├ Security : password change, 2FA setup (QR code TOTP)
  └ Sessions : list active sessions + revoke

[Invitation flow]
  Email link → /invite/[token] → signup form pre-filled → role assigned
```

### Edge Cases
- **Magic link expiré** : message clair + bouton re-envoi
- **OAuth callback fail** : redirect login avec error param
- **Concurrent role change** : last write wins + audit log
- **2FA setup failed** : rollback, ne pas enregistrer secret partial
- **Invitation expirée** : message + bouton "redemander invitation"
- **Désactivation user** : revoke active sessions

### Intégrations
- Brevo : magic link template, invitation emails
- Supabase Auth : SSO SAML (Enterprise plan)
- Sentry : auth errors tracking
- Posthog : auth funnel analytics

## 4. ADAPTATION PLACEHOLDERS

- **`[ROLES]`** : minimum (admin/user) → max (admin/manager/staff/client/viewer/auditor)
- **`[MULTI_TENANT=on/off]`** : organizations table + RLS par org_id
- **`[OAUTH_PROVIDERS]`** : Google (FR mandatory), LinkedIn (B2B), GitHub (dev), Apple (iOS)
- **`[2FA=on/off]`** : sensible projects on (santé, finance)
- **`[SSO_SAML=on/off]`** : Enterprise clients only
- **`[INVITE_FLOW]`** : auto-accept (interne) vs validation admin

## 5. ACCEPTANCE CRITERIA

- [ ] RLS active sur 100% tables (audit `SELECT FROM pg_policies` complet)
- [ ] Magic link arrive < 30s
- [ ] OAuth Google fonctionne en prod (whitelist redirect URLs)
- [ ] Middleware bloque routes admin pour non-admin
- [ ] Audit log capture sign-in/out/role-change
- [ ] 2FA : QR code généré, vérification TOTP OK
- [ ] Invitation : token expire 7j, single-use
- [ ] Désactivation user : sessions revoked instantly
- [ ] Sessions httpOnly cookies (jamais localStorage)
- [ ] Rate limit login : 5 tries / 15min IP
- [ ] Email verification obligatoire pour OAuth ? selon métier
- [ ] Lighthouse > 95 page login

## 6. TODO IMPLEMENTATION

1. **DB** : profiles, organizations, permissions, invitations, audit_log + triggers + RLS
2. **Supabase Auth config** : OAuth providers, email templates, redirects, password policy
3. **Middleware** : matcher routes + role check
4. **Server Actions** : signIn, signOut, invite, updateRole, deactivate, enable2FA
5. **Components** :
   - `<SignInForm />` magic link + OAuth
   - `<SignUpForm />`
   - `<InviteDialog />`
   - `<UserRoleSelect />` inline
   - `<TwoFactorSetup />` QR + verify
   - `<SessionsList />` revoke active
6. **Pages** : login, signup, forgot-password, account/settings, admin/users, invite/[token]
7. **Audit hooks** : log on auth events server-side
8. **Tests** : RLS policies (anon vs auth vs admin queries), middleware redirects, OAuth flow

## 7. CODE SKELETON

```tsx
// /app/login/page.tsx
import { SignInForm } from './_components/sign-in-form';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Bienvenue</h1>
          <p className="text-muted-foreground">Connecte-toi à [PROJET]</p>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}
```

```tsx
// /app/login/_components/sign-in-form.tsx
'use client'
import { signInWithMagicLink } from '../actions';
import { signInWithOAuth } from '../actions';
import { useForm } from 'react-hook-form';

export function SignInForm() {
  const form = useForm({ resolver: zodResolver(z.object({ email: z.string().email() })) });
  
  return (
    <div className="space-y-4">
      <Button onClick={() => signInWithOAuth('google')} variant="outline" className="w-full">
        <GoogleIcon className="mr-2 h-4 w-4" /> Continuer avec Google
      </Button>
      <Separator>ou</Separator>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(({ email }) => signInWithMagicLink(email))} className="space-y-3">
          <FormField name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input type="email" placeholder="toi@email.fr" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <Button type="submit" className="w-full">Recevoir le lien magique</Button>
        </form>
      </Form>
    </div>
  );
}
```

## 8. NOTES SENIOR / GOTCHAS

- ❌ **NE JAMAIS** désactiver RLS "pour debug" → ouvre tout le projet
- ❌ **NE JAMAIS** stocker token JWT côté client (localStorage) → cookies httpOnly via `@supabase/ssr`
- ❌ **NE JAMAIS** check role côté client uniquement → middleware + RLS double couche
- ⚠️ Service role key : Edge Functions only, JAMAIS dans le bundle Next.js
- ⚠️ `auth.users` table : ne pas join direct → toujours via `profiles`
- ⚠️ OAuth redirect URL : whitelist EXACT (avec scheme `https://`) sinon fail prod
- ⚠️ Magic link mobile : deep link config si app native
- ⚠️ Rate limit : Supabase Auth has built-in mais peut être bypassé → Cloudflare WAF en front
- ✅ JWT claims custom : ajoute `role`, `organization_id` via Hook Auth (Supabase) ou table query
- ✅ Session refresh : `@supabase/ssr` gère auto via middleware
- ✅ Upgrade 2026 : Passkeys (WebAuthn) en plus du magic link
- ✅ Upgrade 2026 : SSO SAML pour clients Enterprise (besoin Supabase Pro)
