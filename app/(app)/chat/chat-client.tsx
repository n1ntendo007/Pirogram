"use client";

import { Bell, Camera, Check, CheckCheck, Loader2, LogOut, Mic, Paperclip, Phone, Plus, Search, Send, Smartphone, Video, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type User = {
  id: string;
  username: string;
  displayName: string;
  avatarData: string | null;
};

type Message = {
  id: string;
  chatId: string;
  senderId: string | null;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE" | "SYSTEM" | "CALL";
  text: string | null;
  mediaData: string | null;
  mediaMime: string | null;
  mediaName: string | null;
  createdAt: string;
  sender?: User | null;
  readByOthers?: boolean;
};

type Chat = {
  id: string;
  type: string;
  title: string | null;
  username?: string | null;
  avatarData?: string | null;
  updatedAt: string;
  unreadCount?: number;
  members: User[];
  messages: Omit<Message, "mediaData">[];
};

type CallSession = {
  id: string;
  chatId: string;
  callerId: string;
  kind: "AUDIO" | "VIDEO";
  status: "RINGING" | "ACCEPTED" | "ENDED" | "MISSED" | "DECLINED";
  offer?: unknown;
  answer?: unknown;
  createdAt: string;
  caller: User;
};

type MediaDraft = {
  data: string;
  mime: string;
  name: string;
  type: "IMAGE" | "VIDEO";
};

const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function avatarLabel(name?: string | null) {
  return (name || "P").slice(0, 1).toUpperCase();
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

export default function ChatClient({ currentUser }: { currentUser: User }) {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [mediaDraft, setMediaDraft] = useState<MediaDraft | null>(null);
  const [pushStatus, setPushStatus] = useState("Проверяю уведомления...");
  const [pushReady, setPushReady] = useState(false);
  const [installTip, setInstallTip] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [callNotice, setCallNotice] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId), [chats, activeChatId]);
  const lastMessageDate = messages[messages.length - 1]?.createdAt;

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    setInstallTip(isIOS() ? "iPhone: нажмите «Поделиться» → «На экран Домой»." : "Android: меню браузера → «Установить приложение» / «На главный экран».");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    checkPushConfig();
  }, []);

  useEffect(() => {
    if (!activeChatId) return;
    loadMessages(activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let alive = true;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      const data = await response.json().catch(() => null);
      if (!alive) return;
      setSearching(false);
      setSearchResults(response.ok ? data?.users ?? [] : []);
    }, 250);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!activeChatId) return;
    const interval = window.setInterval(() => {
      loadNewMessages(activeChatId);
      refreshReadReceipts(activeChatId);
      pollCall(activeChatId);
    }, 2200);
    return () => window.clearInterval(interval);
  }, [activeChatId, lastMessageDate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, activeChatId]);

  async function loadChats() {
    setLoadingChats(true);
    const response = await fetch("/api/chats");
    const data = await response.json().catch(() => null);
    const nextChats = data?.chats ?? [];
    setChats(nextChats);
    setLoadingChats(false);
    if (!activeChatId && nextChats[0]) setActiveChatId(nextChats[0].id);
  }

  async function loadMessages(chatId: string) {
    const response = await fetch(`/api/messages?chatId=${encodeURIComponent(chatId)}`);
    const data = await response.json().catch(() => null);
    if (response.ok) {
      setMessages(data?.messages ?? []);
      loadChats();
    }
  }

  async function loadNewMessages(chatId: string) {
    const after = messages[messages.length - 1]?.createdAt;
    if (!after) return;
    const response = await fetch(`/api/messages?chatId=${encodeURIComponent(chatId)}&after=${encodeURIComponent(after)}`);
    const data = await response.json().catch(() => null);
    if (response.ok && data?.messages?.length) {
      setMessages((current) => {
        const known = new Set(current.map((message) => message.id));
        return [...current, ...data.messages.filter((message: Message) => !known.has(message.id))];
      });
      loadChats();
    }
  }



  async function refreshReadReceipts(chatId: string) {
    const response = await fetch(`/api/messages?chatId=${encodeURIComponent(chatId)}&statusOnly=1`);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.receipts?.length) return;
    const receipts = new Map<string, boolean>(data.receipts.map((item: { id: string; readByOthers: boolean }) => [item.id, item.readByOthers] as [string, boolean]));
    setMessages((current) => current.map((message) => receipts.has(message.id) ? { ...message, readByOthers: receipts.get(message.id) } : message));
  }

  async function startPrivateChat(username: string) {
    setSearchError("");
    const cleanUsername = username.trim().replace(/^@+/, "");
    if (!cleanUsername) return;
    const response = await fetch("/api/chats", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cleanUsername })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setSearchError(data?.error ?? "Не удалось открыть чат.");
      return;
    }
    setSearchQuery("");
    setSearchResults([]);
    const chat = data.chat as Chat;
    setChats((current) => [chat, ...current.filter((item) => item.id !== chat.id)]);
    setActiveChatId(chat.id);
  }

  async function createChat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await startPrivateChat(searchQuery);
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanText = text.trim();
    if ((!cleanText && !mediaDraft) || !activeChatId || sending) return;
    setSending(true);

    const payload = {
      chatId: activeChatId,
      text: cleanText,
      mediaData: mediaDraft?.data,
      mediaMime: mediaDraft?.mime,
      mediaName: mediaDraft?.name
    };

    setText("");
    setMediaDraft(null);

    const response = await fetch("/api/messages", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => null);
    setSending(false);

    if (response.ok && data?.message) {
      setMessages((current) => [...current, data.message]);
      loadChats();
    } else {
      setText(cleanText);
      alert(data?.error ?? "Не удалось отправить сообщение.");
    }
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      alert("Можно отправлять только фото и видео.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      alert("Файл слишком большой. Максимум 3.5 МБ в этой версии без отдельного хранилища.");
      return;
    }
    const data = await fileToDataUrl(file);
    setMediaDraft({ data, mime: file.type, name: file.name, type: file.type.startsWith("video/") ? "VIDEO" : "IMAGE" });
  }

  async function checkPushConfig() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushReady(false);
      setPushStatus("Push не поддерживается браузером");
      return;
    }

    const vapidResponse = await fetch("/api/push/vapid");
    const data = await vapidResponse.json().catch(() => null);
    if (!vapidResponse.ok || !data?.publicKey) {
      setPushReady(false);
      setPushStatus("Добавьте VAPID ключи в Vercel");
      return;
    }

    setPushReady(true);
    setPushStatus(Notification.permission === "granted" ? "Уведомления включены" : "Включить уведомления");
  }

  async function enablePush() {
    if (!pushReady) {
      setPushStatus("VAPID ключи ещё не добавлены");
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushStatus("Браузер не поддерживает push");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPushStatus("Разрешение не выдано");
      return;
    }

    const vapidResponse = await fetch("/api/push/vapid");
    const { publicKey } = await vapidResponse.json().catch(() => ({ publicKey: "" }));
    if (!vapidResponse.ok || !publicKey) {
      setPushReady(false);
      setPushStatus("Добавьте VAPID ключи в Vercel");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription)
    });

    setPushStatus(response.ok ? "Уведомления включены" : "Не удалось включить");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/");
  }

  async function startCall(kind: "AUDIO" | "VIDEO") {
    if (!activeChatId) return;
    setCallNotice(kind === "VIDEO" ? "Запускаю видеозвонок..." : "Запускаю аудиозвонок...");
    const response = await fetch("/api/calls", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: activeChatId, kind })
    });
    const data = await response.json().catch(() => null);
    if (response.ok) {
      setActiveCall(data.call);
      setCallNotice("Звонок создан. Для реального P2P соединения включён backend-сигналинг; без STUN/TURN звонки зависят от сети.");
    } else {
      setCallNotice(data?.error ?? "Не удалось создать звонок.");
    }
  }

  async function pollCall(chatId: string) {
    const response = await fetch(`/api/calls?chatId=${encodeURIComponent(chatId)}`);
    const data = await response.json().catch(() => null);
    if (response.ok) {
      setActiveCall(data.call ?? null);
    }
  }

  async function updateCall(status: "ACCEPTED" | "ENDED" | "DECLINED") {
    if (!activeCall) return;
    const response = await fetch("/api/calls", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId: activeCall.id, status })
    });
    const data = await response.json().catch(() => null);
    if (response.ok) {
      setActiveCall(data.call.status === "ENDED" || data.call.status === "DECLINED" ? null : data.call);
    }
  }

  return (
    <main className="safe-screen mx-auto flex max-w-7xl flex-col gap-4 lg:h-dvh lg:flex-row">
      <aside className="glass flex max-h-[44dvh] flex-col rounded-[2rem] p-3 lg:max-h-none lg:w-[25rem]">
        <div className="flex items-center justify-between p-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight">Pirogram</h1>
            <p className="truncate text-xs text-zinc-400">@{currentUser.username} · {currentUser.displayName}</p>
          </div>
          <button onClick={logout} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-zinc-300 active:scale-95" aria-label="Выйти">
            <LogOut size={18} />
          </button>
        </div>

        {installTip ? (
          <div className="mx-3 mb-3 flex gap-3 rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-3 text-xs text-yellow-100">
            <Smartphone className="mt-0.5 shrink-0" size={16} />
            <span>{installTip}</span>
          </div>
        ) : null}

        <button onClick={enablePush} className={`mx-3 mb-3 flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold active:scale-[0.98] ${pushReady ? "border-amber-300/20 bg-amber-400/10 text-amber-100" : "border-white/10 bg-white/[0.05] text-zinc-400"}`}>
          <Bell size={16} /> {pushStatus}
        </button>

        <form onSubmit={createChat} className="mx-3 mb-3 space-y-2">
          <div className="flex gap-2">
            <label className="flex min-h-12 flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-sm text-zinc-300 focus-within:border-yellow-300/60">
              <Search size={16} />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Найти по @username" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-zinc-500" autoCapitalize="none" />
            </label>
            <button className="rounded-2xl bg-white/[0.09] p-3 text-yellow-100 active:scale-95" aria-label="Открыть чат"><Plus size={19} /></button>
          </div>
          {searching ? <p className="px-2 text-xs text-zinc-500">Ищу пользователя...</p> : null}
          {searchResults.length ? (
            <div className="space-y-2 rounded-3xl border border-white/10 bg-black/20 p-2">
              {searchResults.map((user) => (
                <button key={user.id} type="button" onClick={() => startPrivateChat(user.username)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left active:bg-white/[0.08]">
                  {user.avatarData ? <img src={user.avatarData} alt="" className="h-10 w-10 rounded-2xl object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-700 text-sm font-black text-black">{avatarLabel(user.displayName || user.username)}</div>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{user.displayName}</span>
                    <span className="block truncate text-xs text-yellow-200">@{user.username}</span>
                  </span>
                  <span className="rounded-xl bg-yellow-300/10 px-2 py-1 text-xs font-semibold text-yellow-100">Чат</span>
                </button>
              ))}
            </div>
          ) : null}
          {searchError ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">{searchError}</p> : null}
        </form>

        <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto p-2">
          {loadingChats ? <p className="p-3 text-sm text-zinc-400">Загружаю чаты...</p> : null}
          {chats.map((chat) => {
            const lastMessage = chat.messages?.[0];
            const active = chat.id === activeChatId;
            return (
              <button key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`w-full rounded-3xl p-3 text-left transition ${active ? "bg-white/[0.12]" : "bg-white/[0.04] active:bg-white/[0.08]"}`}>
                <div className="flex items-center gap-3">
                  {chat.avatarData ? <img src={chat.avatarData} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" /> : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-700 font-black text-black">{avatarLabel(chat.title)}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate font-semibold">{chat.title || "Чат"}</p>
                      {chat.unreadCount ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-yellow-300 px-1.5 text-[10px] font-black text-black">{chat.unreadCount > 9 ? "9+" : chat.unreadCount}</span> : null}
                    </div>
                    <p className="truncate text-xs text-zinc-400">{lastMessage?.text || (lastMessage?.type === "IMAGE" ? "Фото" : lastMessage?.type === "VIDEO" ? "Видео" : "Нет сообщений")}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="glass flex min-h-[56dvh] flex-1 flex-col overflow-hidden rounded-[2rem] lg:min-h-0">
        <header className="flex items-center justify-between border-b border-white/10 p-4">
          <div className="min-w-0">
            <h2 className="truncate font-black">{activeChat?.title || "Выберите чат"}</h2>
            <p className="truncate text-xs text-zinc-400">{activeChat?.username ? `@${activeChat.username}` : "mobile-first · PWA · login/password"}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => startCall("AUDIO")} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-zinc-300 active:scale-95" title="Аудиозвонок">
              <Phone size={18} />
            </button>
            <button onClick={() => startCall("VIDEO")} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-zinc-300 active:scale-95" title="Видеозвонок">
              <Video size={18} />
            </button>
          </div>
        </header>

        {activeCall ? (
          <div className="mx-4 mt-4 flex items-center justify-between rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-3 text-sm text-yellow-100">
            <div>
              <p className="font-black">{activeCall.kind === "VIDEO" ? "Видеозвонок" : "Аудиозвонок"}</p>
              <p className="text-xs text-yellow-100/70">{activeCall.callerId === currentUser.id ? "Вы звоните" : `${activeCall.caller.displayName} звонит`} · {activeCall.status}</p>
            </div>
            <div className="flex gap-2">
              {activeCall.callerId !== currentUser.id && activeCall.status === "RINGING" ? <button onClick={() => updateCall("ACCEPTED")} className="rounded-2xl bg-emerald-400/20 p-3 text-emerald-100"><Check size={17} /></button> : null}
              <button onClick={() => updateCall(activeCall.status === "RINGING" && activeCall.callerId !== currentUser.id ? "DECLINED" : "ENDED")} className="rounded-2xl bg-red-500/20 p-3 text-red-100"><X size={17} /></button>
            </div>
          </div>
        ) : null}
        {callNotice ? <p className="mx-4 mt-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-xs text-zinc-300">{callNotice}</p> : null}

        <div ref={scrollRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((message) => {
            const mine = message.senderId === currentUser.id;
            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[86%] overflow-hidden rounded-[1.4rem] px-4 py-3 text-sm shadow-xl ${mine ? "bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-700 text-black" : "bg-white/[0.08] text-zinc-100"}`}>
                  {!mine ? <p className="mb-1 text-xs font-semibold text-yellow-200">{message.sender?.displayName || message.sender?.username || "Pirogram"}</p> : null}
                  {message.mediaData && message.type === "IMAGE" ? <img src={message.mediaData} alt={message.mediaName || "Фото"} className="mb-2 max-h-80 w-full rounded-2xl object-cover" /> : null}
                  {message.mediaData && message.type === "VIDEO" ? <video src={message.mediaData} controls playsInline className="mb-2 max-h-80 w-full rounded-2xl" /> : null}
                  {message.text ? <p className="whitespace-pre-wrap break-words">{message.text}</p> : null}
                  <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-black/65" : "text-zinc-500"}`}>
                    <span>{timeLabel(message.createdAt)}</span>
                    {mine ? (message.readByOthers ? <CheckCheck size={13} strokeWidth={2.4} /> : <Check size={13} strokeWidth={2.4} />) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {mediaDraft ? (
          <div className="border-t border-white/10 px-3 pt-3">
            <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.06] p-3">
              {mediaDraft.type === "IMAGE" ? <img src={mediaDraft.data} alt="preview" className="h-16 w-16 rounded-2xl object-cover" /> : <video src={mediaDraft.data} className="h-16 w-16 rounded-2xl object-cover" muted playsInline />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{mediaDraft.name}</p>
                <p className="text-xs text-zinc-400">Готово к отправке</p>
              </div>
              <button onClick={() => setMediaDraft(null)} className="rounded-2xl bg-white/[0.08] p-2 text-zinc-300"><X size={17} /></button>
            </div>
          </div>
        ) : null}

        <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-white/10 p-3">
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={onFileChange} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-zinc-300 active:scale-95" title="Фото или видео">
            <Paperclip size={19} />
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-zinc-300 active:scale-95" title="Камера">
            <Camera size={19} />
          </button>
          <button type="button" className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-zinc-300 opacity-50" title="Голосовые сообщения можно добавить следующим файлом">
            <Mic size={19} />
          </button>
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Сообщение" className="max-h-36 min-h-12 flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-yellow-300/70" rows={1} />
          <button disabled={sending || (!text.trim() && !mediaDraft) || !activeChatId} className="rounded-2xl bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-700 p-3 text-black shadow-lg shadow-amber-950/40 disabled:opacity-50" aria-label="Отправить">
            {sending ? <Loader2 className="animate-spin" size={19} /> : <Send size={19} />}
          </button>
        </form>
      </section>
    </main>
  );
}
