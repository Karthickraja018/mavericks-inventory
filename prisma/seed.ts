import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  const users: [string, string, Role][] = [["Ava Admin","admin@mavericks.test","ADMIN"],["Eli Executive","exec@mavericks.test","EXECUTIVE"],["Mia Manager","manager@mavericks.test","MANAGER"],["Ari Authority","authority@mavericks.test","AUTHORITY"]];
  for (const [name, email, role] of users) await db.user.upsert({ where: { email }, update: {}, create: { name, email, role, passwordHash } });
  for (const [sku, name, qty] of [["SKU-001","A4 Paper Ream",500],["SKU-002","Safety Gloves",120],["SKU-003","Label Printer Roll",40]] as const) {
    const it = await db.item.upsert({ where: { sku }, update: {}, create: { sku, name } });
    // Dev-only convenience (SEED_DEV_STOCK=1): ledger-consistent, labelled. Real opening stock goes through approved reconciliation.
    if (process.env.SEED_DEV_STOCK === "1" && !(await db.stockMovement.count({ where: { itemId: it.id } }))) {
      const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@mavericks.test" } });
      await db.$transaction([db.item.update({ where: { id: it.id }, data: { quantity: qty } }),
        db.stockMovement.create({ data: { itemId: it.id, change: qty, balanceAfter: qty, type: "OPENING", actorId: admin.id, sourceType: "DEV_SEED", reason: "DEV SEED - not for production" } })]);
    }
  }
}
main().finally(() => db.$disconnect());
