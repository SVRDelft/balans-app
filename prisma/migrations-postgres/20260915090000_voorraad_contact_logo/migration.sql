-- AlterTable
ALTER TABLE "Instellingen" ADD COLUMN     "btwNummer" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "contactpersoon" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "land" TEXT NOT NULL DEFAULT 'Nederland',
ADD COLUMN     "logoData" BYTEA,
ADD COLUMN     "logoMimeType" TEXT,
ADD COLUMN     "logoNaam" TEXT,
ADD COLUMN     "telefoon" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "website" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Relatie" ADD COLUMN     "btwNummer" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "iban" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "kvkNummer" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "land" TEXT NOT NULL DEFAULT 'Nederland',
ADD COLUMN     "telefoon" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "website" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Voorraadpost" (
    "id" TEXT NOT NULL,
    "boekjaarId" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "eenheid" TEXT NOT NULL DEFAULT 'stuks',
    "beginAantal" INTEGER NOT NULL DEFAULT 0,
    "beginWaardePerStukCenten" INTEGER NOT NULL DEFAULT 0,
    "aantal" INTEGER NOT NULL DEFAULT 0,
    "waardePerStukCenten" INTEGER NOT NULL DEFAULT 0,
    "locatie" TEXT NOT NULL DEFAULT '',
    "notities" TEXT NOT NULL DEFAULT '',
    "bijgewerktOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voorraadpost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Voorraadpost_boekjaarId_idx" ON "Voorraadpost"("boekjaarId");

-- CreateIndex
CREATE UNIQUE INDEX "Voorraadpost_boekjaarId_naam_key" ON "Voorraadpost"("boekjaarId", "naam");

-- AddForeignKey
ALTER TABLE "Voorraadpost" ADD CONSTRAINT "Voorraadpost_boekjaarId_fkey" FOREIGN KEY ("boekjaarId") REFERENCES "Boekjaar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
