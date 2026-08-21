import { cn } from "@/lib/ui";

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("block animate-shimmer rounded-xl bg-[#eef2f6]", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-[18px] border border-[#e1e5eb] bg-white/95 p-3.5 shadow-sm">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-3 h-7 w-20" />
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-3/4" />
    </div>
  );
}
