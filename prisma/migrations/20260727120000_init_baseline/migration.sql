-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "tournament_status" AS ENUM ('draft', 'setup', 'published', 'live', 'finished', 'archived');

-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('waiting', 'warm_up', 'live', 'finished', 'verified');

-- CreateEnum
CREATE TYPE "version_status" AS ENUM ('candidate', 'official', 'historical');

-- CreateEnum
CREATE TYPE "publish_state" AS ENUM ('unpublished', 'published');

-- CreateEnum
CREATE TYPE "lock_state" AS ENUM ('unlocked', 'locked');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "visibility" AS ENUM ('private', 'public');

-- CreateEnum
CREATE TYPE "court_status" AS ENUM ('available', 'unavailable', 'maintenance');

-- CreateEnum
CREATE TYPE "team_status" AS ENUM ('active', 'withdrawn');

-- CreateEnum
CREATE TYPE "player_status" AS ENUM ('active', 'replaced', 'inactive');

-- CreateEnum
CREATE TYPE "eligibility_status" AS ENUM ('eligible', 'ineligible');

-- CreateEnum
CREATE TYPE "qualification_status" AS ENUM ('qualified', 'not_qualified');

-- CreateEnum
CREATE TYPE "result_status" AS ENUM ('pending', 'normal', 'cancelled', 'abandoned', 'corrected');

-- CreateEnum
CREATE TYPE "assignment_status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "conflict_status" AS ENUM ('unknown', 'clear', 'conflict');

-- CreateEnum
CREATE TYPE "declaration_status" AS ENUM ('declared');

-- CreateEnum
CREATE TYPE "artifact_type" AS ENUM ('drawing', 'schedule', 'playoff', 'bracket');

