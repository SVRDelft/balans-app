-- Een bankimport kan de betaalrekening en de spaarrekening tegelijk bevatten.
ALTER TABLE `Bankimport` ADD COLUMN `spaarRekening` VARCHAR(191) NULL;
ALTER TABLE `Bankimport` ADD COLUMN `spaarEindSaldoCenten` INTEGER NULL;
ALTER TABLE `Bankimport` ADD COLUMN `spaarEindDatum` DATETIME(3) NULL;
