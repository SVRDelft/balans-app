import { Input, Veld } from "@/components/ui/input";

export interface ExtraContactWaarden {
  land: string;
  telefoon: string;
  website: string;
  kvkNummer: string;
  btwNummer: string;
  iban: string;
}

export function ExtraContactvelden({
  waarden,
  fouten,
  toonBank = true,
}: {
  waarden: ExtraContactWaarden;
  fouten?: Record<string, string>;
  toonBank?: boolean;
}) {
  const velden = [
    { naam: "land", label: "Land", type: "text", placeholder: "Nederland" },
    { naam: "telefoon", label: "Telefoonnummer", type: "tel" },
    { naam: "website", label: "Website", type: "url", placeholder: "https://" },
    ...(toonBank
      ? [
          { naam: "iban", label: "IBAN", type: "text" },
          { naam: "kvkNummer", label: "KvK-nummer", type: "text" },
        ]
      : []),
    { naam: "btwNummer", label: "Btw-nummer", type: "text" },
  ] as const;
  return velden.map(({ naam, label, type, ...extra }) => (
    <Veld key={naam} label={label} htmlFor={naam} fout={fouten?.[naam]}>
      <Input
        id={naam}
        name={naam}
        type={type}
        defaultValue={waarden[naam as keyof ExtraContactWaarden]}
        maxLength={naam === "website" ? 500 : 80}
        {...extra}
      />
    </Veld>
  ));
}
