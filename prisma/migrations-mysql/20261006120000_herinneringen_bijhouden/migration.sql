-- Bijhouden hoe vaak er aan een factuur herinnerd is.
ALTER TABLE `Factuur` ADD COLUMN `herinneringen` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `Factuur` ADD COLUMN `laatsteHerinneringOp` DATETIME(3) NULL;
