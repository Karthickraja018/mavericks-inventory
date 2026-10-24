# Mavericks Inventory
1. `cp .env.example .env` (set DATABASE_URL, AUTH_SECRET; APPROVAL_LEVELS=1 or 2)
2. `npm install && npx prisma migrate dev --name init && npm run seed`
3. `npm run dev` → http://localhost:3000

Seed logins (password `password123`): admin@ / exec@ / manager@ / authority@ `mavericks.test`.
Stock is deducted only on final approval, in one DB transaction (conditional UPDATE, all-or-nothing).
