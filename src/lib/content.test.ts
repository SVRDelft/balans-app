import { describe, expect, it } from "vitest";

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
