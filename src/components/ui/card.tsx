import * as React from "react"

import { cn } from "@/lib/utils"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  const hasDarkBg = className?.includes('dark:bg-');
  const hasBgWhite = className?.includes('bg-white') || className?.includes('bg-slate-50') || className?.includes('bg-gray-50') || className?.includes('bg-slate-100') || className?.includes('bg-gray-100');
  const hasLightBorder = className?.includes('border-slate-200') || className?.includes('border-gray-200') || className?.includes('border-slate-100') || className?.includes('border-gray-100');
  const hasDarkBorder = className?.includes('dark:border-');
  const hasDarkText = className?.includes('dark:text-');
  const hasDarkSlateText = className?.includes('text-slate-900') || className?.includes('text-slate-800') || className?.includes('text-gray-900') || className?.includes('text-gray-800') || className?.includes('text-black');

  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className,
        hasBgWhite && !hasDarkBg && "dark:bg-slate-900",
        hasLightBorder && !hasDarkBorder && "dark:border-slate-800",
        hasDarkSlateText && !hasDarkText && "dark:text-slate-100"
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  const hasDarkBg = className?.includes('dark:bg-');
  const hasLightBg = className?.includes('bg-slate-50') || className?.includes('bg-gray-50') || className?.includes('bg-zinc-50') || className?.includes('bg-slate-100') || className?.includes('bg-gray-100') || className?.includes('bg-white');
  const hasLightBorder = className?.includes('border-slate-100') || className?.includes('border-slate-200') || className?.includes('border-gray-100') || className?.includes('border-gray-200');
  const hasDarkBorder = className?.includes('dark:border-');

  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3",
        className,
        hasLightBg && !hasDarkBg && "dark:bg-slate-900/90",
        hasLightBorder && !hasDarkBorder && "dark:border-slate-800"
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium text-slate-900 dark:text-slate-100 group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-4 group-data-[size=sm]/card:px-3", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
