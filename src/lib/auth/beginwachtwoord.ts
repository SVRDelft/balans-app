import { randomInt } from "node:crypto";

// Een beginwachtwoord voor een vereniging: twee gewone woorden en een getal,
// bijvoorbeeld "molen-tulp-47". Leesbaar en goed door te geven in een
// groepsapp, en met ruim 3,5 miljoen mogelijkheden (en tien pogingen per
// minuut) niet te raden. De vereniging kan het daarna zelf wijzigen.

const WOORDEN = [
  "anker", "appel", "bakker", "balkon", "beker", "berg", "bever", "bloem", "boom", "boot",
  "brug", "burcht", "dak", "das", "dijk", "dolfijn", "draak", "duin", "eekhoorn", "egel",
  "eiland", "emmer", "fiets", "fluit", "gitaar", "gracht", "haven", "hamer", "harp", "heide",
  "helm", "hert", "honing", "hoorn", "ijsbeer", "inkt", "jas", "kaars", "kaas", "kameel",
  "kanaal", "kasteel", "kers", "ketel", "kikker", "klok", "koffie", "komeet", "kraan", "kroon",
  "laars", "lamp", "lantaarn", "leeuw", "lepel", "lint", "maan", "meeuw", "merel", "molen",
  "mossel", "muts", "nest", "noot", "oester", "olifant", "orgel", "otter", "paling", "panda",
  "papier", "parel", "peer", "pinguin", "planeet", "polder", "pomp", "potlood", "raket", "regen",
  "ridder", "rivier", "roos", "schaap", "schelp", "sjaal", "sleutel", "slinger", "spiegel", "ster",
  "storm", "strand", "tafel", "tegel", "tijger", "toren", "trein", "trompet", "tulp", "uil",
  "vaas", "valk", "veer", "vlag", "vlinder", "vos", "walvis", "water", "wolk", "zebra",
  "zeil", "zon", "zwaan",
] as const;

export function maakBeginwachtwoord(): string {
  const eerste = WOORDEN[randomInt(WOORDEN.length)];
  let tweede = WOORDEN[randomInt(WOORDEN.length)];
  while (tweede === eerste) tweede = WOORDEN[randomInt(WOORDEN.length)];
  return `${eerste}-${tweede}-${randomInt(10, 100)}`;
}
