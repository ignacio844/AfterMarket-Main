"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentProps } from "react";

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({ className, align = "center", sideOffset = 8, ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={joinClasses(
          "calendar-popover-content z-50 outline-none data-[state=closed]:animate-none data-[state=open]:animate-[calendar-popover-in_180ms_cubic-bezier(0.22,1,0.36,1)]",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
