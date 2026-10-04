import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { cn } from "@/lib/utils";

const FRAME_WIDTH = {
  narrow: "max-w-3xl",
  reading: "max-w-5xl",
  wide: "max-w-6xl",
} as const;

export function NewsPageFrame({
  children,
  wide,
  width,
}: {
  children: ReactNode;
  wide?: boolean;
  width?: keyof typeof FRAME_WIDTH;
}) {
  const size = width ?? (wide ? "wide" : "narrow");
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className={cn("mx-auto w-full px-4 py-8 sm:px-6 lg:px-8", FRAME_WIDTH[size])}>
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
