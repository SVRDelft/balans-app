-- AlterTable
ALTER TABLE "Voorraadpost" ADD COLUMN     "begrotingspostId" TEXT;

-- CreateIndex
CREATE INDEX "Voorraadpost_begrotingspostId_idx" ON "Voorraadpost"("begrotingspostId");

-- AddForeignKey
ALTER TABLE "Voorraadpost" ADD CONSTRAINT "Voorraadpost_begrotingspostId_fkey" FOREIGN KEY ("begrotingspostId") REFERENCES "Begrotingspost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
