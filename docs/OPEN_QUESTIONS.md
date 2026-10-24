# Mavericks Inventory — Open Questions

Numbering 1–20 follows the supplied list (full wording in Appendix A). 21+ are new. **Status:** OPEN · PROPOSED (answer supplied, awaiting confirmation) · RESOLVED (by confirmed decision).
**Gate** = the first implementation gate this question blocks.

| # | Pri | Status | Topic | Gate | Note |
|---|---|---|---|---|---|
| 1 | P0 | PROPOSED | Initial stock scope | 4 | PBD-01 global; conflicts with IMP-002 wording |
| 2 | P0 | PROPOSED | Definition of empty system | 4 | PBD-01: no stock transactions in the ledger. Confirm "transactions" vs "balance" |
| 3 | P1 | OPEN | Meaning of Procured / Distributed Qty | 4 | Cross-check warnings only; does not block posting |
| 4 | P0 | PROPOSED | Variance sign | 4 | PBD-02 |
| 5 | P0 | OPEN | Approver roles | 4 | No-self-approval proposed (PBD-02); roles undefined |
| 6 | P0 | PROPOSED | Historical ledger treatment | 3 | PBD-04/06; no reconstruction path to be built |
| 7 | P0 | OPEN | Duplicate identity | 3 | Needs source IDs (same as 17) |
| 8 | P0 | OPEN | Recipient status values | 3 | Only `Distributed` seen |
| 9 | P0 | PROPOSED | Employee mismatch policy | 3 | PBD-10 block |
| 10 | P0 | OPEN | Transaction size at 50,000 rows | 5 | Prove before choosing strategy (benchmark spike) |
| 11 | P1 | OPEN | Quantity precision | 2 | Validator integer-only by default; storage unchanged |
| 12 | P1 | OPEN | Date/timezone formats | 2 | |
| 13 | P1 | OPEN | Source file retention | 2 | |
| 14 | P1 | OPEN | Reason codes | 4 | Free-text reason required regardless |
| 15 | **P0** | OPEN | `NA` vs blank canonical form | 1 | Variant uniqueness depends on it (NULLs are distinct in Postgres) |
| 16 | P1 | OPEN | Base Location meaning | 3 | |
| 17 | **P0** | OPEN | Source record IDs in workbooks | 3 | Needs sample files |
| 18 | P1 | OPEN | Reversal workflow | 6 | |
| 19 | **P0** | OPEN | Import permissions by role | 2 | Upload, validate, commit, approve, view errors, download |
| 20 | P1 | OPEN | Meaning of Available (counted vs calculated) | 4 | |
| 21 | P0 | OPEN | Meaning of "Product Details" and "Size / Quantity" columns | 1 | Defines variant identity |
| 22 | P0 | OPEN | Mapping existing SKU items to variants | 1 | Needs real data |
| 23 | P0 | PROPOSED | New procurement needs approval | 5 | PBD-05; confirm |
| 24 | P0 | OPEN | Reconciliation approval per variant or per file; effect of a rejected subset on the file | 4 | |
| 25 | P0 | OPEN | Recipient file → Request grouping, requester identity, meaning of "committed" | 5 | |
| 26 | P1 | PROPOSED | Reconciliation approval levels | 4 | PBD-15, one level |
| 27 | P0 | OPEN | `NEEDS_REVIEW` reviewer role, assignment, outcomes, retry | 5 | PBD-16 gives behaviour but not roles |
| 28 | P0 | OPEN | Does the database hold real data; schema and migration state | 1 | Requires user to provide |
| 29 | P1 | PROPOSED | Absent variants in Stock Count | 4 | PBD-13; report format open |
| 30 | P0 | OPEN | How products/variants are created before import (UI, master import) | 2 | No mechanism exists |
| 31 | P0 | OPEN | Procurement approval roles, levels, per file or per row | 5 | |
| 32 | P0 | OPEN | Recipient `Quantity` column and template versioning; quantity for historical rows | 2 | PBD-14 |
| 33 | P1 | OPEN | Transitional handling of `createItem` opening stock and seed data | 1 | PTD-10 |

## Guard rails (carried forward)
- Do not choose an answer for any OPEN item.
- PROPOSED items are not authorisation to build stock-changing code.
- Atomic file commit must still be reconciled with per-row approvals (24, 31) before Gate 4.

---
# Appendix A — Supplied open questions (verbatim)

