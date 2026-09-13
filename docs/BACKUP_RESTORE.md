# Backup and restore runbook

Production launch is blocked until this runbook has been executed successfully
against a dedicated production Atlas project and evidence has been recorded.

## Targets

- RPO: 15 minutes or better.
- RTO: 4 hours for a regional application outage; 8 hours for a full data restore.
- Retention: 7 days point-in-time, 35 daily snapshots, 12 monthly snapshots.
- Owner: production database operator; approver: a separate project owner.

MongoDB's current operational checklist recommends Cloud Backup, a continuous
backup restore window, a defined retention policy, and restore practice:
https://www.mongodb.com/docs/atlas/architecture/current/operational-readiness-checklist/

## Enable and verify backups

1. Use a production-capable Atlas tier in the dedicated production project.
2. Enable Cloud Backup and Continuous Cloud Backup with at least a seven-day PIT
   window. Configure daily/monthly retention and a cross-region copy if budget and
   data residency policy allow it.
3. Restrict backup administration to the smallest operator group. Application
   database users must not be able to alter backups.
4. Create an on-demand snapshot before every schema/index migration that may
   materially affect production.
5. Every week, record latest successful snapshot time, PIT window, storage region,
   and alert status in the operations log.

## Restore drill (never overwrite production)

1. Open an incident/change record and choose a snapshot or point immediately
   before the simulated loss.
2. Restore into a new isolated drill cluster/project. Atlas documents scheduled,
   on-demand, and point-in-time restore modes here:
   https://www.mongodb.com/docs/atlas/backup/cloud-backup/restore-overview/
3. Use a temporary least-privilege verification credential and set a unique
   `MONGODB_DB_NAME`; never point TaskNexus production traffic at the drill target.
4. Run `npm run verify:database` against the restored target in read-only mode.
5. Compare collection count (45), required indexes, a sample of user/team/project/
   opportunity/application relationships, and newest audit/notification timestamps.
6. Record snapshot/PIT chosen, start/end time, recovered timestamp, data checks,
   achieved RPO/RTO, operator, and reviewer. Delete the drill environment after
   evidence is approved under the project's retention rules.

## Real incident recovery

Freeze writes, revoke suspected credentials, preserve audit evidence, and restore
to a new cluster for the safest validation path. After verification, rotate the
Render `MONGODB_URI`, confirm `/api/ready`, execute all four golden-path smoke
tests, then reopen traffic. Restoring in place can replace target data and requires
explicit incident-commander approval. Rotate any credential that might have been
exposed and complete a post-incident review.
