// ============================================================
// src/components/app-breadcrumb.tsx
// רכיב UI — app-breadcrumb
// ============================================================
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type Crumb = {
  label: string;
  to?: string;
  params?: Record<string, string>;
};

export function AppBreadcrumb({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList className="flex-nowrap">
        {items.map((c, i) => {
          const isLast = i === items.length - 1;
          return (
            <span key={`${c.label}-${i}`} className="contents">
              <BreadcrumbItem className="min-w-0">
                {isLast || !c.to ? (
                  <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Link to={c.to as any} params={c.params as any} className="truncate">
                      {c.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && (
                <BreadcrumbSeparator>
                  <ChevronLeft />
                </BreadcrumbSeparator>
              )}
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
