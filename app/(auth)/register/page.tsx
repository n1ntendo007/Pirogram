"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [login, setLogin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, login, username, password })
    });

    const data = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(data?.error ?? "Не удалось создать аккаунт.");
      return;
    }

    router.replace("/chat");
  }

  return (
    <main className="safe-screen flex items-center justify-center">
      <section className="glass w-full max-w-md rounded-[2rem] p-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-300 text-3xl font-black shadow-2xl shadow-violet-950/60">P</div>
          <h1 className="text-3xl font-black tracking-tight">Создать Pirogram</h1>
          <p className="mt-2 text-sm text-slate-400">Ник + логин + публичный @username</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ник / имя в профиле" autoComplete="name" maxLength={40} />
          <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Логин для входа: например my_login" autoCapitalize="none" autoComplete="username" required />
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Публичный @username: например dragon_77" autoCapitalize="none" autoComplete="off" required />
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Пароль: буквы + цифры" autoComplete="new-password" required />
          {error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          <Button disabled={loading} className="w-full">{loading ? "Создаём..." : "Зарегистрироваться"}</Button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">Логин нужен для входа. @username видят другие люди и находят тебя по нему.</p>
        <p className="mt-6 text-center text-sm text-slate-400">
          Уже есть аккаунт? <Link href="/login" className="font-semibold text-cyan-300">Войти</Link>
        </p>
      </section>
    </main>
  );
}
