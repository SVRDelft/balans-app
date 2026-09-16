-- CreateTable
CREATE TABLE "Bankimport" (
    "id" TEXT NOT NULL,
    "boekjaarId" TEXT NOT NULL,
    "bestandHash" TEXT NOT NULL,
    "bestandsnaam" TEXT NOT NULL,
    "rekening" TEXT NOT NULL,
    "beginDatum" TIMESTAMP(3) NOT NULL,
    "eindDatum" TIMESTAMP(3) NOT NULL,
    "beginSaldoCenten" INTEGER NOT NULL,
    "eindSaldoCenten" INTEGER NOT NULL,
    "aantalRegels" INTEGER NOT NULL,
    "duplicaten" INTEGER NOT NULL DEFAULT 0,
    "bevestigdOp" TIMESTAMP(3),
    "banksaldoId" TEXT,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aangemaaktDoor" TEXT NOT NULL,

    CONSTRAINT "Bankimport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bankmutatie" (
    "id" TEXT NOT NULL,
    "boekjaarId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "sleutel" TEXT NOT NULL,
    "rekening" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "bedragCenten" INTEGER NOT NULL,
    "omschrijving" TEXT NOT NULL,
    "tegenpartijNaam" TEXT NOT NULL DEFAULT '',
    "tegenpartijIban" TEXT NOT NULL DEFAULT '',
    "bankReferentie" TEXT,
    "verwerking" TEXT NOT NULL DEFAULT 'open',
    "notitie" TEXT,
    "betalingId" TEXT,
    "uitgaveId" TEXT,
    "verwerktOp" TIMESTAMP(3),
    "verwerktDoor" TEXT,

    CONSTRAINT "Bankmutatie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bankimport_bestandHash_key" ON "Bankimport"("bestandHash");

-- CreateIndex
CREATE UNIQUE INDEX "Bankimport_banksaldoId_key" ON "Bankimport"("banksaldoId");

-- CreateIndex
CREATE INDEX "Bankimport_boekjaarId_aangemaaktOp_idx" ON "Bankimport"("boekjaarId", "aangemaaktOp");

-- CreateIndex
CREATE UNIQUE INDEX "Bankmutatie_sleutel_key" ON "Bankmutatie"("sleutel");

-- CreateIndex
CREATE UNIQUE INDEX "Bankmutatie_betalingId_key" ON "Bankmutatie"("betalingId");

-- CreateIndex
CREATE UNIQUE INDEX "Bankmutatie_uitgaveId_key" ON "Bankmutatie"("uitgaveId");

-- CreateIndex
CREATE INDEX "Bankmutatie_boekjaarId_verwerking_datum_idx" ON "Bankmutatie"("boekjaarId", "verwerking", "datum");

-- AddForeignKey
ALTER TABLE "Bankimport" ADD CONSTRAINT "Bankimport_boekjaarId_fkey" FOREIGN KEY ("boekjaarId") REFERENCES "Boekjaar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bankimport" ADD CONSTRAINT "Bankimport_banksaldoId_fkey" FOREIGN KEY ("banksaldoId") REFERENCES "Banksaldo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bankmutatie" ADD CONSTRAINT "Bankmutatie_boekjaarId_fkey" FOREIGN KEY ("boekjaarId") REFERENCES "Boekjaar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bankmutatie" ADD CONSTRAINT "Bankmutatie_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Bankimport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bankmutatie" ADD CONSTRAINT "Bankmutatie_betalingId_fkey" FOREIGN KEY ("betalingId") REFERENCES "Betaling"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bankmutatie" ADD CONSTRAINT "Bankmutatie_uitgaveId_fkey" FOREIGN KEY ("uitgaveId") REFERENCES "Uitgave"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
