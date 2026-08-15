# Gabarits d'e-mail Supabase — réglage OBLIGATOIRE (ticket V-2)

> **Ceci est du tableau de bord, pas du code.** Le code de `apps/web` est écrit pour ces
> gabarits ; sans eux, **aucune invitation reviewer ne peut aboutir**, quel que soit le code.
> Projet concerné : `hgdeopkmkwyoumsfggrm` → *Authentication → Emails → Templates*.

## Pourquoi

`redirectTo` n'est **pas** l'URL du lien cliqué : c'est la destination **finale**, que GoTrue
expose au gabarit sous `{{ .RedirectTo }}`. C'est le **gabarit** qui décide comment la session
s'ouvre.

Avec les gabarits **par défaut** (`{{ .ConfirmationURL }}`), GoTrue vérifie le lien puis
redirige lui-même vers `redirectTo` en déposant les jetons dans le **fragment** de l'URL
(flux implicite — une invitation admin n'ouvre aucun `flow_state` PKCE). Or :

- le Route Handler d'acceptation ne lit ni fragment ni `?code` ;
- **aucun client navigateur Supabase n'est monté dans cette application** —
  `apps/web/lib/supabase/client.ts` n'a aucun importeur, vérifié par `grep` —
  donc `detectSessionInUrl` ne tourne jamais et personne ne lit ce fragment.

Résultat mesuré avant correctif : aucune session n'est posée, la route reconclut
`proof_required` et **renvoie un e-mail. Boucle infinie.**

Avec les gabarits ci-dessous, le lien pointe directement sur **notre** callback avec un
`token_hash`. `/auth/callback` fait `verifyOtp` **côté serveur, sur les cookies de ce
navigateur**, puis redirige vers `next`. Pas de fragment, pas de PKCE, et le lien fonctionne
même s'il est ouvert dans un autre navigateur que celui qui l'a demandé.

## Les gabarits à poser

Remplacer le corps du lien dans **chacun** de ces gabarits.

### Invite user

```html
<h2>Vous êtes invité</h2>
<p>
  <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next={{ .RedirectTo }}">
    Accepter l'invitation
  </a>
</p>
```

### Reset password (Recovery)

```html
<h2>Réinitialiser votre mot de passe</h2>
<p>
  <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}">
    Choisir un nouveau mot de passe
  </a>
</p>
```

### Confirm signup

```html
<h2>Confirmez votre adresse</h2>
<p>
  <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">
    Confirmer
  </a>
</p>
```

## Réglages associés

| Réglage | Valeur | Pourquoi |
|---|---|---|
| *Authentication → URL Configuration → Site URL* | `https://socean.54-36-180-115.sslip.io` | Alimente `{{ .SiteURL }}`. Doit correspondre à la variable `SITE_URL` de l'app Coolify. |
| *Redirect URLs* | `https://socean.54-36-180-115.sslip.io/**` | GoTrue valide `redirectTo` contre cette liste. Sans l'entrée, `{{ .RedirectTo }}` est vide et le `next` est perdu. |

## Ce que le code fait de son côté (déjà en place)

- `{{ .RedirectTo }}` est une URL **absolue** — GoTrue l'exige. `/auth/callback` la réduit à son
  chemin via `safeNextFromRedirectTo`, qui n'accepte une absolue que si son origine est
  **octet pour octet** celle de l'app. Toute autre origine retombe sur le fallback.
- Branche « compte neuf » : `inviteUserByEmail(email, { redirectTo: <page de confirmation> })`.
- Branche « compte existant » : `resetPasswordForEmail(email, { redirectTo:
  /reset-password?next=<page de confirmation> })`, encodé **une seule fois**. `/reset-password`
  transporte désormais `next` jusqu'à `updatePassword`.

## Vérifier que c'est en place

1. Inviter une adresse dont **aucun compte n'existe** → l'e-mail reçu doit pointer sur
   `…/auth/callback?token_hash=…&type=invite&next=…` (et **non** sur `…/auth/v1/verify?…`).
2. Cliquer → on doit atterrir sur la page de confirmation d'invitation, **connecté**.
3. Recommencer avec une adresse dont **le compte existe déjà** → même chose en passant par
   l'écran de définition du mot de passe.

Tant que l'étape 1 montre `/auth/v1/verify`, le gabarit n'a pas été enregistré.
