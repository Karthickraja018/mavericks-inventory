# Mavericks Inventory — BRD Traceability Matrix

_Requirement status codes: ✅ Implemented & verified · ⚠ Implemented, not fully tested · 🔶 Partially implemented · ❌ Missing · 🐛 Defective · 🔒 Blocked by open question_

_Last updated: 2026-10-24_

---

## Part C — Users, Authentication and Authorization

| BRD Ref | Requirement | Status | Files | Notes |
|---|---|---|---|---|
| §6 | Role: EXECUTIVE | ✅ | `schema.prisma` | Enum value exists |
| §6 | Role: MANAGER | ✅ | `schema.prisma` | Enum value exists |
| §6 | Role: AUTHORITY (Management Authority) | ✅ | `schema.prisma` | Named `AUTHORITY` |
| §6 | Role: ADMIN | ✅ | `schema.prisma` | Enum value exists |
| §7 | Enforce authorization on every server operation | ⚠ | `lib/auth.ts`, all actions | All existing ops protected; new ops TBD |
| §7 | No reliance on hidden buttons or frontend role checks | ✅ | all actions | Server-side guards confirmed |
| §7 | Prevent self-approval | ✅ | `actions.ts decide()` L69 | Guard present |
| §7 | Handle expired sessions | ✅ | `lib/auth.ts` L14 | jwtVerify throws on expiry |
| §7 | No plaintext passwords | ✅ | `actions.ts`, `seed.ts` | bcryptjs hash |
| §7 | View dashboard | ✅ | `(app)/page.tsx` | All roles |
| §7 | View products and stock | ✅ | `inventory/page.tsx` | All roles |
| §7 | Create/edit product masters | ⚠ | `actions.ts createItem` | ADMIN only; edit not yet implemented |
| §7 | Upload Excel files | 🔶 | `imports/actions.ts` | Upload/parse/stage done; commit not done |
| §7 | Preview and validate imports | 🔶 | `imports/[id]/page.tsx` | Error list shown; variant/employee match not shown |
| §7 | Commit historical imports | ❌ | — | Not implemented; blocked by OQ-7, OQ-15, OQ-19 |
| §7 | Submit new procurement | ❌ | — | Not implemented; blocked by OQ-23, OQ-31 |
| §7 | Approve procurement | ❌ | — | Not implemented |
| §7 | Create distribution requests | ✅ | `requests/new/page.tsx` | EXECUTIVE role |
| §7 | Approve/reject distributions | ✅ | `approvals/page.tsx`, `decide()` | MANAGER stage 1, AUTHORITY stage 2 |
| §7 | Approve stock reconciliation | ❌ | — | Not implemented; blocked by OQ-5, OQ-24 |
| §7 | View employee records | ❌ | — | No page exists; Employee model exists |
| §7 | View audit history | ⚠ | `audit/page.tsx` | ADMIN only; actor name not shown, no filter |
| §7 | Export reports | ❌ | — | Not implemented |
| §7 | Manage users and system config | ❌ | — | No user management page |

---

## Part D — Product Master and Inventory

| BRD Ref | Requirement | Status | Files | Notes |
|---|---|---|---|---|
| §8 | Product variants (size, color, brand) | 🔒 | `schema.prisma Item` | `Item` has SKU+name but no size/color/brand; blocked by OQ-15, OQ-21, OQ-22 |
| §8 | Match imported products to variants | 🔒 | `lib/imports.ts` | Structural validation only; matching logic not built |
| §8 | Stable internal IDs / SKUs | ⚠ | `schema.prisma` | CUID ids; SKU unique; no variant composite key |
| §8 | Normalize variant attributes consistently | 🔒 | — | Blocked by OQ-15 |
| §8 | Prevent duplicate product variants | 🔒 | — | No composite unique constraint yet |
| §8 | No auto-create missing variants | — | — | Not coded; requirement understood |
| §8 | Report ambiguous SKU-to-variant mappings | ❌ | — | Not implemented |
| §9 | Available stock = sum of posted movements | ✅ | `actions.ts decide()` | Enforced atomically in approval |
| §9 | Prevent negative stock | 🔶 | `actions.ts decide()` | Conditional UPDATE prevents negative; DB CHECK not applied via migration |
| §9 | Prevent duplicate stock movements | ⚠ | `schema.prisma` | `idempotencyKey @unique` exists; not enforced on all paths |
| §9 | Prevent concurrent overselling | ✅ | `actions.ts decide()` L64 | `FOR UPDATE` lock + conditional UPDATE |
| §9 | Preserve posted transaction history | ⚠ | `hardening.sql` | Immutability trigger written but not applied via migration |
| §9 | Record type, qty, source, actor, timestamp, approval ref | ⚠ | `schema.prisma StockMovement` | Fields exist; `type` is String not enum; `reason` exists |
| §9 | Audit trail for every stock-changing op | ⚠ | `actions.ts` | AuditLog entries written; no correlation IDs yet |
| §10 | createItem must not silently establish opening stock | ✅ | `actions.ts createItem` | Comment PTD-10; no opening stock on create |
| §10 | Opening stock only via approved reconciliation | 🔒 | — | Reconciliation workflow not yet built |

