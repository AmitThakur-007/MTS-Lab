import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * Sanitizes input class names so that any unqualified text-xs or text-sm
 * sizes are promoted to text-base (16px) on mobile viewports (< 768px) and deferred
 * to md:text-xs / md:text-sm on desktop, permanently preventing iOS Safari auto-zoom.
 */
export function sanitizeInputClassName(className?: string): string {
  if (!className) return "text-base md:text-sm";
  const tokens = className.split(/\s+/).filter(Boolean);
  const adjusted = tokens.map(t => {
    if (t === 'text-xs') return 'text-base md:text-xs';
    if (t === 'text-sm') return 'text-base md:text-sm';
    if (t === 'sm:text-xs') return 'md:text-xs';
    if (t === 'sm:text-sm') return 'md:text-sm';
    return t;
  });
  return cn("text-base md:text-sm", ...adjusted);
}

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={sanitizeInputClassName(
        cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )
      )}
      {...props}
    />
  )
}

export { Input }
