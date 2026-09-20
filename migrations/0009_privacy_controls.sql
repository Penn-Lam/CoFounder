CREATE TABLE "privacy_action_authorization" (
    "user_id" TEXT NOT NULL PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
    "otp_hash" TEXT NOT NULL,
    "expires_at" INTEGER NOT NULL,
    "attempts_remaining" INTEGER NOT NULL,
    "verified_at" INTEGER,
    "consumed_at" INTEGER,
    "sent_at" INTEGER NOT NULL
);

CREATE TABLE "pair_participant_withdrawal" (
    "pair_id" TEXT NOT NULL REFERENCES "cofounder_pair" ("pair_id") ON DELETE CASCADE,
    "role" TEXT NOT NULL CHECK ("role" IN ('creator', 'partner')),
    "withdrawn_at" TEXT NOT NULL,
    PRIMARY KEY ("pair_id", "role")
);

CREATE TABLE "account_deletion" (
    "user_id" TEXT NOT NULL PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
    "deleted_at" TEXT NOT NULL
);

CREATE INDEX "pair_participant_withdrawal_pair_idx"
ON "pair_participant_withdrawal" ("pair_id", "role");
