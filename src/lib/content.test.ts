import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { leesVerenigingen } from "./content";

describe("de vijftien", () => {
  it("staan altijd op volgorde van oprichting, de oudste eerst", () => {
    const jaren = leesVerenigingen().map((vereniging) => vereniging.opgericht ?? 9999);
    expect(jaren).toEqual([...jaren].sort((a, b) => a - b));
  });

  it("hebben allemaal een oprichtingsjaar", () => {
    expect(leesVerenigingen().filter((vereniging) => !vereniging.opgericht)).toEqual([]);
  });
});

describe("de stamboom", () => {
  it("bevat elke vereniging precies één keer, en niets anders", async () => {
    const { leesStamboom } = await import("./content");
    const gevonden: string[] = [];
    const loop = (takken: { slug: string; takken?: unknown[] }[]) => {
      for (const tak of takken) {
        gevonden.push(tak.slug);
        loop((tak.takken ?? []) as { slug: string; takken?: unknown[] }[]);
      }
    };
    for (const familie of leesStamboom().families) {
      if (familie.wortel?.slug) gevonden.push(familie.wortel.slug);
      loop(familie.takken);
    }
    const slugs = leesVerenigingen().map((vereniging) => vereniging.slug);
    expect([...gevonden].sort()).toEqual([...slugs].sort());
  });
});