-- CreateTable
CREATE TABLE "tournaments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "tournament_status" NOT NULL DEFAULT 'draft',
    "registration_open_at" TIMESTAMPTZ(6),
    "registration_close_at" TIMESTAMPTZ(6),
    "start_at" TIMESTAMPTZ(6),
    "end_at" TIMESTAMPTZ(6),
    "visibility" "visibility" NOT NULL DEFAULT 'private',
    "publish_state" "publish_state" NOT NULL DEFAULT 'unpublished',
    "published_at" TIMESTAMPTZ(6),
    "published_by" UUID,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tournament_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "status" "court_status" NOT NULL DEFAULT 'available',
    "availability_notes" TEXT,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tournament_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "visibility" "visibility" NOT NULL DEFAULT 'public',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "galleries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tournament_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "visibility" "visibility" NOT NULL DEFAULT 'public',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "galleries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gallery_id" UUID NOT NULL,
    "media_title" VARCHAR(200),
    "media_reference" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "visibility" "visibility" NOT NULL DEFAULT 'public',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "gallery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tournament_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "format" VARCHAR(100) NOT NULL,
    "visibility" "visibility" NOT NULL DEFAULT 'private',
    "publish_state" "publish_state" NOT NULL DEFAULT 'unpublished',
    "published_at" TIMESTAMPTZ(6),
    "published_by" UUID,
    "lock_state" "lock_state" NOT NULL DEFAULT 'unlocked',
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" UUID,
    "unlock_reason" TEXT,
    "unlocked_at" TIMESTAMPTZ(6),
    "unlocked_by" UUID,
    "configuration" JSONB,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "withdrawal_flag" BOOLEAN NOT NULL DEFAULT false,
    "withdrawal_reason" TEXT,
    "status" "team_status" NOT NULL DEFAULT 'active',
    "eligibility_status" "eligibility_status" NOT NULL DEFAULT 'ineligible',
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "replacement_flag" BOOLEAN NOT NULL DEFAULT false,
    "status" "player_status" NOT NULL DEFAULT 'active',
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "current_official_version_id" UUID,
    "review_status" "review_status" NOT NULL DEFAULT 'pending',
    "publish_state" "publish_state" NOT NULL DEFAULT 'unpublished',
    "published_at" TIMESTAMPTZ(6),
    "published_by" UUID,
    "lock_state" "lock_state" NOT NULL DEFAULT 'unlocked',
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" UUID,
    "unlock_reason" TEXT,
    "unlocked_at" TIMESTAMPTZ(6),
    "unlocked_by" UUID,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "drawings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawing_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "drawing_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "drawing_seed" VARCHAR(128) NOT NULL,
    "official_flag" BOOLEAN NOT NULL DEFAULT false,
    "generation_source" VARCHAR(50) NOT NULL DEFAULT 'engine',
    "version_status" "version_status" NOT NULL DEFAULT 'candidate',
    "review_outcome" "review_status",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "drawing_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "current_official_version_id" UUID,
    "review_status" "review_status" NOT NULL DEFAULT 'pending',
    "publish_state" "publish_state" NOT NULL DEFAULT 'unpublished',
    "published_at" TIMESTAMPTZ(6),
    "published_by" UUID,
    "lock_state" "lock_state" NOT NULL DEFAULT 'unlocked',
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" UUID,
    "unlock_reason" TEXT,
    "unlocked_at" TIMESTAMPTZ(6),
    "unlocked_by" UUID,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "schedule_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "official_flag" BOOLEAN NOT NULL DEFAULT false,
    "generation_source" VARCHAR(50) NOT NULL DEFAULT 'engine',
    "version_status" "version_status" NOT NULL DEFAULT 'candidate',
    "review_outcome" "review_status",
    "conflict_status" "conflict_status" NOT NULL DEFAULT 'unknown',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "schedule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "drawing_version_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(50),
    "publish_state" "publish_state" NOT NULL DEFAULT 'unpublished',
    "published_at" TIMESTAMPTZ(6),
    "published_by" UUID,
    "lock_state" "lock_state" NOT NULL DEFAULT 'unlocked',
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" UUID,
    "unlock_reason" TEXT,
    "unlocked_at" TIMESTAMPTZ(6),
    "unlocked_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "drawing_version_id" UUID NOT NULL,
    "placement_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "group_id" UUID,
    "playoff_id" UUID,
    "bracket_id" UUID,
    "schedule_version_id" UUID,
    "court_id" UUID,
    "bracket_position" VARCHAR(50),
    "scheduled_start_at" TIMESTAMPTZ(6),
    "actual_start_at" TIMESTAMPTZ(6),
    "actual_end_at" TIMESTAMPTZ(6),
    "cancellation_flag" BOOLEAN NOT NULL DEFAULT false,
    "abandonment_flag" BOOLEAN NOT NULL DEFAULT false,
    "exception_reason" TEXT,
    "status" "match_status" NOT NULL DEFAULT 'waiting',
    "result_status" "result_status" NOT NULL DEFAULT 'pending',
    "publish_visibility" "visibility" NOT NULL DEFAULT 'private',
    "score_representation" JSONB,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_participations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "side_label" VARCHAR(20) NOT NULL,
    "player_composition_snapshot" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "group_id" UUID,
    "team_id" UUID NOT NULL,
    "rank_position" INTEGER,
    "matches_played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "tie_break_notes" TEXT,
    "last_recalculated_at" TIMESTAMPTZ(6),
    "qualification_status" "qualification_status" NOT NULL DEFAULT 'not_qualified',
    "publish_state" "publish_state" NOT NULL DEFAULT 'unpublished',
    "published_at" TIMESTAMPTZ(6),
    "published_by" UUID,
    "lock_state" "lock_state" NOT NULL DEFAULT 'unlocked',
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" UUID,
    "unlock_reason" TEXT,
    "unlocked_at" TIMESTAMPTZ(6),
    "unlocked_by" UUID,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "standings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "schedule_version_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "court_id" UUID,
    "scheduled_start_at" TIMESTAMPTZ(6) NOT NULL,
    "scheduled_end_at" TIMESTAMPTZ(6),
    "sequence_order" INTEGER NOT NULL,
    "reschedule_flag" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playoffs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "current_official_bracket_id" UUID,
    "qualification_basis" TEXT,
    "review_status" "review_status" NOT NULL DEFAULT 'pending',
    "publish_state" "publish_state" NOT NULL DEFAULT 'unpublished',
    "published_at" TIMESTAMPTZ(6),
    "published_by" UUID,
    "lock_state" "lock_state" NOT NULL DEFAULT 'unlocked',
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" UUID,
    "unlock_reason" TEXT,
    "unlocked_at" TIMESTAMPTZ(6),
    "unlocked_by" UUID,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "playoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brackets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "playoff_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "official_flag" BOOLEAN NOT NULL DEFAULT false,
    "generation_source" VARCHAR(50) NOT NULL DEFAULT 'engine',
    "version_status" "version_status" NOT NULL DEFAULT 'candidate',
    "publish_state" "publish_state" NOT NULL DEFAULT 'unpublished',
    "published_at" TIMESTAMPTZ(6),
    "published_by" UUID,
    "lock_state" "lock_state" NOT NULL DEFAULT 'unlocked',
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" UUID,
    "unlock_reason" TEXT,
    "unlocked_at" TIMESTAMPTZ(6),
    "unlocked_by" UUID,
    "structure_representation" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "champions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "playoff_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "winning_team_id" UUID NOT NULL,
    "declaration_status" "declaration_status" NOT NULL DEFAULT 'declared',
    "declared_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "declared_by" UUID,

    CONSTRAINT "champions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "artifact_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "reviewer_id" UUID,
    "notes" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "artifact_type" "artifact_type" NOT NULL,
    "status" "review_status" NOT NULL DEFAULT 'pending',
    "decision" "review_status",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referee_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID NOT NULL,
    "referee_id" UUID NOT NULL,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMPTZ(6),
    "assignment_status" "assignment_status" NOT NULL DEFAULT 'active',

    CONSTRAINT "referee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tournament_id" UUID,
    "actor_id" UUID,
    "affected_entity_id" UUID NOT NULL,
    "related_version_id" UUID,
    "action_type" VARCHAR(100) NOT NULL,
    "affected_entity_type" VARCHAR(100) NOT NULL,
    "reason" TEXT,
    "previous_official_state" JSONB,
    "new_official_state" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tournament_id" UUID,
    "related_entity_id" UUID,
    "event_type" VARCHAR(100) NOT NULL,
    "related_entity_type" VARCHAR(100),
    "event_meaning" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_tournaments_status" ON "tournaments"("status");

