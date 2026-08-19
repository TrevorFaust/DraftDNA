import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { cn } from "@/lib/utils";

export function NewsPageFrame({
  children,
  wide,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className={cn("mx-auto w-full px-4 py-8 sm:px-6", wide ? "max-w-6xl" : "max-w-3xl")}>
        {children}
      </div>
    </div>
  );
}

export function NewsBreadcrumb({
  items,
}: {
  items: { to?: string; label: string }[];
}) {
  return (
    <nav
      className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
      aria-label="Breadcrumb"
    >
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">/</span>}
          {item.to ? (
            <Link to={item.to} className="hover:text-primary hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground" aria-current="page">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
