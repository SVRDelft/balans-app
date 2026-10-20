import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cookieAlleenOverHttps,
  isBeveiligdeVerbinding,
  mageInloggen,
  onbeveiligdMaarToegestaan,
} from "./beveiliging";

const kopregels = (waarden: Record<string, string> = {}) => new Headers(waarden);

function zetOmgeving(omgeving: string, zonderHttps?: string) {
  vi.stubEnv("NODE_ENV", omgeving);
  vi.stubEnv("ZONDER_HTTPS_INLOGGEN", zonderHttps ?? "");
}

afterEach(() => vi.unstubAllEnvs());

describe("inloggen zonder https", () => {
  it("laat in ontwikkeling altijd inloggen toe", () => {
    zetOmgeving("development");
    expect(mageInloggen(kopregels())).toBe(true);
  });

  it("weigert in productie zonder https", () => {
    zetOmgeving("production");
    expect(mageInloggen(kopregels())).toBe(false);
    expect(mageInloggen(kopregels({ "x-forwarded-proto": "http" }))).toBe(false);
  });

  it("staat inloggen toe over https", () => {
    zetOmgeving("production");
    expect(mageInloggen(kopregels({ "x-forwarded-proto": "https" }))).toBe(true);
    // Een proxyketen zet er meerdere achter elkaar; de eerste telt.
    expect(mageInloggen(kopregels({ "x-forwarded-proto": "https, http" }))).toBe(true);
  });

  it("staat inloggen toe zonder https als het bestuur dat bewust aanzet", () => {
    zetOmgeving("production", "ja");
    expect(mageInloggen(kopregels())).toBe(true);
    expect(onbeveiligdMaarToegestaan(kopregels())).toBe(true);
    // Over https hoort die waarschuwing er niet te staan.
    expect(onbeveiligdMaarToegestaan(kopregels({ "x-forwarded-proto": "https" }))).toBe(false);
  });

  it("laat de Secure-vlag op het cookie weg zolang er geen https is", () => {
    zetOmgeving("production");
    expect(cookieAlleenOverHttps()).toBe(true);
    zetOmgeving("production", "ja");
    expect(cookieAlleenOverHttps()).toBe(false);
  });

  it("herkent https ook uit het protocol van het verzoek", () => {
    expect(isBeveiligdeVerbinding(kopregels(), "https:")).toBe(true);
    expect(isBeveiligdeVerbinding(kopregels(), "http:")).toBe(false);
  });
});
