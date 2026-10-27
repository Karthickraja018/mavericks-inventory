# Mavericks Inventory — BRD Traceability Matrix

_Requirement status codes: ✅ Implemented and verified · ⚠ Implemented but not fully tested or hardened · 🔶 Partially implemented · ❌ Missing · 🐛 Defective or incomplete · 🔒 Blocked by an unresolved business decision_

_Analysis date: 2026-10-26_

This matrix was reconciled against the current application code, Prisma schema, server actions, route pages, tests, and build status. A requirement is not marked ✅ merely because a UI exists; the relevant server-side behavior and verification status are considered.

## Executive summary — what is still missing

The current application is an operational MVP. The main remaining gaps are:

1. **Database migration management** — there is no Prisma migrations directory or migration baseline for the connected database. `prisma/hardening.sql` exists, but its constraints and immutable-ledger trigger are not automatically applied.
2. **Automated business/integration coverage** — tests cover workbook parsing and validation, but not database transactions, role enforcement, reconciliation, procurement, distribution, concurrency, or CRUD actions.
3. **Request review UX** — insufficient-stock requests are moved to `NEEDS_REVIEW`, and a server action exists to requeue or reject them, but the normal approvals page does not present a complete review queue/action flow.
4. **Import business controls** — external transaction identifiers and cross-import duplicate/conflict detection are not implemented; import idempotency currently protects the uploaded file/type/mode combination.
5. **Product-master boundaries** — the `Product` model exists, but there is no product-master UI or product CRUD workflow; inventory CRUD operates directly on `Item` variants.
6. **Inventory usability** — inventory search has a 200-row cap but no pagination and no dedicated attribute/category filters.
7. **Approval and audit detail** — reconciliation approval details are available in the approvals queue, but the audit page does not display `AuditLog.detail`; approval history is not shown as a dedicated detail view.
8. **Operational hardening** — no confirmation dialogs for destructive/stock-changing browser actions, no loading states, incomplete accessibility review, and no configured lint script.
9. **Scale/performance evidence** — the required 50k-row import duration and memory benchmarks have not been run.
10. **Business decisions still needed** — recipient status vocabulary, external identifiers, import conflict policy, approval scope/levels for all import types, and some location/stock policy questions remain open in `docs/OPEN_QUESTIONS.md`.

---

## Part C — Users, Authentication and Authorization

| BRD Ref | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| §6 | EXECUTIVE, MANAGER, AUTHORITY and ADMIN roles | ✅ | `Role` enum and user-management role selector |
| §7 | Enforce authorization on every server operation | ⚠ | Server actions use `requireUser`; automated authorization tests are missing |
| §7 | No reliance on hidden buttons or frontend role checks | ✅ | Mutation actions enforce roles server-side |
| §7 | Prevent self-approval | ✅ | Distribution, procurement and reconciliation approval guards |
| §7 | Handle expired sessions | ✅ | JWT verification failure redirects to login |
| §7 | No plaintext passwords | ✅ | `bcryptjs` hashing in user create/login flow |
| §7 | View dashboard, inventory and stock | ✅ | Authenticated application routes |
| §7 | Create/edit/deactivate/delete inventory items | ⚠ | Admin CRUD is implemented; deletion is correctly blocked for operational history; no automated action tests |
| §7 | Upload Excel files | ⚠ | Admin-only upload, checksum/idempotency, staging and validation are implemented |
| §7 | Preview and validate imports | ✅ | Matching, employee checks, row errors, preview and downloadable error CSV exist |
| §7 | Commit historical imports | ✅ | Historical procurement and recipient records commit without stock movements |
| §7 | Submit new procurement | 🔶 | New procurement is created through the import flow; no separate manual procurement-entry form |
| §7 | Approve/reject procurement | ✅ | Manager/authority import approval posts or rejects procurement stock-in |
| §7 | Create distribution requests | ✅ | Executive request flow and Recipient:NEW import flow |
| §7 | Approve/reject distributions | ✅ | One/two-stage manager/authority workflow with atomic deduction |
| §7 | Approve stock reconciliation | ✅ | Manager/authority approval queue posts reconciliation movements |
| §7 | View employee records | ✅ | Admin employee list, create, edit and activate/deactivate |
| §7 | View audit history | ⚠ | Admin audit page has actor/entity/action/outcome filters; JSON `detail` is not displayed |
| §7 | Export reports | ✅ | Current-stock and ledger CSV routes; permission and export tests are missing |
| §7 | Manage users and system configuration | 🔶 | Admin user CRUD/deactivation exists; no general configuration-management UI |

