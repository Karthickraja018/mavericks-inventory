# Mavericks Inventory — Implementation Status

Rule: a feature is "implemented" only after tests pass. No tests exist yet.

## Gates
| Gate | Scope | Status |
|---|---|---|
| 0 | Documentation and repository reconciliation | **In review** (these documents) |
| 1 | Foundation without stock effects | Not started; blocked on OQ-15, 21, 22, 28 |
| 2 | Upload, parse, preview | Not started; blocked on OQ-19, 21, 30, 32 |
| 3 | Historical imports | Not started; blocked on OQ-7, 8, 17 |
| 4 | Stock Count reconciliation | Not started; blocked on OQ-1/2, 5, 24 |
| 5 | New procurement and distribution | Not started; blocked on OQ-10, 25, 27, 31 |
| 6 | Hardening | Not started |

## Existing application (first build) — not run, not tested
Implemented in code, unverified: login, dashboard, inventory list and admin item creation, requests with drafts and submit, one/two-level approval, atomic stock deduction, audit log page.
Known gaps against the BRDs:
- No migrations folder, tests, CI or `docs/` before this change.
- `seed.ts` writes balances without ledger entries; `createItem` posts an unapproved opening movement.
- `Approval` stores approver name only; `AuditLog` has no detail, outcome, correlation ID or actor FK.
- Insufficient stock returns an error and leaves the request pending; there is no `NEEDS_REVIEW` state.
- Ledger immutability and `quantity >= 0` are not enforced by the database.
- No Excel import, reports/exports, user management, employees or product master.

## Next actions
1. Review and confirm or amend the Proposed items.
2. Provide the real DB state, migrations folder and sample workbooks (OQ-17, 22, 28).
3. Approve Gate 0, then Gate 1 begins.

## Update — first Gate 1/2 code (untested; not run)
Written, not executed: audit/approval/ledger column additions; `Employee`, `ImportJob`, `ImportRow` models; `prisma/hardening.sql`; `createItem` and seed no longer bypass the ledger; Admin-only import upload, structural validation, staging, preview and error CSV; unit tests for the validator (`npm test`).
Not built: product/variant evolution, variant and employee matching, duplicate detection, any commit, reconciliation, procurement or distribution import, NEEDS_REVIEW state. These stay blocked (see OPEN_QUESTIONS.md).
