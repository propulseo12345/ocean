-- Ocean — jeu de donnees de demonstration pour l'org 'socean'.
--
-- PREREQUIS : deploy/01 a 08 appliques (schema 001 -> 015) ET deploy/02
-- (org 'socean' + owner). Ce script alimente les tables CŒUR (clients, comptes
-- sociaux, piliers, etiquettes, contenus, cibles, notifications) pour que le
-- back office affiche autre chose que du vide une fois les mocks retires.
--
-- IDEMPOTENT : chaque insert est garde par un `not exists` sur une cle
-- naturelle (handle de client, titre de contenu, ...). Relancer ne duplique pas.
--
-- CE QUI N'EST **PAS** SEEDE, ET POURQUOI :
--   * media_assets / content_media : un media n'a de sens qu'avec un FICHIER
--     reel dans le bucket media-originals. Semer des lignes sans objet Storage
--     produirait des vignettes cassees et des URL signees en 404 — pire que
--     l'absence de media. Ils arriveront par l'upload TUS (non cable).
--   * imported_posts / post_metrics : ecriture service_role EXCLUSIVE
--     (migration 014). Les semer a la main depuis le SQL Editor contournerait
--     precisement la garde qui empeche de falsifier un rapport client.
--   * calendar_* : scopes par UTILISATEUR et alimentes par l'OAuth agenda.
--
-- Les horodatages sont RELATIFS a now() : le dashboard montre de vraies taches
-- du jour quel que soit le moment ou le seed est joue.

begin;

do $seed$
declare
  v_org        uuid;
  v_owner      uuid;
  v_conn_ig    uuid;
  v_conn_fb    uuid;
  v_conn_tt    uuid;
  v_client     record;
  v_idx        integer := 0;
  v_ig         uuid;
  v_fb         uuid;
  v_tt         uuid;
  v_pillar     uuid;
  v_item       uuid;
  v_label      uuid;
