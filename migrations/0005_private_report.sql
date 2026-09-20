ALTER TABLE "cofounder_pair" ADD COLUMN "report_status" TEXT NOT NULL DEFAULT 'pending'
    CHECK ("report_status" IN ('pending', 'generating', 'ready'));
ALTER TABLE "cofounder_pair" ADD COLUMN "report_generating_at" TEXT;
ALTER TABLE "cofounder_pair" ADD COLUMN "report_ready_at" TEXT;

CREATE TABLE "pair_result" (
    "pair_id" TEXT NOT NULL PRIMARY KEY REFERENCES "cofounder_pair" ("pair_id") ON DELETE CASCADE,
    "question_set_version" TEXT NOT NULL,
    "rules_version" TEXT NOT NULL,
    "content_version" TEXT NOT NULL,
    "report_json" TEXT NOT NULL,
    "created_at" TEXT NOT NULL
);

CREATE TABLE "pair_event" (
    "event_id" TEXT NOT NULL PRIMARY KEY,
    "pair_id" TEXT NOT NULL REFERENCES "cofounder_pair" ("pair_id") ON DELETE CASCADE,
    "event_type" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "delivered_at" TEXT,
    UNIQUE ("pair_id", "event_type")
);

CREATE INDEX "cofounder_pair_report_status_idx"
ON "cofounder_pair" ("report_status", "report_generating_at");

CREATE INDEX "pair_event_delivery_idx"
ON "pair_event" ("event_type", "delivered_at", "created_at");
