import Link from "next/link";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Reports() {
  await requireUser();
  return (
    <>
      <h1>Reports and exports</h1>
      <div className="grid">
        <div className="card">
          <h2>Current stock</h2>
          <p>One row per active product variant with its ledger-maintained balance.</p>
          <Link href="/reports/stock.csv"><button>Download CSV</button></Link>
        </div>
        <div className="card">
          <h2>Stock movement ledger</h2>
          <p>Auditable movements with source references, actors, and balances.</p>
          <Link href="/reports/ledger.csv"><button>Download CSV</button></Link>
        </div>
      </div>
    </>
  );
}
