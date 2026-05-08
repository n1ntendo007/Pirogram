import type { InputHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "min-h-12 w-full rounded-2xl border border-sky-300/15 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 outline-none placeholder:text-slate-500 transition focus:border-sky-300/80 focus:bg-sky-400/[0.08] focus:shadow-[0_0_0_4px_rgba(56,189,248,.08)]",
        className
      )}
    />
  );
}