---

## Part E — Procurement

| BRD Ref | Requirement | Status | Files | Notes |
|---|---|---|---|---|
| §11 | Historical procurement mode | 🔶 | `imports/` | Upload/validate implemented; commit not built |
| §11 | Validate procurement date, variant, quantity | ⚠ | `lib/imports.ts` | Date, integer, XXX validated; variant matching not built |
| §11 | Reject missing variants | 🔒 | — | Blocked by Phase 2 variant model |
| §11 | Reject duplicates | 🔒 | — | Blocked by OQ-7, OQ-17 |
| §11 | Preserve source dates and provenance | ⚠ | `ImportRow.raw` | Source data preserved in JSON; ProcurementRecord not yet created |
| §11 | Record submitter and approver | ❌ | — | No ProcurementRecord yet |
| §11 | Immutable stock movement per committed procurement | ❌ | — | Not built |
| §11 | Atomic commit (procurement record + movement) | ❌ | — | Not built |
| §11 | Historical imports do not increase stock by default | ✅ | `imports/[id]/page.tsx` | "Commit is not available yet" — no stock effect currently |
| §11 | New procurement: approval before stock-in | 🔒 | — | Blocked by OQ-23, OQ-31 |
| §11 | Idempotent retries | ❌ | — | Idempotency key exists on ImportJob; commit not built |

---

## Part F — Recipient and Distribution

| BRD Ref | Requirement | Status | Files | Notes |
|---|---|---|---|---|
| §12 | Recipient template columns | ✅ | `lib/imports.ts` | RECIPIENT template defined; no Quantity column |
| §12 | Quantity field in recipient template | 🔒 | — | Blocked by OQ-32 |
| §13 | Emp ID as primary match | ⚠ | `schema.prisma Employee` | Employee model with empId exists; matching not in import pipeline |
| §13 | Reject employee mismatches | ❌ | — | Not implemented |
| §13 | No auto-create employees during import | — | — | Not coded; requirement understood |
| §13 | Employee identity separate from User | ✅ | `schema.prisma` | Employee and User are distinct models |
| §14 | Historical recipient imports — no stock deduction | ✅ | — | Commit not built; no stock effect |
| §14 | Reject duplicates | 🔒 | — | Blocked by OQ-7, OQ-17 |
| §15 | New distribution → pending requests | ❌ | — | Not implemented; blocked by OQ-25, OQ-32 |
| §15 | No stock deduction before final approval | ✅ | `actions.ts decide()` | Deduction only at final approval stage |
| §15 | Insufficient stock → NEEDS_REVIEW, no deduction | 🐛 | `actions.ts decide()` | Returns error, leaves request pending; no NEEDS_REVIEW state |
| §16 | Recipient status values | 🔒 | — | Blocked by OQ-8 |

---

## Part G — Stock Count Reconciliation

| BRD Ref | Requirement | Status | Files | Notes |
|---|---|---|---|---|
| §17 | Stock Count template | ✅ | `lib/imports.ts` | STOCK_COUNT template defined |
| §18 | Available = reconciliation target | ❌ | — | No reconciliation logic built |
| §18 | Procured/Distributed Qty = cross-checks only | ❌ | — | Cross-check warnings not implemented |
| §18 | Calculate variance | ❌ | — | Not implemented |
| §18 | Display preview (variant, current balance, target, variance) | ❌ | — | Not implemented |
| §19 | Every non-zero adjustment requires approval | ❌ | — | Not implemented |
| §19 | Approver ≠ requester | ❌ | — | Not implemented (but pattern exists in decide()) |
| §19 | Show before/after balance | ❌ | — | Not implemented |
| §19 | Require adjustment reason | ❌ | — | Not implemented |
| §19 | Recheck balance before posting | ❌ | — | Not implemented |
| §19 | Post auditable stock adjustment | ❌ | — | Not implemented |
| §20 | Initial stock only when global ledger empty | ❌ | — | Not implemented; blocked by OQ-1, OQ-2 |

