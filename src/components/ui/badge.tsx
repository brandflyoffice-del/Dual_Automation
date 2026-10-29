import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium leading-4 [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-secondary-foreground",
        emerald: "border-emerald/30 bg-emerald/10 text-emerald",
        indigo: "border-indigo/30 bg-indigo/10 text-indigo-700",
        amber: "border-amber-500/30 bg-amber-500/10 text-amber-700",
        rose: "border-rose-500/30 bg-rose-500/10 text-rose-600",
        sky: "border-sky-500/30 bg-sky-500/10 text-sky-700",
        outline: "border-border text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