---

## Part D — Product Master and Inventory

| BRD Ref | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| §8 | Product variants with size, color and brand | ✅ | `Item` contains SKU, name, size, color, brand, category and unit |
| §8 | Product-master CRUD | 🔶 | Item/variant CRUD exists; no separate `Product` master UI despite the schema model |
| §8 | Match imported products to variants | ✅ | Prepared imports match SKU/name/product plus normalized variant attributes |
| §8 | Stable internal IDs / unique SKUs | ✅ | CUID item IDs and unique SKU |
| §8 | Normalize variant attributes consistently | ✅ | Import normalization canonicalizes blank/NA values and matching fields |
| §8 | Prevent duplicate product variants | ⚠ | SKU uniqueness exists; composite product/variant uniqueness is not database-enforced |
| §8 | Do not auto-create missing variants | ✅ | Unknown variants are validation errors; imports do not create items |
| §8 | Report ambiguous mappings | ✅ | Ambiguous matches are marked invalid with an explicit validation error |
| §9 | Available stock is ledger-backed | ⚠ | Stock movement and cached quantity are updated atomically; DB constraints/migration are not applied |
| §9 | Prevent negative stock | ⚠ | Conditional deduction and initial-stock checks exist; database `CHECK` is only in unapplied SQL |
| §9 | Prevent duplicate stock movements | ⚠ | Idempotency keys exist on movement records, but all retry paths lack integration tests |
| §9 | Prevent concurrent overselling | ✅ | Row lock and conditional quantity update in final distribution approval |
| §9 | Preserve posted transaction history | ⚠ | Immutable trigger is defined in `hardening.sql`, not managed by a migration |
| §9 | Record type, quantity, source, actor, timestamp and approval reference | ✅ | `StockMovement` contains these fields; reason is also stored |
| §9 | Audit every stock-changing operation | ⚠ | Audit records are written for main flows; complete coverage is not tested |
| §10 | Item creation does not establish opening stock | ✅ | New items start at zero and create no movement |
| §10 | Opening stock only through approved reconciliation | ✅ | Stock count approval is the posting path; initial negative values are rejected |

---

## Part E — Procurement

| BRD Ref | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| §11 | Historical procurement mode | ✅ | Procurement historical import creates `ProcurementRecord` without stock effect |
| §11 | Validate procurement date, variant and quantity | ✅ | Date/integer validation plus prepared variant matching |
| §11 | Reject missing variants | ✅ | Unknown/ambiguous variants make rows invalid |
| §11 | Reject duplicates | 🔶 | Intra-file duplicate detection exists; conflicts with prior committed imports are not detected |
| §11 | Preserve source dates and provenance | ✅ | Source row, import job, source reference and date are retained |
| §11 | Record submitter and approver | ✅ | Import uploader and procurement approver fields are persisted |
| §11 | Immutable stock movement per committed procurement | ⚠ | Movement is created atomically; database immutability trigger is not migrated/applied |
| §11 | Atomic procurement record + movement | ✅ | Approval transaction writes both together |
| §11 | Historical imports do not increase stock | ✅ | Historical commit deliberately avoids movements |
| §11 | New procurement approval before stock-in | ✅ | `AWAITING_APPROVAL` queue; approval posts stock-in |
| §11 | Idempotent retries | ⚠ | Source references and movement idempotency keys exist; end-to-end retry tests are missing |

