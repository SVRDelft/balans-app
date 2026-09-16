import { Search } from "lucide-react";

export function Zoekveld({ waarde, placeholder }: { waarde: string; placeholder: string }) {
  return <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground sm:min-w-56">
    Zoeken
    <span className="relative">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <input type="search" name="q" defaultValue={waarde} maxLength={120} placeholder={placeholder} className="veld !pl-9" />
    </span>
  </label>;
}
