CREATE TABLE "otp_ip_limit" (
    "key_hash" TEXT NOT NULL PRIMARY KEY,
    "sent_at" INTEGER NOT NULL
);

ALTER TABLE "otp_email_limit" RENAME COLUMN "email_hash" TO "key_hash";
