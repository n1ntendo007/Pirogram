"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password })
    });

    const data = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(data?.error ?? "Не удалось войти. Проверь логин и пароль.");
      return;
    }

    router.replace("/chat");
  }

  return (
    <main className="safe-screen flex items-center justify-center">
      <section className="glass w-full max-w-md rounded-[2rem] p-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-300 text-3xl font-black shadow-2xl shadow-violet-950/60">P</div>
          <h1 className="text-3xl font-black tracking-tight">Pirogram</h1>
          <p className="mt-2 text-sm text-slate-400">Вход по логину и паролю</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Логин для входа" autoCapitalize="none" autoComplete="username" required />
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Пароль" autoComplete="current-password" required />
          {error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          <Button disabled={loading} className="w-full">{loading ? "Входим..." : "Войти"}</Button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">Искать людей внутри приложения можно по публичному @username.</p>
        <p className="mt-6 text-center text-sm text-slate-400">
          Нет аккаунта? <Link href="/register" className="font-semibold text-cyan-300">Создать</Link>
        </p>
      </section>
    </main>
  );
}
