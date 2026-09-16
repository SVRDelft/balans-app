"use client";

import Link from "next/link";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Banknote,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Receipt,
  Package,
  Scale,
  Settings,
  Table2,
  Target,
  Users,
  Menu,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icoon: React.ComponentType<{ className?: string }>;
}

const GROEPEN: { titel: string; items: NavItem[] }[] = [
  {
    titel: "Overzicht",
    items: [
      { href: "/", label: "Dashboard", icoon: LayoutDashboard },
      { href: "/exploitatie", label: "Exploitatie", icoon: Table2 },
      { href: "/balans", label: "Balans", icoon: Scale },
    ],
  },
  {
    titel: "Administratie",
    items: [
      { href: "/facturen", label: "Facturen", icoon: FileText },
      { href: "/uitgaven", label: "Uitgaven", icoon: Receipt },
      { href: "/evenementen", label: "Evenementen", icoon: CalendarDays },
      { href: "/bank", label: "Banksaldo", icoon: Banknote },
      { href: "/voorraad", label: "Spullen & voorraad", icoon: Package },
    ],
  },
  {
    titel: "Gegevens",
    items: [
      { href: "/verenigingen", label: "Per vereniging", icoon: Building2 },
      { href: "/relaties", label: "Relaties", icoon: Users },
      { href: "/begroting", label: "Begroting", icoon: Target },
    ],
  },
  {
    titel: "Beheer",
    items: [
      { href: "/overdracht", label: "Overdracht", icoon: ArrowLeftRight },
      { href: "/boekjaren", label: "Boekjaren", icoon: CalendarDays },
      { href: "/auditlog", label: "Auditlog", icoon: ClipboardList },
      { href: "/instellingen", label: "Instellingen", icoon: Settings },
    ],
  },
];

function isActief(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navigatie() {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);

  const inhoud = (
      <ul className="grid grid-cols-2 gap-x-3 px-3 py-2 lg:flex lg:flex-col lg:gap-0 lg:py-0">
        {GROEPEN.map((groep) => (
          <li key={groep.titel} className="pt-3">
            <p className="px-2 pb-1 text-[0.68rem] font-semibold tracking-wider text-muted-foreground uppercase">
              {groep.titel}
            </p>
            <ul className="space-y-0.5">
              {groep.items.map((item) => {
                const actief = isActief(pathname, item.href);
                const Icoon = item.icoon;
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      aria-current={actief ? "page" : undefined}
                      onClick={() => { if (menu.current) menu.current.open = false; }}
                      className={cn(
                        "flex min-h-10 items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:min-h-9",
                        actief
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-foreground/75 hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <Icoon className="size-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
  );
  return (
    <nav aria-label="Hoofdnavigatie" className="pb-3 lg:py-2">
      <div className="hidden lg:block">{inhoud}</div>
      <details ref={menu} className="lg:hidden" onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current?.open) {
          menu.current.open = false;
          menu.current.querySelector("summary")?.focus();
        }
      }}>
      <summary className="mx-4 flex cursor-pointer list-none items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm font-medium">
        <span className="flex items-center gap-2"><Menu className="size-4" />Menu</span>
        <span className="text-muted-foreground">{GROEPEN.flatMap((groep) => groep.items).find((item) => isActief(pathname, item.href))?.label}</span>
      </summary>
      {inhoud}
      </details>
    </nav>
  );
}