---

## Part F — Recipient and Distribution

| BRD Ref | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| §12 | Recipient template columns | ✅ | Recipient template supports the current workbook format |
| §12 | Quantity field in recipient template | ⚠ | 13-column template supports quantity; legacy 12-column template is accepted with a warning and cannot safely support stock-changing import |
| §13 | Emp ID as primary match | ✅ | Prepared recipient rows match active employees by Emp ID |
| §13 | Reject employee mismatches | ✅ | Unknown employee, name mismatch and location mismatch are validation errors |
| §13 | Do not auto-create employees during import | ✅ | Employees must be created in the Admin employee page |
| §13 | Employee identity separate from User | ✅ | Separate `Employee` and `User` models |
| §14 | Historical recipient import has no stock deduction | ✅ | Historical records commit without stock movement |
| §14 | Reject duplicates | 🔶 | Intra-file duplicate detection exists; cross-import conflict detection is missing |
| §15 | New distribution creates pending requests | ✅ | Recipient:NEW creates grouped pending requests and distribution records |
| §15 | No deduction before final approval | ✅ | Stock deduction occurs only at final approval |
| §15 | Insufficient stock becomes `NEEDS_REVIEW` with no deduction | 🐛 | Server action marks the request `NEEDS_REVIEW`, but the main approval queue does not provide a complete review resolution UI |
| §16 | Recipient source status vocabulary | 🔒 | Source status is retained, but allowed values and business behavior remain unresolved |

---

## Part G — Stock Count Reconciliation

| BRD Ref | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| §17 | Stock Count template | ✅ | Template validation and workbook fixtures exist |
| §18 | `Available` is reconciliation target | ✅ | Target balance is read from the staged `Available` field |
| §18 | Procured/Distributed are cross-checks only | ✅ | Stored as review fields and shown in approval detail; they do not post stock |
| §18 | Calculate variance | ✅ | Balance before, target and variance are persisted |
| §18 | Display preview of item/current/target/variance | ✅ | Import preview, reconciliation history and approval queue show these values |
| §19 | Non-zero adjustment requires approval | ✅ | Stock changes only in manager/authority approval transaction |
| §19 | Approver is not requester | ✅ | Self-approval is blocked |
| §19 | Show before/after balance | ✅ | Approval queue shows before/target/change; movement stores balance after |
| §19 | Require adjustment reason | ⚠ | Rejection requires a reason; approval accepts an optional reason and supplies a default, so an explicit manager reason is not mandatory |
| §19 | Recheck balance before posting | ✅ | Conditional update checks the original balance before posting |
| §19 | Post auditable stock adjustment | ✅ | `RECONCILIATION_ADJUSTMENT` movement and audit record are created |
| §20 | Initial stock only when global ledger is empty | ✅ | Approval path checks ledger state and rejects negative initial stock |
| §20 | Approval history/detail view | 🔶 | Detailed pending approval view exists; completed reconciliation history is tabular and has no dedicated record detail page |

---

## Part H — Excel Import Framework

