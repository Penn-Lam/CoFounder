CREATE TABLE "public_result" (
    "pair_id" TEXT NOT NULL PRIMARY KEY REFERENCES "cofounder_pair" ("pair_id") ON DELETE CASCADE,
    "current_slug_hash" TEXT NOT NULL UNIQUE,
    "published_at" TEXT NOT NULL,
    "unpublished_at" TEXT
);

CREATE TABLE "public_result_slug" (
    "slug_hash" TEXT NOT NULL PRIMARY KEY,
    "pair_id" TEXT NOT NULL REFERENCES "public_result" ("pair_id") ON DELETE CASCADE,
    "created_at" TEXT NOT NULL,
    "active" INTEGER NOT NULL DEFAULT 1 CHECK ("active" IN (0, 1))
);

CREATE TABLE "public_name_permission" (
    "pair_id" TEXT NOT NULL REFERENCES "cofounder_pair" ("pair_id") ON DELETE CASCADE,
    "user_id" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "permitted" INTEGER NOT NULL DEFAULT 0 CHECK ("permitted" IN (0, 1)),
    "updated_at" TEXT NOT NULL,
    PRIMARY KEY ("pair_id", "user_id")
);

CREATE INDEX "public_result_slug_pair_idx"
ON "public_result_slug" ("pair_id", "active");
