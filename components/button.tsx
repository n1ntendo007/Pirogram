import type { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-400 px-5 py-3 text-sm font-black text-white shadow-xl shadow-violet-950/35 transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55",
        className
      )}
    />
  );
}
