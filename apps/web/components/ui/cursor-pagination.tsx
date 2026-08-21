import Link from "next/link";
import { ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/ui";

export function CursorPagination({
  className,
  firstHref,
  hasNextPage,
  nextHref,
  totalLabel,
}: {
  className?: string;
  firstHref: string;
  hasNextPage: boolean;
  nextHref: string;
  totalLabel: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-[#e1e5eb] pt-3 xl:flex-row xl:items-center xl:justify-between",
        className,
      )}
    >
      <p className="text-sm font-semibold text-[#344054]">{totalLabel}</p>

      <div className="flex flex-wrap items-center gap-2">
        <PageLink disabled={false} href={firstHref}>
          <RotateCcw className="h-4 w-4" />
          <span>Primera pagina</span>
        </PageLink>

        <PageLink disabled={!hasNextPage} href={nextHref}>
          <span>Siguiente</span>
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
