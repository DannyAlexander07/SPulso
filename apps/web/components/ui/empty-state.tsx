import type { ElementType, ReactNode } from "react";

export function EmptyState({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: ReactNode;
  description?: string;
  icon?: ElementType;
  title: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-[18px] border border-dashed border-[#c8d2e0] bg-[#fbfcfd] p-5 text-center">
      {Icon ? (
        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#eef2ff] text-[#4f46e5]">
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <h3 className="mt-3 text-sm font-semibold text-[#1f242d]">{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-sm leading-5 text-[#667085]">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