| BRD Ref | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| §21 | Stock Count, Procurement and Recipient entry points | ✅ | Import center exposes supported type/mode combinations |
| §21 | Explicit mode selection | ✅ | Type/mode selection is required |
| §22 | Upload, parse, preserve row numbers | ✅ | XLSX validation and staged `sourceRow` values |
| §22 | Normalize and match products/employees | ✅ | Prepared import matching is implemented |
| §22 | Validate dates, quantities and required fields | ✅ | Validator and tests cover these controls |
| §22 | Detect duplicate rows | ✅ | Intra-file duplicate rows are marked |
| §22 | Calculate variance/projected impact | ✅ | Stock-count variance is calculated and shown |
| §22 | Display preview with errors | ✅ | Error rows, matched rows and reconciliation preview are displayed |
| §22 | Explicit confirmation and approval | ⚠ | Prepare/commit/approval actions exist; no browser confirmation dialog for destructive actions |
| §22 | Revalidate at commit time | ✅ | Transactions re-read job/items and use conditional balance updates |
| §22 | Atomic commit | ✅ | Business writes use Prisma transactions |
| §22 | Record result and audit | ✅ | Import status, commit metadata and audit records are stored |
| §22 | Downloadable validation report | ✅ | Error CSV route exists |
| §23 | Unsupported type, headers, dates, required fields and placeholders | ✅ | Implemented and covered by validator tests |
| §23 | Validate product and employee identity | ✅ | Prepared matching and mismatch errors |
| §23 | Validate allowed source status values | 🔒 | Status vocabulary is still a business decision |
| §23 | Detect conflicts with prior imports | ❌ | No reliable external transaction ID/conflict lookup |
| §24 | Stable external transaction ID | ❌ | Only generated checksum/source references exist; no source transaction column/model key |
| §24 | Database uniqueness for external source identifiers | ❌ | Not modeled |
| §24 | Idempotency for uploaded file | ✅ | Unique `ImportJob.idempotencyKey` |
| §25 | Rollback on any business-write failure | ✅ | Main import and approval mutations are transactional |
| §25 | Support 50k-row imports | ⚠ | Chunked row staging exists, but required performance/memory benchmark has not been run |
| §26 | Complete import audit record | ⚠ | Upload/prepare/commit/approval audit records exist; audit detail is not fully exposed in the UI |

---

## Part I — Dashboard, Reporting and Audit

| BRD Ref | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| §27 | Active item/variant count | ✅ | Dashboard count and inventory list |
| §27 | Current available stock | ✅ | Dashboard stock aggregate and current-stock report |
| §27 | Pending distribution requests | ✅ | Dashboard metric |
| §27 | Pending procurement approvals | ✅ | Dashboard metric |
| §27 | Pending reconciliation approvals | ✅ | Dashboard metric |
| §27 | Recent movements | 🔶 | Ledger exists, but dashboard does not show a recent-movement panel |
| §27 | Import jobs and failures | 🔶 | Import center lists jobs; dashboard does not show a failure summary |
| §27 | Low-stock indicators | ❌ | No configured threshold or low-stock dashboard/list indicator |
| §28 | Product/variant listing | ✅ | Inventory list includes SKU, attributes, unit and on-hand quantity |
| §28 | Search/filtering | ⚠ | Search covers SKU/name/size/color/brand; no category filter and 200-row cap has no pagination |
| §28 | Stock movement history per item | ✅ | Item detail ledger with discrepancy check and pagination |
| §28 | Procurement history | ✅ | Filtered/paginated procurement page |
| §28 | Distribution history | ✅ | Filtered/paginated distribution page |
| §28 | Reconciliation history | ✅ | Filtered/paginated reconciliation page |
| §28 | Import history | ✅ | Import center and import detail pages |
| §29 | Current stock export | ✅ | CSV route |
| §29 | Stock movement ledger export | ✅ | CSV route |
| §29 | Other reports | 🔶 | No broader analytics/report builder |
| §29 | Exports respect permissions | ⚠ | Routes require authentication, but dedicated export authorization tests are missing |

---

## Part J — Database

| BRD Ref | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| §30 | Reuse existing models | ✅ | Prisma schema contains the implemented domain models |
| §30 | Verify unique constraints | ⚠ | SKU, import idempotency and movement idempotency are unique; variant/source transaction uniqueness is missing |
| §30 | Test migrations against a copy | ❌ | No Prisma migrations directory/baseline exists |
| §31 | ImportJob and ImportRow models | ✅ | Implemented with staged rows and relations |
| §31 | ReconciliationReview | ✅ | Implemented with before/target/variance/reason/reviewer/movement reference |
| §31 | ProcurementRecord and DistributionRecord | ✅ | Implemented with source, mode, approval and movement references |
| §32 | Authoritative stock ledger | ✅ | `StockMovement` is the ledger model |
| §32 | Atomic cache update with ledger | ✅ | Main stock-changing flows use transactions |
| §32 | Prevent concurrent overselling | ✅ | Locking and conditional updates |
| §32 | No mutation of posted movements | ⚠ | Hardening trigger exists only as standalone SQL, not as a managed migration |
| §32 | Non-negative quantity database constraint | ⚠ | Constraint exists only in standalone hardening SQL |

