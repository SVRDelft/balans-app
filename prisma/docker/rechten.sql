-- Prisma maakt tijdens `prisma migrate dev` een tijdelijke "shadow database" aan
-- om te controleren of een migratie klopt. Daar is het recht voor nodig om
-- databases te maken. Alleen voor de lokale ontwikkeldatabase in Docker; op de
-- server van de TU Delft draaien we migraties met `prisma migrate deploy`, en
-- dat heeft geen shadow database nodig.
GRANT ALL PRIVILEGES ON *.* TO 'svr'@'%';
FLUSH PRIVILEGES;
