"use client";

import { Eye, EyeOff, LockKeyhole, UserPlus, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

type Mode = "login" | "register";

function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export default function AuthClient() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [login, setLogin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    const cleanLogin = normalizeUsername(login);
    const cleanUsername = normalizeUsername(username || login);
    const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body = mode === "login"
      ? { login: cleanLogin, password }
      : { displayName: displayName.trim(), login: cleanLogin, username: cleanUsername, password };

    try {
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? (mode === "login" ? "Не удалось войти." : "Не удалось создать аккаунт."));
        return;
      }
      router.replace("/chat");
      router.refresh();
    } catch {
      setError("Нет соединения с сервером. Обнови страницу и попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
  }

  return (
    <main className="safe-screen relative mx-auto grid min-h-dvh w-full place-items-center overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(245,158,11,.28),transparent_30%),radial-gradient(circle_at_80%_25%,rgba(234,179,8,.14),transparent_32%),linear-gradient(135deg,#050505,#11100b_45%,#050505)]" />
      <section className="relative w-full max-w-md overflow-hidden rounded-[2.2rem] border border-yellow-300/15 bg-black/55 p-5 shadow-[0_28px_120px_rgba(0,0,0,.75),0_0_70px_rgba(245,158,11,.12)] backdrop-blur-2xl sm:p-7">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-yellow-400/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-amber-600/10 blur-3xl" />

        <div className="relative text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-[1.35rem] bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-700 text-3xl font-black text-black shadow-2xl shadow-amber-950/60">
            P
          </div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-yellow-300/15 bg-yellow-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-yellow-200">
            <Zap size={13} /> Pirogram
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            {mode === "login" ? "Вход в аккаунт" : "Создать аккаунт"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {mode === "login"
              ? "Введи логин или @username и пароль."
              : "Логин нужен для входа, @username — чтобы тебя могли найти."}
          </p>
        </div>

        <div className="relative my-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          <button type="button" onClick={() => switchMode("login")} className={`rounded-xl px-4 py-3 text-sm font-black transition ${mode === "login" ? "bg-yellow-300 text-black shadow-lg shadow-yellow-950/30" : "text-zinc-400 active:bg-white/[0.06]"}`}>Войти</button>
          <button type="button" onClick={() => switchMode("register")} className={`rounded-xl px-4 py-3 text-sm font-black transition ${mode === "register" ? "bg-yellow-300 text-black shadow-lg shadow-yellow-950/30" : "text-zinc-400 active:bg-white/[0.06]"}`}>Регистрация</button>
        </div>

        <form className="relative space-y-3" onSubmit={onSubmit}>
          {mode === "register" ? (
            <>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Ник / имя в чате" autoComplete="name" maxLength={40} />
              <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Публичный @username" autoCapitalize="none" autoCorrect="off" autoComplete="off" inputMode="text" maxLength={32} />
            </>
          ) : null}

          <Input value={login} onChange={(event) => setLogin(event.target.value)} placeholder={mode === "login" ? "Логин или @username" : "Логин для входа"} autoCapitalize="none" autoCorrect="off" autoComplete="username" inputMode="text" maxLength={32} required />

          <div className="relative">
            <Input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} placeholder={mode === "register" ? "Пароль минимум 8 символов" : "Пароль"} autoComplete={mode === "register" ? "new-password" : "current-password"} required />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-zinc-400 active:bg-white/10" aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm leading-5 text-red-100">{error}</p> : null}

          <Button disabled={loading} className="w-full gap-2">
            {mode === "login" ? <LockKeyhole size={18} /> : <UserPlus size={18} />}
            {loading ? "Подождите..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </Button>
        </form>

        <p className="relative mt-5 text-center text-xs leading-5 text-zinc-500">
          На телефоне используй тот же логин/@username и пароль. После входа можно добавить сайт на экран домой.
        </p>
      </section>
    </main>
  );
}
