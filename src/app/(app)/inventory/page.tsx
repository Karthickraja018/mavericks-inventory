import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { InventoryView } from "./inventory-view";
import { Boxes, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { q?: string; error?: string; success?: string; stock?: string };
}) {
  const u = await requireUser();

  const [itemsRaw, categoriesGroup, stockAgg] = await Promise.all([
    db.item.findMany({
      orderBy: { sku: "asc" },
      take: 500,
    }),
    db.item.findMany({
      select: { category: true },
      distinct: ["category"],
      where: { active: true },
    }),
    db.item.aggregate({
      _sum: { quantity: true },
      where: { active: true },
    }),
  ]);

  const items = itemsRaw.map((i) => ({
    id: i.id,
    sku: i.sku,
    name: i.name,
    size: i.size,
    color: i.color,
    brand: i.brand,
    category: i.category,
    unit: i.unit,
    quantity: Number(i.quantity),
    active: i.active,
  }));

  const totalVariants = items.length;
  const inStockCount = items.filter((i) => i.active && i.quantity > 10).length;
  const lowStockCount = items.filter((i) => i.active && i.quantity > 0 && i.quantity <= 10).length;
  const zeroStockCount = items.filter((i) => i.active && i.quantity <= 0).length;
  const totalUnits = Number(stockAgg._sum.quantity ?? 0);

  const categories = categoriesGroup.map((c) => c.category).filter(Boolean);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Master catalog of product variants, live on-hand quantities, and ledger-backed movement tracking."
        breadcrumbs={[
          { label: "Workspace", href: "/" },
          { label: "Inventory" },
        ]}
      />

      {searchParams.error && <div className="err">{searchParams.error}</div>}
      {searchParams.success && <div className="ok">{searchParams.success}</div>}

      {/* KPI Cards Grid */}
      <div className="grid" style={{ marginBottom: 16 }}>
        <KpiCard
          label="Active Variants"
          value={totalVariants}
          subtext={`${totalUnits.toLocaleString()} total units on hand`}
          icon={Boxes}
        />
        <KpiCard
          label="In Stock (&gt;10 units)"
          value={inStockCount}
          subtext="Healthy inventory levels"
          variant="success"
          icon={CheckCircle2}
        />
        <KpiCard
          label="Low Stock (1-10 units)"
          value={lowStockCount}
          subtext="Reorder / replenishment required"
          variant={lowStockCount > 0 ? "warning" : "default"}
          icon={AlertTriangle}
        />
        <KpiCard
          label="Out of Stock (0 units)"
          value={zeroStockCount}
          subtext="Zero available units"
          variant={zeroStockCount > 0 ? "danger" : "default"}
          icon={XCircle}
        />
      </div>

      {/* Main Interactive Inventory Workspace */}
      <InventoryView
        items={items}
        userRole={u.role}
        categories={categories}
        initialQuery={searchParams.q}
        initialStockFilter={searchParams.stock}
      />
    </>
  );
}
