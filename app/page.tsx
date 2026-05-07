import Link from "next/link";
import { ArrowRight, Bell, Lock, MessageCircle, Smartphone, Video } from "lucide-react";

const features = [
  { icon: MessageCircle, title: "Чаты", text: "Личные диалоги, избранное и обновление сообщений без стороннего realtime-провайдера." },
  { icon: Bell, title: "Push", text: "Web Push через service worker: уведомления о новых сообщениях и звонках." },
  { icon: Video, title: "Звонки", text: "Встроенный WebRTC-слой с polling-сигналингом. Без LiveKit и подобных сервисов." },
  { icon: Lock, title: "Защита", text: "Хэш паролей, httpOnly cookie, rate-limit, валидация данных и security headers." },
  { icon: Smartphone, title: "На экран домой", text: "PWA для iPhone и Android: manifest, service worker, иконки и mobile-first интерфейс." }
];

export default function HomePage() {
  return (
    <main className="safe-screen mx-auto flex max-w-6xl flex-col gap-8 py-10">
      <section className="glass overflow-hidden rounded-[2rem] p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-bold text-cyan-100">
              Pirogram · dark mobile messenger
            </div>
            <h1 className="max-w-3xl text-5xl font-black tracking-tight sm:text-6xl">
              Тёмный мессенджер под телефон, хостинг и GitHub.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              Готовый стартовый проект: регистрация по логину и паролю, переписки, фото и видео в чатах, push-уведомления, PWA и базовая серверная защита.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-400 px-5 py-3 text-sm font-black text-white shadow-xl shadow-violet-950/35 active:scale-[0.98]">
                Создать аккаунт <ArrowRight size={18} />
              </Link>
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-bold text-slate-100 active:scale-[0.98]">
                Войти
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm rounded-[2.4rem] border border-white/10 bg-black/40 p-3 shadow-2xl shadow-violet-950/50">
            <div className="rounded-[1.8rem] bg-slate-950/90 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black">Pirogram</p>
                  <p className="text-xs text-cyan-200">online</p>
                </div>
                <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-300" />
              </div>
              <div className="space-y-3">
                <div className="w-4/5 rounded-[1.3rem] bg-white/[0.08] p-3 text-sm text-slate-200">Привет, сайт уже как приложение 🔥</div>
                <div className="ml-auto w-4/5 rounded-[1.3rem] bg-gradient-to-br from-violet-500 to-cyan-500 p-3 text-sm font-semibold text-white">Кидай фото и видео прямо в чат</div>
                <div className="rounded-[1.3rem] border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-100">Вход теперь по логину и паролю</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.title} className="glass rounded-[1.7rem] p-5">
              <Icon className="mb-4 text-cyan-200" size={24} />
              <h2 className="font-black">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{feature.text}</p>
            </div>
          );
        })}
      </section>
    </main>
  );
}
