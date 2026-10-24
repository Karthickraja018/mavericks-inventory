# Mavericks Inventory — Implementation Plan

_Last updated: 2026-10-24. Phases below match BRD §37–44._

## Summary of pre-existing working code (verified by build + test)

| Feature | Files | Status |
|---|---|---|
| Login / logout | `actions.ts`, `login/page.tsx`, `lib/auth.ts` | ✓ Built, types pass, tests pass |
| Dashboard | `(app)/page.tsx` | ✓ Built |
| Inventory list + search | `inventory/page.tsx` | ✓ Built |
| Admin item creation (no opening stock) | `actions.ts createItem` | ✓ Built, PTD-10 compliant |
| Distribution requests (EXECUTIVE) | `requests/` | ✓ Built |
| Two-stage approval + atomic stock deduction | `actions.ts decide()` | ✓ Built, self-approval guard present |
| Audit log page | `audit/page.tsx` | ✓ Built |
| Import upload, parse, validate, stage | `imports/actions.ts`, `lib/imports.ts` | ✓ Built |
| Import job list + detail | `imports/page.tsx`, `imports/[id]/page.tsx` | ✓ Built |
| Error CSV download | `imports/[id]/errors/route.ts` | ✓ Built |
| 4 unit tests (import validator) | `lib/imports.test.ts` | ✓ Pass (0 failures) |

## Phase 1 — Analysis and safe foundation (current phase)

**Goal:** Produce verified documentation and add tests around existing behavior. No stock-balance changes.

| Task | Status |
|---|---|
| Inspect full repository | ✓ Done |
| Build and type check | ✓ Pass (tsc 0 errors, next build success) |
| Run existing tests | ✓ Pass (4/4) |
| Create docs/ARCHITECTURE.md | ✓ Done |
| Create docs/BRD.md | ✓ Done |
| Create docs/IMPLEMENTATION_PLAN.md | ✓ Done (this file) |
| Create docs/IMPLEMENTATION_STATUS.md | → Update in progress |
| Create docs/TEST_PLAN.md | → In progress |
| Create traceability matrix | → In progress |
| Apply prisma/hardening.sql via migration | ← Next step |
| Add DB-level `CHECK quantity >= 0` | ← Blocked by migration |
| Add immutability trigger | ← Blocked by migration |
| Add NEEDS_REVIEW status to schema | → Phase 2 |
| Add tests for existing actions | → Phase 1 completion |

## Phase 2 — Product and inventory integrity

**Goal:** Enforce ledger consistency and open the path to Product/Variant evolution.

Dependencies: OQ-15 (NA canonical form), OQ-21 (variant identity), OQ-22 (existing SKU mapping), OQ-28 (real DB state)

| Task | Blocker |
|---|---|
| Add `Product` model; evolve `Item` → variant (add size, color, brand, productId) | OQ-15, OQ-21, OQ-22 |
| Add `@@unique([productId, size, color, brand])` with NULLS NOT DISTINCT (PG 15+) | OQ-15 |
| Add `NEEDS_REVIEW` to Status enum | No blocker |
| Add `StockMovement.type` enum (PROCUREMENT_IN, DISTRIBUTION_OUT, etc.) | No blocker |
| Reconcile existing `Item.quantity` against `SUM(StockMovement.change)` | Needs real DB state |
| Add `approvalRef`/`reason` fields to StockMovement | No blocker |
| Write ledger-reconciliation check script | No blocker |
| Tests: negative stock prevention, duplicate movement idempotency | No blocker |

## Phase 3 — Import infrastructure (commit path)

**Goal:** Complete the import pipeline to commit stage. No stock effects in this phase.

Dependencies: OQ-19 (import permissions), OQ-7 (duplicate identity), OQ-17 (source IDs)

| Task | Blocker |
|---|---|
| Add variant matching to `validateRows` (after Phase 2 variant model) | Phase 2 |
| Add employee matching to `validateRows` | No blocker (Employee model exists) |
| Add duplicate-within-file detection | OQ-7, OQ-17 (duplicate key semantics) |
| Add `commitImport` server action (historical procurement + recipient, no stock) | OQ-7, OQ-19 |
| Add `ImportJob.committedById`, `committedAt`, `approvalRef` fields | No blocker |
| Add `ProcurementRecord` model for historical procurement records | OQ-7 |
| Add `DistributionRecord` model for historical recipient records | OQ-7, OQ-8, OQ-25 |
| Extend import preview page with variant/employee match summary | Phase 2 |
| Add commit button (gated on VALIDATED status + no invalid rows) | No blocker |
| Performance test: 50k row workbook parse time and memory | OQ-10 |
| Tests: header, field, date, duplicate, employee, variant validation | Phase 2 + OQ-7 |

## Phase 4 — Historical imports

**Goal:** Historical procurement and recipient imports (no stock effect).

Dependencies: Phase 3, OQ-8 (recipient status values)

