CREATE TABLE "product_event" (
    "event_id" TEXT NOT NULL PRIMARY KEY,
    "pair_id" TEXT,
    "user_id" TEXT,
    "event_type" TEXT NOT NULL,
    "created_at" TEXT NOT NULL
);

CREATE INDEX "product_event_funnel_idx"
ON "product_event" ("event_type", "created_at");

CREATE INDEX "product_event_pair_idx"
ON "product_event" ("pair_id", "event_type");

CREATE TABLE "abuse_window" (
    "scope" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "window_started_at" INTEGER NOT NULL,
    "request_count" INTEGER NOT NULL,
    PRIMARY KEY ("scope", "key_hash", "window_started_at")
);

CREATE INDEX "abuse_window_cleanup_idx"
ON "abuse_window" ("window_started_at");
