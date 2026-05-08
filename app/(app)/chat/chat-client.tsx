"use client";

import {
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  Loader2,
  LogOut,
  Moon,
  Mic,
  Paperclip,
  Phone,
  PhoneOff,
  Plus,
  Search,
  Send,
  Smartphone,
  TestTube2,
  Trash2,
  Sun,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type User = {
  id: string;
  username: string;
  login?: string;
  displayName: string;
  avatarData: string | null;
  createdAt?: string;
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

type AudioOutputElement = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
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
  const [activeTab, setActiveTab] = useState<"chats" | "calls" | "settings">("chats");
  const [editingChats, setEditingChats] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [callNotice, setCallNotice] = useState("");
  const [testingPush, setTestingPush] = useState(false);
  const [callWorking, setCallWorking] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callMuted, setCallMuted] = useState(false);
  const [callCameraOff, setCallCameraOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [audioRouteStatus, setAudioRouteStatus] = useState("Обычный звук");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<CallSession | null>(null);
  const callRoleRef = useRef<"caller" | "receiver" | null>(null);
  const signalStartedRef = useRef<string | null>(null);
  const addedIceKeysRef = useRef<Set<string>>(new Set());
  const pendingLocalIceRef = useRef<SignalIce[]>([]);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId), [chats, activeChatId]);
  const lastMessageDate = messages[messages.length - 1]?.createdAt;
  const isIncomingRinging = Boolean(activeCall && activeCall.callerId !== currentUser.id && activeCall.status === "RINGING");
  const isCallConnected = Boolean(activeCall && activeCall.status === "ACCEPTED");

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    const saved = window.localStorage.getItem("pirogram_theme");
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("pirogram_theme", theme);
  }, [theme]);

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
    }, 1800);
    return () => window.clearInterval(interval);
  }, [activeChatId, lastMessageDate]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void pollAnyCall();
    }, 2500);
    return () => window.clearInterval(interval);
  }, [activeChatId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, activeChatId]);

  useEffect(() => {
    if (!localVideoRef.current) return;
    localVideoRef.current.srcObject = localStream;
    if (localStream) void localVideoRef.current.play().catch(() => undefined);
  }, [localStream, activeCall?.id, activeCall?.status]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      if (remoteStream) void remoteVideoRef.current.play().catch(() => undefined);
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.volume = 1;
      remoteAudioRef.current.muted = false;
      if (remoteStream) void remoteAudioRef.current.play().catch(() => undefined);
    }
    if (remoteStream) void applyAudioRoute(speakerOn);
  }, [remoteStream, activeCall?.id, activeCall?.status, speakerOn]);

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

  async function deleteChatForEveryone(chatId: string, chatType?: string) {
    if (!chatId || chatType === "SAVED") return;
    const confirmed = window.confirm("Удалить этот чат у вас и у собеседника? Все сообщения, фото, видео и записи звонков исчезнут у обоих. Это действие нельзя отменить.");
    if (!confirmed) return;

    const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
      method: "DELETE",
      credentials: "include"
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      alert(data?.error ?? "Не удалось удалить чат.");
      return;
    }

    const nextChats = chats.filter((chat) => chat.id !== chatId);
    setChats(nextChats);
    if (activeChatId === chatId) {
      setActiveChatId(nextChats[0]?.id ?? "");
      setMessages([]);
      setActiveCall(null);
      cleanupCallMedia();
      setMobileListOpen(true);
    }
    if (!nextChats.some((chat) => chat.type !== "SAVED")) setEditingChats(false);
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
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCallWorking(false);
    setCallMuted(false);
    setCallCameraOff(false);
    setSpeakerOn(false);
    setAudioRouteStatus("Обычный звук");
    addedIceKeysRef.current = new Set();
    pendingLocalIceRef.current = [];
    signalStartedRef.current = null;
    callRoleRef.current = null;
  }

  function mediaConstraints(kind: "AUDIO" | "VIDEO"): MediaStreamConstraints {
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: kind === "VIDEO" ? {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } : false
    };
  }

  async function ensureLocalMedia(kind: "AUDIO" | "VIDEO") {
    const existing = localStreamRef.current;
    if (existing) return existing;
    const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints(kind));
    stream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    stream.getVideoTracks().forEach((track) => {
      track.enabled = true;
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }

  async function sendIceCandidate(role: "caller" | "receiver", candidate: SignalIce) {
    const currentCall = activeCallRef.current;
    if (!currentCall) {
      pendingLocalIceRef.current.push(candidate);
      return;
    }
    const field = role === "caller" ? "callerIce" : "receiverIce";
    await fetch("/api/calls", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId: currentCall.id, [field]: [candidate] })
    }).catch(() => undefined);
  }

  async function flushPendingIce(role: "caller" | "receiver") {
    const candidates = pendingLocalIceRef.current;
    if (!candidates.length) return;
    pendingLocalIceRef.current = [];
    await Promise.all(candidates.map((candidate) => sendIceCandidate(role, candidate)));
  }

  function createPeer(role: "caller" | "receiver") {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const remote = new MediaStream();
    remoteStreamRef.current = remote;
    setRemoteStream(remote);

    pc.ontrack = (event) => {
      const streamTracks = event.streams[0]?.getTracks() ?? [];
      const tracks = streamTracks.length ? streamTracks : [event.track];
      for (const track of tracks) {
        if (!remote.getTracks().some((item) => item.id === track.id)) remote.addTrack(track);
      }
      setRemoteStream(remote);
      window.setTimeout(() => {
        void remoteAudioRef.current?.play().catch(() => undefined);
        void remoteVideoRef.current?.play().catch(() => undefined);
      }, 120);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        setCallWorking(true);
        setCallNotice(role === "caller" ? "Собеседник подключился. Звук включён." : "Вы подключены к звонку. Звук включён.");
        void remoteAudioRef.current?.play().catch(() => undefined);
        void remoteVideoRef.current?.play().catch(() => undefined);
      }
      if (["failed", "disconnected", "closed"].includes(state)) {
        if (state === "failed") setCallNotice("Звонок не смог установиться. Иногда нужен TURN-сервер или другая сеть.");
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setCallWorking(true);
        void remoteAudioRef.current?.play().catch(() => undefined);
        void remoteVideoRef.current?.play().catch(() => undefined);
      }
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON() as SignalIce;
      const key = JSON.stringify(candidate);
      if (addedIceKeysRef.current.has(`local:${key}`)) return;
      addedIceKeysRef.current.add(`local:${key}`);
      void sendIceCandidate(role, candidate);
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

    try {
      setCallNotice(kind === "VIDEO" ? "Создаю видеозвонок..." : "Создаю аудиозвонок...");
      const stream = await ensureLocalMedia(kind);
      void localVideoRef.current?.play().catch(() => undefined);
      void remoteAudioRef.current?.play().catch(() => undefined);
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
      activeCallRef.current = data.call;
      setActiveCall(data.call);
      await flushPendingIce("caller");
      setCallNotice("Звоним… собеседник увидит входящий звонок. Если сеть сложная, может понадобиться TURN, но базовый сигналинг исправлен.");
    } catch {
      cleanupCallMedia();
      setCallNotice(kind === "VIDEO" ? "Не удалось начать видеозвонок. Проверь разрешение камеры и микрофона." : "Не удалось начать аудиозвонок. Проверь разрешение микрофона.");
    }
  }

  async function acceptCall() {
    if (!activeCall) return;

    try {
      const callToAnswer = activeCall;
      setActiveChatId(callToAnswer.chatId);
      setMobileListOpen(false);
      void loadMessages(callToAnswer.chatId);
      activeCallRef.current = callToAnswer;
      cleanupCallMedia();
      activeCallRef.current = callToAnswer;
      const stream = await ensureLocalMedia(callToAnswer.kind);
      void localVideoRef.current?.play().catch(() => undefined);
      void remoteAudioRef.current?.play().catch(() => undefined);
      const pc = createPeer("receiver");
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      if (!callToAnswer.offer?.sdp) {
        setCallNotice("Входящий звонок без offer. Попробуй позвонить снова.");
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(callToAnswer.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const response = await fetch("/api/calls", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: callToAnswer.id, status: "ACCEPTED", answer: { type: answer.type, sdp: answer.sdp || "" } })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setCallNotice(data?.error ?? "Не удалось принять звонок.");
        cleanupCallMedia();
        return;
      }

      signalStartedRef.current = data.call.id;
      activeCallRef.current = data.call;
      setActiveCall(data.call);
      await flushPendingIce("receiver");
      await applyRemoteIce(data.call.callerIce);
      void localVideoRef.current?.play().catch(() => undefined);
      void remoteAudioRef.current?.play().catch(() => undefined);
      void remoteVideoRef.current?.play().catch(() => undefined);
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

  async function pollAnyCall() {
    const response = await fetch("/api/calls", { credentials: "include" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.call) return;
    const call = data.call as CallSession;
    if (activeCallRef.current?.id === call.id) return;
    activeCallRef.current = call;
    setActiveCall(call);
    if (call.callerId === currentUser.id || call.status === "ACCEPTED") {
      if (call.chatId !== activeChatId) {
        setActiveChatId(call.chatId);
        void loadMessages(call.chatId);
      }
    }
    if (call.callerId !== currentUser.id) {
      setCallNotice(`${call.caller.displayName} звонит…`);
    }
  }

  async function pollCall(chatId: string) {
    const response = await fetch(`/api/calls?chatId=${encodeURIComponent(chatId)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok) return;
    const call = (data?.call ?? null) as CallSession | null;

    if (!call) {
      if (activeCallRef.current?.chatId === chatId) {
        cleanupCallMedia();
        activeCallRef.current = null;
        setActiveCall(null);
      }
      return;
    }

    activeCallRef.current = call;
    setActiveCall(call);

    if (["ENDED", "DECLINED", "MISSED"].includes(call.status)) {
      cleanupCallMedia();
      activeCallRef.current = null;
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
      await applyRemoteIce(call.receiverIce);
      await flushPendingIce("caller");
      setCallNotice("Собеседник ответил. Устанавливаю соединение...");
    }

    if (pc) {
      if (role === "caller") {
        await applyRemoteIce(call.receiverIce);
      } else if (role === "receiver") {
        await applyRemoteIce(call.callerIce);
        await flushPendingIce("receiver");
      }
    }
  }

  async function applyAudioRoute(nextSpeakerOn: boolean) {
    const audio = remoteAudioRef.current as AudioOutputElement | null;
    if (!audio) return;

    audio.muted = false;
    audio.volume = 1;

    try {
      await audio.play();
    } catch {
      // On iOS/Safari playback sometimes starts only after the user's tap.
    }

    if (typeof audio.setSinkId !== "function") {
      setAudioRouteStatus(nextSpeakerOn ? "Громкая связь" : "Обычный звук");
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((device) => device.kind === "audiooutput");
      const speaker = outputs.find((device) => /speaker|громк|динамик|loud/i.test(device.label));
      const earpiece = outputs.find((device) => /ear|receiver|phone|телефон|communication/i.test(device.label));
      const target = nextSpeakerOn
        ? (speaker?.deviceId || "default")
        : (earpiece?.deviceId || outputs.find((device) => device.deviceId === "communications")?.deviceId || "default");

      await audio.setSinkId(target);
      setAudioRouteStatus(nextSpeakerOn ? "Громкая связь" : "Обычный звук");
    } catch {
      setAudioRouteStatus(nextSpeakerOn ? "Громкая связь" : "Обычный звук");
    }
  }

  async function toggleSpeaker() {
    const next = !speakerOn;
    setSpeakerOn(next);
    await applyAudioRoute(next);
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
    <main className="tg-main h-dvh w-full overflow-hidden bg-[#dfe8f2] text-[#111827]">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" aria-hidden="true" />
      <div className="tg-shell mx-auto flex h-full max-w-[1500px] shadow-2xl shadow-slate-900/10">
        <aside className={`tg-sidebar ${showSidebar ? "flex" : "hidden"} h-full w-full shrink-0 flex-col border-r border-slate-200 bg-white lg:flex lg:w-[390px]`}>
          <div className="tg-topbar border-b border-slate-200 bg-[#f8fbff]/95 px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))] backdrop-blur-xl">
            {activeTab === "chats" ? (
              <>
                <div className="mb-3 flex h-11 items-center justify-between">
                  <button type="button" onClick={() => setEditingChats((value) => !value)} className={`rounded-full px-1 text-[15px] font-medium active:opacity-60 ${editingChats ? "text-red-500" : "text-[#229ed9]"}`}>
                    {editingChats ? "Done" : "Edit"}
                  </button>
                  <h1 className="text-[18px] font-bold tracking-[-0.02em] text-slate-950">Chats</h1>
                  <button type="button" onClick={() => { setActiveTab("settings"); setMobileListOpen(true); }} className="tg-icon-btn grid h-9 w-9 place-items-center rounded-full active:bg-slate-100" aria-label="Настройки">
                    <Smartphone size={19} />
                  </button>
                </div>

                <label className="tg-search flex h-10 items-center gap-2 rounded-xl bg-[#eef2f7] px-3 text-[15px] text-slate-500 shadow-inner shadow-slate-200/50 focus-within:ring-2 focus-within:ring-[#229ed9]/20">
                  <Search size={17} />
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search or @username" className="tg-input-darkfix min-w-0 flex-1 bg-transparent outline-none" autoCapitalize="none" />
                  {searchQuery ? <button type="button" onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="grid h-5 w-5 place-items-center rounded-full bg-black/20 text-white"><X size={13} /></button> : null}
                </label>

                {searchQuery.trim().length >= 2 ? (
                  <div className="tg-popover mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
                    {searching ? <p className="px-3 py-3 text-sm text-slate-500">Ищу пользователя...</p> : null}
                    {searchResults.map((user) => (
                      <button key={user.id} type="button" onClick={() => void startPrivateChat(user.username)} className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 active:bg-[#eef7fd]">
                        {user.avatarData ? <img src={user.avatarData} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#57c4ff] to-[#1e8fd0] text-sm font-bold text-white">{avatarLabel(user.displayName || user.username)}</div>}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-slate-950">{user.displayName}</span>
                          <span className="block truncate text-[13px] text-[#229ed9]">@{user.username}</span>
                        </span>
                        <span className="rounded-full bg-[#229ed9]/10 px-2.5 py-1 text-xs font-semibold text-[#229ed9]">Chat</span>
                      </button>
                    ))}
                    {!searching && !searchResults.length ? <p className="px-3 py-3 text-sm text-slate-500">Пользователи не найдены</p> : null}
                  </div>
                ) : null}
                {searchError ? <p className="mt-2 rounded-xl bg-red-50 p-3 text-xs text-red-600">{searchError}</p> : null}
              </>
            ) : activeTab === "settings" ? (
              <div className="flex h-11 items-center justify-between">
                <button type="button" onClick={() => setActiveTab("chats")} className="rounded-full px-1 text-[15px] font-medium text-[#229ed9] active:opacity-60">Chats</button>
                <h1 className="tg-title text-[18px] font-bold tracking-[-0.02em]">Settings</h1>
                <span className="w-12" />
              </div>
            ) : (
              <div className="flex h-11 items-center justify-between">
                <button type="button" onClick={() => setActiveTab("chats")} className="rounded-full px-1 text-[15px] font-medium text-[#229ed9] active:opacity-60">Chats</button>
                <h1 className="tg-title text-[18px] font-bold tracking-[-0.02em]">Calls</h1>
                <span className="w-12" />
              </div>
            )}
          </div>

          {activeTab === "chats" ? (
            <div className="tg-list no-scrollbar flex-1 overflow-y-auto bg-white">
              {loadingChats ? <p className="p-4 text-sm text-slate-500">Загружаю чаты...</p> : null}
              {chats.map((chat) => {
                const lastMessage = chat.messages?.[0];
                const active = chat.id === activeChatId;
                const mine = lastMessage?.senderId === currentUser.id;
                return (
                  <div key={chat.id} className={`tg-chat-row flex w-full items-center gap-2 px-3 py-1.5 transition ${active ? "tg-chat-row-active" : "active:bg-slate-100"}`}>
                    {editingChats && chat.type !== "SAVED" ? (
                      <button
                        type="button"
                        onClick={() => void deleteChatForEveryone(chat.id, chat.type)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500 text-white shadow-sm active:scale-95"
                        aria-label="Удалить чат у обоих"
                      >
                        <Trash2 size={17} />
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => {
                        if (editingChats && chat.type !== "SAVED") {
                          void deleteChatForEveryone(chat.id, chat.type);
                          return;
                        }
                        setActiveChatId(chat.id);
                        setMobileListOpen(false);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      {chat.avatarData ? <img src={chat.avatarData} alt="" className="h-[58px] w-[58px] shrink-0 rounded-full object-cover" /> : <div className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#7bd0ff] via-[#229ed9] to-[#0969a8] text-xl font-bold text-white shadow-sm">{avatarLabel(chat.title)}</div>}
                      <div className="min-w-0 flex-1 border-b border-slate-100 pb-2.5">
                        <div className="mb-0.5 flex items-center gap-3">
                          <p className="min-w-0 flex-1 truncate text-[16px] font-semibold tracking-[-0.01em] text-slate-950">{chat.title || "Чат"}</p>
                          <span className="shrink-0 text-[12px] text-slate-400">{timeLabel(lastMessage?.createdAt || chat.updatedAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1 truncate text-[14px] leading-5 text-slate-500">
                            {mine ? (
                              <span className="mr-1 inline-flex align-middle text-[#229ed9]">{lastMessage?.readByOthers ? <CheckCheck size={15} /> : <Check size={15} />}</span>
                            ) : null}
                            <span>{chatPreview(lastMessage)}</span>
                          </div>
                          {chat.unreadCount ? <span className="grid min-w-6 place-items-center rounded-full bg-[#229ed9] px-1.5 py-0.5 text-[11px] font-bold text-white">{chat.unreadCount > 99 ? "99+" : chat.unreadCount}</span> : null}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : activeTab === "settings" ? (
            <div className="tg-settings no-scrollbar flex-1 overflow-y-auto p-4">
              <div className="tg-card mb-4 rounded-3xl p-4 shadow-sm">
                <div className="flex items-center gap-4">
                  {currentUser.avatarData ? <img src={currentUser.avatarData} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[#7bd0ff] via-[#229ed9] to-[#0969a8] text-2xl font-bold text-white">{avatarLabel(currentUser.displayName)}</div>}
                  <div className="min-w-0">
                    <p className="truncate text-xl font-bold text-slate-950">{currentUser.displayName}</p>
                    <p className="truncate text-sm text-[#229ed9]">@{currentUser.username}</p>
                    {currentUser.login ? <p className="tg-muted truncate text-xs">Логин: {currentUser.login}</p> : null}
                  </div>
                </div>
              </div>

              <div className="tg-card mb-4 overflow-hidden rounded-3xl shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-950">Уведомления</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{pushStatus}</p>
                  {installTip ? <p className="mt-1 text-xs leading-5 text-slate-500">{installTip}</p> : null}
                </div>
                <button onClick={enablePush} disabled={pushBusy || !pushReady} className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-slate-50 disabled:opacity-50">
                  <span className="inline-flex items-center gap-3 text-[15px] text-slate-900"><Bell size={18} className="text-[#229ed9]" />{pushBusy ? "Подключаю push..." : "Включить уведомления"}</span>
                  <span className="text-sm text-[#229ed9]">Открыть</span>
                </button>
                <button onClick={sendPushTest} disabled={testingPush || !pushReady} className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left active:bg-slate-50 disabled:opacity-50">
                  <span className="inline-flex items-center gap-3 text-[15px] text-slate-900"><TestTube2 size={18} className="text-[#229ed9]" />Проверить push</span>
                  <span className="text-sm text-[#229ed9]">{testingPush ? "Отправляю..." : "Тест"}</span>
                </button>
              </div>

              <div className="tg-card mb-4 overflow-hidden rounded-3xl shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-950">Оформление</p>
                  <p className="mt-1 text-xs text-slate-500">Выбери светлую или тёмную тему.</p>
                </div>
                <button onClick={() => setTheme("light")} className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-slate-50">
                  <span className="inline-flex items-center gap-3 text-[15px] text-slate-900"><Sun size={18} className="text-[#229ed9]" />Светлая тема</span>
                  {theme === "light" ? <Check size={18} className="text-[#229ed9]" /> : null}
                </button>
                <button onClick={() => setTheme("dark")} className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left active:bg-slate-50">
                  <span className="inline-flex items-center gap-3 text-[15px] text-slate-900"><Moon size={18} className="text-[#229ed9]" />Тёмная тема</span>
                  {theme === "dark" ? <Check size={18} className="text-[#229ed9]" /> : null}
                </button>
              </div>

              <div className="tg-card overflow-hidden rounded-3xl shadow-sm">
                <button onClick={logout} className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-red-50">
                  <span className="inline-flex items-center gap-3 text-[15px] font-semibold text-red-500"><LogOut size={18} />Выйти из аккаунта</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="tg-settings flex flex-1 flex-col items-center justify-center p-6 text-center">
              <Phone size={38} className="mb-3 text-[#229ed9]" />
              <p className="tg-title text-lg font-bold">Звонки</p>
              <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">История звонков появится позже. Сейчас звонки запускаются прямо из открытого чата.</p>
            </div>
          )}

          <div className="tg-tabbar grid h-[72px] shrink-0 grid-cols-3 border-t border-slate-200 bg-[#f8fbff]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 text-[11px] font-medium text-slate-400 backdrop-blur-xl lg:hidden">
            <button onClick={() => { setActiveTab("calls"); setMobileListOpen(true); }} className={`flex flex-col items-center gap-1 rounded-2xl py-1 active:bg-slate-100 ${activeTab === "calls" ? "text-[#229ed9]" : ""}`}><Phone size={21} /> Calls</button>
            <button onClick={() => { setActiveTab("chats"); setMobileListOpen(true); }} className={`flex flex-col items-center gap-1 rounded-2xl py-1 active:bg-slate-100 ${activeTab === "chats" ? "text-[#229ed9]" : ""}`}><Bell size={21} /> Chats</button>
            <button onClick={() => { setActiveTab("settings"); setMobileListOpen(true); }} className={`flex flex-col items-center gap-1 rounded-2xl py-1 active:bg-slate-100 ${activeTab === "settings" ? "text-[#229ed9]" : ""}`}><Smartphone size={21} /> Settings</button>
          </div>
        </aside>

        <section className={`tg-chat-panel ${showChat ? "flex" : "hidden"} h-full min-w-0 flex-1 flex-col bg-[#e6edf5] lg:flex`}>
          <header className="tg-chat-header sticky top-0 z-30 flex min-h-[64px] shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.55rem)] backdrop-blur-xl sm:px-4 lg:min-h-[64px] lg:py-0">
            <button onClick={() => setMobileListOpen(true)} className="tg-icon-btn grid h-10 w-10 place-items-center rounded-full active:bg-slate-100 lg:hidden">
              <ArrowLeft size={21} />
            </button>
            {activeChat?.avatarData ? <img src={activeChat.avatarData} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#7bd0ff] via-[#229ed9] to-[#0969a8] text-sm font-bold text-white">{avatarLabel(activeChat?.title)}</div>}
            <div className="min-w-0 flex-1">
              <h2 className="tg-title truncate text-[16px] font-semibold">{activeChat?.title || "Выберите чат"}</h2>
              <p className="tg-accent truncate text-[13px]">{activeChat?.username ? `@${activeChat.username}` : `@${currentUser.username}`}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => void startCall("AUDIO")} disabled={!activeChatId} className="tg-icon-btn grid h-10 w-10 place-items-center rounded-full active:bg-slate-100 disabled:opacity-40" title="Аудиозвонок">
                <Phone size={20} />
              </button>
              <button onClick={() => void startCall("VIDEO")} disabled={!activeChatId} className="tg-icon-btn grid h-10 w-10 place-items-center rounded-full active:bg-slate-100 disabled:opacity-40" title="Видеозвонок">
                <Video size={20} />
              </button>
            </div>
          </header>

          {activeCall && !isIncomingRinging ? (
            <div className="tg-inline-panel border-b border-slate-200 px-4 py-3">
              <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 rounded-2xl bg-[#e8f4fc] px-4 py-3 text-sm text-slate-700">
                <div className="min-w-0">
                  <p className="tg-title truncate font-semibold">{activeCall.kind === "VIDEO" ? "Видеозвонок" : "Аудиозвонок"}</p>
                  <p className="tg-muted truncate text-xs">{activeCall.callerId === currentUser.id ? "Ты звонишь" : `${activeCall.caller.displayName} звонит`} · {activeCall.status}</p>
                </div>
                <div className="flex gap-2">
                  {activeCall.callerId !== currentUser.id && activeCall.status === "RINGING" ? (
                    <button onClick={() => void acceptCall()} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">Принять</button>
                  ) : null}
                  <button onClick={() => void endCall(activeCall.callerId !== currentUser.id && activeCall.status === "RINGING" ? "DECLINED" : "ENDED")} className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white">{activeCall.callerId !== currentUser.id && activeCall.status === "RINGING" ? "Отклонить" : "Завершить"}</button>
                </div>
              </div>
            </div>
          ) : null}
          {callNotice ? <p className="tg-inline-panel tg-muted border-b border-slate-200 px-4 py-2 text-center text-xs">{callNotice}</p> : null}

          <div ref={scrollRef} className="tg-message-area no-scrollbar flex-1 overflow-y-auto px-3 py-4 sm:px-5">
            <div className="mx-auto flex max-w-4xl flex-col gap-2">
              {messages.map((message, index) => {
                const mine = message.senderId === currentUser.id;
                const prev = messages[index - 1];
                const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(message.createdAt);
                return (
                  <div key={message.id}>
                    {showDay ? (
                      <div className="my-3 flex justify-center">
                        <span className="tg-day-chip rounded-full px-3 py-1 text-[12px] font-medium backdrop-blur">{dayLabel(message.createdAt)}</span>
                      </div>
                    ) : null}
                    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`tg-bubble max-w-[86%] text-[15px] ${mine ? "tg-bubble-mine" : "tg-bubble-theirs"}`}>
                        {!mine ? <p className="tg-bubble-author mb-1 text-xs font-semibold">{message.sender?.displayName || message.sender?.username || "Pirogram"}</p> : null}
                        {message.mediaData && message.type === "IMAGE" ? <img src={message.mediaData} alt={message.mediaName || "Фото"} className="tg-bubble-media mb-2 max-h-80 w-full object-cover" /> : null}
                        {message.mediaData && message.type === "VIDEO" ? <video src={message.mediaData} controls playsInline className="tg-bubble-media mb-2 max-h-80 w-full" /> : null}
                        {message.text ? <p className="whitespace-pre-wrap break-words leading-6">{message.text}</p> : null}
                        <div className="tg-bubble-meta ml-8 mt-1 flex items-center justify-end gap-1 text-[11px]">
                          <span>{timeLabel(message.createdAt)}</span>
                          {mine ? (message.readByOthers ? <CheckCheck size={15} strokeWidth={2.4} /> : <Check size={15} strokeWidth={2.4} />) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {mediaDraft ? (
            <div className="tg-compose border-t border-slate-200 px-2 pt-2">
              <div className="tg-preview-card mx-auto flex max-w-4xl items-center gap-2 rounded-2xl p-2">
                {mediaDraft.type === "IMAGE" ? <img src={mediaDraft.data} alt="preview" className="h-12 w-12 rounded-xl object-cover" /> : <video src={mediaDraft.data} className="h-12 w-12 rounded-xl object-cover" muted playsInline />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">{mediaDraft.name}</p>
                  <p className="tg-muted text-xs">Готово к отправке</p>
                </div>
                <button onClick={() => setMediaDraft(null)} className="grid h-9 w-9 place-items-center rounded-full bg-black/10 text-slate-500"><X size={17} /></button>
              </div>
            </div>
          ) : null}

          <form onSubmit={sendMessage} className="tg-compose border-t border-slate-200 px-2 py-1.5 pb-[max(6px,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex max-w-4xl items-end gap-1.5">
              <input ref={fileRef} type="file" accept="image/*,video/*" onChange={onFileChange} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 active:bg-slate-100 tg-icon-btn" title="Фото или видео">
                <Paperclip size={20} />
              </button>
              <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Message" className="tg-input-darkfix max-h-28 min-h-9 flex-1 resize-none rounded-[1.1rem] px-3 py-2 text-[14px] leading-5 outline-none focus:ring-2 focus:ring-[#229ed9]/20" rows={1} />
              <button disabled={sending || (!text.trim() && !mediaDraft) || !activeChatId} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#229ed9] text-white shadow-lg shadow-[#229ed9]/20 disabled:bg-slate-300" aria-label="Отправить">
                {sending ? <Loader2 className="animate-spin" size={19} /> : <Send size={17} />}
              </button>
            </div>
          </form>
        </section>
      </div>

      {isIncomingRinging && activeCall ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-5 backdrop-blur-md">
          <div className="pointer-events-auto w-full max-w-sm rounded-[2rem] bg-[#111827] p-6 text-center text-white shadow-2xl">
            <div className="mx-auto mb-5 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-[#7bd0ff] via-[#229ed9] to-[#0969a8] text-4xl font-bold shadow-xl shadow-[#229ed9]/25">
              {avatarLabel(activeCall.caller.displayName)}
            </div>
            <p className="text-2xl font-bold tracking-[-0.03em]">{activeCall.caller.displayName}</p>
            <p className="mt-1 text-sm text-white/65">@{activeCall.caller.username}</p>
            <p className="mt-4 text-base font-medium text-white/85">{activeCall.kind === "VIDEO" ? "Входящий видеозвонок" : "Входящий аудиозвонок"}</p>
            <p className="mt-2 text-xs leading-5 text-white/50">Сначала выбери: принять или отклонить. Камера/микрофон включатся только после принятия.</p>
            <div className="mt-7 grid grid-cols-2 gap-4">
              <button onClick={() => void endCall("DECLINED")} className="flex flex-col items-center gap-2 rounded-3xl bg-red-500 px-4 py-4 font-semibold text-white active:scale-95">
                <PhoneOff size={25} /> Отклонить
              </button>
              <button onClick={() => void acceptCall()} className="flex flex-col items-center gap-2 rounded-3xl bg-emerald-500 px-4 py-4 font-semibold text-white active:scale-95">
                <Phone size={25} /> Принять
              </button>
            </div>
          </div>
        </div>
      ) : activeCall ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center bg-slate-950/55 p-3 sm:items-center">
          <div className="tg-modal pointer-events-auto w-full max-w-4xl rounded-[2rem] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="tg-title text-lg font-bold">{activeCall.kind === "VIDEO" ? "Видеозвонок" : "Аудиозвонок"}</p>
                <p className="tg-muted text-xs">{callWorking || isCallConnected ? `Соединение установлено · ${audioRouteStatus}` : callNotice || "Подключение..."}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={toggleMute} title={callMuted ? "Включить микрофон" : "Выключить микрофон"} className={`grid h-11 w-11 place-items-center rounded-full ${callMuted ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}><Mic size={18} /></button>
                <button onClick={() => void toggleSpeaker()} title={speakerOn ? "Обычный звук" : "Громкая связь"} className={`grid h-11 w-11 place-items-center rounded-full ${speakerOn ? "bg-[#229ed9] text-white" : "bg-slate-100 text-slate-700"}`}>{speakerOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
                {activeCall.kind === "VIDEO" ? <button onClick={toggleCamera} title={callCameraOff ? "Включить камеру" : "Выключить камеру"} className={`grid h-11 w-11 place-items-center rounded-full ${callCameraOff ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{callCameraOff ? <VideoOff size={18} /> : <Video size={18} />}</button> : null}
                <button onClick={() => void endCall("ENDED")} className="grid h-11 w-11 place-items-center rounded-full bg-red-500 text-white"><PhoneOff size={18} /></button>
              </div>
            </div>

            <div className="mb-3 rounded-2xl bg-black/5 px-3 py-2 text-xs text-slate-500">На телефоне кнопка динамика переключает режим «громкая связь / обычный звук». Если браузер не даёт принудительно выбрать динамик, Pirogram включает максимально громкое воспроизведение, а окончательный маршрут звука выбирает система телефона.</div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="overflow-hidden rounded-[1.5rem] bg-slate-100 p-3">
                <p className="tg-muted mb-2 text-xs font-semibold">Ты</p>
                {activeCall.kind === "VIDEO" ? (
                  localStream ? <video ref={localVideoRef} autoPlay playsInline muted className="h-[220px] w-full rounded-[1.2rem] bg-black object-cover" /> : <div className="grid h-[220px] place-items-center rounded-[1.2rem] bg-slate-200 text-slate-500">Камера не включена</div>
                ) : (
                  <div className="grid h-[180px] place-items-center rounded-[1.2rem] bg-slate-200">
                    <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#7bd0ff] to-[#229ed9] text-2xl font-bold text-white">{avatarLabel(currentUser.displayName)}</div>
                  </div>
                )}
              </div>
              <div className="overflow-hidden rounded-[1.5rem] bg-slate-100 p-3">
                <p className="tg-muted mb-2 text-xs font-semibold">Собеседник</p>
                {activeCall.kind === "VIDEO" ? (
                  remoteStream ? <video ref={remoteVideoRef} autoPlay playsInline className="h-[220px] w-full rounded-[1.2rem] bg-black object-cover" /> : <div className="grid h-[220px] place-items-center rounded-[1.2rem] bg-slate-200 text-slate-500">Ждём видео собеседника</div>
                ) : (
                  <div className="grid h-[180px] place-items-center rounded-[1.2rem] bg-slate-200">
                    <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-2xl font-bold text-[#229ed9] shadow-sm">{avatarLabel(activeCall.callerId === currentUser.id ? activeChat?.title : activeCall.caller.displayName)}</div>
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