-- CreateIndex
CREATE INDEX "idx_courts_tournament" ON "courts"("tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_galleries_tournament" ON "galleries"("tournament_id");

-- CreateIndex
CREATE INDEX "idx_categories_tournament" ON "categories"("tournament_id");

-- CreateIndex
CREATE INDEX "idx_teams_category" ON "teams"("category_id");

-- CreateIndex
CREATE INDEX "idx_players_team" ON "players"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_drawings_category" ON "drawings"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "drawings_current_official_version_id_key" ON "drawings"("current_official_version_id");

-- CreateIndex
CREATE INDEX "idx_drawing_versions_drawing" ON "drawing_versions"("drawing_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_drawing_versions_number" ON "drawing_versions"("drawing_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_schedules_category" ON "schedules"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_current_official_version_id_key" ON "schedules"("current_official_version_id");

-- CreateIndex
CREATE INDEX "idx_schedule_versions_schedule" ON "schedule_versions"("schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_schedule_versions_number" ON "schedule_versions"("schedule_id", "version_number");

-- CreateIndex
CREATE INDEX "idx_groups_category" ON "groups"("category_id");

-- CreateIndex
CREATE INDEX "idx_groups_drawing_version" ON "groups"("drawing_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_groups_version_name" ON "groups"("drawing_version_id", "name");

-- CreateIndex
CREATE INDEX "idx_group_members_team" ON "group_members"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_group_members_group_team" ON "group_members"("group_id", "team_id");

-- CreateIndex
CREATE INDEX "idx_matches_category" ON "matches"("category_id");

-- CreateIndex
CREATE INDEX "idx_matches_status" ON "matches"("status");

-- CreateIndex
CREATE INDEX "idx_matches_court" ON "matches"("court_id");

-- CreateIndex
CREATE INDEX "idx_matches_group" ON "matches"("group_id");

-- CreateIndex
CREATE INDEX "idx_matches_playoff" ON "matches"("playoff_id");

-- CreateIndex
CREATE INDEX "idx_matches_category_status" ON "matches"("category_id", "status");

-- CreateIndex
CREATE INDEX "idx_match_participations_team" ON "match_participations"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_participations_match_side" ON "match_participations"("match_id", "side_label");

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_participations_match_team" ON "match_participations"("match_id", "team_id");

-- CreateIndex
CREATE INDEX "idx_standings_category" ON "standings"("category_id");

-- CreateIndex
CREATE INDEX "idx_standings_team" ON "standings"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_standings_category_team_group" ON "standings"("category_id", "team_id", "group_id");

-- CreateIndex
CREATE INDEX "idx_schedule_entries_version" ON "schedule_entries"("schedule_version_id");

-- CreateIndex
CREATE INDEX "idx_schedule_entries_court_time" ON "schedule_entries"("court_id", "scheduled_start_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_schedule_entries_version_match" ON "schedule_entries"("schedule_version_id", "match_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_playoffs_category" ON "playoffs"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "playoffs_current_official_bracket_id_key" ON "playoffs"("current_official_bracket_id");

-- CreateIndex
CREATE INDEX "idx_brackets_playoff" ON "brackets"("playoff_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_brackets_playoff_number" ON "brackets"("playoff_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_champions_playoff" ON "champions"("playoff_id");

-- CreateIndex
CREATE INDEX "idx_reviews_artifact" ON "reviews"("artifact_type", "artifact_id");

-- CreateIndex
CREATE INDEX "idx_referee_assignments_referee" ON "referee_assignments"("referee_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_tournament_time" ON "audit_logs"("tournament_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_event_logs_tournament_time" ON "event_logs"("tournament_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "courts" ADD CONSTRAINT "courts_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_gallery_id_fkey" FOREIGN KEY ("gallery_id") REFERENCES "galleries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_current_official_version_id_fkey" FOREIGN KEY ("current_official_version_id") REFERENCES "drawing_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing_versions" ADD CONSTRAINT "drawing_versions_drawing_id_fkey" FOREIGN KEY ("drawing_id") REFERENCES "drawings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_current_official_version_id_fkey" FOREIGN KEY ("current_official_version_id") REFERENCES "schedule_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_drawing_version_id_fkey" FOREIGN KEY ("drawing_version_id") REFERENCES "drawing_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_drawing_version_id_fkey" FOREIGN KEY ("drawing_version_id") REFERENCES "drawing_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_playoff_id_fkey" FOREIGN KEY ("playoff_id") REFERENCES "playoffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_bracket_id_fkey" FOREIGN KEY ("bracket_id") REFERENCES "brackets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_schedule_version_id_fkey" FOREIGN KEY ("schedule_version_id") REFERENCES "schedule_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participations" ADD CONSTRAINT "match_participations_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participations" ADD CONSTRAINT "match_participations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standings" ADD CONSTRAINT "standings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standings" ADD CONSTRAINT "standings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standings" ADD CONSTRAINT "standings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_schedule_version_id_fkey" FOREIGN KEY ("schedule_version_id") REFERENCES "schedule_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playoffs" ADD CONSTRAINT "playoffs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playoffs" ADD CONSTRAINT "playoffs_current_official_bracket_id_fkey" FOREIGN KEY ("current_official_bracket_id") REFERENCES "brackets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brackets" ADD CONSTRAINT "brackets_playoff_id_fkey" FOREIGN KEY ("playoff_id") REFERENCES "playoffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "champions" ADD CONSTRAINT "champions_playoff_id_fkey" FOREIGN KEY ("playoff_id") REFERENCES "playoffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "champions" ADD CONSTRAINT "champions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "champions" ADD CONSTRAINT "champions_winning_team_id_fkey" FOREIGN KEY ("winning_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referee_assignments" ADD CONSTRAINT "referee_assignments_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- SQL-only constraints from Physical Database Design v0.1.1
-- (Partial unique indexes, CHECK constraints, partial indexes)
-- =============================================================================

-- Partial unique indexes (soft-delete aware / one-official)
CREATE UNIQUE INDEX "uq_tournaments_name_active"
  ON "tournaments" ("name")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uq_categories_tournament_name"
  ON "categories" ("tournament_id", "name")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uq_courts_tournament_label"
  ON "courts" ("tournament_id", "label")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uq_teams_category_name"
  ON "teams" ("category_id", "name")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uq_drawing_versions_one_official"
  ON "drawing_versions" ("drawing_id")
  WHERE "official_flag" = true;

CREATE UNIQUE INDEX "uq_schedule_versions_one_official"
  ON "schedule_versions" ("schedule_id")
  WHERE "official_flag" = true;

CREATE UNIQUE INDEX "uq_brackets_one_official"
  ON "brackets" ("playoff_id")
  WHERE "official_flag" = true;

CREATE UNIQUE INDEX "uq_referee_assignments_active"
  ON "referee_assignments" ("match_id")
  WHERE "assignment_status" = 'active';

-- Partial index for live operations
CREATE INDEX "idx_matches_live"
  ON "matches" ("category_id")
  WHERE "status" IN ('warm_up', 'live');

-- CHECK constraints
ALTER TABLE "tournaments"
  ADD CONSTRAINT "ck_tournaments_reg_dates"
  CHECK (
    "registration_open_at" IS NULL
    OR "registration_close_at" IS NULL
    OR "registration_open_at" <= "registration_close_at"
  );

ALTER TABLE "tournaments"
  ADD CONSTRAINT "ck_tournaments_event_dates"
  CHECK (
    "start_at" IS NULL
    OR "end_at" IS NULL
    OR "start_at" <= "end_at"
  );

ALTER TABLE "standings"
  ADD CONSTRAINT "ck_standings_nonneg"
  CHECK (
    "wins" >= 0
    AND "losses" >= 0
    AND "points" >= 0
    AND "matches_played" >= 0
  );

ALTER TABLE "standings"
  ADD CONSTRAINT "ck_standings_rank"
  CHECK ("rank_position" IS NULL OR "rank_position" >= 1);

ALTER TABLE "drawing_versions"
  ADD CONSTRAINT "ck_drawing_versions_number"
  CHECK ("version_number" >= 1);

ALTER TABLE "schedule_versions"
  ADD CONSTRAINT "ck_schedule_versions_number"
  CHECK ("version_number" >= 1);

ALTER TABLE "brackets"
  ADD CONSTRAINT "ck_brackets_number"
  CHECK ("version_number" >= 1);

ALTER TABLE "schedule_entries"
  ADD CONSTRAINT "ck_schedule_entries_time"
  CHECK (
    "scheduled_end_at" IS NULL
    OR "scheduled_start_at" <= "scheduled_end_at"
  );

ALTER TABLE "matches"
  ADD CONSTRAINT "ck_matches_stage_xor"
  CHECK ("group_id" IS NULL OR "playoff_id" IS NULL);

ALTER TABLE "matches"
  ADD CONSTRAINT "ck_matches_flags"
  CHECK (NOT ("cancellation_flag" AND "abandonment_flag"));

ALTER TABLE "group_members"
  ADD CONSTRAINT "ck_group_members_order"
  CHECK ("placement_order" >= 1);

ALTER TABLE "sponsors"
  ADD CONSTRAINT "ck_sponsors_order"
  CHECK ("display_order" >= 0);

ALTER TABLE "gallery_items"
  ADD CONSTRAINT "ck_gallery_items_order"
  CHECK ("display_order" >= 0);
