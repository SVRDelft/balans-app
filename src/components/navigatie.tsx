"use client";

import Link from "next/link";
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
  Scale,
  Settings,
  Table2,
  Target,
  Users,
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

  return (
    <nav className="lg:py-2">
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-3 lg:py-0">
        {GROEPEN.map((groep) => (
          <li key={groep.titel} className="contents lg:block lg:pt-4">
            <p className="hidden px-2 pb-1 text-[0.68rem] font-semibold tracking-wider text-muted-foreground uppercase lg:block">
              {groep.titel}
            </p>
            <ul className="contents lg:block lg:space-y-0.5">
              {groep.items.map((item) => {
                const actief = isActief(pathname, item.href);
                const Icoon = item.icoon;
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      aria-current={actief ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
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
    </nav>
  );
}
