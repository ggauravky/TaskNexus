# Backup and restore runbook

Status: **BLOCKED — not executed against production infrastructure.** This file
defines the launch gate and evidence record; it does not claim that a backup or
restore exists.

MongoDB documents Cloud Backup and Continuous Cloud Backup for M10+ dedicated
clusters and recommends a seven-day PIT restore window:

- <https://www.mongodb.com/docs/atlas/cluster-additional-settings/>
- <https://www.mongodb.com/docs/atlas/architecture/current/operational-readiness-checklist/>
- <https://www.mongodb.com/docs/atlas/backup/cloud-backup/restore-overview/>

## Required production policy

- Dedicated M10+ (or larger based on measured demand), replica-set deployment in
  the approved application region. Free/shared behavior is not acceptable proof.
- Cloud Backup and Continuous Cloud Backup enabled; PIT restore window at least
  seven days.
- Snapshot retention: hourly 7 days, daily 35 days, monthly 12 months. Change
  only through a reviewed recovery/data-retention decision.
- Snapshot region aligned with production; add a second-region copy only after
  data-residency and cost approval.
- Termination protection enabled; auto-expand storage reviewed.
- Alerts: backup freshness/failure, disk 80% warning and 90% critical,
  connections 80% of limit, replication/election critical events.
- Application user: read/write only for the production TaskNexus database. It
  cannot administer projects, users, backups or restores.
- Recovery operator and independent reviewer named in the release record.

Target objectives are proposals until measured: RPO 15 minutes or better and RTO
4 hours. Do not present either as an SLA. The restore drill replaces the RTO with
its measured duration and confirms whether the RPO target is met.

## Safe restore drill

Never restore over the canonical production database.

1. Record source project/cluster, snapshot ID or PIT timestamp, source region,
   latest successful backup time, operator, reviewer and drill start time.
2. Create an isolated restore target in the same provider/region and a unique
   drill database/cluster name. Ensure no production application points to it.
3. Restore the selected snapshot/PIT using a recovery identity, not the
   application identity. Atlas cluster restores can replace target data; verify
   the target twice before confirmation.
4. Create a temporary read-only verifier credential. Do not paste its URI into
   tickets or source. Run the database verifier against the restored database.
5. Verify without recording subject values:
   - expected application collections and both GridFS bucket collections;
   - representative declared indexes;
   - user/profile, Team/membership, Project/participant/task,
     Opportunity/organization and native-application relationships;
   - representative GridFS metadata and private API retrieval.
6. Record end time, measured duration, recovered timestamp, achieved RPO, each
   check result and any index/search rebuild required.
7. Revoke the temporary credential. Delete the isolated target only after the
   reviewer accepts evidence; record target deletion and timestamp.

## Evidence record

| Field | Actual evidence |
| --- | --- |
| Backup source / snapshot or PIT | **BLOCKED — not supplied** |
| Restore target | **BLOCKED — not created** |
| Date/time | **BLOCKED** |
| Duration / measured RTO | **BLOCKED** |
| Recovered timestamp / achieved RPO | **BLOCKED** |
| Collection/GridFS checks | **BLOCKED** |
| Index and relationship checks | **BLOCKED** |
| Temporary credential revoked | **BLOCKED** |
| Restore target cleanup | **BLOCKED** |

## Incident recovery

Freeze writes, preserve audit evidence, revoke suspected credentials and restore
to a new target for validation. After reviewer acceptance, rotate the backend
MongoDB URI, verify `/api/ready`, private attachment retrieval and all deployed
golden paths before reopening traffic. In-place restoration requires explicit
incident-lead approval and is not the default procedure.