| Task | Blocker |
|---|---|
| `commitImport` for PROCUREMENT:HISTORICAL | Phase 3 |
| `commitImport` for RECIPIENT:HISTORICAL | Phase 3, OQ-8 |
| Duplicate detection: same file idempotency key re-use | Phase 3 |
| Duplicate detection: same external source ref | OQ-7, OQ-17 |
| Idempotency: retry of same commit does not create duplicate records | Phase 3 |
| Audit: log each committed record with import job ref | Phase 3 |
| Tests: all above | Phase 3 |

## Phase 5 — Stock Count reconciliation

**Goal:** Full reconciliation preview, approval and stock adjustment.

Dependencies: Phase 3, OQ-1 (initial stock scope), OQ-2 (empty system), OQ-5 (approver role), OQ-24 (per file vs per variant approval)

| Task | Blocker |
|---|---|
| Add `ReconciliationReview` model | No blocker |
| Calculate variance per variant on import job detail page | Phase 3 |
| Show before, target, variance, cross-checks | Phase 3 |
| `submitReconciliation` server action: create ReconciliationReview per variant | Phase 3 |
| `approveReconciliation` server action: recheck balance, post StockMovement | OQ-5 |
| Empty-ledger check (global, not per variant) | OQ-1, OQ-2 |
| Self-approval prevention for reconciliation | OQ-5 |
| Reason required before posting | OQ-14 |
| Stale-balance guard: recompute variance at approval time | Phase 3 |
| Tests: positive/negative variance, zero variance (no approval), self-approval rejection, stale balance | Phase 3, OQ-5 |

## Phase 6 — New procurement and distribution

**Goal:** Authorized new procurement workflow and new distribution via import.

Dependencies: Phase 4, OQ-23 (procurement approval), OQ-25 (recipient grouping), OQ-27 (NEEDS_REVIEW reviewer), OQ-31 (procurement approval roles), OQ-32 (quantity column)

| Task | Blocker |
|---|---|
| `commitImport` for PROCUREMENT:NEW → creates ProcurementRecord in PENDING state | OQ-31 |
| Procurement approval action → posts StockMovement atomically | OQ-23, OQ-31 |
| `commitImport` for RECIPIENT:NEW → creates Request+RequestLine per employee batch | OQ-25, OQ-32 |
| NEEDS_REVIEW routing on insufficient stock | OQ-27 |
| Reviewer assignment for NEEDS_REVIEW | OQ-27 |
| Concurrent-approval stock oversell prevention (row-level lock) | No blocker |
| Tests: procurement approval, concurrent approval, insufficient stock → review state, no double-posting | All above |

## Phase 7 — Remaining features

| Task | Notes |
|---|---|
| Dashboard: stock total, import job counts, low-stock | No blocker |
| Inventory: variant filter (size, color, brand), movement history per item | Phase 2 |
| Stock movement ledger view | Phase 2 |
| Procurement history page | Phase 6 |
| Distribution history page | Phase 4 |
| Reconciliation history page | Phase 5 |
| Import history filters | No blocker |
| Audit log: show actor name, filter by entity/action | No blocker |
| Reports: current stock export (CSV), movement ledger export | No blocker |
| User management page (ADMIN) | No blocker |
| Employee management page (ADMIN) | No blocker |
| Role-based nav for Manager/Authority on procurement approval | Phase 6 |
| Responsive behavior improvements | No blocker |
| Error states and loading indicators | No blocker |

## Phase 8 — Final verification

| Task | Notes |
|---|---|
| Full test suite run | All phases |
| Lint and type check | No blocker |
| Production build | No blocker |
| Migration test against copy of real data | OQ-28 |
| 50k row import test | OQ-10 |
| Stock invariant verification | Phase 2+ |
| Update all documentation | All phases |
| Final completion report | All phases |

---

## Dependency graph (key blockers)

```
OQ-15, OQ-21, OQ-22 → Phase 2 (variant model)
Phase 2 → Phase 3 (variant matching in imports)
OQ-7, OQ-17 → Phase 3 (duplicate detection)
OQ-19 → Phase 3 (commit permissions)
Phase 3 → Phase 4 (historical commit)
Phase 3, OQ-1, OQ-2, OQ-5, OQ-24 → Phase 5 (reconciliation)
Phase 4, OQ-23, OQ-25, OQ-27, OQ-31, OQ-32 → Phase 6 (new procurement + distribution)
```

## What can be built now (unblocked)

1. `NEEDS_REVIEW` status on the `Status` enum and supporting logic in `decide()`.
2. Prisma migration to apply `hardening.sql` constraints.
3. Audit log improvements (actor name, structured detail).
4. Dashboard improvements (real stock total, import counts).
5. Inventory page: movement history per item, active/inactive filter.
6. Employee management page (ADMIN).
7. Additional tests for existing actions.
8. User management page (ADMIN).
9. Reports: current stock CSV export.
