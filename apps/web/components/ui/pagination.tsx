import Link from "next/link";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/ui";

export function Pagination({
  buildHref,
  className,
  page,
  totalPages,
  totalLabel,
}: {
  buildHref: (page: number) => string;
  className?: string;
  page: number;
  totalPages: number;
  totalLabel?: string;
}) {
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;
  const items = buildPageItems(page, totalPages);

  return (
    <div className={cn("flex flex-col gap-3 border-t border-[#e1e5eb] pt-3 xl:flex-row xl:items-center xl:justify-between", className)}>
      <p className="text-sm font-semibold text-[#344054]">{totalLabel ?? `Pagina ${page} de ${totalPages}`}</p>

      <div className="flex flex-wrap items-center gap-2">
        <PageLink disabled={!hasPrevious} href={buildHref(Math.max(page - 1, 1))}>
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Anterior</span>
        </PageLink>

        <div className="flex flex-wrap items-center gap-1 rounded-[14px] border border-[#e1e5eb] bg-[#fbfcfd] p-1">
          {items.map((item, index) =>
            item === "ellipsis" ? (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#98a2b3]" key={`ellipsis-${index}`}>
                <MoreHorizontal className="h-4 w-4" />
              </span>
            ) : (
              <Link
                aria-current={item === page ? "page" : undefined}
                className={cn(
                  "spulso-interactive inline-flex h-8 min-w-8 items-center justify-center rounded-xl px-2.5 text-sm font-bold transition",
                  item === page
                    ? "bg-[#4f46e5] text-white shadow-sm shadow-[#4f46e5]/20"
                    : "text-[#475467] hover:bg-white hover:text-[#4f46e5] hover:shadow-sm",
                )}
                href={buildHref(item)}
                key={item}
              >
                {item}
              </Link>
            ),
          )}
        </div>

        <PageLink disabled={!hasNext} href={buildHref(Math.min(page + 1, totalPages))}>
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight className="h-4 w-4" />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  children,
  disabled,
  href,
}: {
  children: React.ReactNode;
  disabled: boolean;
  href: string;
}) {
  return (
    <Link
      aria-disabled={disabled}
      className={cn(
        "spulso-interactive inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition sm:px-4",
        disabled
          ? "pointer-events-none border-[#e1e5eb] bg-[#f8fafc] text-[#98a2b3]"
          : "border-[#d8dee8] bg-white text-[#475467] hover:border-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4f46e5]",
      )}
      href={disabled ? "#" : href}
    >
      {children}
    </Link>
  );
}

function buildPageItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const validPages = [...pages]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((left, right) => left - right);
  const items: Array<number | "ellipsis"> = [];

  for (const item of validPages) {
    const previous = items[items.length - 1];

    if (typeof previous === "number" && item - previous > 1) {
      items.push("ellipsis");
    }

    items.push(item);
  }

  return items;
}
