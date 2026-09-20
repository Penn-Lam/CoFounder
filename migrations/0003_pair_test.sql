CREATE TABLE "pair_test" (
    "pair_id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "question_set_version" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "state_json" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    "submitted_at" TEXT
);

CREATE INDEX "pair_test_active_user_idx"
ON "pair_test" ("user_id", "submitted_at");
