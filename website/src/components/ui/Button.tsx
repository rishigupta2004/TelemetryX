"use client";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "secondary" | "outline" | "terminal";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          "relative inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 group",
          {
            "bg-white text-black hover:bg-zinc-200 border border-transparent font-sans shadow-[0_0_20px_rgba(255,255,255,0.2)]": variant === "primary",
            "bg-zinc-900 text-white hover:bg-zinc-800 border border-zinc-700 font-sans": variant === "secondary",
            "border border-zinc-700 bg-black hover:border-white text-zinc-300 hover:text-white font-sans": variant === "outline",
            "border border-[var(--telemetry-green)] bg-[#001100] text-[var(--telemetry-green)] font-mono uppercase tracking-widest hover:bg-[#002200] hover:shadow-[0_0_15px_rgba(0,255,0,0.3)]": variant === "terminal",
            "h-8 px-4 text-xs": size === "sm",
            "h-10 px-6 text-sm": size === "md",
            "h-12 px-8 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
