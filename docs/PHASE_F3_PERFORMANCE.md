# TaskNexus V2 — Phase F3 performance

**Dashboard optimization verified locally.** The measured bottleneck was full task/payment/review/submission history being fetched into Node, including a duplicate task read on the freelancer dashboard. This work keeps the overview DTO and onboarding derivation.

## Method

`backend/scripts/verifyPhaseFDashboard.js` uses an explicitly guarded loopback MongoDB 8.0 replica set, Node 24.22.1, HTTP on an ephemeral port, synthetic users, and exact fixture cleanup. Sampled each endpoint serially after two warm-ups (12 measured requests per role/size). Task descriptions and submission bodies were populated. Mixed task statuses, revisions and payment states exercised onboarding and summary parity. Mongo command monitoring measured returned documents across cursor batches. The single-record case was added as after-change parity coverage. No p99 or production capacity claims are supported by these samples.

## Results

| Role / owned tasks | Before p50 / p95 (ms) | After p50 / p95 (ms) | Median Mongo documents before → after |
|---|---:|---:|---:|
| Client / 0 | 6.09 / 9.65 | 16.71 / 21.76 | 1 → 1 |
| Freelancer / 0 | 17.17 / 28.77 | 23.99 / 47.32 | 2 → 1 |
| Client / 100 | 36.54 / 48.30 | 27.81 / 36.92 | 203 → 112 |
| Freelancer / 100 | 85.12 / 113.00 | 43.93 / 66.63 | 509 → 116 |
| Client / 1,000 | 130.11 / 168.96 | 62.17 / 98.76 | 2,003 → 1,012 |
| Freelancer / 1,000 | 335.20 / 384.92 | 78.82 / 87.83 | 5,009 → 1,016 |
| Client / 10,000 | 1,170.66 / 1,380.08 | 363.68 / 454.66 | 20,003 → 10,012 |
| Freelancer / 10,000 | 2,837.47 / 3,181.04 | 159.38 / 424.64 | 50,009 → 10,016 |

- All measured requests returned successful responses and passed contract assertions. At 10,000 rows client median Mongo commands went 9 → 8, freelancer 22 → 13. Serial sample throughput was 0.89 → 2.69 and 0.35 → 5.39 requests/s respectively. These are scoped, loopback measurements, not concurrency limits.
- At 10,000 rows, median HTTP response size stayed 30,532 bytes (client) and 25,444 bytes (freelancer). Observed end-of-case Node RSS went 570.99 → 440.61 MiB and 597.17 → 510.20 MiB, respectively. RSS includes fixture preparation and benchmark process history; it is not a per-request memory measurement.
- The empty-case measured latency rose by 12.11 ms (client p95) and 18.55 ms (freelancer p95) in this short sample. Mongo commands were unchanged or lower. A larger repeated/production-equivalent run is needed to attribute the variance; no latency target was set for empty dashboards.
- `executionStats` for 10,000 task facts showed indexed plans and 10,000 examined/returned for both owners. Payment summaries also used indexed plans, examined 10,000 owned records and returned one or two grouped rows. No production index was added. The dashboard still has O(owner task history) work and should be reassessed for accounts larger than the tested range.

## Changes and bounds

Controllers now request projected task facts and hydrate only their existing recent/attention/current cards, using owner filters again during hydration. Payments and QA counts are aggregated in Mongo; freelancer rating and task facts are reused for performance. Cached assignment statistics are updated only when values change and only their two fields are written. The existing formulas, workflow status classifications and ordinary numeric payment types retain parity. Legacy malformed amounts require separate reconciliation; this is not a financial migration.

Search was left intact. The F1 API verification measured p95 29.9 ms across 20 warmed searches on its small seeded dataset and checked the existing 2,000 ms gate. That exercise is not a high-volume search benchmark. Multi-instance SSE, long-lived stream backpressure, sustained concurrency, upload pressure and hosted cold starts were not load-certified. Assignment/review concurrency and GridFS reconnect storage were exercised in the local domain verifiers. Existing runbooks cover external checks.

A separate loopback probe completed four authenticated SSE connect/abort cycles. It observed one registered stream while connected and zero retained streams after each abort. This checks the normal single-process cleanup path only.

Failure recovery coverage includes bounded mocked SMTP retries and terminal failure (`emailService.test.js`), cleanup when a later attachment write fails (`storageProvider.test.js`), and abort/stale search response handling (`globalSearchWiring.test.js`). GridFS integration checked persistence across a database reconnect. An interrupted multipart upload under load, sustained concurrency, and recovery through a hosted restart remain unverified.

Verification entry point: `node backend/scripts/verifyPhaseFDashboard.js --confirm-tasknexus-v2-staging`, with explicit test-owned local Mongo settings. Roll back only the dashboard read optimization if parity or load results regress; no data/schema rollback is required.
