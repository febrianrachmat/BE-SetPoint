-- Courts need an explicit order: label sorting breaks once a tournament has
-- "Court 10" alongside "Court 2".
ALTER TABLE "courts" ADD COLUMN "display_order" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows so current label ordering is preserved.
WITH ordered AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "tournament_id"
            ORDER BY "label" ASC, "created_at" ASC
        ) - 1 AS "position"
    FROM "courts"
)
UPDATE "courts"
SET "display_order" = ordered."position"
FROM ordered
WHERE "courts"."id" = ordered."id";

CREATE INDEX "idx_courts_tournament_order" ON "courts"("tournament_id", "display_order");
