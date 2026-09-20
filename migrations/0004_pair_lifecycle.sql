DROP INDEX "pair_test_active_user_idx";

ALTER TABLE "pair_test" RENAME TO "pair_test_legacy";

CREATE TABLE "cofounder_pair" (
    "pair_id" TEXT NOT NULL PRIMARY KEY,
    "creator_user_id" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "partner_user_id" TEXT REFERENCES "user" ("id") ON DELETE SET NULL,
    "invite_token_hash" TEXT UNIQUE,
    "invite_created_at" TEXT,
    "claimed_at" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CHECK ("partner_user_id" IS NULL OR "partner_user_id" <> "creator_user_id")
);

INSERT INTO "cofounder_pair"
    ("pair_id", "creator_user_id", "created_at", "updated_at")
SELECT "pair_id", "user_id", "created_at", "updated_at"
FROM "pair_test_legacy";

CREATE TABLE "pair_test" (
    "pair_id" TEXT NOT NULL REFERENCES "cofounder_pair" ("pair_id") ON DELETE CASCADE,
    "user_id" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "question_set_version" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "state_json" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    "submitted_at" TEXT,
    PRIMARY KEY ("pair_id", "user_id")
);

INSERT INTO "pair_test"
    ("pair_id", "user_id", "question_set_version", "revision", "state_json",
     "created_at", "updated_at", "submitted_at")
SELECT "pair_id", "user_id", "question_set_version", "revision", "state_json",
       "created_at", "updated_at", "submitted_at"
FROM "pair_test_legacy";

DROP TABLE "pair_test_legacy";

CREATE INDEX "cofounder_pair_creator_idx"
ON "cofounder_pair" ("creator_user_id", "updated_at");

CREATE INDEX "cofounder_pair_partner_idx"
ON "cofounder_pair" ("partner_user_id", "updated_at");

CREATE INDEX "pair_test_user_idx"
ON "pair_test" ("user_id", "submitted_at");
