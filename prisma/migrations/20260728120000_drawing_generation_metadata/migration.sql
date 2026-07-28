-- AlterTable
ALTER TABLE "teams" ADD COLUMN "seed_rank" INTEGER;

-- AlterTable
ALTER TABLE "drawing_versions" ADD COLUMN "placement_mode" VARCHAR(20) NOT NULL DEFAULT 'random';
ALTER TABLE "drawing_versions" ADD COLUMN "prng_algorithm" VARCHAR(50);
ALTER TABLE "drawing_versions" ADD COLUMN "engine_version" VARCHAR(50) NOT NULL DEFAULT 'drawing-engine-v1';
ALTER TABLE "drawing_versions" ADD COLUMN "generation_duration_ms" INTEGER;

-- Drop defaults used only for backfill of empty tables (fresh env has no versions yet)
ALTER TABLE "drawing_versions" ALTER COLUMN "placement_mode" DROP DEFAULT;
ALTER TABLE "drawing_versions" ALTER COLUMN "engine_version" DROP DEFAULT;

-- Partial unique: one seed_rank per active team in a category
CREATE UNIQUE INDEX "uq_teams_category_seed_rank"
ON "teams" ("category_id", "seed_rank")
WHERE "deleted_at" IS NULL AND "seed_rank" IS NOT NULL;
