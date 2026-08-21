import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/ui";

type FieldBaseProps = {
  error?: string;
  hint?: string;
  icon?: ElementType;
  label?: string;
  rightSlot?: ReactNode;
};

export function TextField({
  className,
  error,
  hint,
  icon: Icon,
  label,
  rightSlot,
  ...props
}: FieldBaseProps & ComponentPropsWithoutRef<"input">) {
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-[13px] font-semibold text-[#667085]">{label}</span> : null}
      <span
        className={cn(
          "flex min-h-10 items-center gap-2 rounded-[13px] border border-[#d8dee8] bg-white px-3 transition hover:border-[#c8d2e0] focus-within:border-[#4f46e5] focus-within:ring-4 focus-within:ring-[#4f46e5]/10",
          error && "border-[#fda29b] focus-within:border-[#d92d20] focus-within:ring-[#d92d20]/10",
        )}
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-[#98a2b3]" /> : null}
        <input autoComplete="off"
          className={cn("min-w-0 flex-1 bg-transparent text-sm text-[#1f242d] outline-none placeholder:text-[#98a2b3]", className)}
          {...props}
        />
        {rightSlot}
      </span>
      {error ? <span className="mt-1.5 block text-xs font-semibold text-[#b42318]">{error}</span> : null}
      {!error && hint ? <span className="mt-1.5 block text-xs text-[#667085]">{hint}</span> : null}
    </label>
  );
}

export function SelectField({
  className,
  error,
  hint,
  icon: Icon,
  label,
  ...props
}: FieldBaseProps & ComponentPropsWithoutRef<"select">) {
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-[13px] font-semibold text-[#667085]">{label}</span> : null}
      <span
        className={cn(
          "flex min-h-10 items-center gap-2 rounded-[13px] border border-[#d8dee8] bg-white px-3 transition hover:border-[#c8d2e0] focus-within:border-[#4f46e5] focus-within:ring-4 focus-within:ring-[#4f46e5]/10",
          error && "border-[#fda29b] focus-within:border-[#d92d20] focus-within:ring-[#d92d20]/10",
        )}
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-[#98a2b3]" /> : null}
        <select className={cn("min-w-0 flex-1 bg-transparent text-sm text-[#1f242d] outline-none", className)} {...props} />
      </span>
      {error ? <span className="mt-1.5 block text-xs font-semibold text-[#b42318]">{error}</span> : null}
      {!error && hint ? <span className="mt-1.5 block text-xs text-[#667085]">{hint}</span> : null}
    </label>
  );
}

export function TextAreaField({
  className,
  error,
  hint,
  label,
  ...props
}: FieldBaseProps & ComponentPropsWithoutRef<"textarea">) {
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-[13px] font-semibold text-[#667085]">{label}</span> : null}
      <textarea autoComplete="off"
        className={cn(
          "min-h-28 w-full rounded-[13px] border border-[#d8dee8] bg-white px-3 py-2.5 text-sm text-[#1f242d] outline-none transition placeholder:text-[#98a2b3] hover:border-[#c8d2e0] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10",
          error && "border-[#fda29b] focus:border-[#d92d20] focus:ring-[#d92d20]/10",
          className,
        )}
        {...props}
      />
      {error ? <span className="mt-1.5 block text-xs font-semibold text-[#b42318]">{error}</span> : null}
      {!error && hint ? <span className="mt-1.5 block text-xs text-[#667085]">{hint}</span> : null}
    </label>
  );
}
