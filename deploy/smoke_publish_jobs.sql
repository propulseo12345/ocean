-- SMOKE TEST « réel minimal » claim + reaper sur publish_jobs (étape 5 go-live).
-- À jouer dans le SQL Editor APRÈS deploy/15_migration_020.sql ET après avoir
-- programmé au moins un contenu dans l'app (=> un publish_job 'scheduled' réel).
--
-- 100 % NON DESTRUCTIF : tout est encapsulé dans BEGIN … ROLLBACK. Rien n'est
-- écrit durablement — c'est une PREUVE que la mécanique de file fonctionne sur la
-- vraie base, pas une exécution. now() est figé au début de la transaction, donc
-- l'antidatage du lease puis le reaper se comportent comme en production.
--
-- Attendu :
--   étape A -> 1 ligne, status='claimed', lease_expires_at ~ now()+2min
--   étape C -> 1 ligne, status='retrying', attempts incrémenté de 1
--   (si 0 ligne à l'étape A : aucun job dû — programme un contenu d'abord)

begin;

-- A. CLAIM atomique (SQL EXACT du worker : FOR UPDATE SKIP LOCKED + lease 2 min).
with claimed as (
  update public.publish_jobs
  set status = 'claimed', worker_id = 'smoke-test', claimed_at = now(),
      lease_expires_at = now() + make_interval(secs => 120)
  where id = (
    select id from public.publish_jobs
    where status in ('scheduled', 'retrying', 'awaiting_media')
      and run_at <= now()
      and (next_attempt_at is null or next_attempt_at <= now())
    order by run_at
    for update skip locked
    limit 1
  )
  returning id, status, worker_id, lease_expires_at, attempts
)
select 'A_claimed' as step, * from claimed;

-- B. Simule un worker mort : on antidate le lease du job réclamé.
update public.publish_jobs
set lease_expires_at = now() - interval '1 minute'
where worker_id = 'smoke-test' and status = 'claimed';

-- C. REAPER (SQL EXACT du worker) : le lease expiré => le job repart en 'retrying'.
update public.publish_jobs
set status = 'retrying', attempts = attempts + 1,
    worker_id = null, claimed_at = null, lease_expires_at = null,
    next_attempt_at = now()
where status in ('claimed', 'publishing')
  and lease_expires_at is not null and lease_expires_at < now()
  and attempts < max_attempts;

select 'C_reaped' as step, id, status, attempts
from public.publish_jobs
where id in (select id from public.publish_jobs where next_attempt_at is not null and status = 'retrying')
order by updated_at desc
limit 1;

-- Rien n'est conservé : la preuve est faite, on annule tout.
rollback;
