import * as React from "react"

import { cn } from "@/lib/utils"
import { sanitizeInputClassName } from "./input"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
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
    <textarea
      data-slot="textarea"
      className={sanitizeInputClassName(
        cn(
          "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
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

export { Textarea }
