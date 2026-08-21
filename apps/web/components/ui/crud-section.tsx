import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

export function CrudSection({
  actions,
  children,
  className,
  description,
  eyebrow,
  filters,
  title,
}: {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: string;
  filters?: ReactNode;
  title: string;
}) {
  return (
    <section
      className={cn(
        "animate-rise min-w-0 rounded-[18px] border border-[#e1e5eb] bg-white/95 p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.035)] backdrop-blur-sm transition duration-200 hover:border-[#c8d2e0] hover:shadow-[0_14px_34px_rgba(15,23,42,0.055)]",
        className,
      )}
    >
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0 pr-0 lg:pr-4">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#667085]">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 whitespace-normal break-words text-lg font-semibold leading-6 tracking-normal text-[#1f242d]">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-5 text-[#667085]">{description}</p> : null}
        </div>

        {actions ? (
          <div className="flex w-full min-w-0 flex-wrap items-start gap-2 sm:w-auto sm:justify-start lg:max-w-full lg:justify-end">
            {actions}
          </div>
        ) : null}
      </div>

      {filters ? (
        <div className="mt-3 min-w-0 rounded-[16px] border border-[#e1e5eb] bg-[#fbfcfd] p-2">
          {filters}
        </div>
      ) : null}

      {children ? <div className="mt-4 min-w-0">{children}</div> : null}
    </section>
  );
}
