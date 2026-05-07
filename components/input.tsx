import type { InputHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "min-h-12 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-50 outline-none placeholder:text-slate-500 transition focus:border-cyan-300/70 focus:bg-white/[0.09]",
        className
      )}
    />
  );
}
