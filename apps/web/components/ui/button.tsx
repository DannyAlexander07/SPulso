import Link from "next/link";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/ui";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  danger:
    "border-[#fecdca] bg-[#fee4e2] text-[#b42318] hover:border-[#fda29b] hover:bg-[#fecdca]",
  ghost:
    "border-transparent bg-transparent text-[#475467] hover:bg-[#eef2ff] hover:text-[#4f46e5]",
  primary:
    "border-[#4f46e5] bg-[#4f46e5] text-white shadow-[0_14px_30px_rgba(79,70,229,0.22)] hover:-translate-y-0.5 hover:bg-[#4338ca] hover:shadow-[0_18px_36px_rgba(79,70,229,0.26)]",
  secondary:
    "border-[#d8dee8] bg-white text-[#344054] shadow-sm hover:-translate-y-0.5 hover:border-[#818cf8] hover:bg-[#f7f7ff] hover:text-[#4f46e5]",
  soft:
    "border-[#c7d2fe] bg-[#eef2ff] text-[#4f46e5] hover:-translate-y-0.5 hover:bg-[#dfe7ff]",
};

const sizes: Record<ButtonSize, string> = {
  icon: "h-9 w-9 justify-center px-0",
  lg: "h-11 px-4 text-sm",
  md: "h-9 px-3.5 text-sm",
  sm: "h-8 px-3 text-xs",
};

type BaseProps = {
  children?: ReactNode;
  className?: string;
  icon?: ElementType;
  iconAfter?: ElementType;
  isLoading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

type ButtonProps = BaseProps & ComponentPropsWithoutRef<"button">;
type LinkButtonProps = BaseProps & ComponentPropsWithoutRef<typeof Link>;

export function Button({
  children,
  className,
  disabled,
  icon: Icon,
  iconAfter: IconAfter,
  isLoading,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClassName({ className, size, variant })}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children ? <span className="truncate">{children}</span> : null}
      {IconAfter ? <IconAfter className="h-4 w-4" /> : null}
    </button>
  );
}

export function LinkButton({
  children,
  className,
  icon: Icon,
  iconAfter: IconAfter,
  isLoading,
  size = "md",
  variant = "primary",
  ...props
}: LinkButtonProps) {
  return (
    <Link className={buttonClassName({ className, size, variant })} {...props}>
      {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children ? <span className="truncate">{children}</span> : null}
      {IconAfter ? <IconAfter className="h-4 w-4" /> : null}
    </Link>
  );
}

function buttonClassName({
  className,
  size,
  variant,
}: {
  className?: string;
  size: ButtonSize;
  variant: ButtonVariant;
}) {
  return cn(
    "spulso-interactive inline-flex shrink-0 items-center gap-2 rounded-[13px] border font-semibold transition disabled:pointer-events-none disabled:opacity-55",
    "focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#818cf8]/40",
    sizes[size],
    variants[variant],
    className,
  );
}
