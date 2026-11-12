import { describe, expect, it } from "vitest";
import { leesMarkdown, leesRegel } from "./markdown";

describe("de kleine Markdown-lezer voor content/", () => {
  it("leest een titel, secties en onderdelen", () => {
    const document = leesMarkdown(
      "# Titel\n\nEerste alinea.\n\n## Wat we doen\n\nUitleg.\n\n### Samenwerken\n\nBeschrijving.\n",
    );
    expect(document.titel).toBe("Titel");
    expect(document.blokken).toEqual([
      { soort: "alinea", stukken: [{ soort: "tekst", tekst: "Eerste alinea." }] },
    ]);
    expect(document.secties).toHaveLength(1);
    expect(document.secties[0].kop).toBe("Wat we doen");
    expect(document.secties[0].onderdelen[0].kop).toBe("Samenwerken");
    expect(document.secties[0].onderdelen[0].blokken[0]).toEqual({
      soort: "alinea",
      stukken: [{ soort: "tekst", tekst: "Beschrijving." }],
    });
  });

  it("voegt doorlopende regels samen tot één alinea", () => {
    const document = leesMarkdown("Een zin\ndie doorloopt.\n");
    expect(document.blokken[0]).toEqual({
      soort: "alinea",
      stukken: [{ soort: "tekst", tekst: "Een zin die doorloopt." }],
    });
  });

  it("leest opsommingen, ook als een punt over twee regels staat", () => {
    const document = leesMarkdown("- Eerste punt\n- Tweede punt\n  loopt door\n");
    expect(document.blokken[0]).toEqual({
      soort: "lijst",
      punten: [
        [{ soort: "tekst", tekst: "Eerste punt" }],
        [{ soort: "tekst", tekst: "Tweede punt loopt door" }],
      ],
    });
  });

  it("herkent vet en links binnen een regel", () => {
    expect(leesRegel("Dit is **vet** en een [link](https://svr.tudelft.nl).")).toEqual([
      { soort: "tekst", tekst: "Dit is " },
      { soort: "sterk", tekst: "vet" },
      { soort: "tekst", tekst: " en een " },
      { soort: "link", tekst: "link", naar: "https://svr.tudelft.nl" },
      { soort: "tekst", tekst: "." },
    ]);
  });

  it("laat een placeholder staan zoals hij is", () => {
    const document = leesMarkdown("## Hoe solliciteer je?\n\n[IN TE VULLEN: periode]\n");
    expect(document.secties[0].blokken[0]).toEqual({
      soort: "alinea",
      stukken: [{ soort: "tekst", tekst: "[IN TE VULLEN: periode]" }],
    });
  });
});
