-- Append to a migration created with: npx prisma migrate dev --create-only --name hardening
ALTER TABLE "Item" ADD CONSTRAINT item_qty_nonneg CHECK (quantity >= 0);
ALTER TABLE "StockMovement" ADD CONSTRAINT mv_nonzero CHECK ("change" <> 0);
ALTER TABLE "ImportJob" ADD CONSTRAINT job_type_mode CHECK ((type = 'STOCK_COUNT' AND mode = 'RECONCILIATION') OR (type IN ('PROCUREMENT','RECIPIENT') AND mode IN ('HISTORICAL','NEW')));
CREATE FUNCTION forbid_ledger_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'StockMovement is append-only'; END $$ LANGUAGE plpgsql;
CREATE TRIGGER stockmovement_immutable BEFORE UPDATE OR DELETE ON "StockMovement" FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();
