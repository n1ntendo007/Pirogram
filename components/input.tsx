import type { InputHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "min-h-12 w-full rounded-2xl border border-yellow-300/15 bg-white/[0.055] px-4 py-3 text-sm text-zinc-50 outline-none placeholder:text-zinc-500 transition focus:border-yellow-300/80 focus:bg-yellow-300/[0.07]",
        className
      )}
    />
  );
}
