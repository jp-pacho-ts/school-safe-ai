BEGIN;

-- Preserve existing reports. Publicly supplied names are report-local, not accounts.
ALTER TABLE "Report"
    ADD COLUMN "reporterName" VARCHAR(100),
    ADD COLUMN "submissionKey" UUID;

CREATE UNIQUE INDEX "Report_submissionKey_key" ON "Report"("submissionKey");

-- Prisma cannot express this privacy constraint; keep it in versioned SQL.
ALTER TABLE "Report" DROP CONSTRAINT "Report_anonymous_reporter_check";
ALTER TABLE "Report" ADD CONSTRAINT "Report_anonymous_reporter_check"
    CHECK (
        NOT "isAnonymous"
        OR ("reporterId" IS NULL AND "reporterName" IS NULL)
    );

COMMIT;