# Mavericks Inventory — Open Questions and Conflicts

These items remain unresolved and must not be silently decided by the implementation agent.

## P0 — Resolve before stock-affecting import implementation

1. **Stock Count when a variant has no ledger history but the system has some inventory data:** The confirmed rule permits establishing initial stock when the system is empty. Clarify whether this means the entire inventory database is empty, or whether a specific variant with no ledger entries can be initialized independently.
2. **Definition of “system is empty”:** Is this global (no inventory ledger transactions at all) or per product variant? Recommended: define it precisely and enforce it in code.
3. **Meaning of imported `Procured` and `Distributed Qty`:** Confirm whether they are cumulative historical totals, period totals, or current snapshot totals. They are cross-checks only and must not independently post stock.
4. **Variance sign and adjustment semantics:** Confirm the exact rule: `variance = imported Available - ledger Available`; positive means stock increase, negative means stock decrease. Approval required for either direction.
5. **Approver role and separation of duties:** Which role(s) can approve reconciliation adjustments? Can the requester approve their own adjustment? Existing project decision says self-approval is forbidden; confirm it applies to reconciliation imports and all approval stages.
6. **Historical procurement/distribution ledger treatment:** Confirm whether historical modes create business-history records only, or whether there is a separate one-time migration path that reconstructs ledger transactions. Default remains no stock effect.
7. **Duplicate identity:** The current decision says reject duplicates, but the reliable key for historical records is not defined. Confirm available procurement/distribution reference IDs or define a deterministic duplicate-detection policy. Product + date + quantity alone may incorrectly classify legitimate repeated transactions as duplicates.
8. **Recipient status allowed values:** The screenshot shows `Distributed`, but the full allowed status list and mapping to workflow states are unconfirmed.
9. **Historical employee mismatch policy:** If Emp ID matches but name or base location differs, should the row be blocked for correction or held for manual review? Recommended: block commit until resolved.
10. **All-or-nothing transaction size:** Large imports (e.g. tens of thousands of rows) can create long-running database transactions. Confirm whether all rows must share one database transaction, or whether an atomic import can be implemented through a staged, journaled commit mechanism that guarantees no visible partial business result. The business requirement remains all-or-nothing.

## P1 — Resolve before production readiness

11. **Quantity precision and units:** Are all quantities whole units? Is fractional quantity ever valid?
12. **Date and timezone policy:** Confirm accepted Excel date formats and timezone assumptions.
13. **Source file retention:** How long should uploaded files, previews and error reports be retained, and who may access them?
14. **Reconciliation reason codes:** Define mandatory reason codes (e.g. physical count, damage, loss, correction) and whether free-text notes are required.
15. **Product variant normalization:** Confirm canonical treatment of `NA`, blanks, capitalization, brand spelling and size values. Define whether `NA` and blank mean the same thing.
16. **Inventory location:** MVP is assumed to have one location. Confirm whether Base Location is employee metadata only or has any inventory-location significance.
17. **Historical import identifiers:** Confirm whether the source workbook has unique record IDs beyond row numbers. Row numbers are not stable identifiers across changed files.
18. **Import cancellation and rollback after commit:** The file transaction can roll back on commit failure. A later business correction should normally use compensating ledger transactions; confirm whether users need a formal reversal workflow.
19. **Permissions for imports:** Confirm which roles may upload, validate, commit, approve reconciliation, view error rows and download source files.
20. **Stock Count template semantics:** Confirm whether `Available` is expected to represent a physically counted balance or a calculated balance supplied by the business. The import requirement treats it as the target, but the source of that target must be explicit.

## Potential conflicts to guard against

- **Initial stock vs. empty-system condition:** If “empty” is global, an import containing one existing variant and one new variant may require a mixed outcome. Define whether this is allowed; atomic commit means either the entire file succeeds or none of it does.
- **Historical imports vs. duplicate rejection:** If there is no stable source transaction ID, deterministic duplicate detection may be imperfect. Do not invent a composite key without approval.
- **All-or-nothing vs. large files:** A single very large transaction can stress database locks and timeouts. Any optimization must preserve the no-partial-business-commit guarantee.
- **Stock Count cross-checks:** `Procured` and `Distributed Qty` may not reconcile with ledger totals if they are cumulative totals from a different date range. Show warnings; do not alter stock from those fields.
- **Self-approval:** If the existing workflow prohibits self-approval, apply the same control to reconciliation approvals unless explicitly overridden.
