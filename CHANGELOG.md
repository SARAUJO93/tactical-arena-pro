# Changelog

## 3.2.0 - 2026-11-24

- Added a commercial transmission runbook and rollback procedure.
- Added a persistence compatibility policy.
- Added the `prelive` validation command.
- Frozen the state-schema migration contract for production exports.
- Added release documentation for operational handoff.

## 3.1.0 - 2026-11-24

- Separated read-only build validation from release publication permissions.
- Disabled persisted checkout credentials in CI, soak and release workflows.
- Added automated exposed-secret scanning.
- Added CodeQL JavaScript/TypeScript analysis.
- Rejected external collector URLs with credentials, query strings or fragments.
- Tightened CSP directives for objects, forms and framing.

## 3.0.0 - 2026-11-24

- Added deterministic damage validation and resilience statistics.
- Added persistence snapshot pruning.
- Added bounded external collector delivery timeouts.
- Added physical-resilience unit coverage.

## 2.9.0 - 2026-11-24

- Added immediate external delivery when pilot observability starts.
- Added latency, success/failure counts and last-success metrics.
- Added a local sanitized quality-event collector.
- Added a controlled-pilot checklist for live operation.
- Improved external delivery status in Settings and Telemetry.

## 2.9.0 - 2026-11-24

- Added immediate pilot delivery when external observability starts.
- Added delivery latency, success/failure counts and last-success metrics.
- Added a local sanitized quality-event collector.
- Added a 7A pilot checklist for pre-live, live and post-live review.
- Improved external status with delivery totals and latency.

## 2.8.0 - 2026-11-24

- Added offline service-worker shell caching.
- Added visible backup and corrupt-state restoration.
- Added structured and redacted operational event logging.
- Added bounded external delivery retries with backoff.
- Tightened browser lifecycle and persistence recovery.

## 2.7.0 - 2026-11-24

- Added FPS, frame-time and JavaScript heap telemetry.
- Added external delivery status in the settings panel.
- Added dependency audit checks to CI and release validation.
- Added a manual 30-minute soak workflow.
- Kept release validation blocking when automated checks fail.

## 2.6.0 - 2026-11-24

- Added opt-in external quality observability.
- Restricted external delivery to HTTPS or local HTTP endpoints.
- Sanitized payloads to aggregated quality and error categories only.
- Added persistence for observability consent and endpoint configuration.

## 2.5.0 - 2026-11-24

- Added automated release tag and package version validation.
- Added reconnect/recovery, persistence reload and soak coverage.
- Added release manifest and portable package artifacts.
- Published SHA-256 checksums for release integrity.
- Documented manual production approval and tagged releases.

## Unreleased - Cobertura operativa

- Added reconnect/recovery coverage for TikFinity WebSocket sessions.
- Added persistence reload and complete victory smoke coverage.
- Added an optional soak test with configurable duration.
- Kept long soak tests outside the normal CI smoke suite.

## 2.4.1 - 2026-11-24

- Unified the visible application and telemetry version.
- Added persistence export/import controls.
- Preserved corrupt persisted state for recovery.
- Added complete-round and persistence reload smoke coverage.
- Protected production releases with GitHub environment approval.
- Added SHA-256 checksums to release artifacts.

## 2.4.0 - 2026-11-24

- Added persistence schema versioning.
- Added runtime, persistence and WebSocket quality metrics.
- Added installation and TikFinity documentation.
- Added tagged release workflow.

## 2.3.0

- Added leagues, seasons, Elo, rounds and historical records.
