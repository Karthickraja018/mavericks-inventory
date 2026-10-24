# Mavericks Inventory — Test Plan

_Last updated: 2026-10-24_

## Test infrastructure

- Runner: `node:test` (built-in, no extra dependency)
- Execution: `npm test` → `tsx --test src/lib/*.test.ts`
- Pattern: all `*.test.ts` files in `src/lib/` are picked up automatically.
- DB tests: require `DATABASE_URL` pointing to a test database; use `prisma migrate reset --force` before each test run.

---

## Test file structure

```
src/lib/
  imports.test.ts       ← existing (4 tests)
  auth.test.ts          ← to be created
  ledger.test.ts        ← to be created
  variant.test.ts       ← to be created (Phase 2)
  employee.test.ts      ← to be created (Phase 3)
  reconciliation.test.ts ← to be created (Phase 5)
  procurement.test.ts   ← to be created (Phase 6)
  distribution.test.ts  ← to be created (Phase 6)
  concurrency.test.ts   ← to be created (Phase 6)
```

---

## Test categories

### 1. Authentication and permissions (Phase 1)

| Test | Expected |
|---|---|
| No cookie → requireUser redirects to /login | redirect('/login') |
| Expired JWT → requireUser redirects to /login | redirect('/login') |
| Valid JWT, inactive user → redirect | redirect('/login') |
| Valid JWT, user not in DB → redirect | redirect('/login') |
| Valid JWT, wrong role → throws Forbidden | Error('Forbidden') |
| Valid JWT, correct role → returns user | user object |

### 2. Item creation (Phase 1)

| Test | Expected |
|---|---|
| Non-ADMIN calling createItem → Forbidden | throws |
| ADMIN creates item with unique SKU → succeeds | item created, audit log entry |
| ADMIN creates item with duplicate SKU → error | redirect with error msg |
| Created item has quantity=0 | item.quantity === 0 |
| Created item has no StockMovement | count=0 |

### 3. Distribution request workflow (Phase 1)

| Test | Expected |
|---|---|
| Non-EXECUTIVE calling createRequest → Forbidden | throws |
| createRequest with no items → redirect with error | redirect |
| createRequest with invalid item ID → error | redirect |
| createRequest with inactive item → error | redirect |
| createRequest save-draft → DRAFT status | request.status=DRAFT |
| createRequest submit → PENDING_MANAGER | request.status=PENDING_MANAGER |
| submitRequest by non-owner → not updated | no state change |

### 4. Approval and stock deduction (Phase 1)

| Test | Expected |
|---|---|
| Non-MANAGER/AUTHORITY calling decide → Forbidden | throws |
| MANAGER deciding on PENDING_AUTHORITY request → wrong approver | Error |
| AUTHORITY deciding on PENDING_MANAGER request → wrong approver | Error |
| Requester approving own request → self-approval blocked | Error |
| Reject without remarks → error | Error |
| MANAGER approves → PENDING_AUTHORITY (2-level) | status advances |
| AUTHORITY approves with sufficient stock → APPROVED, stock deducted | stock -= qty |
| AUTHORITY approves with insufficient stock → error, no deduction | stock unchanged |
| Approved request stock movement: idempotency key unique | no duplicate on retry |
| Concurrent approvals cannot deduct below zero | one succeeds, one errors |
| Rejection → REJECTED, no stock change | stock unchanged |

### 5. Import validator (Phase 1 — existing)

| Test | Expected | Status |
|---|---|---|
| Header mismatch → headerError | string | ✅ Pass |
| Valid row → 0 errors | 0 errors | ✅ Pass |
| XXX, blank, bad quantity → 3 error codes | codes array | ✅ Pass |
| Blank numeric → MISSING_REQUIRED | code | ✅ Pass |

### 6. Import upload (Phase 1)

| Test | Expected |
|---|---|
| Non-ADMIN calling uploadImport → Forbidden | throws |
| Upload non-xlsx file → error | redirect |
| Upload >10MB file → error | redirect |
| Upload valid procurement file → ImportJob created | job.status=VALIDATED |
| Upload file with header errors → FAILED | job.status=FAILED |
| Upload same file+type+mode twice → same job ID returned | dup.id returned |
| ImportRow.sourceRow matches Excel row number | sourceRow preserved |
| Invalid row → ImportRow.status=INVALID | — |
| Valid row → ImportRow.status=VALID | — |
| Audit log entry created on upload | AuditLog.action=IMPORT_UPLOADED |

### 7. Variant matching (Phase 2)

| Test | Expected |
|---|---|
| Row with known SKU → matched variant | ImportRow.matchedItemId set |
| Row with unknown SKU → INVALID, VARIANT_NOT_FOUND error | error code |
| Case/whitespace normalization on SKU | match succeeds |
| Ambiguous product text → warning | WARNING status |
| NA brand → canonical null/empty match | no false positive |

