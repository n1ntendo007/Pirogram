import type { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-700 px-5 py-3 text-sm font-black text-black shadow-xl shadow-amber-950/35 transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55",
        className
      )}
    />
  );
}
