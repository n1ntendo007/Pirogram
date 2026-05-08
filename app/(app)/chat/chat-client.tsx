"use client";

import {
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  Loader2,
  LogOut,
  Mic,
  Paperclip,
  Phone,
  PhoneOff,
  Plus,
  Search,
  Send,
  Smartphone,
  TestTube2,
  Video,
  VideoOff,
  X
} from "lucide-react";
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
  offer?: SignalDescription | null;
  answer?: SignalDescription | null;
  callerIce?: SignalIce[] | null;
  receiverIce?: SignalIce[] | null;
  createdAt: string;
  caller: User;
};

type MediaDraft = {
  data: string;
  mime: string;
  name: string;
  type: "IMAGE" | "VIDEO";
};

type SignalDescription = {
  type: RTCSdpType;
  sdp: string;
};

type SignalIce = {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string | null;
};

const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
];

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

function timeLabel(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function avatarLabel(name?: string | null) {
  return (name || "P").slice(0, 1).toUpperCase();
}

function chatPreview(message?: Omit<Message, "mediaData">) {
  if (!message) return "Нет сообщений";
  if (message.type === "IMAGE") return "📷 Фото";
  if (message.type === "VIDEO") return "🎬 Видео";
  if (message.type === "CALL") return message.text || "Звонок";
  return message.text || "Сообщение";
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
  const [pushStatus, setPushStatus] = useState("Проверяю push...");
  const [pushReady, setPushReady] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [installTip, setInstallTip] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [mobileListOpen, setMobileListOpen] = useState(true);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [callNotice, setCallNotice] = useState("");
  const [testingPush, setTestingPush] = useState(false);
  const [callWorking, setCallWorking] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callMuted, setCallMuted] = useState(false);
  const [callCameraOff, setCallCameraOff] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<CallSession | null>(null);
  const callRoleRef = useRef<"caller" | "receiver" | null>(null);
  const signalStartedRef = useRef<string | null>(null);
  const addedIceKeysRef = useRef<Set<string>>(new Set());

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId), [chats, activeChatId]);
  const lastMessageDate = messages[messages.length - 1]?.createdAt;

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    setInstallTip(isIOS() ? "iPhone: push работает только после «Поделиться» → «На экран Домой»." : "Android/ПК: можно установить как приложение — так push работает стабильнее.");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    void checkPushConfig();
  }, []);

  useEffect(() => {
    if (!activeChatId) return;
    void loadMessages(activeChatId);
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
      void loadNewMessages(activeChatId);
      void refreshReadReceipts(activeChatId);
      void pollCall(activeChatId);
    }, 2200);
    return () => window.clearInterval(interval);
  }, [activeChatId, lastMessageDate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, activeChatId]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    return () => {
      cleanupCallMedia();
    };
  }, []);

  async function loadChats() {
    setLoadingChats(true);
    const response = await fetch("/api/chats");
    const data = await response.json().catch(() => null);
    const nextChats = data?.chats ?? [];
    setChats(nextChats);
    setLoadingChats(false);
    if (!activeChatId && nextChats[0]) {
      setActiveChatId(nextChats[0].id);
    }
  }

  async function loadMessages(chatId: string) {
    const response = await fetch(`/api/messages?chatId=${encodeURIComponent(chatId)}`);
    const data = await response.json().catch(() => null);
    if (response.ok) {
      setMessages(data?.messages ?? []);
      void loadChats();
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
      void loadChats();
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
    setMobileListOpen(false);
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
      void loadChats();
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
      setPushStatus("Этот браузер не поддерживает web-push");
      return;
    }

    const vapidResponse = await fetch("/api/push/vapid");
    const data = await vapidResponse.json().catch(() => null);
    if (!vapidResponse.ok || !data?.publicKey) {
      setPushReady(false);
      setPushStatus("Нет VAPID ключей на сервере");
      return;
    }

    if (isIOS() && !isStandalone()) {
      setPushReady(true);
      setPushStatus("На iPhone сначала добавь сайт на экран Домой");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await fetch("/api/push/subscribe", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(existing)
        });
        setPushReady(true);
        setPushStatus("Push подключён на этом устройстве");
        return;
      }
    } catch {
      setPushReady(true);
      setPushStatus("Разреши уведомления и включи push");
      return;
    }

    setPushReady(true);
    if (Notification.permission === "granted") {
      setPushStatus("Разрешение есть, осталось подписать устройство");
    } else if (Notification.permission === "denied") {
      setPushStatus("Уведомления заблокированы в браузере");
    } else {
      setPushStatus("Нажми, чтобы включить уведомления");
    }
  }

  async function enablePush() {
    if (!pushReady || pushBusy) return;
    setPushBusy(true);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setPushStatus("Браузер не поддерживает push");
        return;
      }

      if (isIOS() && !isStandalone()) {
        setPushStatus("На iPhone push работает только у установленного приложения");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("Разрешение на уведомления не выдано");
        return;
      }

      const vapidResponse = await fetch("/api/push/vapid");
      const { publicKey } = await vapidResponse.json().catch(() => ({ publicKey: "" }));
      if (!vapidResponse.ok || !publicKey) {
        setPushStatus("Нет VAPID ключей в Vercel");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription)
      });

      setPushStatus(response.ok ? "Push включён на этом устройстве" : "Не удалось сохранить push-подписку");
    } catch {
      setPushStatus("Не удалось включить push");
    } finally {
      setPushBusy(false);
    }
  }

  async function sendPushTest() {
    setTestingPush(true);
    const response = await fetch("/api/push/test", { method: "POST", credentials: "include" });
    setTestingPush(false);
    if (response.ok) {
      setPushStatus("Тест отправлен. Если ничего нет — проверь устройство, браузер и VAPID.");
    } else {
      const data = await response.json().catch(() => null);
      setPushStatus(data?.error ?? "Тестовый push не ушёл");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/");
  }

  async function testMedia(kind: "AUDIO" | "VIDEO") {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "VIDEO" });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  function cleanupCallMedia() {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCallWorking(false);
    setCallMuted(false);
    setCallCameraOff(false);
    addedIceKeysRef.current = new Set();
    signalStartedRef.current = null;
    callRoleRef.current = null;
  }

  async function ensureLocalMedia(kind: "AUDIO" | "VIDEO") {
    const existing = localStreamRef.current;
    if (existing) return existing;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "VIDEO" });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }

  function createPeer(role: "caller" | "receiver") {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const remote = new MediaStream();
    remoteStreamRef.current = remote;
    setRemoteStream(remote);

    pc.ontrack = (event) => {
      for (const track of event.streams[0].getTracks()) {
        if (!remote.getTracks().some((item) => item.id === track.id)) remote.addTrack(track);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        setCallWorking(true);
        setCallNotice(role === "caller" ? "Собеседник подключился." : "Вы подключены к звонку.");
      }
      if (["failed", "disconnected", "closed"].includes(state)) {
        if (state === "failed") setCallNotice("Звонок не смог установиться. Иногда нужен TURN-сервер или другая сеть.");
      }
    };

    pc.onicecandidate = (event) => {
      const currentCall = activeCallRef.current;
      if (!currentCall || !event.candidate) return;
      const candidate = event.candidate.toJSON() as SignalIce;
      const key = JSON.stringify(candidate);
      if (addedIceKeysRef.current.has(`local:${key}`)) return;
      addedIceKeysRef.current.add(`local:${key}`);
      const field = role === "caller" ? "callerIce" : "receiverIce";
      void fetch("/api/calls", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: currentCall.id, [field]: [candidate] })
      });
    };

    peerRef.current = pc;
    callRoleRef.current = role;
    return pc;
  }

  async function applyRemoteIce(candidates: SignalIce[] | null | undefined) {
    const pc = peerRef.current;
    if (!pc || !candidates?.length) return;
    for (const candidate of candidates) {
      const key = JSON.stringify(candidate);
      if (addedIceKeysRef.current.has(`remote:${key}`)) continue;
      try {
        await pc.addIceCandidate(candidate);
        addedIceKeysRef.current.add(`remote:${key}`);
      } catch {
        // ignore duplicates / race conditions
      }
    }
  }

  async function startCall(kind: "AUDIO" | "VIDEO") {
    if (!activeChatId) return;
    cleanupCallMedia();
    const allowed = await testMedia(kind);
    if (!allowed) {
      setCallNotice("Браузер не дал доступ к микрофону/камере. Разреши доступ и попробуй ещё раз.");
      return;
    }

    try {
      setCallNotice(kind === "VIDEO" ? "Создаю видеозвонок..." : "Создаю аудиозвонок...");
      const stream = await ensureLocalMedia(kind);
      const pc = createPeer("caller");
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await fetch("/api/calls", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: activeChatId, kind, offer: { type: offer.type, sdp: offer.sdp || "" } })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setCallNotice(data?.error ?? "Не удалось создать звонок.");
        cleanupCallMedia();
        return;
      }

      signalStartedRef.current = data.call.id;
      setActiveCall(data.call);
      setCallNotice("Звоним… собеседник увидит входящий звонок. Для идеальной работы в любых сетях позже можно добавить TURN-сервер.");
    } catch {
      cleanupCallMedia();
      setCallNotice("Не удалось начать звонок.");
    }
  }

  async function acceptCall() {
    if (!activeCall) return;

    try {
      cleanupCallMedia();
      const stream = await ensureLocalMedia(activeCall.kind);
      const pc = createPeer("receiver");
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      if (!activeCall.offer?.sdp) {
        setCallNotice("Входящий звонок без offer. Попробуй позвонить снова.");
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(activeCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const response = await fetch("/api/calls", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: activeCall.id, status: "ACCEPTED", answer: { type: answer.type, sdp: answer.sdp || "" } })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setCallNotice(data?.error ?? "Не удалось принять звонок.");
        cleanupCallMedia();
        return;
      }

      signalStartedRef.current = data.call.id;
      setActiveCall(data.call);
      setCallNotice("Подключаю звонок...");
    } catch {
      cleanupCallMedia();
      setCallNotice("Не удалось принять звонок.");
    }
  }

  async function endCall(status: "ENDED" | "DECLINED") {
    if (activeCall) {
      await fetch("/api/calls", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: activeCall.id, status })
      }).catch(() => undefined);
    }
    cleanupCallMedia();
    setActiveCall(null);
    setCallNotice(status === "DECLINED" ? "Звонок отклонён." : "Звонок завершён.");
  }

  async function pollCall(chatId: string) {
    const response = await fetch(`/api/calls?chatId=${encodeURIComponent(chatId)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok) return;
    const call = (data?.call ?? null) as CallSession | null;

    if (!call) {
      if (activeCallRef.current) {
        cleanupCallMedia();
        setActiveCall(null);
      }
      return;
    }

    setActiveCall(call);

    if (["ENDED", "DECLINED", "MISSED"].includes(call.status)) {
      cleanupCallMedia();
      setActiveCall(null);
      setCallNotice(call.status === "DECLINED" ? "Собеседник отклонил звонок." : "Звонок завершён.");
      return;
    }

    if (call.callerId !== currentUser.id && call.status === "RINGING") {
      setCallNotice(`${call.caller.displayName} звонит…`);
    }

    const role = callRoleRef.current;
    const pc = peerRef.current;

    if (role === "caller" && pc && call.status === "ACCEPTED" && call.answer?.sdp && !pc.currentRemoteDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription(call.answer));
      setCallNotice("Собеседник ответил. Устанавливаю соединение...");
    }

    if (pc) {
      if (role === "caller") {
        await applyRemoteIce(call.receiverIce);
      } else if (role === "receiver") {
        await applyRemoteIce(call.callerIce);
      }
    }
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !callMuted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setCallMuted(next);
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !callCameraOff;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !next;
    });
    setCallCameraOff(next);
  }

  const showSidebar = mobileListOpen;
  const showChat = !mobileListOpen || typeof window === "undefined";

  return (
    <main className="safe-screen mx-auto flex max-w-[1480px] gap-4 lg:h-dvh">
      <aside className={`glass ${showSidebar ? "flex" : "hidden"} w-full flex-col overflow-hidden rounded-[2rem] lg:flex lg:w-[27rem]`}>
        <div className="border-b border-yellow-300/10 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-tight text-white">Pirogram</h1>
              <p className="truncate text-xs text-zinc-400">@{currentUser.username} · {currentUser.displayName}</p>
            </div>
            <button onClick={logout} className="rounded-2xl border border-yellow-300/10 bg-white/[0.04] p-3 text-zinc-300 active:scale-95" aria-label="Выйти">
              <LogOut size={18} />
            </button>
          </div>

          {installTip ? (
            <div className="mb-3 flex gap-3 rounded-2xl border border-yellow-400/15 bg-yellow-500/8 p-3 text-xs text-yellow-100/90">
              <Smartphone className="mt-0.5 shrink-0" size={15} />
              <span>{installTip}</span>
            </div>
          ) : null}

          <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <button onClick={enablePush} disabled={pushBusy || !pushReady} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold active:scale-[0.98] ${pushReady ? "border-yellow-400/15 bg-yellow-500/10 text-yellow-100" : "border-white/10 bg-white/[0.04] text-zinc-500"}`}>
              <Bell size={16} /> {pushBusy ? "Подключаю push..." : pushStatus}
            </button>
            <button onClick={sendPushTest} disabled={testingPush || !pushReady} className="rounded-2xl border border-yellow-400/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-200 active:scale-[0.98] disabled:opacity-50">
              {testingPush ? <Loader2 size={16} className="mx-auto animate-spin" /> : <span className="inline-flex items-center gap-2"><TestTube2 size={16} /> Тест</span>}
            </button>
          </div>
          <p className="mb-3 text-[11px] leading-5 text-zinc-500">
            Push приходит только на том устройстве, где ты его включил. Если шлёшь сообщение сам себе — уведомления не будет. На iPhone нужен значок на домашнем экране.
          </p>

          <form onSubmit={createChat} className="space-y-2">
            <div className="flex gap-2">
              <label className="flex min-h-12 flex-1 items-center gap-2 rounded-2xl border border-yellow-300/12 bg-white/[0.04] px-3 text-sm text-zinc-300 focus-within:border-yellow-300/55">
                <Search size={16} className="text-zinc-500" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Найти по @username" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-zinc-500" autoCapitalize="none" />
              </label>
              <button className="rounded-2xl border border-yellow-300/12 bg-white/[0.04] p-3 text-yellow-100 active:scale-95" aria-label="Открыть чат"><Plus size={19} /></button>
            </div>
            {searching ? <p className="px-2 text-xs text-zinc-500">Ищу пользователя...</p> : null}
            {searchResults.length ? (
              <div className="space-y-1 rounded-2xl border border-yellow-300/10 bg-black/20 p-2">
                {searchResults.map((user) => (
                  <button key={user.id} type="button" onClick={() => void startPrivateChat(user.username)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left active:bg-white/[0.07]">
                    {user.avatarData ? <img src={user.avatarData} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-700 text-sm font-black text-black">{avatarLabel(user.displayName || user.username)}</div>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{user.displayName}</span>
                      <span className="block truncate text-xs text-zinc-400">@{user.username}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {searchError ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">{searchError}</p> : null}
          </form>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto p-2">
          {loadingChats ? <p className="p-4 text-sm text-zinc-400">Загружаю чаты...</p> : null}
          {chats.map((chat) => {
            const lastMessage = chat.messages?.[0];
            const active = chat.id === activeChatId;
            const mine = lastMessage?.senderId === currentUser.id;
            return (
              <button
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id);
                  setMobileListOpen(false);
                }}
                className={`mb-1 flex w-full items-center gap-3 rounded-[1.4rem] px-3 py-3 text-left transition ${active ? "bg-yellow-500/12 shadow-[inset_0_0_0_1px_rgba(245,158,11,.15)]" : "hover:bg-white/[0.04] active:bg-white/[0.06]"}`}
              >
                {chat.avatarData ? <img src={chat.avatarData} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-700 font-black text-black">{avatarLabel(chat.title)}</div>}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-3">
                    <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white">{chat.title || "Чат"}</p>
                    <span className="shrink-0 text-[11px] text-zinc-500">{timeLabel(lastMessage?.createdAt || chat.updatedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1 truncate text-sm text-zinc-400">
                      {mine ? (
                        <span className="mr-1 inline-flex align-middle text-yellow-300">{lastMessage?.readByOthers ? <CheckCheck size={14} /> : <Check size={14} />}</span>
                      ) : null}
                      <span>{chatPreview(lastMessage)}</span>
                    </div>
                    {chat.unreadCount ? <span className="grid min-w-6 place-items-center rounded-full bg-yellow-400 px-1.5 py-0.5 text-[11px] font-black text-black">{chat.unreadCount > 99 ? "99+" : chat.unreadCount}</span> : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className={`glass ${showChat ? "flex" : "hidden"} min-h-[70dvh] flex-1 flex-col overflow-hidden rounded-[2rem] lg:flex`}>
        <header className="flex items-center gap-3 border-b border-yellow-300/10 px-4 py-3">
          <button onClick={() => setMobileListOpen(true)} className="rounded-2xl border border-yellow-300/10 bg-white/[0.04] p-2.5 text-zinc-300 lg:hidden">
            <ArrowLeft size={18} />
          </button>
          {activeChat?.avatarData ? <img src={activeChat.avatarData} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-700 text-sm font-black text-black">{avatarLabel(activeChat?.title)}</div>}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-black text-white">{activeChat?.title || "Выберите чат"}</h2>
            <p className="truncate text-xs text-zinc-500">{activeChat?.username ? `@${activeChat.username}` : "Личные сообщения"}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void startCall("AUDIO")} disabled={!activeChatId} className="rounded-2xl border border-yellow-300/10 bg-white/[0.04] p-3 text-zinc-300 active:scale-95 disabled:opacity-50" title="Аудиозвонок">
              <Phone size={18} />
            </button>
            <button onClick={() => void startCall("VIDEO")} disabled={!activeChatId} className="rounded-2xl border border-yellow-300/10 bg-white/[0.04] p-3 text-zinc-300 active:scale-95 disabled:opacity-50" title="Видеозвонок">
              <Video size={18} />
            </button>
          </div>
        </header>

        {activeCall ? (
          <div className="mx-4 mt-4 rounded-3xl border border-yellow-400/15 bg-yellow-500/10 p-4 text-sm text-yellow-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black">{activeCall.kind === "VIDEO" ? "Видеозвонок" : "Аудиозвонок"}</p>
                <p className="text-xs text-yellow-100/75">{activeCall.callerId === currentUser.id ? "Ты звонишь" : `${activeCall.caller.displayName} звонит`} · статус: {activeCall.status}</p>
              </div>
              <div className="flex gap-2">
                {activeCall.callerId !== currentUser.id && activeCall.status === "RINGING" ? (
                  <button onClick={() => void acceptCall()} className="rounded-2xl bg-emerald-400/20 px-4 py-2 font-semibold text-emerald-100">Принять</button>
                ) : null}
                <button onClick={() => void endCall(activeCall.callerId !== currentUser.id && activeCall.status === "RINGING" ? "DECLINED" : "ENDED")} className="rounded-2xl bg-red-500/20 px-4 py-2 font-semibold text-red-100">{activeCall.callerId !== currentUser.id && activeCall.status === "RINGING" ? "Отклонить" : "Завершить"}</button>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-yellow-100/70">Звонки уже подключены через WebRTC + сигналинг на сервере. Если в некоторых сетях не соединяется — это обычно из-за отсутствия TURN-сервера. В обычных сетях должно работать.</p>
          </div>
        ) : null}
        {callNotice ? <p className="mx-4 mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-zinc-300">{callNotice}</p> : null}

        <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,.02),transparent_18%),radial-gradient(circle_at_top,rgba(245,158,11,.08),transparent_32%)] px-3 py-4 sm:px-5">
          <div className="mx-auto flex max-w-4xl flex-col gap-3">
            {messages.map((message, index) => {
              const mine = message.senderId === currentUser.id;
              const prev = messages[index - 1];
              const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(message.createdAt);
              return (
                <div key={message.id}>
                  {showDay ? (
                    <div className="my-2 flex justify-center">
                      <span className="rounded-full border border-yellow-400/10 bg-black/30 px-3 py-1 text-[11px] text-zinc-400">{dayLabel(message.createdAt)}</span>
                    </div>
                  ) : null}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[88%] rounded-[1.35rem] px-4 py-3 shadow-xl ${mine ? "rounded-br-md bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-700 text-black" : "rounded-bl-md border border-yellow-300/10 bg-[#15130d]/95 text-zinc-100"}`}>
                      {!mine ? <p className="mb-1 text-xs font-semibold text-yellow-200">{message.sender?.displayName || message.sender?.username || "Pirogram"}</p> : null}
                      {message.mediaData && message.type === "IMAGE" ? <img src={message.mediaData} alt={message.mediaName || "Фото"} className="mb-2 max-h-80 w-full rounded-2xl object-cover" /> : null}
                      {message.mediaData && message.type === "VIDEO" ? <video src={message.mediaData} controls playsInline className="mb-2 max-h-80 w-full rounded-2xl" /> : null}
                      {message.text ? <p className="whitespace-pre-wrap break-words leading-6">{message.text}</p> : null}
                      <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-black/65" : "text-zinc-500"}`}>
                        <span>{timeLabel(message.createdAt)}</span>
                        {mine ? (message.readByOthers ? <CheckCheck size={13} strokeWidth={2.4} /> : <Check size={13} strokeWidth={2.4} />) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {mediaDraft ? (
          <div className="border-t border-yellow-300/10 px-3 pt-3">
            <div className="mx-auto flex max-w-4xl items-center gap-3 rounded-3xl border border-yellow-300/10 bg-white/[0.04] p-3">
              {mediaDraft.type === "IMAGE" ? <img src={mediaDraft.data} alt="preview" className="h-16 w-16 rounded-2xl object-cover" /> : <video src={mediaDraft.data} className="h-16 w-16 rounded-2xl object-cover" muted playsInline />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{mediaDraft.name}</p>
                <p className="text-xs text-zinc-400">Готово к отправке</p>
              </div>
              <button onClick={() => setMediaDraft(null)} className="rounded-2xl bg-white/[0.08] p-2 text-zinc-300"><X size={17} /></button>
            </div>
          </div>
        ) : null}

        <form onSubmit={sendMessage} className="border-t border-yellow-300/10 p-3">
          <div className="mx-auto flex max-w-4xl items-end gap-2">
            <input ref={fileRef} type="file" accept="image/*,video/*" onChange={onFileChange} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-2xl border border-yellow-300/10 bg-white/[0.04] p-3 text-zinc-300 active:scale-95" title="Фото или видео">
              <Paperclip size={19} />
            </button>
            <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Сообщение" className="max-h-36 min-h-12 flex-1 resize-none rounded-2xl border border-yellow-300/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-yellow-300/55" rows={1} />
            <button disabled={sending || (!text.trim() && !mediaDraft) || !activeChatId} className="rounded-2xl bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-700 p-3 text-black shadow-lg shadow-amber-950/40 disabled:opacity-50" aria-label="Отправить">
              {sending ? <Loader2 className="animate-spin" size={19} /> : <Send size={19} />}
            </button>
          </div>
        </form>
      </section>

      {activeCall ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-3 sm:items-center">
          <div className="pointer-events-auto glass w-full max-w-4xl rounded-[2rem] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black text-white">{activeCall.kind === "VIDEO" ? "Видеозвонок" : "Аудиозвонок"}</p>
                <p className="text-xs text-zinc-400">{callWorking ? "Соединение установлено" : callNotice || "Подключение..."}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={toggleMute} className={`rounded-2xl p-3 ${callMuted ? "bg-yellow-500/20 text-yellow-100" : "bg-white/[0.05] text-zinc-200"}`}><Mic size={18} /></button>
                {activeCall.kind === "VIDEO" ? <button onClick={toggleCamera} className={`rounded-2xl p-3 ${callCameraOff ? "bg-yellow-500/20 text-yellow-100" : "bg-white/[0.05] text-zinc-200"}`}>{callCameraOff ? <VideoOff size={18} /> : <Video size={18} />}</button> : null}
                <button onClick={() => void endCall("ENDED")} className="rounded-2xl bg-red-500/20 p-3 text-red-100"><PhoneOff size={18} /></button>
              </div>
            </div>

            <div className={`grid gap-3 ${activeCall.kind === "VIDEO" ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
              <div className="gold-panel overflow-hidden rounded-[1.5rem] p-3">
                <p className="mb-2 text-xs font-semibold text-zinc-400">Ты</p>
                {activeCall.kind === "VIDEO" ? (
                  localStream ? <video ref={localVideoRef} autoPlay playsInline muted className="h-[220px] w-full rounded-[1.2rem] bg-black object-cover" /> : <div className="grid h-[220px] place-items-center rounded-[1.2rem] bg-black/40 text-zinc-500">Ожидание камеры</div>
                ) : (
                  <div className="grid h-[180px] place-items-center rounded-[1.2rem] bg-black/40">
                    <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-700 text-2xl font-black text-black">{avatarLabel(currentUser.displayName)}</div>
                  </div>
                )}
              </div>
              <div className="gold-panel overflow-hidden rounded-[1.5rem] p-3">
                <p className="mb-2 text-xs font-semibold text-zinc-400">Собеседник</p>
                {activeCall.kind === "VIDEO" ? (
                  remoteStream ? <video ref={remoteVideoRef} autoPlay playsInline className="h-[220px] w-full rounded-[1.2rem] bg-black object-cover" /> : <div className="grid h-[220px] place-items-center rounded-[1.2rem] bg-black/40 text-zinc-500">Ждём подключение собеседника</div>
                ) : (
                  <div className="grid h-[180px] place-items-center rounded-[1.2rem] bg-black/40">
                    <div className="grid h-20 w-20 place-items-center rounded-full bg-white/[0.05] text-2xl font-black text-yellow-100">{avatarLabel(activeCall.callerId === currentUser.id ? activeChat?.title : activeCall.caller.displayName)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