### 8. Employee matching (Phase 3)

| Test | Expected |
|---|---|
| Row with known Emp ID → matched employee | ImportRow.matchedEmployeeId set |
| Row with unknown Emp ID → INVALID | EMPLOYEE_NOT_FOUND |
| Known Emp ID, name mismatch → WARNING | kept for review |
| Known Emp ID, location mismatch → WARNING | kept for review |
| Commit with unresolved mismatch → blocked | commit disabled |

### 9. Duplicate detection (Phase 3)

| Test | Expected |
|---|---|
| Two rows in same file with same product+date+qty → DUPLICATE | second row flagged |
| Same file uploaded twice (same idempotency key) → existing job reused | same job.id |
| Committed procurement uploaded again → DUPLICATE detected | conflict reported |

### 10. Historical imports (Phase 4)

| Test | Expected |
|---|---|
| PROCUREMENT:HISTORICAL commit → ProcurementRecord created | record.mode=HISTORICAL |
| PROCUREMENT:HISTORICAL → no StockMovement created | 0 movements |
| PROCUREMENT:HISTORICAL → Item.quantity unchanged | unchanged |
| RECIPIENT:HISTORICAL → DistributionRecord created | record.mode=HISTORICAL |
| RECIPIENT:HISTORICAL → no StockMovement | 0 movements |
| RECIPIENT:HISTORICAL → Item.quantity unchanged | unchanged |
| Retry historical commit → no duplicate records | idempotent |

### 11. Stock Count reconciliation (Phase 5)

| Test | Expected |
|---|---|
| Positive variance → requires approval | adjustmentRequired=true |
| Negative variance → requires approval | adjustmentRequired=true |
| Zero variance → no approval, no movement | no ReconciliationReview |
| Procured field does not post movement | StockMovement count unchanged |
| Distributed Qty field does not post movement | StockMovement count unchanged |
| Approve reconciliation → StockMovement posted | movement.type=RECONCILIATION_ADJUSTMENT |
| Balance after equals target | Item.quantity = target |
| Self-approval of reconciliation → blocked | Error |
| Stale balance (changed since preview) → invalidated | Error |
| Negative inventory blocked | Error |
| No reason provided → blocked | Error |
| Initial stock when ledger empty → allowed (global rule) | succeeds |
| Initial stock when ledger non-empty → blocked | Error |
| Missing variant in file → unaffected, reported | item unchanged |
| Missing variant stock not zeroed | balance unchanged |
| Rollback on commit failure → no partial adjustments | all or none |

### 12. New procurement (Phase 6)

| Test | Expected |
|---|---|
| New procurement commit → ProcurementRecord PENDING | status=PENDING |
| ProcurementRecord PENDING → no StockMovement | 0 movements |
| Approve procurement → StockMovement created | movement.type=PROCUREMENT_IN |
| Approve procurement → Item.quantity increased | qty increased |
| Reject procurement → no movement | unchanged |
| Retry approve → no duplicate movement | idempotent |

### 13. New distribution via import (Phase 6)

| Test | Expected |
|---|---|
| RECIPIENT:NEW commit → Request+RequestLine created | status=PENDING_MANAGER |
| RECIPIENT:NEW → no stock deduction | qty unchanged |
| Approve distribution → stock deducted | qty decreased |
| Insufficient stock at approval → NEEDS_REVIEW | no deduction |
| Concurrent approvals → one succeeds, one → NEEDS_REVIEW | no oversell |
| Retry approval → no duplicate movement | idempotent |

### 14. Performance (Phase 6/7)

| Test | Expected |
|---|---|
| Parse 50k-row XLSX → completes < 30s | no timeout |
| 50k-row parse memory peak < 512MB | measured |
| DB transaction for 50k rows completes or rolls back cleanly | no partial state |
| Concurrent stock deductions (10 goroutines) → no negative balance | invariant holds |

### 15. Invariants (cross-phase)

| Test | Expected |
|---|---|
| Item.quantity >= 0 always | DB CHECK + server guard |
| StockMovement.change != 0 | DB CHECK |
| StockMovement immutable (no UPDATE/DELETE) | trigger fires |
| ImportJob idempotency key unique | DB UNIQUE |
| No visible partial business commit after failure | rollback confirmed |

---

## Running tests

```bash
# Unit tests (no DB required)
npm test

# Type check
npx tsc --noEmit

# Build
npm run build

# DB-dependent tests (requires DATABASE_URL with test DB)
DATABASE_URL=... npm test
```

---

## Pre-existing test failures (none)

All 4 existing tests pass. No pre-existing failures to distinguish from new ones.
