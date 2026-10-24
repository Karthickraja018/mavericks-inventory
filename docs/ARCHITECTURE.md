# Mavericks Inventory — Architecture

_Last updated: 2026-10-24_

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2 (App Router, React 18, server actions) |
| Language | TypeScript 5 (strict; `tsconfig.json` `baseUrl=src`) |
| Database | PostgreSQL via Neon (pooled + direct URL) |
| ORM | Prisma 5.22 |
| Authentication | Custom JWT (jose HS256, 8 h expiry, HttpOnly cookie `s`) |
| Password hashing | bcryptjs |
| Excel parsing | exceljs 4.4 streaming reader |
| Test runner | Node.js built-in `node:test` + `tsx` |
| Runtime | Node.js (Next.js server) |

No frontend JS framework beyond React. No state management library. No UI component library. Vanilla CSS design system.

---

## Module layout

```
src/
  app/
    actions.ts               # root server actions (login, logout, createItem, createRequest, submitRequest, decide)
    globals.css              # single CSS design system
    layout.tsx               # root HTML shell
    login/page.tsx           # login page (unauthenticated)
    (app)/
      layout.tsx             # authenticated shell + nav
      page.tsx               # dashboard
      inventory/page.tsx     # item list + admin item creation
      requests/
        page.tsx             # request list (role-filtered)
        new/page.tsx         # new request form (EXECUTIVE only)
        [id]/page.tsx        # request detail + approval history
      approvals/page.tsx     # approval queue (MANAGER / AUTHORITY)
      imports/
        page.tsx             # import list + upload form (ADMIN)
        actions.ts           # uploadImport server action
        [id]/page.tsx        # import job detail + error table
        [id]/errors/route.ts # GET → CSV error report download
      audit/page.tsx         # audit log table (ADMIN)
  lib/
    auth.ts                  # setSession, requireUser
    db.ts                    # PrismaClient singleton
    imports.ts               # TEMPLATES, readFirstSheet, validateRows
    imports.test.ts          # 4 unit tests (node:test)

prisma/
  schema.prisma              # canonical schema
  seed.ts                    # dev seed (4 users, 3 items, optional SEED_DEV_STOCK)
  hardening.sql              # DB-level constraints and immutability trigger

docs/
  ARCHITECTURE.md            # this file
  BRD.md                     # business requirements (to be created; source is the master prompt)
  BRD_IMPORT_ADDENDUM.md     # import BRD addendum
  DATA_MODEL.md              # schema delta proposal
  DECISIONS.md               # decision log
  OPEN_QUESTIONS.md          # open questions
  IMPLEMENTATION_STATUS.md   # gate status
  IMPLEMENTATION_PLAN.md     # phased plan
  TEST_PLAN.md               # test strategy
```

---

## Routing and authorization

All routes under `(app)/` call `requireUser()` which:
1. Reads the `s` JWT cookie.
2. Verifies the signature and expiry.
3. Fetches the user from the database.
4. Returns the user or redirects to `/login`.
5. Optionally checks `roles[]` and throws `Error("Forbidden")` on mismatch.

Role-based nav injection: `layout.tsx` adds nav links based on `u.role`.  
Role-based page guards: each page or action calls `requireUser([...roles])`.

### Current role-to-access map

| Route / Action | EXECUTIVE | MANAGER | AUTHORITY | ADMIN |
|---|---|---|---|---|
| Dashboard `/` | ✓ | ✓ | ✓ | ✓ |
| Inventory list `/inventory` | ✓ | ✓ | ✓ | ✓ |
| Create item | ✗ | ✗ | ✗ | ✓ |
| New request `/requests/new` | ✓ | ✗ | ✗ | ✗ |
| Submit request | ✓ | ✗ | ✗ | ✗ |
| Requests list `/requests` | own only | all | all | all |
| Approvals `/approvals` | ✗ | ✓ | ✓ | ✗ |
| Approve/reject | ✗ | Stage 1 | Stage 2 | ✗ |
| Imports `/imports` | ✗ | ✗ | ✗ | ✓ |
| Upload import | ✗ | ✗ | ✗ | ✓ |
| Import detail | ✗ | ✗ | ✗ | ✓ |
| Audit log `/audit` | ✗ | ✗ | ✗ | ✓ |

**Missing from nav/permissions (gaps):** import commit, reconciliation approval, procurement approval, employee management, user management, reports/exports.

---

## Authorization enforcement model

- **Server actions** call `requireUser([roles])` at the top of each function before any DB access.
- **Route handlers** (`GET`) call `requireUser([roles])`.
- **Page components** call `requireUser()` or `requireUser([roles])` before any data fetch.
- No client-side role guard is relied upon for security.
- Self-approval prevention: `if (r.requesterId === u.id) throw` in `decide()`.

---

## Stock accounting

`Item.quantity` is a cached balance kept in sync with `StockMovement` rows.

The `decide()` action does an atomic balance deduction:
```sql
UPDATE "Item" SET quantity = quantity - $q
WHERE id = $itemId AND quantity >= $q
RETURNING quantity::text
```
If the row count is 0 (insufficient stock) the transaction rolls back and an error is returned. No `NEEDS_REVIEW` state exists yet.

**Gap:** The cached balance (`Item.quantity`) is not reconciled against `SUM(StockMovement.change)` by any automatic process. DB constraints (`CHECK quantity >= 0`, immutability trigger) from `hardening.sql` have not been applied via a migration yet.

---

## Import pipeline (current state)

1. Admin uploads `.xlsx` ≤ 10 MB with explicit type+mode.
2. `uploadImport` computes SHA-256 checksum + idempotency key.
3. Duplicate file+type+mode: returns existing job.
4. `readFirstSheet` streams and parses rows (exceljs).
5. `validateRows` checks headers, required fields, integers, dates, `XXX` placeholders.
6. Results staged in `ImportJob` + `ImportRow`.
7. **Commit: not implemented.** Import detail page shows "commit is not available yet."
8. Error CSV download available for ADMIN.

**Gaps:** variant matching, employee matching, duplicate-within-file detection, reconciliation variance calculation, commit action, approval workflow for imports.

---

## Database constraints (hardening.sql — not yet applied)

```sql
CHECK (quantity >= 0)           -- on Item
CHECK (change <> 0)             -- on StockMovement  
CHECK valid type/mode pair      -- on ImportJob
Trigger: StockMovement is append-only
```

These constraints are defined in `prisma/hardening.sql` but have **not been applied** via a migration. The Prisma schema has no migrations directory; the database state is managed by `prisma migrate dev`.

---

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection (Neon / local) |
| `DATABASE_URL_UNPOOLED` | Direct connection for migrations |
| `AUTH_SECRET` | JWT signing key (keep secret, min 32 chars) |
| `APPROVAL_LEVELS` | `1` or `2` (default 2); snapshot at request submission |
| `SEED_DEV_STOCK` | `1` to seed dev stock via the approved ledger path |
