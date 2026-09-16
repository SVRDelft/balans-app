import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-card px-2.5 py-1 text-sm shadow-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "text-sm leading-none font-medium text-foreground select-none",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Label, veld en eventuele toelichting bij elkaar. Scheelt herhaling in de
 * vele formulieren van deze app.
 */
function Veld({
  label,
  htmlFor,
  toelichting,
  fout,
  verplicht,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  toelichting?: React.ReactNode;
  fout?: string;
  verplicht?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {verplicht ? (
          <span className="ml-0.5 text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </Label>
      {React.Children.map(children, (kind) => {
        if (!htmlFor || !React.isValidElement<React.ComponentProps<"input">>(kind) || kind.props.id !== htmlFor) return kind;
        return React.cloneElement(kind, {
          "aria-invalid": fout ? true : undefined,
          "aria-describedby": [toelichting ? `${htmlFor}-hulp` : "", fout ? `${htmlFor}-fout` : ""].filter(Boolean).join(" ") || undefined,
        });
      })}
      {toelichting ? (
        <p id={htmlFor ? `${htmlFor}-hulp` : undefined} className="text-xs text-muted-foreground">{toelichting}</p>
      ) : null}
      {fout ? <p id={htmlFor ? `${htmlFor}-fout` : undefined} role="alert" className="text-xs text-destructive">{fout}</p> : null}
    </div>
  );
}

export { Input, Textarea, Select, Label, Veld };