---

## Part H — Excel Import Framework

| BRD Ref | Requirement | Status | Files | Notes |
|---|---|---|---|---|
| §21 | Three import entry points (SC, Proc, Recipient) | ✅ | `imports/page.tsx` | All 5 mode combinations listed |
| §21 | Explicit mode selection | ✅ | `imports/page.tsx` | Dropdown with forced selection |
| §22 | Stage 1: Select type/mode | ✅ | `imports/page.tsx` | — |
| §22 | Stage 2: Upload workbook | ✅ | `imports/actions.ts` | — |
| §22 | Stage 3: Validate file type, size, headers | ✅ | `imports/actions.ts` | .xlsx, ≤10MB, header check |
| §22 | Stage 4: Parse rows, preserve row numbers | ✅ | `lib/imports.ts readFirstSheet` | `n` = row number |
| §22 | Stage 5: Normalize for matching | 🔒 | — | Blocked by OQ-15 |
| §22 | Stage 6: Match products, variants, employees | ❌ | — | Not implemented |
| §22 | Stage 7: Validate dates, quantities, statuses | ⚠ | `lib/imports.ts validateRows` | Dates, ints validated; status list open (OQ-8) |
| §22 | Stage 8: Detect duplicate rows | ❌ | — | Not implemented; blocked by OQ-7 |
| §22 | Stage 9: Calculate variances / projected impact | ❌ | — | Not implemented |
| §22 | Stage 10: Display preview with errors | 🔶 | `imports/[id]/page.tsx` | Row errors shown; match status/variance not shown |
| §22 | Stage 11: Explicit confirmation + approval | ❌ | — | Not implemented |
| §22 | Stage 12: Revalidate at commit time | ❌ | — | Not implemented |
| §22 | Stage 13: Atomic commit | ❌ | — | Not implemented |
| §22 | Stage 14: Record result and audit | ⚠ | `imports/actions.ts` | ImportJob + AuditLog on upload; commit audit not yet built |
| §22 | Stage 15: Downloadable validation report | ✅ | `imports/[id]/errors/route.ts` | CSV download implemented |
| §23 | Reject unsupported file types | ✅ | `imports/actions.ts` | `.xlsx` check |
| §23 | Validate headers | ✅ | `lib/imports.ts` | Exact header match |
| §23 | Reject malformed dates | ✅ | `lib/imports.ts` | `validDate` function |
| §23 | Reject missing required fields | ✅ | `lib/imports.ts` | `MISSING_REQUIRED` error code |
| §23 | Reject XXX placeholder | ✅ | `lib/imports.ts` | `PLACEHOLDER_VALUE` error code |
| §23 | Validate product variant identity | ❌ | — | Not implemented |
| §23 | Validate employee identity | ❌ | — | Not implemented |
| §23 | Validate status values | 🔒 | — | Blocked by OQ-8 |
| §23 | Detect duplicate rows in file | ❌ | — | Not implemented |
| §23 | Detect conflicts with prior imports | ❌ | — | Not implemented |
| §23 | Preserve source row numbers in errors | ✅ | `lib/imports.ts` | `r.n` propagated to ImportRow.sourceRow |
| §24 | Reject duplicates, report conflicting rows | ❌ | — | Not implemented |
| §24 | Use stable external transaction ID | 🔒 | — | Blocked by OQ-17 |
| §24 | DB uniqueness for source identifiers | ❌ | — | Not implemented |
| §24 | Idempotency key on import | ✅ | `schema.prisma ImportJob` | `idempotencyKey @unique` on job |
| §25 | All-or-nothing commit semantics | ❌ | — | Commit not built |
| §25 | DB transaction for business writes | ❌ | — | Commit not built |
| §25 | Rollback if any row fails commit | ❌ | — | Commit not built |
| §25 | 50k row import support | 🔒 | — | Blocked by OQ-10 (benchmark needed) |
| §26 | Import audit record (all fields) | ⚠ | `imports/actions.ts` | Upload audit written; commit audit not yet built |

---

## Part I — Dashboard, Reporting and Audit

