-- Purge des 2 residus de test (client « Client de demo ») a appliquer sur
-- hgdeopkmkwyoumsfggrm (SQL Editor). Non destructif pour les donnees reelles :
-- ne cible que les 2 contenus crees au runtime pendant la verification du cablage.
--
--   c092f256… « TEST NUIT 8 » (in_review, soft-deleted / corbeille)
--   f69aa705… « TEST PUB 9 »  (published, + 1 cible newsletter publiee a la main)
--
-- content_targets / content_media cascaderont. Verifie le 2026-07-22 : les 2 lignes
-- existent bien et appartiennent au client demo 88c1a509-3d7d-4c3f-8f6c-03c5c85abb35.
-- (Tentee via MCP le 2026-07-22 : bloquee par le classifieur de permissions auto.)

delete from content_items
where id in (
  'c092f256-d215-4f7a-9a15-653d3371857d',
  'f69aa705-d43d-4994-8792-8ec6d0f3ae9e'
);
