import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * Sanitizes input and form-control class names so that any sub-16px font sizes
 * (text-xs, text-sm, text-[11px-15px], sm:text-xs, etc.) are promoted to text-base
 * (16px) on mobile viewports (< 768px / md) and deferred to md:text-sm / md:text-xs
 * on desktop, permanently preventing iOS Safari, Chrome for iOS, and mobile WebKit auto-zoom.
 */
export function sanitizeInputClassName(className?: string): string {
  if (!className) return "text-base md:text-sm";
  const tokens = className.split(/\s+/).filter(Boolean);
  const adjusted = tokens.map(t => {
    // Unprefixed sub-16px font sizes
    if (t === 'text-xs') return 'text-base md:text-xs';
    if (t === 'text-sm') return 'text-base md:text-sm';
    const customPx = t.match(/^text-\[(1[0-5]|[1-9])px\]$/);
    if (customPx) return `text-base md:${t}`;

    // Small-breakpoint prefixed sub-16px font sizes (e.g. sm:text-xs, sm:text-sm)
    if (t === 'sm:text-xs' || t === 'xs:text-xs') return 'md:text-xs';
    if (t === 'sm:text-sm' || t === 'xs:text-sm') return 'md:text-sm';
    const customSmPx = t.match(/^(?:sm|xs):text-\[(1[0-5]|[1-9])px\]$/);
    if (customSmPx) return `md:text-[${customSmPx[1]}px]`;

    return t;
  });
  return cn("text-base md:text-sm", ...adjusted);
}

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const hasFocusWhite = className?.includes('focus:bg-white');
  const hasDarkFocus = className?.includes('dark:focus:bg-');
  const hasLightBg = className?.includes('bg-white') || className?.includes('bg-slate-50') || className?.includes('bg-slate-100') || className?.includes('bg-gray-50') || className?.includes('bg-gray-100') || className?.includes('bg-zinc-50');
  const hasDarkBg = className?.includes('dark:bg-');
  const hasLightBorder = className?.includes('border-slate-200') || className?.includes('border-slate-100') || className?.includes('border-gray-200') || className?.includes('border-gray-100');
  const hasDarkBorder = className?.includes('dark:border-');
  const hasDarkPlaceholder = className?.includes('dark:placeholder:');
  const hasDarkText = className?.includes('text-slate-900') || className?.includes('text-slate-800') || className?.includes('text-slate-950') || className?.includes('text-black') || className?.includes('text-gray-900') || className?.includes('text-gray-800');
  const hasDarkVariantText = className?.includes('dark:text-');

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={sanitizeInputClassName(
        cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className,
          hasLightBg && !hasDarkBg && "dark:bg-slate-800 dark:text-white",
          hasDarkText && !hasDarkVariantText && "dark:text-white",
          hasFocusWhite && !hasDarkFocus && "dark:focus:bg-slate-800",
          hasLightBorder && !hasDarkBorder && "dark:border-slate-700",
          !hasDarkPlaceholder && "dark:placeholder:text-slate-400"
        )
      )}
      {...props}
    />
  )
}

export { Input }
