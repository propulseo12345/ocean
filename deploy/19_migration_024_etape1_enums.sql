-- Migration 024, ETAPE 1/2 — a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor).
-- Genere depuis supabase/migrations/024_needs_verification.sql. Prerequis : 023.
--
-- ⚠ EXECUTER CE FICHIER SEUL, PUIS l'etape 2 dans un SECOND envoi.
-- `alter type ... add value` doit etre COMMITE avant que la valeur puisse etre
-- EVALUEE. L'editeur SQL Supabase enveloppe chaque envoi dans une transaction :
-- tout coller d'un bloc peut echouer sur « unsafe use of new value ».
--
-- Idempotent (`if not exists`). Rejouable sans risque.

alter type public.target_status add value if not exists 'needs_verification';
alter type public.content_status add value if not exists 'needs_verification';
alter type public.publish_job_status add value if not exists 'needs_verification';
