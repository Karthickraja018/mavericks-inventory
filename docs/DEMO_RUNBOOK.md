# Mavericks Inventory — Manager Demo Runbook

This runbook provides a complete end-to-end demonstration of the Mavericks Inventory application. A full demo uses multiple roles because setup, request creation, and approval are intentionally separated.

## 1. Demo preparation

Start the application:

```powershell
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo accounts

All seeded accounts use the password `password123`.

| Account | Role | Demo purpose |
|---|---|---|
| `admin@mavericks.test` | ADMIN | Configure inventory, employees, users, and imports |
| `exec@mavericks.test` | EXECUTIVE | Create and submit distribution requests |
| `manager@mavericks.test` | MANAGER | Perform first-level approvals |
| `authority@mavericks.test` | AUTHORITY | Perform final approvals |

Use separate browser profiles or incognito windows to stay signed in as different users.

For the complete Manager → Authority flow, configure:

```text
APPROVAL_LEVELS=2
```

With `APPROVAL_LEVELS=1`, the Manager can complete final approval.

---

## 2. Role overview

| Role | Main capabilities |
|---|---|
| **EXECUTIVE** | View dashboard, inventory, stock, reports, and own requests. Create and submit distribution requests. |
| **MANAGER** | View all requests. Approve or reject Stage 1 requests. Approve or reject stock reconciliation and procurement approvals. |
| **AUTHORITY** | Perform Stage 2/final distribution approval. Approve or reject stock reconciliation and procurement approvals. |
| **ADMIN** | Manage inventory, employees, users, roles, imports, and audit history. |

Important controls:

- All authenticated roles can view the dashboard, inventory, operational pages, and reports.
- Only Admin can create, edit, activate/deactivate, or delete inventory items.
- Executives create requests; Managers and Authorities approve them.
- A user cannot approve their own request.
- Stock is deducted only during final approval.
- Stock-changing operations are recorded in the stock movement ledger and audit log.

---

## 3. Admin setup and inventory CRUD

Log in as:

```text
admin@mavericks.test
password123
```

### 3.1 Dashboard

Open **Overview** and show:

- Total inventory items
- Current stock
- Pending requests
- Recent activity
- Import activity, if available

Explain that this is the operational summary and that stock changes are supported by an auditable ledger.

### 3.2 Create an inventory item

Open **Inventory** and enter:

```text
SKU: DEMO-MUG-BLK
Name: Demo Coffee Mug
Size: N/A
Color: Black
Brand: Demo Brand
Unit: pcs
```

Click **Add item**.

Explain:

- SKU must be unique.
- New items start with zero stock.
- Creating an item does not create opening stock.
- Opening stock is established through approved reconciliation.

### 3.3 Read and inspect an item

The Inventory page displays:

- SKU
- Name
- Size
- Color
- Brand
- Unit
- On-hand quantity
- Active/inactive status

Click **Manage** beside the item to open its detail page and stock movement history.

### 3.4 Update an item

Change the name or brand and click **Save changes**. Return to Inventory and confirm the updated values.

### 3.5 Deactivate and reactivate an item

Click **Deactivate item**.

Return to Inventory. The item is hidden by default because only active items are shown.

Select **Show inactive** to display it, open the item, and click **Activate item**.

### 3.6 Delete behavior

An item with no operational history can be deleted.

Deletion is intentionally blocked when the item has:

- Stock movements
- Requests
- Procurement records
- Distribution records
- Reconciliation records
- Import references

Explain that items with history should be deactivated rather than deleted so inventory history is preserved.

---

## 4. Employee and user administration

### 4.1 Employees

Open **Employees** and demonstrate:

- Create an employee
- Edit employee details
- Activate or deactivate an employee

Explain that Recipient imports match existing employees by **Employee ID**. Employees are not automatically created during imports.

### 4.2 Users and roles

Open **Users** and demonstrate:

- Create a user
- Assign a role
- Edit user information
- Activate or deactivate a user

Explain that inactive users cannot log in and that permissions are enforced server-side, not only by hiding buttons.

---

## 5. Stock opening through reconciliation

This is the recommended way to create stock for the distribution demo.

### 5.1 Admin uploads a stock-count workbook

As Admin, open **Import Center**.

Select:

```text
Stock Count (reconciliation)
```

Upload:

```text
Stock_Count_Sample_Valid.xlsx
```

Click **Validate file**.

Explain:

- Uploading stages and validates the workbook only.
- No stock changes occur during upload.
- Headers, products, quantities, dates, and variant matching are checked.
- Invalid rows are reported without partially changing stock.

Open the import job and show:

- Total rows
- Valid rows
- Invalid rows
- Validation errors
- Import status
- Error CSV download

### 5.2 Manager approves reconciliation

Log in as:

```text
manager@mavericks.test
password123
```

Open **Approvals**. The stock-count import should appear under **Import approvals**.

Review:

- Current balance
- Counted target balance
- Variance
- Total increase
- Total decrease
- Procurement and distribution cross-check values

Enter a reason:

```text
Approved based on physical stock count for demo.
```

Click **Approve and post**.

Explain:

- The counted target becomes the official balance.
- An auditable reconciliation movement is posted.
- Zero-variance rows do not change stock.
- The operation can be reviewed later in the ledger.

Return to Inventory and show the updated quantity.

---

## 6. Procurement workflow

Procurement increases stock only after approval when using the New mode.

### 6.1 Historical procurement

As Admin, open **Import Center** and select:

```text
Procurement, historical
```

Upload:

```text
Procurement_Sample_Valid.xlsx
```

Validate and commit the valid import if the import detail page provides the **Commit** action.

Explain:

- Historical procurement preserves past records.
- Historical procurement does not increase current stock.
- Source dates and source rows are retained.
- Invalid product variants are rejected.

Open **Procurement** to show the historical record.

### 6.2 New procurement

Upload a valid procurement workbook using:

```text
Procurement, new
```

Prepare and commit the import.

The import enters an approval state such as:

```text
AWAITING_APPROVAL
```

Log in as Manager and open **Approvals**.

Review the file, uploader, valid rows, products, and quantities. Click **Approve and post**.

Explain:

- Uploading or committing the file does not immediately increase stock.
- Stock-in occurs only after approval.
- Procurement records and stock movements are written atomically.
- If approval fails, partial stock-in is not retained.

Return to Inventory and show the increased balance.

To demonstrate rejection, repeat the process with another New procurement import and click **Reject**. Enter a reason.

---

## 7. Distribution request workflow

This is the primary Manager approval flow.

### 7.1 Executive creates and submits a request

Log in as:

```text
exec@mavericks.test
password123
```

Open **Requests** and click **New request**.

Use an item with available stock:

```text
Purpose: New employee onboarding
Quantity: 2
```

#### Save a draft

Click **Save draft**. The request remains in `DRAFT`.

Explain that the Executive can review the request before submitting it.

#### Submit for approval

Open the draft and click **Submit for approval**.

The status becomes:

```text
PENDING_MANAGER
```

The Executive can see the request status but cannot approve it.

### 7.2 Manager performs Stage 1 approval

Log in as:

```text
manager@mavericks.test
password123
```

Open **Approvals** and review:

- Request number
- Requester
- Purpose
- Requested quantity
- Current stock

Click **Approve**.

With two-level approval enabled, the status becomes:

```text
PENDING_AUTHORITY
```

Explain:

- The Manager is the first approval stage.
- Stock is not deducted yet.
- The Manager cannot approve their own request.
- Rejection requires remarks.

To demonstrate rejection, create another request and reject it with:

```text
Quantity is outside the current business requirement.
```

The request becomes `REJECTED`.

### 7.3 Authority performs final approval

Log in as:

```text
authority@mavericks.test
password123
```

Open **Approvals** and approve the request.

The request becomes:

```text
APPROVED
```

At final approval:

- Stock is deducted.
- A `DISTRIBUTION_OUT` movement is recorded.
- The resulting balance is stored.
- The operation is audited.
- The transaction is atomic.

Return to Inventory and show the reduced balance. Open the item’s **History** page to show the movement ledger.

---

## 8. Insufficient stock and `NEEDS_REVIEW`

This is a useful exception flow for demonstrating controls.

### 8.1 Create an oversized request

As Executive, create a request for more units than are available:

```text
Purpose: Insufficient stock demo
Quantity: 9999
```

Submit it.

### 8.2 Approve through the stages

As Manager, approve Stage 1. If two-level approval is enabled, log in as Authority and attempt final approval.

The system should:

- Detect insufficient stock.
- Deduct nothing.
- Roll back any partial deductions.
- Mark the request as `NEEDS_REVIEW`.
- Record the review reason.

Explain that this prevents negative inventory balances.

If the review-resolution interface is available, demonstrate:

- **Requeue** — sends the request back to `PENDING_MANAGER`.
- **Reject** — rejects it permanently and requires remarks.

---

## 9. Recipient imports

Recipient imports are controlled by Admin.

### 9.1 Historical Recipient import

As Admin, open **Import Center** and select:

```text
Recipient, historical
```

Upload:

```text
Recipient_Sample_Valid.xlsx
```

Validate and commit.

Explain:

- Employee ID is the primary match.
- Name and base location are validation fields.
- Employees are not automatically created.
- Historical records do not deduct current stock.
- Source information is retained for traceability.

### 9.2 New Recipient import

Select:

```text
Recipient, new
```

Upload:

```text
Recipient_Sample_With_Quantity.xlsx
```

Validate and commit.

Explain:

- The import creates pending distribution requests.
- It does not deduct stock at commit time.
- Requests follow the normal Manager/Authority approval workflow.
- Stock is deducted only after final approval.

Log in as Manager and show the generated requests in **Approvals**.

---

## 10. Reports and audit trail

### 10.1 Current stock report

Open **Reports** and download **Current stock**.

This report contains active product variants and their current ledger-maintained balances.

### 10.2 Stock movement ledger

Download **Stock movement ledger**.

Show that it contains:

- Movement date
- Item
- Quantity change
- Balance after movement
- Movement type
- Source reference
- Actor
- Approval reference

Use this to prove that reconciliation, procurement, and distribution are traceable.

### 10.3 Admin audit log

Log in as Admin and open **Audit log**.

Show events such as:

- Login
- Item created
- Item updated
- Request submitted
- Request approved
- Request rejected
- Procurement approved
- Reconciliation approved
- Stock movement posted

---

## 11. Recommended 20-minute manager demo

Use this sequence when time is limited:

1. Log in as Admin.
2. Show the Dashboard.
3. Open Inventory and create one item.
4. Upload a valid Stock Count workbook.
5. Log in as Manager.
6. Approve the reconciliation and show stock increasing.
7. Log in as Executive.
8. Create and submit a distribution request.
9. Log in as Manager.
10. Approve Stage 1.
11. Log in as Authority.
12. Approve the final stage.
13. Show stock decreasing.
14. Open the item History page.
15. Download the stock movement ledger.
16. Log in as Admin and show the Audit Log.
17. Optionally demonstrate insufficient stock → `NEEDS_REVIEW`.

---

## 12. Manager capability summary

### The Manager can

- View the dashboard, inventory, requests, operations, and reports.
- View all requests.
- Approve or reject Stage 1 distribution requests.
- Approve or reject stock reconciliation imports.
- Approve or reject new procurement stock-in.
- View current stock and ledger data.
- Resolve insufficient-stock requests where the resolution UI is available.

### The Manager cannot

- Create or edit inventory items.
- Delete or deactivate inventory items.
- Upload imports.
- Manage users.
- Manage employees.
- View the Admin import center.
- Perform final Stage 2 approval when two-level approval is enabled.

The full demo therefore uses Admin for setup/imports, Executive for request creation, Manager for first-level approvals, and Authority for final approvals.
