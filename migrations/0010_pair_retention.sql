ALTER TABLE "cofounder_pair" ADD COLUMN "last_activity_at" TEXT;

UPDATE "cofounder_pair" SET "last_activity_at" = "updated_at";

CREATE TABLE "pair_email_delivery" (
    "event_id" TEXT NOT NULL REFERENCES "pair_event" ("event_id") ON DELETE CASCADE,
    "user_id" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "created_at" TEXT NOT NULL,
    "delivered_at" TEXT,
    PRIMARY KEY ("event_id", "user_id")
);

CREATE INDEX "cofounder_pair_expiry_idx"
ON "cofounder_pair" ("last_activity_at", "report_status");

CREATE INDEX "pair_email_delivery_pending_idx"
ON "pair_email_delivery" ("delivered_at", "created_at");
