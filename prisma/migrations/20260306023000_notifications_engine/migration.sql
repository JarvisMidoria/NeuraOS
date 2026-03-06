-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'LOW',
    "href" TEXT,
    "fingerprint" TEXT NOT NULL,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_companyId_fingerprint_key" ON "Notification"("companyId", "fingerprint");

-- CreateIndex
CREATE INDEX "Notification_companyId_createdAt_idx" ON "Notification"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_companyId_readAt_idx" ON "Notification"("companyId", "readAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
