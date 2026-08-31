# MTS Lab Security/Data Failure Audit — 2026-09-01

## Status
Repository audit is in progress. No production data or secrets are modified by this document.

## Confirmed findings
- Current dashboard realtime architecture uses Supabase realtime rather than the legacy frontend `EventSource` implementation.
- `useDashboardData` uses `Promise.allSettled` and currently falls back to empty arrays for some failed/malformed responses; this can mask API failures as empty data.
- Staff Management `/api/users` currently expects an array and the backend returns an array; therefore the reported `.filter is not a function` must be traced to another staff/technician response rather than changing `/api/users` blindly.
- The repository still contains navigation references to the legacy Security & Surveillance page and therefore the old implementation has not yet been proven safe to remove.
- `ResponsiveContainer` is used by dashboard charts and requires parent-dimension/lifecycle validation for the reported negative-dimension warning.
- No current repository reference to `/api/share/history` was found in the exact repository search performed; if production still requests it, stale deployment/client code must be investigated.

## Safety decision
No GitHub push should be represented as production-ready until the implementation can be executed with the repository's real dependency/environment configuration and lint/typecheck/build/API/realtime regression tests can be completed.
