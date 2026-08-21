import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/ui";

export function DataTable({
  children,
  className,
  tableClassName,
}: {
  children: ReactNode;
  className?: string;
  tableClassName?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-[18px] border border-[#e1e5eb] bg-white/95 shadow-[0_6px_18px_rgba(15,23,42,0.025)]",
        className,
      )}
    >
      <table className={cn("w-full border-separate border-spacing-0", tableClassName)}>{children}</table>
    </div>
  );
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
        {children}
      </tr>
    </thead>
  );
}

export function DataTableHeader({
  align = "left",
  children,
  className,
  ...props
}: {
  align?: "left" | "right" | "center";
  children: ReactNode;
} & ComponentPropsWithoutRef<"th">) {
  return (
    <th
      className={cn(
        "bg-[#fbfcfd] px-3.5 py-2.5 first:rounded-tl-[18px] last:rounded-tr-[18px]",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function DataTableCell({
  align = "left",
  children,
  className,
  ...props
}: {
  align?: "left" | "right" | "center";
  children: ReactNode;
  className?: string;
} & ComponentPropsWithoutRef<"td">) {
  return (
    <td
      className={cn(
        "border-t border-[#e1e5eb] px-3.5 py-2.5 text-sm",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}
