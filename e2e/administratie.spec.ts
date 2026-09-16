import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import pg from 'pg';
import ExcelJS from 'exceljs';

// The runner creates this ignored file. Refuse to run destructive fixtures on any other database.
const config = JSON.parse(readFileSync('.vercel/e2e-env.json', 'utf8'));
const databaseUrl = new URL(config.env.NEON_DATABASE_URL);
if (!/^\/svr_test_\d+_[a-f0-9]{6}$/.test(databaseUrl.pathname) || databaseUrl.pathname !== `/${config.database}`) throw new Error('Tests require an isolated database.');
const db = new pg.Pool({ connectionString: databaseUrl.href });
const ids: Record<string, string> = {};
const runtimeErrors: string[] = [];
let page: Page;
function field(name: string) {
  return page.getByLabel(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?$`));
}

async function row(sql: string, values: unknown[] = []) { return (await db.query(sql, values)).rows[0]; }
async function go(path: string) {
  const response = await page.goto(path);
  expect(response?.status(), path).toBeLessThan(400);
  await expect(page.locator('main h1')).toBeVisible();
}
async function save(label = 'Opslaan') {
  const button = page.getByRole('button', { name: label, exact: true });
  const submits = label !== 'Zoeken' && await button.evaluate(element => element instanceof HTMLButtonElement && element.type === 'submit' && !!element.form);
  if (submits) {
    const saved = page.waitForResponse(response => response.request().method() === 'POST' && response.url().startsWith(config.env.E2E_BASE_URL));
    const [response] = await Promise.all([saved, button.click()]);
    expect(response.status(), `Opslaan: ${label}`).toBeLessThan(400);
    await response.finished();
  } else await button.click();
}
async function workbook() {
  const response = await page.request.get('/api/export/excel');
  expect(response.status()).toBe(200);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await response.body() as unknown as ExcelJS.Buffer);
  return book;
}
async function balance(expected: Record<string, number> = {}) {
  const book = await workbook();
  const values: Record<string, unknown> = {};
  book.getWorksheet('Balans')!.eachRow(r => { values[String(r.getCell(1).value)] = r.getCell(2).value; });
  expect(values['Activa min passiva']).toBe(0);
  for (const [name, value] of Object.entries(expected)) expect(values[name], name).toBe(value);
}
async function invoice(name: string, amount: string, due = '2026-09-07') {
  await go('/facturen/nieuw');
  await field('Relatie').selectOption(ids.relatie);
  await field('Omschrijving').fill(name);
  await field('Factuurdatum').fill('2026-09-01');
  await field('Vervaldatum').fill(due);
  await field('Omschrijving regel 1').fill(name);
  await field('Begrotingspost regel 1').selectOption(ids.inkomst);
  await field('Prijs per stuk regel 1').fill(amount);
  await save('Opslaan als concept');
  await expect(page).toHaveURL(/\/facturen\/[a-z0-9]{20,}$/);
  return (await row('SELECT id FROM "Factuur" WHERE omschrijving=$1', [name])).id as string;
}
async function send() {
  await save('Op verstuurd zetten');
  await expect(page.locator('main').getByText('Concept', { exact: true })).toHaveCount(0);
}
async function pay(amount: string) {
  await page.locator('input[name="bedrag"]').fill(amount);
  await page.locator('input[name="datum"]').fill('2026-09-15');
  await save('Betaling vastleggen');
  await expect(page.getByText(/Betaling van .* vastgelegd/)).toBeVisible();
}
async function expense(name: string, amount: string, event?: string) {
  await go('/uitgaven/nieuw');
  await field('Datum').fill('2026-09-15');
  await field('Bedrag').fill(amount);
  await field('Leverancier').fill('Testleverancier');
  await field('Omschrijving').fill(name);
  await field('Begrotingspost').selectOption(event ? ids.eventkosten : ids.uitgave);
  if (event) await field('Evenement').selectOption(event);
  await save();
  await expect(page).toHaveURL(/\/uitgaven\/[a-z0-9]{20,}$/);
  return (await row('SELECT id FROM "Uitgave" WHERE omschrijving=$1', [name])).id as string;
}

test.describe.serial('Volledige SVR-administratie', () => {
  test.beforeAll(async ({ browser }) => {
    // This is exclusively our temporary database; an existing dev/prod DB is refused above.
    const tables = (await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`)).rows;
    if (tables.length) await db.query(`TRUNCATE ${tables.map(t => `"${t.tablename.replaceAll('"', '""')}"`).join(', ')} CASCADE`);
    page = await browser.newPage();
    page.setDefaultTimeout(15_000);
    page.on('pageerror', error => runtimeErrors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await mkdir('.vercel/qa', { recursive: true });
  });
  test.afterAll(async () => { await page?.close(); await db.end(); });

  test('inloggen, verkeerd wachtwoord en eerste boekjaar zonder seed', async () => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/inloggen$/);
    expect((await page.request.get('/api/export/excel')).status()).toBe(401);
    await page.getByLabel('Je naam').fill('SVR Browsertest');
    await page.getByLabel('Wachtwoord').fill('onjuist-testwachtwoord');
    await save('Inloggen');
    await expect(page.getByText('Het wachtwoord klopt niet.')).toBeVisible();
    await page.getByLabel('Je naam').fill('SVR Browsertest');
    await page.getByLabel('Wachtwoord').fill(config.env.APP_WACHTWOORD);
    await save('Inloggen');
    await expect(page).toHaveURL(/\/boekjaren$/);
    await field('Naam').fill('SVR Test 2026-2027');
    await page.getByLabel('Voorvoegsel factuurnummers').fill('TEST-2026');
    await page.getByLabel('Startdatum').fill('2026-09-01');
    await page.getByLabel('Einddatum').fill('2027-08-31');
    await field('Beginsaldo bank').fill('1000,00');
    await page.getByLabel('Beginsaldo eigen vermogen').fill('1000,00');
    await save('Boekjaar aanmaken');
    await expect(page.getByRole('combobox', { name: 'Boekjaar' })).toBeVisible();
    const jaar = await row('SELECT * FROM "Boekjaar"');
    expect(jaar.actief).toBe(true);
    expect(jaar.beginsaldoBankCenten).toBe(100000);
    ids.jaar = jaar.id;
    await go('/');
    await expect(page.getByRole('link', { name: 'Nieuwe factuur', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Voer je banksaldo in' })).toBeVisible();
  });

  test('organisatie, logo, relaties, contactgegevens en zoeken', async () => {
    await go('/instellingen');
    await page.locator('[name="organisatieNaam"]').fill('SVR Testadministratie');
    await page.locator('[name="adres"]').fill('Teststraat 1');
    await page.locator('[name="postcode"]').fill('2628 CD');
    await page.locator('[name="plaats"]').fill('Delft');
    await page.locator('[name="kvkNummer"]').fill('12345678');
    await page.locator('[name="email"]').fill('bestuur@example.org');
    await page.locator('[name="logo"]').setInputFiles('public/svr-logo.jpg');
    await save();
    await expect(page.getByText(/Instellingen opgeslagen/)).toBeVisible();
    expect((await row('SELECT "logoData" FROM "Instellingen"')).logoData.length).toBeGreaterThan(100);
    const logo = await page.request.get('/api/logo');
    expect(logo.status()).toBe(200);
    expect(logo.headers()['content-type']).toMatch(/image/);

    await go('/relaties/nieuw');
    await page.locator('[name="naam"]').fill('Testvereniging Bèta');
    await page.locator('[name="contactpersoon"]').fill('Penningmeester');
    await page.locator('[name="email"]').fill('beta@example.org');
    await page.locator('[name="adres"]').fill('Mekelweg 2');
    await page.locator('[name="postcode"]').fill('2628 CD');
    await page.locator('[name="plaats"]').fill('Delft');
    await page.locator('[name="kvkNummer"]').fill('12345678');
    await page.locator('[name="telefoon"]').fill('0612345678');
    await save();
    await expect(page).toHaveURL(/\/relaties$/);
    ids.relatie = (await row('SELECT id FROM "Relatie" WHERE naam=$1', ['Testvereniging Bèta'])).id;
    await page.getByRole('searchbox').fill('BÈTA');
    await save('Zoeken');
    await expect(page.getByRole('link', { name: 'Testvereniging Bèta', exact: true })).toBeVisible();
    await expect(page.locator('a[href="mailto:beta@example.org"]')).toBeVisible();
    await page.getByRole('searchbox').fill('onvindbaar');
    await save('Zoeken');
    await expect(page.getByText('Geen relaties gevonden')).toBeVisible();
    await go('/relaties');
  });

  test('begroting aanmaken, voorraad verbruiken en waardering op de balans', async () => {
    for (const [key, code, naam, soort, categorie] of [
      ['inkomst', 'I1', 'Bijdragen', 'inkomst', 'vast'],
      ['uitgave', 'U1', 'Bestuurskosten', 'uitgave', 'vast'],
      ['eventkosten', 'U2', 'Evenementkosten', 'uitgave', 'omslag'],
      ['eventinkomst', 'I2', 'Evenementbijdragen', 'inkomst', 'omslag'],
    ]) {
      await go('/begroting/nieuw');
      await field('Code').fill(code);
      await field('Naam').fill(naam);
      await field('Soort').selectOption(soort);
      await field('Categorie').selectOption(categorie);
      await page.getByLabel('Begroot bedrag').fill('300,00');
      await save();
      await expect(page).toHaveURL(/\/begroting$/);
      ids[key] = (await row('SELECT id FROM "Begrotingspost" WHERE code=$1', [code])).id;
    }
    await go('/voorraad?nieuw=1');
    for (const [name, value] of Object.entries({ naam: 'Dassen', beginAantal: '10', beginWaardePerStukCenten: '5,00', aantal: '10', waardePerStukCenten: '5,00', locatie: 'SVR-kast' })) await page.locator(`[name="${name}"]`).fill(value);
    await field('Begrotingspost').selectOption(ids.uitgave);
    await save();
    await expect(page).toHaveURL(/\/voorraad$/);
    ids.voorraad = (await row('SELECT id FROM "Voorraadpost" WHERE naam=$1', ['Dassen'])).id;
    await go(`/voorraad?verbruik=${ids.voorraad}`);
    await page.locator('[name="aantal"]').fill('11');
    await expect(page.getByRole('button', { name: 'Verbruik boeken', exact: true })).toBeDisabled();
    await page.locator('[name="aantal"]').fill('2');
    await page.getByLabel('Waarvoor?').fill('Nieuw bestuur');
    await save('Verbruik boeken');
    await expect(page.getByText(/2 stuks afgeboekt/)).toBeVisible();
    expect((await row('SELECT aantal FROM "Voorraadpost" WHERE id=$1', [ids.voorraad])).aantal).toBe(8);
    await balance({ 'Spullen & voorraad': 40, 'Resultaat lopend boekjaar': -10 });
  });

  test('uitgaven, betaling, bonnetje, wijzigen en zoeken', async () => {
    ids.uitgaveBoeking = await expense('Kantoorbenodigdheden', '25,50');
    await page.locator('[name="bijlage"]').setInputFiles('public/svr-logo.jpg');
    await page.locator('[name="bedragDefinitief"]').check();
    await page.locator('[name="betaald"]').check();
    await save();
    await expect(page.getByText('Betaald', { exact: true })).toBeVisible();
    const uitgave = await row('SELECT * FROM "Uitgave" WHERE id=$1', [ids.uitgaveBoeking]);
    expect(uitgave.betaald).toBe(true);
    expect(uitgave.bijlageId).toBeTruthy();
    ids.bijlage = uitgave.bijlageId;
    const bon = await page.request.get(`/api/bijlagen/${ids.bijlage}`);
    expect(bon.status()).toBe(200);
    expect((await bon.body()).length).toBeGreaterThan(100);
    await go('/uitgaven?q=kantoor');
    await expect(page.getByRole('link', { name: 'Kantoorbenodigdheden', exact: true })).toBeVisible();
    await balance({ 'Banksaldo volgens de administratie': 974.5, 'Resultaat lopend boekjaar': -35.5 });
  });

  test('factuur, deelbetaling, vervaldatum, herinnering en PDF', async () => {
    ids.factuur = await invoice('Bijdrage korte termijn', '100,00');
    await send();
    await pay('30,00');
    await expect(page.getByText('Deels betaald', { exact: true })).toBeVisible();
    await save('Tekst bekijken');
    await expect(page.locator('textarea[readonly]')).toContainText('betaaltermijn');
    const pdf = await page.request.get(`/api/facturen/${ids.factuur}/pdf`);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
    await writeFile('.vercel/qa/factuur.pdf', await pdf.body());
    await balance({ 'Openstaande debiteuren': 70, 'Resultaat lopend boekjaar': 64.5 });
    ids.lang = await invoice('Bijdrage lange termijn', '50,00', '2026-11-01');
    await send();
    await go('/facturen?status=vervallen');
    await expect(page.getByText('Bijdrage korte termijn', { exact: true })).toBeVisible();
    await expect(page.getByText('Bijdrage lange termijn', { exact: true })).toHaveCount(0);
    await go('/facturen?q=LANGE');
    await expect(page.getByText('Bijdrage lange termijn', { exact: true })).toBeVisible();
  });

  test('creditconcept, verrekenen, terugbetalen en oninbaar herstellen', async () => {
    await go(`/facturen/${ids.factuur}`);
    await save('Crediteren');
    await expect(page).not.toHaveURL(new RegExp(`${ids.factuur}$`));
    ids.credit = (await row('SELECT id FROM "Factuur" WHERE "crediteertFactuurId"=$1', [ids.factuur])).id;
    await balance({ 'Openstaande debiteuren': 120, 'Resultaat lopend boekjaar': 114.5 });
    await send();
    await balance({ 'Openstaande debiteuren': 20, 'Resultaat lopend boekjaar': 14.5 });
    await pay('-30,00');
    await expect(page.getByText('Betaald', { exact: true })).toBeVisible();
    await balance({ 'Openstaande debiteuren': 50 });
    await go(`/facturen/${ids.lang}`);
    await pay('10,00');
    await save('Oninbaar afboeken');
    await expect(page.getByText('Oninbaar', { exact: true })).toBeVisible();
    await balance({ 'Openstaande debiteuren': 0, 'Resultaat lopend boekjaar': -25.5 });
    await save('Terugzetten naar openstaand');
    await expect(page.getByText('Deels betaald', { exact: true })).toBeVisible();
    await balance({ 'Openstaande debiteuren': 40, 'Resultaat lopend boekjaar': 14.5 });
  });

  test('evenement, deelnemers, voorlopige kosten, omslag en naheffing', async () => {
    await go('/evenementen/nieuw');
    await field('Naam').fill('Bestuursdiner');
    await field('Datum').fill('2026-09-15');
    await field('Kostenpost').selectOption(ids.eventkosten);
    await field('Opbrengstpost').selectOption(ids.eventinkomst);
    await save();
    await expect(page).toHaveURL(/\/evenementen\/[a-z0-9]{20,}$/);
    ids.event = (await row('SELECT id FROM "Evenement" WHERE naam=$1', ['Bestuursdiner'])).id;
    await page.getByLabel('Bestaande relatie').selectOption(ids.relatie);
    await field('Personen').fill('3');
    await page.getByLabel('Meteen als bevestigd betalend markeren').check();
    await save('Toevoegen');
    await expect.poll(async () => (await row('SELECT COUNT(*)::int AS n FROM "Deelnemer"')).n).toBe(1);
    ids.eventuitgave = await expense('Dinerkosten', '100,00', ids.event);
    await go(`/evenementen/${ids.event}`);
    await expect(page.getByRole('button', { name: 'Omslag berekenen en facturen maken', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Bedrag definitief', exact: true }).click();
    await page.locator('[name="bevestigLeveranciers"]').check();
    await page.locator('[name="bevestigDeelnemers"]').check();
    await save('Omslag berekenen en facturen maken');
    await expect.poll(async () => (await row('SELECT COUNT(*)::int AS n FROM "Omslagronde"')).n).toBe(1);
    const ronde = await row('SELECT * FROM "Omslagronde"');
    expect(ronde.totaalGefactureerdCenten).toBe(10002);
    expect(ronde.aantalBevestigd).toBe(3);
    expect((await row('SELECT "omslagrondeId" FROM "Uitgave" WHERE id=$1', [ids.eventuitgave])).omslagrondeId).toBe(ronde.id);
    const naheffing = await expense('Nakomende kosten', '9,00', ids.event);
    await page.locator('[name="bedragDefinitief"]').check();
    await save();
    await go(`/evenementen/${ids.event}`);
    await page.locator('[name="bevestigLeveranciers"]').check();
    await page.locator('[name="bevestigDeelnemers"]').check();
    await save('Naheffing berekenen en facturen maken');
    await expect.poll(async () => (await row('SELECT COUNT(*)::int AS n FROM "Omslagronde"')).n).toBe(2);
    expect((await row('SELECT "omslagrondeId" FROM "Uitgave" WHERE id=$1', [naheffing])).omslagrondeId).toBeTruthy();
    for (const f of (await db.query('SELECT id, "totaalCenten" FROM "Factuur" WHERE "evenementId"=$1', [ids.event])).rows) {
      await go(`/facturen/${f.id}`); await send(); await pay((f.totaalCenten / 100).toFixed(2));
    }
    await go(`/evenementen/${ids.event}`);
    await save('Evenement afsluiten');
    await expect(page.getByRole('button', { name: 'Heropenen', exact: true })).toBeVisible();
    await save('Heropenen');
    await expect(page.getByRole('button', { name: 'Evenement afsluiten', exact: true })).toBeVisible();
    await balance();
  });

  test('gelijktijdig verbruik wordt niet overschreven en niet dubbel geboekt', async () => {
    const stockId = 'testgelijktijdigevoorraad';
    await db.query('INSERT INTO "Voorraadpost" (id,"boekjaarId",naam,"beginAantal","beginWaardePerStukCenten",aantal,"waardePerStukCenten","bijgewerktOp") VALUES ($1,$2,$3,5,100,5,100,NOW())', [stockId, ids.jaar, 'Gelijktijdige proef']);
    const pages = [await page.context().newPage(), await page.context().newPage()];
    try {
      for (const tab of pages) {
        await tab.goto(`/voorraad?verbruik=${stockId}`);
        await tab.locator('[name="aantal"]').fill('4');
        await tab.locator('[name="reden"]').fill('Gelijktijdige controle');
      }
      await Promise.all(pages.map(tab => tab.getByRole('button', { name: 'Verbruik boeken', exact: true }).click()));
      await expect.poll(async () => (await row('SELECT aantal FROM "Voorraadpost" WHERE id=$1', [stockId])).aantal).toBe(1);
      await expect.poll(async () => (await row('SELECT COUNT(*)::int AS n FROM "Auditlog" WHERE "entiteitId"=$1', [stockId])).n).toBe(1);
      await expect.poll(async () => (await Promise.all(pages.map(tab => tab.locator('main').innerText()))).some(text => /Er liggen er maar 1/.test(text))).toBe(true);
    } finally {
      for (const tab of pages) await tab.close();
      await db.query('DELETE FROM "Voorraadpost" WHERE id=$1', [stockId]);
    }
  });

  test('concept wijzigen, regels toevoegen en verwijderen zonder nummerhergebruik', async () => {
    const concept = await invoice('Verwijderbaar concept', '10,00');
    const nummer = (await row('SELECT volgnummer FROM "Factuur" WHERE id=$1', [concept])).volgnummer;
    await page.getByRole('link', { name: 'Bewerken', exact: true }).click();
    await field('Omschrijving regel 1').fill('Aangepaste regel');
    await save('Regel toevoegen');
    await field('Omschrijving regel 2').fill('Tweede regel');
    await field('Prijs per stuk regel 2').fill('15,00');
    await save('Opslaan als concept');
    await expect(page).toHaveURL(new RegExp(`${concept}$`));
    expect((await row('SELECT "totaalCenten" FROM "Factuur" WHERE id=$1', [concept])).totaalCenten).toBe(2500);
    await save('Concept verwijderen');
    await expect(page).toHaveURL(/\/facturen$/);
    const next = await invoice('Volgend concept', '1,00');
    expect((await row('SELECT volgnummer FROM "Factuur" WHERE id=$1', [next])).volgnummer).toBeGreaterThan(nummer);
    await save('Concept verwijderen');
    await expect(page).toHaveURL(/\/facturen$/);
    await balance();
  });

  test('jaarfacturen exact verdelen, dubbele generatie blokkeren en ongebruikte gegevens verwijderen', async () => {
    await go('/relaties/nieuw');
    await field('Naam').fill('Testvereniging Gamma');
    await save();
    await expect(page).toHaveURL(/\/relaties$/);
    const relatie = (await row('SELECT id FROM "Relatie" WHERE naam=$1', ['Testvereniging Gamma'])).id;
    await go(`/relaties/${relatie}`);
    await field('Contactpersoon').fill('Nieuw bestuur');
    await save();
    await expect(page).toHaveURL(/\/relaties$/);
    expect((await row('SELECT contactpersoon FROM "Relatie" WHERE id=$1', [relatie])).contactpersoon).toBe('Nieuw bestuur');
    await go('/begroting/nieuw');
    await field('Code').fill('I3');
    await field('Naam').fill('Jaarbijdrage test');
    await field('Soort').selectOption('inkomst');
    await field('Categorie').selectOption('vast');
    await field('Begroot bedrag').fill('300,05');
    await save();
    await expect(page).toHaveURL(/\/begroting$/);
    const post = (await row('SELECT id FROM "Begrotingspost" WHERE code=$1', ['I3'])).id;
    await go('/facturen/jaarfacturen');
    await field('Begrotingspost').selectOption(post);
    await field('Factuurdatum').fill('2026-09-15');
    await save('2 conceptfacturen aanmaken');
    await expect(page.getByRole('button', { name: '0 conceptfacturen aanmaken', exact: true })).toBeDisabled();
    const facturen = (await db.query('SELECT f.id, f."totaalCenten", f.status FROM "Factuur" f JOIN "Factuurregel" r ON r."factuurId"=f.id WHERE r."begrotingspostId"=$1 ORDER BY f."totaalCenten"', [post])).rows;
    expect(facturen.map(f => f.totaalCenten)).toEqual([15002, 15003]);
    expect(facturen.every(f => f.status === 'concept')).toBe(true);
    await page.reload();
    await field('Begrotingspost').selectOption(post);
    await expect(page.getByRole('button', { name: '0 conceptfacturen aanmaken', exact: true })).toBeDisabled();
    for (const f of facturen) { await go(`/facturen/${f.id}`); await save('Concept verwijderen'); await expect(page).toHaveURL(/\/facturen$/); }
    await go(`/begroting/${post}`);
    await save('Verwijderen');
    await expect(page).toHaveURL(/\/begroting$/);
    await go(`/relaties/${relatie}`);
    await save('Verwijderen');
    await expect(page).toHaveURL(/\/relaties$/);
    expect(await row('SELECT id FROM "Relatie" WHERE id=$1', [relatie])).toBeUndefined();
    const uitgave = await expense('Verwijderbare uitgave', '12,00');
    await save('Verwijderen');
    await expect(page).toHaveURL(/\/uitgaven$/);
    expect(await row('SELECT id FROM "Uitgave" WHERE id=$1', [uitgave])).toBeUndefined();
    await balance();
  });

  test('banksaldo, alle overzichten en exports laden zonder browserfouten', async () => {
    await go('/bank');
    await page.getByLabel('Saldo volgens de bankapp').fill('1093,52');
    await save('Saldo vastleggen');
    await expect(page.getByText('Banksaldo vastgelegd.')).toBeVisible();
    for (const route of ['/', '/facturen', '/uitgaven', '/evenementen', '/bank', '/voorraad', '/verenigingen', `/verenigingen/${ids.relatie}`, '/relaties', `/relaties/${ids.relatie}`, '/begroting', '/exploitatie', '/balans', '/overdracht', '/boekjaren', '/auditlog', '/instellingen']) {
      await go(route);
      await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0);
    }
    const pdf = await page.request.get('/api/export/pdf');
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
    await writeFile('.vercel/qa/overdracht.pdf', await pdf.body());
    const book = await workbook();
    expect(book.worksheets.map(sheet => sheet.name)).toEqual(expect.arrayContaining(['Exploitatie', 'Balans', 'Debiteuren', 'Facturen', 'Uitgaven', 'Evenementen', 'Spullen & voorraad']));
    await writeFile('.vercel/qa/overdracht.xlsx', Buffer.from(await book.xlsx.writeBuffer()));
    await balance();
    expect(runtimeErrors).toEqual([]);
    await go('/');
    await page.screenshot({ path: '.vercel/qa/dashboard-desktop.png', fullPage: true });
  });

  test('nieuw boekjaar, begroting kopiëren, voorraad overnemen en historie beschermen', async () => {
    await go('/boekjaren');
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Boekjaar aanmaken', exact: true }) });
    await form.locator('[name="naam"]').fill('SVR Test 2027-2028');
    await form.locator('[name="factuurPrefix"]').fill('TEST-2027');
    await form.locator('[name="startDatum"]').fill('2027-09-01');
    await form.locator('[name="eindDatum"]').fill('2028-08-31');
    await form.locator('[name="kopieerVan"]').selectOption(ids.jaar);
    await save('Boekjaar aanmaken');
    await expect(form.getByText('Boekjaar opgeslagen.')).toBeVisible();
    const next = await row('SELECT * FROM "Boekjaar" WHERE "factuurPrefix"=$1', ['TEST-2027']);
    ids.volgendJaar = next.id;
    expect(next.actief).toBe(false);
    expect((await row('SELECT COUNT(*)::int AS n FROM "Begrotingspost" WHERE "boekjaarId"=$1', [next.id])).n).toBe(4);
    await page.getByRole('row').filter({ hasText: 'SVR Test 2027-2028' }).getByRole('button', { name: 'Activeren' }).click();
    await expect(page.getByRole('combobox', { name: 'Boekjaar' })).toHaveValue(next.id);
    await go('/voorraad');
    await save('Neem vorig boekjaar over');
    await expect.poll(async () => (await row('SELECT COUNT(*)::int AS n FROM "Voorraadpost" WHERE "boekjaarId"=$1', [next.id])).n).toBe(1);
    const stock = await row('SELECT * FROM "Voorraadpost" WHERE "boekjaarId"=$1', [next.id]);
    expect(stock.beginAantal).toBe(8);
    expect(stock.aantal).toBe(8);
    expect(stock.begrotingspostId).toBeTruthy();
    expect(stock.begrotingspostId).not.toBe(ids.uitgave);
    // Forge an old expense ID while viewing the active new year: the server must reject it.
    await go('/uitgaven/nieuw');
    await field('Datum').fill('2027-09-15');
    await field('Leverancier').fill('Mag niet opslaan');
    await field('Omschrijving').fill('Mag niet wijzigen');
    await field('Bedrag').fill('999,00');
    await field('Begrotingspost').selectOption(stock.begrotingspostId);
    await page.locator('main form').evaluate((form, oldId) => {
      const input = document.createElement('input'); input.type = 'hidden'; input.name = 'id'; input.value = oldId; form.append(input);
    }, ids.uitgaveBoeking);
    await save();
    await expect(page.getByText('Deze uitgave hoort niet bij het actieve boekjaar.')).toBeVisible();
    expect((await row('SELECT "bedragCenten" FROM "Uitgave" WHERE id=$1', [ids.uitgaveBoeking])).bedragCenten).toBe(2550);
    await page.getByRole('combobox', { name: 'Boekjaar' }).selectOption(ids.jaar);
    await expect(page.getByText('Alleen lezen — dit boekjaar is niet actief')).toBeVisible();
    await go('/boekjaren');
    await expect(page.getByRole('button', { name: 'Wijzigingen opslaan' })).toHaveCount(0);
    await go('/voorraad');
    await expect(page.getByRole('link', { name: 'Spullen toevoegen' })).toHaveCount(0);
    await go(`/facturen/${ids.lang}`);
    await expect(page.getByRole('button', { name: 'Betaling vastleggen' })).toHaveCount(0);
  });

  test('mobiel menu, geen horizontale pagina-overloop en uitloggen', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['/', '/relaties', '/voorraad', '/facturen', '/boekjaren']) {
      await go(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), route).toBe(true);
    }
    await page.locator('summary').filter({ hasText: 'Menu' }).click();
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await expect(page.locator('details[open]')).toHaveCount(0);
    await page.screenshot({ path: '.vercel/qa/dashboard-mobile.png', fullPage: true });
    expect(runtimeErrors).toEqual([]);
    await page.getByRole('button', { name: 'Uitloggen', exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/inloggen$/);
    for (const route of ['/api/logo', '/api/export/pdf', `/api/facturen/${ids.factuur}/pdf`, `/api/bijlagen/${ids.bijlage}`]) expect((await page.request.get(route)).status(), route).toBe(401);
  });
});
