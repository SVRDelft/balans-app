-- Onthoudt of het bestuur de koppeling met een relatie zelf koos; de
-- automatische koppeling op naam laat die dan met rust.
ALTER TABLE `Portaaltoegang` ADD COLUMN `relatieHandmatig` BOOLEAN NOT NULL DEFAULT false;