| BRD Ref | Requirement | Status | Files | Notes |
|---|---|---|---|---|
| §27 | Dashboard: active product variant count | ⚠ | `(app)/page.tsx` | `Item.count` shown; not yet variant-aware |
| §27 | Dashboard: current available stock | ❌ | — | Not shown |
| §27 | Dashboard: pending distribution requests | ✅ | `(app)/page.tsx` | Shown |
| §27 | Dashboard: pending procurement approvals | ❌ | — | Not shown |
| §27 | Dashboard: pending reconciliation approvals | ❌ | — | Not shown |
| §27 | Dashboard: recent movements | ❌ | — | Not shown |
| §27 | Dashboard: import jobs and failures | ❌ | — | Not shown |
| §27 | Dashboard: low-stock indicators | ❌ | — | No threshold defined |
| §28 | Product/variant listing | ⚠ | `inventory/page.tsx` | Basic list; no variant attributes shown |
| §28 | Search and filtering | ⚠ | `inventory/page.tsx` | SKU/name search; no variant attribute filter |
| §28 | Stock movement history per item | ❌ | — | No item detail page |
| §28 | Procurement history | ❌ | — | No page |
| §28 | Distribution history | ❌ | — | Requests list exists; no distribution-specific view |
| §28 | Reconciliation history | ❌ | — | No page |
| §28 | Import history | ✅ | `imports/page.tsx` | Last 50 jobs listed |
| §29 | Current stock export | ❌ | — | Not implemented |
| §29 | Stock movement ledger export | ❌ | — | Not implemented |
| §29 | Other reports | ❌ | — | Not implemented |
| §29 | Exports respect permissions | ❌ | — | Not implemented |

---

## Part J — Database

| BRD Ref | Requirement | Status | Files | Notes |
|---|---|---|---|---|
| §30 | Reuse existing models | ✅ | `schema.prisma` | No duplicate models |
| §30 | Verify unique constraints | ⚠ | `schema.prisma` | Item.sku unique; ImportJob.idempotencyKey unique; variant composite constraint missing |
| §30 | Test migrations against copy | 🔒 | — | No migrations folder; blocked by OQ-28 |
| §31 | ImportJob model | ✅ | `schema.prisma` | All required fields |
| §31 | ImportRow model | ✅ | `schema.prisma` | All required fields |
| §31 | ReconciliationReview | ❌ | — | Not in schema yet |
| §32 | Authoritative stock ledger (StockMovement) | ✅ | `schema.prisma` | Single ledger |
| §32 | Atomic cache update with ledger | ✅ | `actions.ts decide()` | UPDATE + INSERT in transaction |
| §32 | Prevent concurrent overselling | ✅ | `actions.ts decide()` | FOR UPDATE lock |
| §32 | No mutating posted movements | ⚠ | `hardening.sql` | Trigger defined but not applied via migration |

---

## Part K — UI/UX

| BRD Ref | Requirement | Status | Files | Notes |
|---|---|---|---|---|
| §33 | Consistent navigation | ✅ | `(app)/layout.tsx` | Role-conditional nav |
| §33 | Responsive layouts | ⚠ | `globals.css` | Basic media query for mobile |
| §33 | Loading states | ❌ | — | No loading UI |
| §33 | Error states | ⚠ | All pages | Error via URL searchParams; no inline toasts |
| §33 | Empty states | ✅ | All list pages | `.empty` divs present |
| §33 | Accessible labels | ⚠ | Various | `htmlFor`/`aria-label` present; some gaps |
| §33 | Confirmation dialogs for stock-changing ops | ❌ | — | No confirm dialogs |
| §33 | Search, filtering, pagination | 🔶 | `inventory/page.tsx` | Search only; no pagination, no variant attribute filter |
| §34 | Import preview: match status, variance | ❌ | — | Not implemented |

---

## Part L — Testing

| BRD Ref | Requirement | Status | Notes |
|---|---|---|---|
| §35 | Auth: unauthenticated access denied | ⚠ | `requireUser` tested manually; no automated test |
| §35 | Auth: unauthorized roles blocked | ⚠ | Server-side enforcement exists; no test |
| §35 | Self-approval rejected | ⚠ | Guard in `decide()`; no test |
| §35 | Import validator tests | ✅ | 4 tests pass |
| §35 | All other test categories | ❌ | Not implemented |
| §36 | Lint | — | No lint script in package.json |
| §36 | Type check | ✅ | `tsc --noEmit` exits 0 |
| §36 | Unit tests | ✅ | 4 pass |
| §36 | Integration tests | ❌ | Not implemented |
| §36 | Production build | ✅ | `next build` exits 0 |
| §36 | DB schema validation | ⚠ | `prisma validate` not in scripts |
| §36 | Migration checks | ❌ | No migrations folder |
| §36 | E2E tests | ❌ | Not configured |
