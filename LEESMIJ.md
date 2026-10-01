# Gebouwde versie

Deze map is het resultaat van `npm run build` en wordt automatisch gemaakt.
**Bewerk hier niets**: bij de volgende deploy is het weg.

- `server.js` is het opstartbestand voor Passenger.
- `public/` is de document root in Plesk.
- `prisma/` staat erbij om op de server `npm run migrate` te kunnen draaien.
- `storage/` wordt vanzelf aangemaakt zodra er iets wordt geüpload en blijft
  bij een nieuwe deploy staan.

De stappen in Plesk staan in DEPLOY.md in de hoofdbranch.