begin
  select o.id, o.created_by into v_org, v_owner
  from public.organizations o
  where o.slug = 'socean';

  if v_org is null then
    raise exception
      'Org "socean" introuvable. Applique deploy/02_seed_org.sql avant ce script.';
  end if;

  -- =========================================================================
  -- 1. Clients
  -- =========================================================================

  insert into public.clients (org_id, name, handle, brand_color, timezone, approval_mode, bio, category, notes)
  select v_org, x.name, x.handle, x.color, 'Europe/Paris', x.mode, x.bio, x.category, x.notes
  from (values
    ('Brulerie Lacaze', 'brulerie-lacaze', 'oklch(0.55 0.13 55)',  'required'::public.approval_mode,
     E'Torrefaction artisanale a Toulouse.\nCafes de specialite, torrefies chaque semaine.',
     'Cafe & torrefaction', 'Forfait 12 posts/mois. Validation systematique avant publication.'),
    ('Maison Verde', 'maison-verde', 'oklch(0.6 0.12 145)', 'optional'::public.approval_mode,
     E'Cuisine vegetale de saison.\nProduits locaux, zero dechet.',
     'Restaurant', 'Reactive sur les retours. Accepte la publication directe hors campagne.'),
    ('Atelier Nove', 'atelier-nove', 'oklch(0.5 0.14 300)', 'auto'::public.approval_mode,
     E'Vetements faits main, series limitees.',
     'Mode & artisanat', 'Publication automatique : le client fait confiance sur la ligne edito.')
  ) as x(name, handle, color, mode, bio, category, notes)
  where not exists (
    select 1 from public.clients c where c.org_id = v_org and c.handle = x.handle
  );

  -- =========================================================================
  -- 2. Connexions plateformes (niveau org) — AUCUN token ici.
  --    Les tokens vivent dans platform_connection_secrets (deny-all, Vault).
  -- =========================================================================

  insert into public.platform_connections (org_id, provider, connected_by, provider_account_id, provider_account_name, status, scopes)
  select v_org, x.provider, v_owner, x.account_id, x.account_name, x.status, x.scopes
  from (values
    ('instagram'::public.integration_provider, 'meta-business-demo', 'Socean Business', 'connected'::public.account_status,
     array['instagram_basic','instagram_content_publish','pages_read_engagement']),
    ('facebook'::public.integration_provider,  'meta-pages-demo',    'Socean Pages',    'connected'::public.account_status,
     array['pages_manage_posts','pages_read_engagement']),
    ('tiktok'::public.integration_provider,    'tiktok-demo',        'Socean TikTok',   'connected'::public.account_status,
     array['video.upload'])
  ) as x(provider, account_id, account_name, status, scopes)
  where not exists (
    select 1 from public.platform_connections pc
    where pc.org_id = v_org and pc.provider = x.provider and pc.provider_account_id = x.account_id
  );

  select id into v_conn_ig from public.platform_connections
   where org_id = v_org and provider = 'instagram';
  select id into v_conn_fb from public.platform_connections
   where org_id = v_org and provider = 'facebook';
  select id into v_conn_tt from public.platform_connections
   where org_id = v_org and provider = 'tiktok';

  -- =========================================================================
  -- 3. Par client : comptes sociaux, piliers, etiquettes, reglages, contenus
  -- =========================================================================

  for v_client in
    select id, handle, name from public.clients
    where org_id = v_org and handle in ('brulerie-lacaze', 'maison-verde', 'atelier-nove')
    order by handle
  loop
    v_idx := v_idx + 1;

    -- 3a. Comptes sociaux. Le compte Instagram de la Brulerie est volontairement
    --     en needs_reauth : c'est ce qui fait apparaitre la tache « reconnecter »
    --     du dashboard, et la banniere de sante des comptes.
    insert into public.social_accounts
      (org_id, client_id, platform_connection_id, platform, provider_account_id, username, display_name, status, followers_count, following_count)
    select v_org, v_client.id, v_conn_ig, 'instagram', v_client.handle || '-ig',
           replace(v_client.handle, '-', ''), v_client.name,
           case when v_client.handle = 'brulerie-lacaze' then 'needs_reauth'::public.account_status
                else 'connected'::public.account_status end,
           1200 * v_idx + 340, 180 + 40 * v_idx
    where not exists (
      select 1 from public.social_accounts sa
      where sa.client_id = v_client.id and sa.platform = 'instagram'
    );

    insert into public.social_accounts
      (org_id, client_id, platform_connection_id, platform, provider_account_id, username, display_name, status, followers_count, following_count)
    select v_org, v_client.id, v_conn_fb, 'facebook', v_client.handle || '-fb',
           replace(v_client.handle, '-', ''), v_client.name, 'connected', 800 * v_idx + 120, 0
    where not exists (
      select 1 from public.social_accounts sa
      where sa.client_id = v_client.id and sa.platform = 'facebook'
    );

    -- TikTok pour un seul client : la moitie des parcours produit (brouillon a
    -- finaliser) doit exister, mais pas partout.
    if v_client.handle = 'maison-verde' then
      insert into public.social_accounts
        (org_id, client_id, platform_connection_id, platform, provider_account_id, username, display_name, status, followers_count, following_count)
      select v_org, v_client.id, v_conn_tt, 'tiktok', v_client.handle || '-tt',
             replace(v_client.handle, '-', ''), v_client.name, 'connected', 2400, 95
      where not exists (
        select 1 from public.social_accounts sa
        where sa.client_id = v_client.id and sa.platform = 'tiktok'
      );
    end if;

    select id into v_ig from public.social_accounts
     where client_id = v_client.id and platform = 'instagram';
    select id into v_fb from public.social_accounts
     where client_id = v_client.id and platform = 'facebook';
    select id into v_tt from public.social_accounts
     where client_id = v_client.id and platform = 'tiktok';

    -- 3b. Piliers editoriaux (la somme des parts fait 100).
    insert into public.content_pillars (org_id, client_id, name, color_token, target_share, sort_order)
    select v_org, v_client.id, x.name, x.token, x.share, x.ord
    from (values
      ('Coulisses', 'chart-1', 40, 0),
      ('Produit',   'chart-2', 35, 1),
      ('Communaute','chart-3', 25, 2)
    ) as x(name, token, share, ord)
    where not exists (
      select 1 from public.content_pillars p
      where p.client_id = v_client.id and p.name = x.name
    );

    select id into v_pillar from public.content_pillars
     where client_id = v_client.id and name = 'Coulisses';

    -- 3c. Etiquettes transverses.
    insert into public.content_labels (org_id, client_id, name, color_token, sort_order)
    select v_org, v_client.id, x.name, x.token, x.ord
    from (values
      ('Promo',      'chart-4', 0),
      ('Evergreen',  'chart-5', 1),
      ('Marronnier', 'chart-3', 2)
    ) as x(name, token, ord)
    where not exists (
      select 1 from public.content_labels l
      where l.client_id = v_client.id and l.name = x.name
    );

    select id into v_label from public.content_labels
     where client_id = v_client.id and name = 'Promo';

    -- 3d. Reglages de cadence + brand kit.
    insert into public.client_settings (org_id, client_id, review_reminder_days, cadence_gap_days, cadence_max_per_day)
    select v_org, v_client.id, 2, 7, 2
    where not exists (
      select 1 from public.client_settings s where s.client_id = v_client.id
    );

    insert into public.brand_kits (org_id, client_id, palette, tone, do_list, dont_list, banned_words)
    select v_org, v_client.id,
           array['oklch(0.55 0.13 55)', 'oklch(0.9 0.03 80)', 'oklch(0.3 0.02 60)'],
           'Chaleureux, direct, jamais donneur de lecons.',
           array['Parler a la premiere personne', 'Montrer les mains et le geste'],
           array['Superlatifs vides', 'Emojis en rafale'],
           array['revolutionnaire', 'incontournable']
    where not exists (
      select 1 from public.brand_kits b where b.client_id = v_client.id
    );

    -- 3e. Contenus — un par statut structurant du parcours produit.
    --     Les titres servent de cle d'idempotence.

    -- (1) Programme AUJOURD'HUI -> tache « publier aujourd'hui » du dashboard.
    if not exists (select 1 from public.content_items ci
                   where ci.client_id = v_client.id and ci.title = 'Le geste du matin') then
      insert into public.content_items
        (org_id, client_id, title, caption, hashtags, format, status, scheduled_at, created_by, pillar_id)
      values (v_org, v_client.id, 'Le geste du matin',
              E'On ouvre a 7h. Le premier geste, c''est toujours le meme.',
              array['artisanat','matin'], 'post', 'scheduled',
              date_trunc('day', now()) + interval '18 hours', v_owner, v_pillar)
      returning id into v_item;

      insert into public.content_targets (org_id, client_id, content_item_id, social_account_id, platform, status)
      values (v_org, v_client.id, v_item, v_ig, 'instagram', 'queued'),
             (v_org, v_client.id, v_item, v_fb, 'facebook',  'queued');

      insert into public.content_item_labels (org_id, client_id, content_item_id, content_label_id)
      values (v_org, v_client.id, v_item, v_label);
    end if;

    -- (2) En attente de validation client -> tache « a valider » + portail.
    if not exists (select 1 from public.content_items ci
                   where ci.client_id = v_client.id and ci.title = 'Nouvelle serie, edition limitee') then
      insert into public.content_items
        (org_id, client_id, title, caption, hashtags, format, status, scheduled_at, created_by, client_comments_count)
      values (v_org, v_client.id, 'Nouvelle serie, edition limitee',
              E'Trente pieces, pas une de plus. Disponibles vendredi.',
              array['editionlimitee'], 'carousel', 'in_review',
              now() + interval '3 days', v_owner, 0)
      returning id into v_item;

      insert into public.content_targets (org_id, client_id, content_item_id, social_account_id, platform, status)
      values (v_org, v_client.id, v_item, v_ig, 'instagram', 'pending');
    end if;

    -- (3) Echec de publication -> tache « danger » + message d'erreur reel.
    if not exists (select 1 from public.content_items ci
                   where ci.client_id = v_client.id and ci.title = 'Portes ouvertes samedi') then
      insert into public.content_items
        (org_id, client_id, title, caption, hashtags, format, status, scheduled_at, created_by, last_error)
      values (v_org, v_client.id, 'Portes ouvertes samedi',
              E'On ouvre l''atelier au public, samedi de 10h a 18h.',
              array['portesouvertes'], 'post', 'failed',
              now() - interval '2 days', v_owner,
              jsonb_build_object('code', 'token_expired',
                                 'message', 'Jeton Instagram expire — reconnecte le compte.'))
      returning id into v_item;

      insert into public.content_targets
        (org_id, client_id, content_item_id, social_account_id, platform, status, last_error)
      values (v_org, v_client.id, v_item, v_ig, 'instagram', 'failed',
              jsonb_build_object('code', 'token_expired',
                                 'message', 'Jeton Instagram expire — reconnecte le compte.'));
    end if;

    -- (4) Publie -> alimente la grille et l'historique du portail.
    if not exists (select 1 from public.content_items ci
                   where ci.client_id = v_client.id and ci.title = 'Merci pour cette annee') then
      insert into public.content_items
        (org_id, client_id, title, caption, hashtags, format, status, scheduled_at, created_by, pinned)
      values (v_org, v_client.id, 'Merci pour cette annee',
              E'Un mot simple : merci. On remet ca l''an prochain.',
              array['merci'], 'post', 'published',
              now() - interval '9 days', v_owner, true)
      returning id into v_item;

      insert into public.content_targets
        (org_id, client_id, content_item_id, social_account_id, platform, status, external_post_id, permalink, published_at)
      values (v_org, v_client.id, v_item, v_ig, 'instagram', 'published',
              'ig_' || replace(v_item::text, '-', ''),
              'https://www.instagram.com/p/demo-' || left(replace(v_item::text, '-', ''), 8) || '/',
              now() - interval '9 days');
    end if;

    -- (5) Idee sur l'etagere (non datee) -> colonne « idees » du studio.
    if not exists (select 1 from public.content_items ci
                   where ci.client_id = v_client.id and ci.title = 'Serie : les fournisseurs') then
      insert into public.content_items
        (org_id, client_id, title, caption, format, status, created_by, internal_notes)
      values (v_org, v_client.id, 'Serie : les fournisseurs',
              '', 'reel', 'idea', v_owner,
              'Trois episodes, un par fournisseur. A tourner sur place.');
    end if;

    -- (6) Brouillon TikTok pousse -> tache « finaliser dans TikTok ».
    --     Uniquement la ou un compte TikTok existe.
    if v_tt is not null
       and not exists (select 1 from public.content_items ci
                       where ci.client_id = v_client.id and ci.title = 'Recette express en 30 secondes') then
      insert into public.content_items
        (org_id, client_id, title, caption, hashtags, format, status, scheduled_at, created_by)
      values (v_org, v_client.id, 'Recette express en 30 secondes',
              E'Trois ingredients, trente secondes, zero excuse.',
              array['recette','rapide'], 'reel', 'partially_published',
              now() - interval '1 day', v_owner)
      returning id into v_item;

      insert into public.content_targets (org_id, client_id, content_item_id, social_account_id, platform, status)
      values (v_org, v_client.id, v_item, v_tt, 'tiktok', 'pushed_to_platform');
    end if;
  end loop;

  -- =========================================================================
  -- 4. Notifications de l'owner (audience 'owner' — la cloche du shell)
  -- =========================================================================

  insert into public.notifications
    (org_id, client_id, recipient_user_id, type, title, body, channels, audience, href, read_at, created_at)
  select v_org, c.id, v_owner, x.type, x.title, x.body, x.channels, 'owner', x.href, x.read_at, x.created_at
  from public.clients c
  cross join (values
    ('publish_failed'::public.notification_type,
     'Echec de publication',
     'Le post n''a pas pu etre publie sur Instagram (jeton expire).',
     array['in_app','push','email']::public.notification_channel[],
     '/settings/accounts', null::timestamptz, now() - interval '2 days'),
    ('token_reauth_needed'::public.notification_type,
     'Compte a reconnecter',
     'Un compte Instagram doit etre reconnecte pour reprendre les publications.',
     array['in_app','email']::public.notification_channel[],
     '/settings/accounts', null::timestamptz, now() - interval '1 day'),
    ('content_approved'::public.notification_type,
     'Contenu approuve',
     'Un contenu vient d''etre approuve par le client.',
     array['in_app','push']::public.notification_channel[],
     '/dashboard', now() - interval '3 days', now() - interval '4 days')
  ) as x(type, title, body, channels, href, read_at, created_at)
  where c.org_id = v_org
    and c.handle = 'brulerie-lacaze'
    and not exists (
      select 1 from public.notifications n
      where n.org_id = v_org and n.recipient_user_id = v_owner and n.type = x.type
    );

  raise notice 'Seed de demonstration applique sur l''org socean (%).', v_org;
end
$seed$;

commit;

-- Verification : chaque compteur doit etre > 0 et STABLE si on relance le seed.
select
  (select count(*) from public.clients c
     join public.organizations o on o.id = c.org_id where o.slug = 'socean')      as clients,
  (select count(*) from public.social_accounts sa
     join public.organizations o on o.id = sa.org_id where o.slug = 'socean')     as comptes_sociaux,
  (select count(*) from public.content_pillars p
     join public.organizations o on o.id = p.org_id where o.slug = 'socean')      as piliers,
  (select count(*) from public.content_items ci
     join public.organizations o on o.id = ci.org_id where o.slug = 'socean')     as contenus,
  (select count(*) from public.content_targets ct
     join public.organizations o on o.id = ct.org_id where o.slug = 'socean')     as cibles,
  (select count(*) from public.notifications n
     join public.organizations o on o.id = n.org_id where o.slug = 'socean')      as notifications;
