CREATE TABLE "report_job" (
    "pair_id" TEXT NOT NULL PRIMARY KEY REFERENCES "cofounder_pair" ("pair_id") ON DELETE CASCADE,
    "created_at" TEXT NOT NULL,
    "dispatched_at" TEXT
);

CREATE INDEX "report_job_pending_idx"
ON "report_job" ("dispatched_at", "created_at");