---

## Part K — UI/UX

| BRD Ref | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| §33 | Consistent role-aware navigation | ✅ | Shared app layout/sidebar |
| §33 | Responsive layouts | ⚠ | Basic mobile CSS exists; no automated or device-level review |
| §33 | Loading states | ❌ | No route-level or action loading UI |
| §33 | Error states | ⚠ | URL error messages and empty states exist; no toast/error-boundary pattern |
| §33 | Empty states | ✅ | List pages provide empty-state messages |
| §33 | Accessible labels | ⚠ | Many labels exist, but accessibility has not been comprehensively audited |
| §33 | Confirmation dialogs for stock/destructive operations | ❌ | No browser confirmation for approval, deletion or deactivation |
| §33 | Search, filtering and pagination | 🔶 | Operational history pages paginate; inventory list is capped at 200 without pagination |
| §34 | Import preview with match status and variance | ✅ | Import detail and approval queue show match/variance information |
| §34 | Completed approval detail | 🔶 | Pending queue is detailed; no dedicated completed approval detail route |

---

## Part L — Testing and delivery controls

| BRD Ref | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| §35 | Auth and role enforcement tests | ❌ | Server guards exist, but no automated auth/action tests |
| §35 | Self-approval tests | ❌ | Guard exists; no automated test |
| §35 | Import validator tests | ✅ | `npm test`: 57 parser/validator tests pass |
| §35 | Reconciliation/procurement/distribution integration tests | ❌ | Not implemented |
| §35 | Transaction rollback and concurrency tests | ❌ | Not implemented |
| §35 | Inventory CRUD tests | ❌ | Not implemented |
| §36 | Lint | ❌ | `package.json` has no lint script |
| §36 | Type check | ✅ | `npx tsc --noEmit` passes |
| §36 | Unit tests | ⚠ | Validator/workbook tests pass; business-unit coverage is incomplete |
| §36 | Integration tests | ❌ | No database-backed integration suite |
| §36 | Production build | ✅ | `npm run build` passes |
| §36 | Migration verification | ❌ | No migration baseline; `prisma migrate status` reports no migrations |
| §36 | 50k-row performance/memory test | ❌ | Not run |

---

## Prioritized backlog from this analysis

### P0 — correctness and release safety

- Create and verify a Prisma migration baseline, including non-negative quantity, non-zero movement, import mode checks and immutable `StockMovement`.
- Add database-backed tests for approval transactions, rollback, stale-balance detection, no-negative-stock, self-approval, idempotent retry and concurrency.
- Finish the `NEEDS_REVIEW` request queue and resolution UI.
- Define and implement stable external transaction IDs and cross-import conflict detection.

### P1 — workflow completeness

- Require an explicit reason for approved non-zero reconciliation adjustments, or document the accepted default-reason policy.
- Add completed reconciliation/procurement/distribution approval detail views with audit detail and reason.
- Add manual procurement entry if the BRD requires procurement outside Excel import.
- Add product-master CRUD and clarify the boundary between `Product` and `Item`.
- Add low-stock thresholds and dashboard indicators.

### P2 — usability and maintainability

- Add inventory pagination and category/attribute filters.
- Add confirmation dialogs and loading states.
- Add accessibility review and lint configuration.
- Add performance tests for large workbooks.
- Expand audit UI to display structured `AuditLog.detail`.
