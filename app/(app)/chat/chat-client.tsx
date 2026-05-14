"use client";

import {
  ArrowLeft,
  AtSign,
  Bell,
  Camera,
  Check,
  CheckCheck,
  Loader2,
  LogOut,
  Moon,
  Pause,
  Play,
  Mic,
  Paperclip,
  Pencil,
  Phone,
  PhoneOff,
  Plus,
  Reply,
  Search,
  Send,
  SmilePlus,
  Smartphone,
  TestTube2,
  Trash2,
  Wrench,
  UserPlus,
  Users,
  UserRound,
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
  aliases?: { username: string }[];
  isAdmin?: boolean;
  maintenanceMode?: boolean;
  createdAt?: string;
};

type ReplyPreviewMessage = {
  id: string;
  chatId?: string;
  senderId: string | null;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE" | "SYSTEM" | "CALL";
  text: string | null;
  mediaMime?: string | null;
  mediaName: string | null;
  createdAt: string;
  sender?: User | null;
};

type MessageReaction = {
  emoji: ReactionEmoji;
  userId: string;
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
  replyTo?: ReplyPreviewMessage | null;
  reactions?: MessageReaction[];
};

type Chat = {
  id: string;
  type: string;
  title: string | null;
  username?: string | null;
  avatarData?: string | null;
  updatedAt: string;
  unreadCount?: number;
  memberCount?: number;
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
  type: "IMAGE" | "VIDEO" | "VOICE";
};

type AvatarEditorState = {
  target: "user" | "group";
  source: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

type SettingsPage = "main" | "profile" | "permissions" | "reactions" | "appearance" | "admin";

type LightboxMedia = {
  data: string;
  mime: string | null;
  name: string | null;
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

const REACTION_EMOJIS = ["💋", "❤️‍🔥"] as const;
type ReactionEmoji = typeof REACTION_EMOJIS[number];

const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
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

function isAudioMime(mime?: string | null) {
  return Boolean(mime && mime.toLowerCase().startsWith("audio/"));
}

function formatVoiceDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function parseVoiceDurationFromName(name?: string | null) {
  if (!name) return 0;
  const match = name.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;
  return Math.max(0, minutes * 60 + seconds);
}

function chatPreview(message?: Omit<Message, "mediaData">) {
  if (!message) return "Нет сообщений";
  if (isAudioMime(message.mediaMime)) return "🎤 Голосовое";
  if (message.type === "IMAGE") return "📷 Фото";
  if (message.type === "VIDEO") return "🎬 Видео";
  if (message.type === "CALL") return message.text || "Звонок";
  return message.text || "Сообщение";
}

function replyPreview(message?: ReplyPreviewMessage | Message | null) {
  if (!message) return "Сообщение";
  if (isAudioMime(message.mediaMime)) return "Голосовое";
  if (message.type === "IMAGE") return "Фото";
  if (message.type === "VIDEO") return "Видео";
  if (message.type === "CALL") return message.text || "Звонок";
  return message.text || "Сообщение";
}

function chatSubtitle(chat: Chat | undefined, currentUser: User) {
  if (!chat) return `@${currentUser.username}`;
  if (chat.type === "PRIVATE") return chat.username ? `@${chat.username}` : "Личный чат";
  if (chat.type === "GROUP") return `${chat.memberCount ?? chat.members.length} участников`;
  return `@${currentUser.username}`;
}

function parseUsernames(value: string) {
  return [...new Set(value.split(/[\s,;]+/).map((item) => item.trim().replace(/^@+/, "").toLowerCase()).filter(Boolean))];
}

function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return typeof value === "string" && (REACTION_EMOJIS as readonly string[]).includes(value);
}

function summarizeReactions(reactions: MessageReaction[] | undefined, currentUserId: string) {
  return REACTION_EMOJIS.map((emoji) => {
    const items = (reactions ?? []).filter((reaction) => reaction.emoji === emoji);
    return { emoji, count: items.length, reactedByMe: items.some((reaction) => reaction.userId === currentUserId) };
  }).filter((reaction) => reaction.count > 0);
}

async function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

async function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось открыть изображение."));
    image.src = src;
  });
}

async function cropAvatarToSquare(editor: AvatarEditorState) {
  const image = await loadImage(editor.source);
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Браузер не смог обработать изображение.");

  const scale = Math.max(size / image.width, size / image.height) * editor.zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (size - width) / 2 + editor.offsetX;
  const y = (size - height) / 2 + editor.offsetY;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, x, y, width, height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function VoiceNote({ src, name }: { src: string; name?: string | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fallbackDuration = useMemo(() => parseVoiceDurationFromName(name), [name]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    setDuration(fallbackDuration);
    setPosition(0);
    setProgress(0);
    setPlaying(false);
  }, [fallbackDuration, src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const syncMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      } else if (fallbackDuration > 0) {
        setDuration(fallbackDuration);
      }
    };
    const onTime = () => {
      const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallbackDuration;
      setPosition(audio.currentTime || 0);
      setProgress(total ? Math.min(1, audio.currentTime / total) : 0);
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setPosition(0);
      audio.currentTime = 0;
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", syncMeta);
    audio.addEventListener("durationchange", syncMeta);
    audio.addEventListener("canplay", syncMeta);
    audio.addEventListener("ended", onEnded);
    syncMeta();
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", syncMeta);
      audio.removeEventListener("durationchange", syncMeta);
      audio.removeEventListener("canplay", syncMeta);
      audio.removeEventListener("ended", onEnded);
    };
  }, [fallbackDuration, src]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play().catch(() => undefined);
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  const visibleSeconds = playing && position > 0 ? position : duration;

  return (
    <div className="tg-voice-note" aria-label={name || "Голосовое сообщение"}>
      <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => void togglePlayback()} className="tg-voice-play" aria-label={playing ? "Пауза" : "Воспроизвести"}>
        {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
      </button>
      <div className="tg-voice-body">
        <div className="tg-voice-wave" style={{ "--voice-progress": `${Math.round(progress * 100)}%` } as React.CSSProperties}>
          {Array.from({ length: 28 }).map((_, index) => <span key={index} style={{ height: `${8 + ((index * 7) % 18)}px` }} />)}
        </div>
        <div className="tg-voice-caption">
          <span>Голосовое</span>
          <span>{formatVoiceDuration(visibleSeconds)}</span>
        </div>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  );
}

export default function ChatClient({ currentUser }: { currentUser: User }) {
  const router = useRouter();
  const [profileUser, setProfileUser] = useState<User>(currentUser);
  const isAdmin = profileUser.isAdmin || profileUser.username === "admin";
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
  const [groupCreatorOpen, setGroupCreatorOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupMembers, setGroupMembers] = useState("");
  const [groupMemberSearch, setGroupMemberSearch] = useState("");
  const [groupPickResults, setGroupPickResults] = useState<User[]>([]);
  const [groupSelectedUsers, setGroupSelectedUsers] = useState<User[]>([]);
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteResults, setInviteResults] = useState<User[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [messageMenu, setMessageMenu] = useState<Message | null>(null);
  const [quickReaction, setQuickReaction] = useState<ReactionEmoji>("💋");
  const [swipeState, setSwipeState] = useState<{ id: string; dx: number; ready: boolean } | null>(null);
  const [reactionBurst, setReactionBurst] = useState<{ id: string; emoji: ReactionEmoji } | null>(null);
  const [sending, setSending] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [loadingChats, setLoadingChats] = useState(true);
  const [mobileListOpen, setMobileListOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"chats" | "calls" | "settings">("chats");
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("main");
  const [profileNameDraft, setProfileNameDraft] = useState(currentUser.displayName);
  const [profileUsernameDraft, setProfileUsernameDraft] = useState(currentUser.username);
  const [profileBusy, setProfileBusy] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<LightboxMedia | null>(null);
  const [profileSheetUser, setProfileSheetUser] = useState<User | null>(null);
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
  const [mediaPermissionStatus, setMediaPermissionStatus] = useState("Микрофон/камера ещё не проверены");
  const [iceServers, setIceServers] = useState<RTCIceServer[]>(DEFAULT_ICE_SERVERS);
  const [turnReady, setTurnReady] = useState(false);
  const [maintenanceClosed, setMaintenanceClosed] = useState(Boolean(currentUser.maintenanceMode));
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [adminAliases, setAdminAliases] = useState<{ username: string; createdAt?: string }[]>(currentUser.aliases ?? []);
  const [aliasInput, setAliasInput] = useState("");
  const [adminUserSearch, setAdminUserSearch] = useState("");
  const [adminUserResults, setAdminUserResults] = useState<User[]>([]);
  const [adminSelectedUser, setAdminSelectedUser] = useState<User | null>(null);
  const [adminUsernameDraft, setAdminUsernameDraft] = useState("");
  const [adminDisplayNameDraft, setAdminDisplayNameDraft] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [avatarEditor, setAvatarEditor] = useState<AvatarEditorState | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const profileAvatarRef = useRef<HTMLInputElement | null>(null);
  const groupAvatarRef = useRef<HTMLInputElement | null>(null);
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
  const messagePointerStartRef = useRef<{ x: number; y: number; id: string } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const lastTapRef = useRef<{ id: string; at: number } | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<number | null>(null);
  const voiceStartedAtRef = useRef(0);
  const voiceCancelledRef = useRef(false);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId), [chats, activeChatId]);
  const privateChatUser = useMemo(() => activeChat?.type === "PRIVATE" ? activeChat.members.find((member) => member.id !== currentUser.id) ?? null : null, [activeChat, currentUser.id]);
  const activeChatMedia = useMemo(() => messages.filter((message) => (message.type === "IMAGE" || message.type === "VIDEO") && message.mediaData), [messages]);
  const profileUserMedia = useMemo(() => profileSheetUser ? activeChatMedia.filter((message) => message.senderId === profileSheetUser.id || activeChat?.type === "PRIVATE") : [], [activeChat?.type, activeChatMedia, profileSheetUser]);
  const lastMessageDate = messages[messages.length - 1]?.createdAt;
  const isIncomingRinging = Boolean(activeCall && activeCall.callerId !== currentUser.id && activeCall.status === "RINGING");
  const isCallConnected = Boolean(activeCall && activeCall.status === "ACCEPTED");

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    const saved = window.localStorage.getItem("pirogram_theme");
    if (saved === "dark" || saved === "light") setTheme(saved);

    const savedReaction = window.localStorage.getItem("pirogram_quick_reaction");
    if (isReactionEmoji(savedReaction)) setQuickReaction(savedReaction);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("pirogram_theme", theme);
  }, [theme]);

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    void loadAppState();
    void loadIceServers();
    if (isAdmin) void loadAdminAliases();
  }, [isAdmin]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadAppState({ silent: true });
    }, 4500);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    searchUsers(groupMemberSearch, setGroupPickResults, false, groupSelectedUsers.map((item) => item.id));
  }, [groupMemberSearch, groupSelectedUsers]);

  useEffect(() => {
    searchUsers(inviteSearch, setInviteResults, false, activeChat?.members.map((item) => item.id) ?? []);
  }, [inviteSearch, activeChat?.id, activeChat?.members]);

  useEffect(() => {
    if (!isAdmin) return;
    searchUsers(adminUserSearch, setAdminUserResults, true, []);
  }, [adminUserSearch, isAdmin]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadChats({ silent: true });
    }, 2500);
    return () => window.clearInterval(interval);
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
    if (typeof window === "undefined") return;
    void refreshMediaPermissionStatus();
  }, []);

  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) window.clearInterval(voiceTimerRef.current);
      voiceRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    async function sendPresence() {
      if (document.visibilityState !== "visible") return;
      await fetch("/api/presence", { method: "POST", credentials: "include" }).catch(() => undefined);
    }

    void sendPresence();
    const interval = window.setInterval(() => {
      void sendPresence();
    }, 15_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void sendPresence();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    setReplyTo(null);
    setMessageMenu(null);
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

  async function searchUsers(queryValue: string, setter: (users: User[]) => void, includeSelf = false, excludeIds: string[] = []) {
    const query = queryValue.trim();
    if (query.length < 2) {
      setter([]);
      return;
    }
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}${includeSelf ? "&includeSelf=1" : ""}`, { credentials: "include" }).catch(() => null);
    const data = response ? await response.json().catch(() => null) : null;
    if (!response?.ok) {
      setter([]);
      return;
    }
    const excluded = new Set(excludeIds);
    setter((data?.users ?? []).filter((user: User) => !excluded.has(user.id)));
  }

  async function loadAppState(options?: { silent?: boolean }) {
    const response = await fetch("/api/me", { credentials: "include" }).catch(() => null);
    const data = response ? await response.json().catch(() => null) : null;
    if (!response?.ok || !data) return;
    if (data.user) {
      setProfileUser((current) => ({ ...current, ...data.user, isAdmin: data.isAdmin, maintenanceMode: data.maintenanceMode }));
      if (!profileBusy) {
        setProfileNameDraft(data.user.displayName ?? "");
        setProfileUsernameDraft(data.user.username ?? "");
      }
    }
    setMaintenanceClosed(Boolean(data.maintenanceMode));
    if (!options?.silent && data.isAdmin) void loadAdminAliases();
  }

  async function loadIceServers() {
    const response = await fetch("/api/calls/ice", { credentials: "include" }).catch(() => null);
    const data = response ? await response.json().catch(() => null) : null;
    if (response?.ok && Array.isArray(data?.iceServers)) {
      setIceServers(data.iceServers);
      setTurnReady(Boolean(data.hasTurn));
      setMediaPermissionStatus(data.hasTurn ? "Звонки готовы: STUN + TURN подключены" : "STUN включён. Для разных сетей лучше добавить TURN_URLS в Vercel");
    }
  }

  async function loadAdminAliases() {
    if (!isAdmin) return;
    const response = await fetch("/api/admin/aliases", { credentials: "include" }).catch(() => null);
    const data = response ? await response.json().catch(() => null) : null;
    if (response?.ok) setAdminAliases(data?.aliases ?? []);
  }

  async function toggleMaintenanceMode() {
    if (!isAdmin || maintenanceBusy) return;
    setMaintenanceBusy(true);
    const next = !maintenanceClosed;
    const response = await fetch("/api/admin/maintenance", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next })
    });
    const data = await response.json().catch(() => null);
    setMaintenanceBusy(false);
    if (!response.ok) {
      alert(data?.error ?? "Не удалось переключить тех обслуживание.");
      return;
    }
    setMaintenanceClosed(Boolean(data.enabled));
  }

  async function addAdminAlias(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!aliasInput.trim() || !isAdmin) return;
    const response = await fetch("/api/admin/aliases", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: aliasInput.trim() })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      alert(data?.error ?? "Не удалось добавить юзернейм.");
      return;
    }
    setAliasInput("");
    setAdminAliases(data?.aliases ?? []);
  }

  async function removeAdminAlias(username: string) {
    const response = await fetch("/api/admin/aliases", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
    const data = await response.json().catch(() => null);
    if (response.ok) setAdminAliases(data?.aliases ?? []);
  }

  function selectAdminUser(user: User) {
    setAdminSelectedUser(user);
    setAdminUsernameDraft(user.username);
    setAdminDisplayNameDraft(user.displayName);
  }

  async function saveAdminUser() {
    if (!adminSelectedUser || adminBusy) return;
    setAdminBusy(true);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(adminSelectedUser.id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: adminUsernameDraft, displayName: adminDisplayNameDraft })
    });
    const data = await response.json().catch(() => null);
    setAdminBusy(false);
    if (!response.ok) {
      alert(data?.error ?? "Не удалось сохранить профиль.");
      return;
    }
    setAdminSelectedUser(data.user);
    setAdminUserResults((current) => current.map((user) => user.id === data.user.id ? data.user : user));
    void loadChats({ silent: true });
  }

  async function openAvatarEditor(file: File, target: "user" | "group") {
    if (!file.type.startsWith("image/")) {
      alert("Выбери изображение.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      alert("Аватарка слишком большая. Максимум 3.5 МБ.");
      return;
    }
    const source = await fileToDataUrl(file);
    setAvatarEditor({ target, source, zoom: 1, offsetX: 0, offsetY: 0 });
  }

  async function saveAvatarEditor() {
    if (!avatarEditor) return;
    try {
      const avatarData = await cropAvatarToSquare(avatarEditor);
      if (avatarEditor.target === "user") {
        const response = await fetch("/api/me", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatarData })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Не удалось сохранить аватарку.");
        setProfileUser((current) => ({ ...current, ...data.user }));
        void loadChats({ silent: true });
      } else if (activeChat?.type === "GROUP") {
        const response = await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatarData })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Не удалось сохранить аватарку группы.");
        updateChatInList(data.chat as Chat);
      }
      setAvatarEditor(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Не удалось обработать фото.");
    }
  }

  function openUserProfile(user?: User | null) {
    if (!user) return;
    setProfileSheetUser(user);
  }

  async function saveMyProfile() {
    if (profileBusy) return;
    const displayName = profileNameDraft.trim();
    const username = profileUsernameDraft.trim().replace(/^@+/, "").toLowerCase();
    if (!displayName) {
      alert("Введи имя профиля.");
      return;
    }
    if (!username) {
      alert("Введи @username.");
      return;
    }
    setProfileBusy(true);
    const response = await fetch("/api/me", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, username })
    });
    const data = await response.json().catch(() => null);
    setProfileBusy(false);
    if (!response.ok) {
      alert(data?.error ?? "Не удалось сохранить профиль.");
      return;
    }
    setProfileUser((current) => ({ ...current, ...data.user }));
    setProfileNameDraft(data.user.displayName ?? displayName);
    setProfileUsernameDraft(data.user.username ?? username);
    setProfileSheetUser((current) => current?.id === data.user.id ? { ...current, ...data.user } : current);
    void loadChats({ silent: true });
    setSettingsPage("main");
  }

  function addSelectedGroupUser(user: User) {
    setGroupSelectedUsers((current) => current.some((item) => item.id === user.id) ? current : [...current, user]);
    setGroupMemberSearch("");
    setGroupPickResults([]);
  }

  async function inviteUserToActiveGroup(user: User) {
    if (!activeChat || activeChat.type !== "GROUP") return;
    const response = await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: [user.id] })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      alert(data?.error ?? "Не удалось добавить участника.");
      return;
    }
    updateChatInList(data.chat as Chat);
    setInviteSearch("");
    setInviteResults([]);
  }

  async function loadChats(options?: { silent?: boolean }) {
    if (!options?.silent) setLoadingChats(true);
    const response = await fetch("/api/chats", { credentials: "include" });
    const data = await response.json().catch(() => null);
    const nextChats = response.ok ? data?.chats ?? [] : [];
    setChats(nextChats);
    if (!options?.silent) setLoadingChats(false);
    setActiveChatId((current) => {
      if (!current && nextChats[0]) return nextChats[0].id;
      if (current && !nextChats.some((chat: Chat) => chat.id === current)) {
        setMessages([]);
        setActiveCall(null);
        cleanupCallMedia();
        return nextChats[0]?.id ?? "";
      }
      return current;
    });
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
    if (!after) {
      await loadMessages(chatId);
      return;
    }
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
    const receipts = new Map<string, { readByOthers: boolean; reactions?: MessageReaction[] }>(
      data.receipts.map((item: { id: string; readByOthers: boolean; reactions?: MessageReaction[] }) => [item.id, { readByOthers: item.readByOthers, reactions: item.reactions }] as [string, { readByOthers: boolean; reactions?: MessageReaction[] }])
    );
    setMessages((current) => current.map((message) => {
      const receipt = receipts.get(message.id);
      return receipt ? { ...message, readByOthers: receipt.readByOthers, reactions: receipt.reactions ?? message.reactions } : message;
    }));
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


  async function createGroupChat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = groupTitle.trim();
    const usernames = parseUsernames(groupMembers);
    const userIds = groupSelectedUsers.map((member) => member.id);
    if (!title || groupBusy) return;
    setGroupBusy(true);
    setSearchError("");
    const response = await fetch("/api/chats", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "GROUP", title, usernames, userIds })
    });
    const data = await response.json().catch(() => null);
    setGroupBusy(false);
    if (!response.ok) {
      setSearchError(data?.error ?? "Не удалось создать общий чат.");
      return;
    }
    const chat = data.chat as Chat;
    setGroupTitle("");
    setGroupMembers("");
    setGroupMemberSearch("");
    setGroupSelectedUsers([]);
    setGroupCreatorOpen(false);
    setChats((current) => [chat, ...current.filter((item) => item.id !== chat.id)]);
    setActiveChatId(chat.id);
    setMobileListOpen(false);
  }

  function updateChatInList(chat: Chat) {
    setChats((current) => [chat, ...current.filter((item) => item.id !== chat.id)]);
  }

  async function renameGroupChat() {
    if (!activeChat || activeChat.type !== "GROUP") return;
    const title = window.prompt("Новое название общего чата", activeChat.title || "");
    if (!title?.trim()) return;
    const response = await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      alert(data?.error ?? "Не удалось изменить название.");
      return;
    }
    updateChatInList(data.chat as Chat);
  }

  async function inviteToGroupChat() {
    if (!activeChat || activeChat.type !== "GROUP") return;
    const raw = window.prompt("Кого пригласить? Введи @username через пробел или запятую");
    const usernames = parseUsernames(raw || "");
    if (!usernames.length) return;
    const response = await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      alert(data?.error ?? "Не удалось пригласить пользователей.");
      return;
    }
    updateChatInList(data.chat as Chat);
  }

  async function leaveGroupChat() {
    if (!activeChat || activeChat.type !== "GROUP") return;
    const confirmed = window.confirm(`Выйти из общего чата «${activeChat.title || "Чат"}»?`);
    if (!confirmed) return;
    const response = await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}?mode=leave`, {
      method: "DELETE",
      credentials: "include"
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      alert(data?.error ?? "Не удалось выйти из чата.");
      return;
    }
    const nextChats = chats.filter((chat) => chat.id !== activeChat.id);
    setChats(nextChats);
    setActiveChatId(nextChats[0]?.id ?? "");
    setMessages([]);
    setMobileListOpen(true);
  }

  async function postMessage(payload: { chatId: string; text?: string; mediaData?: string; mediaMime?: string; mediaName?: string; replyToId?: string }, restoreText = "") {
    setSending(true);
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
      setReplyTo(null);
      void loadChats();
      return true;
    }

    if (restoreText) setText(restoreText);
    alert(data?.error ?? "Не удалось отправить сообщение.");
    return false;
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanText = text.trim();
    if ((!cleanText && !mediaDraft) || !activeChatId || sending || recordingVoice) return;

    const payload = {
      chatId: activeChatId,
      text: cleanText,
      mediaData: mediaDraft?.data,
      mediaMime: mediaDraft?.mime,
      mediaName: mediaDraft?.name,
      replyToId: replyTo?.id
    };

    setText("");
    setMediaDraft(null);
    await postMessage(payload, cleanText);
  }

  function preferredVoiceMimeType() {
    if (typeof MediaRecorder === "undefined") return "";
    const candidates = ["audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm;codecs=opus"];
    return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || "";
  }

  async function startVoiceRecording() {
    if (!activeChatId || sending || recordingVoice) return;
    if (!("mediaDevices" in navigator) || typeof MediaRecorder === "undefined") {
      alert("Браузер не поддерживает голосовые сообщения.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredVoiceMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      voiceRecorderRef.current = recorder;
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];
      voiceCancelledRef.current = false;
      voiceStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setRecordingVoice(true);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const chunks = [...voiceChunksRef.current];
        const elapsed = Math.max(1, Math.round((Date.now() - voiceStartedAtRef.current) / 1000));
        const cancelled = voiceCancelledRef.current;
        voiceChunksRef.current = [];
        if (voiceTimerRef.current) window.clearInterval(voiceTimerRef.current);
        voiceTimerRef.current = null;
        setRecordingVoice(false);
        setRecordingSeconds(0);
        stream.getTracks().forEach((track) => track.stop());
        voiceStreamRef.current = null;
        voiceRecorderRef.current = null;
        if (cancelled || !chunks.length || !activeChatId) return;
        const type = recorder.mimeType || chunks[0]?.type || "audio/webm";
        const blob = new Blob(chunks, { type });
        if (blob.size > MAX_UPLOAD_BYTES) {
          alert("Голосовое слишком большое. Запиши короче.");
          return;
        }
        void fileToDataUrl(blob).then((data) => postMessage({
          chatId: activeChatId,
          text: "",
          mediaData: data,
          mediaMime: type,
          mediaName: `voice-${Date.now()}-${formatVoiceDuration(elapsed)}.webm`,
          replyToId: replyTo?.id
        })).catch(() => alert("Не удалось отправить голосовое."));
      };
      recorder.start(250);
      voiceTimerRef.current = window.setInterval(() => setRecordingSeconds(Math.round((Date.now() - voiceStartedAtRef.current) / 1000)), 250);
    } catch {
      setRecordingVoice(false);
      alert("Разреши доступ к микрофону, чтобы записывать голосовые.");
    }
  }

  function stopVoiceRecording() {
    if (!voiceRecorderRef.current || voiceRecorderRef.current.state === "inactive") return;
    voiceRecorderRef.current.stop();
  }

  function cancelVoiceRecording() {
    voiceCancelledRef.current = true;
    if (voiceRecorderRef.current && voiceRecorderRef.current.state !== "inactive") {
      voiceRecorderRef.current.stop();
      return;
    }
    if (voiceTimerRef.current) window.clearInterval(voiceTimerRef.current);
    voiceTimerRef.current = null;
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
    setRecordingVoice(false);
    setRecordingSeconds(0);
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

  function clearMessageGesture() {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  function changeQuickReaction(emoji: ReactionEmoji) {
    setQuickReaction(emoji);
    window.localStorage.setItem("pirogram_quick_reaction", emoji);
  }

  function startMessagePointer(event: React.PointerEvent, message: Message) {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers do not allow pointer capture on every element.
    }
    messagePointerStartRef.current = { x: event.clientX, y: event.clientY, id: message.id };
    longPressTriggeredRef.current = false;
    setSwipeState(null);
    clearMessageGesture();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setSwipeState(null);
      setMessageMenu(message);
      if (navigator.vibrate) navigator.vibrate(35);
    }, 520);
  }

  function moveMessagePointer(event: React.PointerEvent, message: Message) {
    const start = messagePointerStartRef.current;
    if (!start || start.id !== message.id || longPressTriggeredRef.current) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dy) > 54) {
      setSwipeState(null);
      return;
    }
    if (dx < -8) {
      clearMessageGesture();
      const clamped = Math.max(dx, -92);
      setSwipeState({ id: message.id, dx: clamped, ready: clamped < -46 });
    } else if (swipeState?.id === message.id) {
      setSwipeState(null);
    }
  }

  function handleMessageTap(message: Message) {
    const now = Date.now();
    const previous = lastTapRef.current;
    if (previous?.id === message.id && now - previous.at < 310) {
      lastTapRef.current = null;
      void toggleReaction(message, quickReaction);
      return;
    }
    lastTapRef.current = { id: message.id, at: now };
  }

  function endMessagePointer(event: React.PointerEvent, message: Message) {
    const start = messagePointerStartRef.current;
    clearMessageGesture();
    messagePointerStartRef.current = null;
    const wasLongPress = longPressTriggeredRef.current;
    longPressTriggeredRef.current = false;
    if (!start || start.id !== message.id || wasLongPress) {
      setSwipeState(null);
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const wasSwipe = dx < -45 && Math.abs(dy) < 42;
    if (wasSwipe) {
      setReplyTo(message);
      if (navigator.vibrate) navigator.vibrate(20);
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      handleMessageTap(message);
    }
    window.setTimeout(() => setSwipeState((current) => current?.id === message.id ? null : current), 110);
  }

  function applyMessageReactions(messageId: string, reactions: MessageReaction[]) {
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, reactions } : message));
    setMessageMenu((current) => current?.id === messageId ? { ...current, reactions } : current);
  }

  async function toggleReaction(message: Message, emoji: ReactionEmoji) {
    const currentReaction = message.reactions?.find((reaction) => reaction.userId === currentUser.id);
    const isRemoving = currentReaction?.emoji === emoji;
    const optimisticReactions = isRemoving
      ? (message.reactions ?? []).filter((reaction) => reaction.userId !== currentUser.id)
      : [...(message.reactions ?? []).filter((reaction) => reaction.userId !== currentUser.id), { emoji, userId: currentUser.id }];

    applyMessageReactions(message.id, optimisticReactions);
    if (!isRemoving) {
      setReactionBurst({ id: message.id, emoji });
      window.setTimeout(() => setReactionBurst((current) => current?.id === message.id ? null : current), 650);
      if (navigator.vibrate) navigator.vibrate(15);
    }

    const response = await fetch(`/api/messages/${encodeURIComponent(message.id)}/reactions`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji })
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.reactions) {
      applyMessageReactions(message.id, data.reactions as MessageReaction[]);
    } else {
      if (activeChatId) void loadMessages(activeChatId);
    }
  }

  async function deleteMessage(scope: "me" | "everyone") {
    if (!messageMenu) return;
    const message = messageMenu;
    const response = await fetch(`/api/messages/${encodeURIComponent(message.id)}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      alert(data?.error ?? "Не удалось удалить сообщение.");
      return;
    }
    setMessages((current) => current.filter((item) => item.id !== message.id));
    if (replyTo?.id === message.id) setReplyTo(null);
    setMessageMenu(null);
    void loadChats({ silent: true });
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

  async function refreshMediaPermissionStatus() {
    const nav = navigator as Navigator & { permissions?: { query: (descriptor: { name: PermissionName }) => Promise<PermissionStatus> } };
    if (!nav.permissions?.query) {
      setMediaPermissionStatus("Браузер попросит доступ при первом звонке");
      return;
    }

    try {
      const mic = await nav.permissions.query({ name: "microphone" as PermissionName });
      const camera = await nav.permissions.query({ name: "camera" as PermissionName });
      if (mic.state === "granted" && camera.state === "granted") setMediaPermissionStatus("Микрофон и камера разрешены");
      else if (mic.state === "granted") setMediaPermissionStatus("Микрофон разрешён, камера ещё нет");
      else if (mic.state === "denied" || camera.state === "denied") setMediaPermissionStatus("Доступ заблокирован в настройках браузера");
      else setMediaPermissionStatus("Нажми проверку, чтобы заранее разрешить доступ");
    } catch {
      setMediaPermissionStatus("Браузер попросит доступ при первом звонке");
    }
  }

  async function warmUpCallPermissions(kind: "AUDIO" | "VIDEO" = "VIDEO") {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaPermissionStatus("Этот браузер не поддерживает микрофон/камеру");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints(kind));
      const hasAudio = stream.getAudioTracks().length > 0;
      const hasVideo = kind === "AUDIO" || stream.getVideoTracks().length > 0;
      stream.getTracks().forEach((track) => track.stop());
      if (!hasAudio) {
        setMediaPermissionStatus("Микрофон не найден или не разрешён");
        return false;
      }
      if (!hasVideo) {
        setMediaPermissionStatus("Камера не найдена или не разрешена");
        return false;
      }
      setMediaPermissionStatus(kind === "VIDEO" ? "Микрофон и камера разрешены" : "Микрофон разрешён");
      void refreshMediaPermissionStatus();
      return true;
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setMediaPermissionStatus("Доступ запрещён. Разреши микрофон/камеру в настройках сайта");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setMediaPermissionStatus("Микрофон или камера не найдены на устройстве");
      } else {
        setMediaPermissionStatus("Не удалось получить доступ к микрофону/камере");
      }
      return false;
    }
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
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Браузер не поддерживает микрофон/камеру.");

    const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints(kind));
    if (!stream.getAudioTracks().length) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("Микрофон не найден или не разрешён.");
    }
    if (kind === "VIDEO" && !stream.getVideoTracks().length) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("Камера не найдена или не разрешена.");
    }

    stream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    stream.getVideoTracks().forEach((track) => {
      track.enabled = true;
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    setMediaPermissionStatus(kind === "VIDEO" ? "Микрофон и камера разрешены" : "Микрофон разрешён");
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
    const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 });
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
      void loadIceServers();
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
      setCallNotice(turnReady ? "Звоним… TURN включён, соединение должно проходить через разные сети стабильнее." : "Звоним… STUN включён. Для самых сложных сетей добавь TURN_URLS/TURN_USERNAME/TURN_CREDENTIAL в Vercel.");
    } catch (error) {
      cleanupCallMedia();
      const message = error instanceof Error ? error.message : "Проверь разрешение микрофона/камеры.";
      setCallNotice(`${kind === "VIDEO" ? "Не удалось начать видеозвонок" : "Не удалось начать аудиозвонок"}. ${message}`);
      setMediaPermissionStatus(message);
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
    } catch (error) {
      cleanupCallMedia();
      const message = error instanceof Error ? error.message : "Проверь разрешение микрофона/камеры.";
      setCallNotice(`Не удалось принять звонок. ${message}`);
      setMediaPermissionStatus(message);
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

  if (maintenanceClosed && !isAdmin) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#e6edf5] px-5 text-center">
        <div className="tg-card max-w-sm rounded-[2rem] p-7 shadow-2xl shadow-slate-900/10">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[#229ed9]/10 text-3xl">🛠️</div>
          <h1 className="tg-title text-2xl font-black tracking-[-0.03em]">Закрыто на тех обслуживание</h1>
          <p className="tg-muted mt-3 text-sm leading-6">Админ обновляет Pirogram. Когда обновление закончится, приложение снова откроется.</p>
        </div>
      </main>
    );
  }

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
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setGroupCreatorOpen((value) => !value)} className="tg-icon-btn grid h-9 w-9 place-items-center rounded-full active:bg-slate-100" aria-label="Создать общий чат">
                      <Plus size={20} />
                    </button>
                    <button type="button" onClick={() => { setActiveTab("settings"); setSettingsPage("main"); setMobileListOpen(true); }} className="tg-icon-btn grid h-9 w-9 place-items-center rounded-full active:bg-slate-100" aria-label="Настройки">
                      <Smartphone size={19} />
                    </button>
                  </div>
                </div>

                <label className="tg-search flex h-10 items-center gap-2 rounded-xl bg-[#eef2f7] px-3 text-[15px] text-slate-500 shadow-inner shadow-slate-200/50 focus-within:ring-2 focus-within:ring-[#229ed9]/20">
                  <Search size={17} />
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search or @username" className="tg-input-darkfix min-w-0 flex-1 bg-transparent outline-none" autoCapitalize="none" />
                  {searchQuery ? <button type="button" onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="grid h-5 w-5 place-items-center rounded-full bg-black/20 text-white"><X size={13} /></button> : null}
                </label>

                {groupCreatorOpen ? (
                  <form onSubmit={createGroupChat} className="tg-popover tg-theme-panel mt-2 space-y-3 rounded-2xl border p-3 shadow-lg shadow-slate-900/5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Users size={17} className="text-[#229ed9]" /> Новый общий чат</div>
                    <input value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} placeholder="Название чата" className="tg-input-darkfix tg-theme-field w-full rounded-xl px-3 py-2 text-sm outline-none" maxLength={64} />
                    <div className="tg-soft-surface rounded-2xl p-2">
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {groupSelectedUsers.map((member) => (
                          <button key={member.id} type="button" onClick={() => setGroupSelectedUsers((current) => current.filter((item) => item.id !== member.id))} className="tg-chip-soft rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm">
                            {member.displayName} <span className="text-slate-400">×</span>
                          </button>
                        ))}
                      </div>
                      <input value={groupMemberSearch} onChange={(event) => setGroupMemberSearch(event.target.value)} placeholder="Найти по нику или @username" className="tg-input-darkfix tg-theme-field w-full rounded-xl px-3 py-2 text-sm outline-none" autoCapitalize="none" />
                      {groupPickResults.length ? (
                        <div className="tg-theme-list mt-2 overflow-hidden rounded-xl shadow-sm">
                          {groupPickResults.map((user) => (
                            <button key={user.id} type="button" onClick={() => addSelectedGroupUser(user)} className="tg-theme-row flex w-full items-center gap-2 border-b px-2 py-2 text-left last:border-b-0">
                              {user.avatarData ? <img src={user.avatarData} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="grid h-8 w-8 place-items-center rounded-full bg-[#229ed9] text-xs font-bold text-white">{avatarLabel(user.displayName)}</div>}
                              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.displayName}</span><span className="block truncate text-xs text-[#229ed9]">@{user.username}</span></span>
                              <Plus size={16} className="text-[#229ed9]" />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <input value={groupMembers} onChange={(event) => setGroupMembers(event.target.value)} placeholder="Или @username через пробел" className="tg-input-darkfix tg-theme-field w-full rounded-xl px-3 py-2 text-sm outline-none" autoCapitalize="none" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setGroupCreatorOpen(false)} className="tg-secondary-button flex-1 rounded-xl px-3 py-2 text-sm font-semibold active:scale-[0.98]">Отмена</button>
                      <button disabled={groupBusy || !groupTitle.trim()} className="flex-1 rounded-xl bg-[#229ed9] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 active:scale-[0.98]">{groupBusy ? "Создаю..." : "Создать"}</button>
                    </div>
                  </form>
                ) : null}

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
                <button type="button" onClick={() => settingsPage === "main" ? setActiveTab("chats") : setSettingsPage("main")} className="rounded-full px-1 text-[15px] font-medium text-[#229ed9] active:opacity-60">{settingsPage === "main" ? "Chats" : "Назад"}</button>
                <h1 className="tg-title text-[18px] font-bold tracking-[-0.02em]">{settingsPage === "main" ? "Settings" : settingsPage === "profile" ? "Профиль" : settingsPage === "permissions" ? "Разрешения" : settingsPage === "reactions" ? "Реакции" : settingsPage === "appearance" ? "Оформление" : "Админ"}</h1>
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
              <input ref={profileAvatarRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void openAvatarEditor(file, "user"); }} />
              {settingsPage === "main" ? (
                <>
                  <div className="tg-card mb-4 rounded-3xl p-4 shadow-sm">
                    <div className="flex items-center gap-4">
                      <button type="button" onClick={() => profileAvatarRef.current?.click()} className="group relative shrink-0">
                        {profileUser.avatarData ? <img src={profileUser.avatarData} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[#7bd0ff] via-[#229ed9] to-[#0969a8] text-2xl font-bold text-white">{avatarLabel(profileUser.displayName)}</div>}
                        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/35 text-white opacity-0 transition group-hover:opacity-100"><Camera size={20} /></span>
                      </button>
                      <button type="button" onClick={() => setSettingsPage("profile")} className="min-w-0 flex-1 text-left active:opacity-70">
                        <p className="truncate text-xl font-bold text-slate-950">{profileUser.displayName}</p>
                        <p className="truncate text-sm text-[#229ed9]">@{profileUser.username}</p>
                        {profileUser.login ? <p className="tg-muted truncate text-xs">Логин: {profileUser.login}</p> : null}
                      </button>
                    </div>
                  </div>

                  <div className="tg-card mb-4 overflow-hidden rounded-3xl shadow-sm">
                    <button type="button" onClick={() => setSettingsPage("profile")} className="tg-settings-row flex w-full items-center justify-between px-4 py-3 text-left">
                      <span className="inline-flex min-w-0 items-center gap-3 text-[15px] font-semibold"><UserRound size={18} className="text-[#229ed9]" />Профиль</span>
                      <span className="text-xl leading-none text-slate-400">›</span>
                    </button>
                    <button type="button" onClick={() => setSettingsPage("permissions")} className="tg-settings-row flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left">
                      <span className="inline-flex min-w-0 items-center gap-3 text-[15px] font-semibold"><Bell size={18} className="text-[#229ed9]" />Разрешения</span>
                      <span className="text-xl leading-none text-slate-400">›</span>
                    </button>
                    <button type="button" onClick={() => setSettingsPage("reactions")} className="tg-settings-row flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left">
                      <span className="inline-flex min-w-0 items-center gap-3 text-[15px] font-semibold"><SmilePlus size={18} className="text-[#229ed9]" />Реакции</span>
                      <span className="text-sm text-[#229ed9]">{quickReaction}</span>
                    </button>
                    <button type="button" onClick={() => setSettingsPage("appearance")} className="tg-settings-row flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left">
                      <span className="inline-flex min-w-0 items-center gap-3 text-[15px] font-semibold">{theme === "dark" ? <Moon size={18} className="text-[#229ed9]" /> : <Sun size={18} className="text-[#229ed9]" />}Оформление</span>
                      <span className="text-sm text-[#229ed9]">{theme === "dark" ? "Тёмная" : "Светлая"}</span>
                    </button>
                    <button type="button" onClick={() => setActiveTab("calls")} className="tg-settings-row flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left">
                      <span className="inline-flex min-w-0 items-center gap-3 text-[15px] font-semibold"><Phone size={18} className="text-[#229ed9]" />Звонки</span>
                      <span className="text-xl leading-none text-slate-400">›</span>
                    </button>
                    {isAdmin ? (
                      <button type="button" onClick={() => setSettingsPage("admin")} className="tg-settings-row flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left">
                        <span className="inline-flex min-w-0 items-center gap-3 text-[15px] font-semibold"><Wrench size={18} className="text-[#229ed9]" />Админ-панель</span>
                        <span className="text-xl leading-none text-slate-400">›</span>
                      </button>
                    ) : null}
                  </div>

                  <div className="tg-card overflow-hidden rounded-3xl shadow-sm">
                    <button onClick={logout} className="tg-settings-row flex w-full items-center justify-between px-4 py-3 text-left active:bg-red-50">
                      <span className="inline-flex items-center gap-3 text-[15px] font-semibold text-red-500"><LogOut size={18} />Выйти из аккаунта</span>
                    </button>
                  </div>
                </>
              ) : null}

              {settingsPage === "profile" ? (
                <div className="space-y-4">
                  <div className="tg-card rounded-3xl p-4 text-center shadow-sm">
                    <button type="button" onClick={() => profileAvatarRef.current?.click()} className="group relative mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#7bd0ff] via-[#229ed9] to-[#0969a8] text-3xl font-black text-white shadow-xl shadow-[#229ed9]/20">
                      {profileUser.avatarData ? <img src={profileUser.avatarData} alt="" className="h-full w-full object-cover" /> : avatarLabel(profileUser.displayName)}
                      <span className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition group-hover:opacity-100"><Camera size={24} /></span>
                    </button>
                    <p className="tg-muted mt-3 text-xs">Нажми на аватарку, чтобы поменять фото.</p>
                    <button type="button" onClick={() => profileAvatarRef.current?.click()} className="mt-3 rounded-full bg-[#229ed9]/10 px-4 py-2 text-sm font-bold text-[#229ed9] active:scale-[0.98]">Изменить фото</button>
                  </div>

                  <div className="tg-card overflow-hidden rounded-3xl p-4 shadow-sm">
                    <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">Имя</label>
                    <input value={profileNameDraft} onChange={(event) => setProfileNameDraft(event.target.value)} placeholder="Твоё имя" className="tg-input-darkfix tg-theme-field mb-4 w-full rounded-2xl px-3 py-3 text-[15px] outline-none" maxLength={40} />
                    <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">Username</label>
                    <div className="tg-theme-field mb-2 flex items-center gap-2 rounded-2xl px-3 py-3">
                      <AtSign size={16} className="text-slate-400" />
                      <input value={profileUsernameDraft} onChange={(event) => setProfileUsernameDraft(event.target.value)} placeholder="username" className="tg-input-darkfix min-w-0 flex-1 bg-transparent text-[15px] outline-none" autoCapitalize="none" maxLength={20} />
                    </div>
                    <p className="tg-muted mb-4 text-xs leading-5">Можно поставить только свободный username: латиница, цифры и подчёркивание.</p>
                    <button type="button" onClick={() => void saveMyProfile()} disabled={profileBusy} className="w-full rounded-2xl bg-[#229ed9] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{profileBusy ? "Сохраняю..." : "Сохранить профиль"}</button>
                  </div>
                </div>
              ) : null}

              {settingsPage === "permissions" ? (
                <div className="space-y-4">
                  <div className="tg-card overflow-hidden rounded-3xl shadow-sm">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-950">Уведомления</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{pushStatus}</p>
                      {installTip ? <p className="mt-1 text-xs leading-5 text-slate-500">{installTip}</p> : null}
                    </div>
                    <button onClick={enablePush} disabled={pushBusy || !pushReady} className="tg-settings-row flex w-full items-center justify-between px-4 py-3 text-left disabled:opacity-50">
                      <span className="inline-flex items-center gap-3 text-[15px] text-slate-900"><Bell size={18} className="text-[#229ed9]" />{pushBusy ? "Подключаю push..." : "Включить уведомления"}</span>
                      <span className="text-sm text-[#229ed9]">Открыть</span>
                    </button>
                    <button onClick={sendPushTest} disabled={testingPush || !pushReady} className="tg-settings-row flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left disabled:opacity-50">
                      <span className="inline-flex items-center gap-3 text-[15px] text-slate-900"><TestTube2 size={18} className="text-[#229ed9]" />Проверить push</span>
                      <span className="text-sm text-[#229ed9]">{testingPush ? "Отправляю..." : "Тест"}</span>
                    </button>
                  </div>

                  <div className="tg-card overflow-hidden rounded-3xl shadow-sm">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-950">Микрофон и камера</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{mediaPermissionStatus}</p>
                    </div>
                    <button onClick={() => void warmUpCallPermissions("AUDIO")} className="tg-settings-row flex w-full items-center justify-between px-4 py-3 text-left">
                      <span className="inline-flex items-center gap-3 text-[15px] text-slate-900"><Mic size={18} className="text-[#229ed9]" />Разрешить микрофон</span>
                      <span className="text-sm text-[#229ed9]">Проверить</span>
                    </button>
                    <button onClick={() => void warmUpCallPermissions("VIDEO")} className="tg-settings-row flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left">
                      <span className="inline-flex items-center gap-3 text-[15px] text-slate-900"><Video size={18} className="text-[#229ed9]" />Разрешить микрофон и камеру</span>
                      <span className="text-sm text-[#229ed9]">Проверить</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {settingsPage === "reactions" ? (
                <div className="tg-card overflow-hidden rounded-3xl shadow-sm">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-950">Реакция двойным тапом</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Выбери смайлик: потом дважды тапни по сообщению, чтобы поставить или убрать реакцию.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => changeQuickReaction(emoji)}
                        className={`tg-quick-reaction-btn rounded-2xl px-4 py-3 text-2xl font-semibold active:scale-[0.97] ${quickReaction === emoji ? "is-selected" : ""}`}
                      >
                        <span>{emoji}</span>
                        {quickReaction === emoji ? <Check size={17} className="tg-quick-reaction-check" /> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {settingsPage === "appearance" ? (
                <div className="tg-card overflow-hidden rounded-3xl shadow-sm">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-950">Оформление</p>
                    <p className="mt-1 text-xs text-slate-500">Выбери светлую или тёмную тему.</p>
                  </div>
                  <button onClick={() => setTheme("light")} className="tg-settings-row flex w-full items-center justify-between px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-3 text-[15px] text-slate-900"><Sun size={18} className="text-[#229ed9]" />Светлая тема</span>
                    {theme === "light" ? <Check size={18} className="text-[#229ed9]" /> : null}
                  </button>
                  <button onClick={() => setTheme("dark")} className="tg-settings-row flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-3 text-[15px] text-slate-900"><Moon size={18} className="text-[#229ed9]" />Тёмная тема</span>
                    {theme === "dark" ? <Check size={18} className="text-[#229ed9]" /> : null}
                  </button>
                </div>
              ) : null}

              {settingsPage === "admin" && isAdmin ? (
                <div className="tg-card mb-4 overflow-hidden rounded-3xl shadow-sm">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Wrench size={17} className="text-[#229ed9]" /> Админ-панель</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Только @admin видит этот блок. Здесь можно закрыть приложение для всех, кроме тебя.</p>
                  </div>
                  <button onClick={() => void toggleMaintenanceMode()} disabled={maintenanceBusy} className={`tg-settings-row flex w-full items-center justify-between px-4 py-3 text-left font-semibold disabled:opacity-60 ${maintenanceClosed ? "text-emerald-600" : "text-red-500"}`}>
                    <span className="inline-flex items-center gap-3"><Wrench size={18} />{maintenanceClosed ? "Завершить обновление" : "Закрыть на тех обслуживание"}</span>
                    <span className="text-xs">{maintenanceBusy ? "..." : maintenanceClosed ? "Закрыто" : "Открыто"}</span>
                  </button>

                  <div className="border-t border-slate-100 px-4 py-3">
                    <p className="mb-2 text-sm font-semibold text-slate-950">Свободные юзернеймы админа</p>
                    <form onSubmit={addAdminAlias} className="flex gap-2">
                      <input value={aliasInput} onChange={(event) => setAliasInput(event.target.value)} placeholder="например pirogram" className="tg-input-darkfix tg-theme-field min-w-0 flex-1 rounded-xl px-3 py-2 text-sm outline-none" autoCapitalize="none" />
                      <button className="rounded-xl bg-[#229ed9] px-3 py-2 text-sm font-bold text-white">Добавить</button>
                    </form>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {adminAliases.length ? adminAliases.map((alias) => (
                        <button key={alias.username} type="button" onClick={() => void removeAdminAlias(alias.username)} className="rounded-full bg-[#229ed9]/10 px-2.5 py-1 text-xs font-semibold text-[#229ed9]">
                          @{alias.username} <span className="text-slate-400">×</span>
                        </button>
                      )) : <span className="text-xs text-slate-400">Дополнительных юзернеймов пока нет</span>}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 px-4 py-3">
                    <p className="mb-2 text-sm font-semibold text-slate-950">Профили пользователей</p>
                    <label className="tg-theme-field flex h-10 items-center gap-2 rounded-xl px-3 text-sm">
                      <Search size={16} />
                      <input value={adminUserSearch} onChange={(event) => setAdminUserSearch(event.target.value)} placeholder="Найти по нику или @username" className="tg-input-darkfix min-w-0 flex-1 bg-transparent outline-none" autoCapitalize="none" />
                    </label>
                    {adminUserResults.length ? (
                      <div className="tg-theme-list mt-2 overflow-hidden rounded-2xl">
                        {adminUserResults.map((user) => (
                          <button key={user.id} type="button" onClick={() => selectAdminUser(user)} className="tg-theme-row flex w-full items-center gap-2 border-b px-2 py-2 text-left last:border-b-0">
                            {user.avatarData ? <img src={user.avatarData} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="grid h-9 w-9 place-items-center rounded-full bg-[#229ed9] text-xs font-bold text-white">{avatarLabel(user.displayName)}</div>}
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.displayName}</span><span className="block truncate text-xs text-[#229ed9]">@{user.username}</span></span>
                            <UserRound size={16} className="text-slate-400" />
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {adminSelectedUser ? (
                      <div className="tg-soft-surface mt-3 rounded-2xl p-3">
                        <div className="mb-3 flex items-center gap-2">
                          {adminSelectedUser.avatarData ? <img src={adminSelectedUser.avatarData} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-[#229ed9] text-sm font-bold text-white">{avatarLabel(adminSelectedUser.displayName)}</div>}
                          <div className="min-w-0"><p className="truncate text-sm font-bold">{adminSelectedUser.displayName}</p><p className="truncate text-xs text-[#229ed9]">@{adminSelectedUser.username}</p></div>
                        </div>
                        <input value={adminDisplayNameDraft} onChange={(event) => setAdminDisplayNameDraft(event.target.value)} placeholder="Ник" className="tg-input-darkfix tg-theme-field mb-2 w-full rounded-xl px-3 py-2 text-sm outline-none" />
                        <div className="tg-theme-field mb-2 flex items-center gap-2 rounded-xl px-3 py-2">
                          <AtSign size={15} className="text-slate-400" />
                          <input value={adminUsernameDraft} onChange={(event) => setAdminUsernameDraft(event.target.value)} placeholder="username" className="tg-input-darkfix min-w-0 flex-1 bg-transparent text-sm outline-none" autoCapitalize="none" />
                        </div>
                        <button onClick={() => void saveAdminUser()} disabled={adminBusy} className="w-full rounded-xl bg-[#229ed9] px-3 py-2 text-sm font-bold text-white disabled:opacity-60">{adminBusy ? "Сохраняю..." : "Сохранить профиль"}</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
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
            <button onClick={() => { setActiveTab("settings"); setSettingsPage("main"); setMobileListOpen(true); }} className={`flex flex-col items-center gap-1 rounded-2xl py-1 active:bg-slate-100 ${activeTab === "settings" ? "text-[#229ed9]" : ""}`}><Smartphone size={21} /> Settings</button>
          </div>
        </aside>

        <section className={`tg-chat-panel ${showChat ? "flex" : "hidden"} h-full min-w-0 flex-1 flex-col bg-[#e6edf5] lg:flex`}>
          <header className="tg-chat-header sticky top-0 z-30 flex min-h-[64px] shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.55rem)] backdrop-blur-xl sm:px-4 lg:min-h-[64px] lg:py-0">
            <button onClick={() => setMobileListOpen(true)} className="tg-icon-btn grid h-10 w-10 place-items-center rounded-full active:bg-slate-100 lg:hidden">
              <ArrowLeft size={21} />
            </button>
            <button type="button" onClick={() => activeChat?.type === "GROUP" ? setGroupInfoOpen(true) : openUserProfile(privateChatUser)} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left active:bg-slate-50">
              {activeChat?.avatarData ? <img src={activeChat.avatarData} alt="" className="h-11 w-11 rounded-full object-cover" /> : privateChatUser?.avatarData ? <img src={privateChatUser.avatarData} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#7bd0ff] via-[#229ed9] to-[#0969a8] text-sm font-bold text-white">{avatarLabel(activeChat?.title || privateChatUser?.displayName)}</div>}
              <span className="min-w-0 flex-1">
                <span className="tg-title block truncate text-[16px] font-semibold">{activeChat?.title || privateChatUser?.displayName || "Выберите чат"}</span>
                <span className="tg-accent block truncate text-[13px]">{chatSubtitle(activeChat, profileUser)}</span>
              </span>
            </button>
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
            <div key={activeChatId || "empty-chat"} className="tg-message-stack tg-chat-view mx-auto flex max-w-4xl flex-col gap-1.5">
              {messages.map((message, index) => {
                const mine = message.senderId === currentUser.id;
                const prev = messages[index - 1];
                const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(message.createdAt);
                const previousSameSender = !showDay && prev?.senderId === message.senderId;
                const swipe = swipeState?.id === message.id ? swipeState : null;
                const reactionSummary = summarizeReactions(message.reactions, currentUser.id);
                const showIncomingIdentity = !mine && activeChat?.type === "GROUP";
                return (
                  <div key={message.id} className="tg-message-row" style={{ animationDelay: `${Math.min(index * 16, 160)}ms` }}>
                    {showDay ? (
                      <div className="my-3 flex justify-center">
                        <span className="tg-day-chip tg-fade-chip rounded-full px-3 py-1 text-[12px] font-medium backdrop-blur">{dayLabel(message.createdAt)}</span>
                      </div>
                    ) : null}
                    <div className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                      {showIncomingIdentity ? (
                        <button type="button" onClick={() => openUserProfile(message.sender)} disabled={previousSameSender || !message.sender} className={`shrink-0 rounded-full ${previousSameSender ? "pointer-events-none" : "active:scale-95"}`}>
                          {message.sender?.avatarData ? <img src={message.sender.avatarData} alt="" className={`h-8 w-8 rounded-full object-cover ${previousSameSender ? "opacity-0" : ""}`} /> : <div className={`grid h-8 w-8 place-items-center rounded-full bg-[#229ed9] text-xs font-bold text-white ${previousSameSender ? "opacity-0" : ""}`}>{avatarLabel(message.sender?.displayName || message.sender?.username)}</div>}
                        </button>
                      ) : null}
                      <div className="tg-message-shell relative max-w-[78%] sm:max-w-[62%]">
                        <div className={`tg-swipe-reply-icon ${swipe?.ready ? "is-ready" : ""}`} aria-hidden="true">
                          <Reply size={17} />
                        </div>
                        {reactionBurst?.id === message.id ? <div className="tg-reaction-burst" aria-hidden="true">{reactionBurst.emoji}</div> : null}
                        <div
                          onPointerDown={(event) => startMessagePointer(event, message)}
                          onPointerMove={(event) => moveMessagePointer(event, message)}
                          onPointerUp={(event) => endMessagePointer(event, message)}
                          onPointerCancel={() => { clearMessageGesture(); setSwipeState(null); }}
                          onPointerLeave={() => { clearMessageGesture(); setSwipeState(null); }}
                          onContextMenu={(event) => { event.preventDefault(); setMessageMenu(message); }}
                          style={swipe ? { transform: `translateX(${swipe.dx}px)`, transition: "none" } : undefined}
                          className={`tg-bubble tg-bubble-animated max-w-full touch-pan-y text-[14px] ${mine ? "tg-bubble-mine" : "tg-bubble-theirs"} ${previousSameSender ? "tg-bubble-tight" : ""}`}
                        >
                          {showIncomingIdentity && !previousSameSender ? <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => openUserProfile(message.sender)} className="tg-bubble-author mb-1 block text-left text-[11px] font-semibold">{message.sender?.displayName || message.sender?.username || "Pirogram"}</button> : null}
                          {message.replyTo ? (
                            <div className="tg-reply-quote mb-1.5 rounded-xl px-2.5 py-1.5 text-xs">
                              <p className="truncate font-bold">{message.replyTo.sender?.displayName || message.replyTo.sender?.username || "Pirogram"}</p>
                              <p className="truncate opacity-80">{replyPreview(message.replyTo)}</p>
                            </div>
                          ) : null}
                          {message.mediaData && message.type === "IMAGE" ? <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setLightboxMedia({ data: message.mediaData || "", mime: message.mediaMime, name: message.mediaName, type: "IMAGE" })} className="mb-2 block overflow-hidden rounded-[14px] text-left"><img src={message.mediaData} alt={message.mediaName || "Фото"} className="tg-bubble-media max-h-80 w-full object-cover" /></button> : null}
                          {message.mediaData && message.type === "VIDEO" ? <video src={message.mediaData} controls playsInline className="tg-bubble-media mb-2 max-h-80 w-full" /> : null}
                          {message.mediaData && isAudioMime(message.mediaMime) ? <VoiceNote src={message.mediaData} name={message.mediaName} /> : null}
                          {message.text && !isAudioMime(message.mediaMime) ? <p className="whitespace-pre-wrap break-words leading-6">{message.text}</p> : null}
                          <div className="tg-bubble-meta ml-8 mt-1 flex items-center justify-end gap-1 text-[11px]">
                            <span>{timeLabel(message.createdAt)}</span>
                            {mine ? (message.readByOthers ? <CheckCheck size={15} strokeWidth={2.4} /> : <Check size={15} strokeWidth={2.4} />) : null}
                          </div>
                          {reactionSummary.length ? (
                            <div className="tg-reaction-row mt-1.5 flex flex-wrap gap-1">
                              {reactionSummary.map((reaction) => (
                                <button
                                  key={reaction.emoji}
                                  type="button"
                                  onClick={() => void toggleReaction(message, reaction.emoji)}
                                  className={`tg-reaction-pill ${reaction.reactedByMe ? "is-mine" : ""}`}
                                  aria-label={`Реакция ${reaction.emoji}`}
                                >
                                  <span>{reaction.emoji}</span>
                                  {reaction.count > 1 ? <span className="tg-reaction-count">{reaction.count}</span> : null}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {replyTo ? (
            <div className="tg-compose border-t border-slate-200 px-2 pt-2">
              <div className="tg-preview-card mx-auto flex max-w-4xl items-center gap-2 rounded-2xl p-2">
                <Reply size={18} className="shrink-0 text-[#229ed9]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">Ответ {replyTo.sender?.displayName ? `для ${replyTo.sender.displayName}` : "на сообщение"}</p>
                  <p className="tg-muted truncate text-xs">{replyPreview(replyTo)}</p>
                </div>
                <button type="button" onClick={() => setReplyTo(null)} className="grid h-9 w-9 place-items-center rounded-full bg-black/10 text-slate-500"><X size={17} /></button>
              </div>
            </div>
          ) : null}

          {mediaDraft ? (
            <div className="tg-compose border-t border-slate-200 px-2 pt-2">
              <div className="tg-preview-card mx-auto flex max-w-4xl items-center gap-2 rounded-2xl p-1.5">
                {mediaDraft.type === "IMAGE" ? <img src={mediaDraft.data} alt="preview" className="h-10 w-10 rounded-xl object-cover" /> : <video src={mediaDraft.data} className="h-10 w-10 rounded-xl object-cover" muted playsInline />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">{mediaDraft.name}</p>
                  <p className="tg-muted text-xs">Готово к отправке</p>
                </div>
                <button onClick={() => setMediaDraft(null)} className="grid h-9 w-9 place-items-center rounded-full bg-black/10 text-slate-500"><X size={17} /></button>
              </div>
            </div>
          ) : null}

          <form onSubmit={sendMessage} className="tg-compose tg-compose-compact border-t border-slate-200 px-2 py-1 pb-[max(4px,env(safe-area-inset-bottom))]">
            <div className="tg-compose-inner mx-auto flex max-w-4xl items-end gap-1.5">
              <input ref={fileRef} type="file" accept="image/*,video/*" onChange={onFileChange} className="hidden" />
              {recordingVoice ? (
                <>
                  <button type="button" onClick={cancelVoiceRecording} className="tg-compose-btn grid h-8 w-8 shrink-0 place-items-center rounded-full text-red-500 active:bg-red-500/10 tg-icon-btn" title="Отменить голосовое">
                    <X size={19} />
                  </button>
                  <div className="tg-voice-recording flex min-h-8 flex-1 items-center gap-2 rounded-[1rem] px-3 py-1.5 text-[14px] font-semibold">
                    <span className="tg-record-dot" />
                    <span>Запись {formatVoiceDuration(recordingSeconds)}</span>
                    <span className="ml-auto text-xs font-medium opacity-70">нажми отправить</span>
                  </div>
                  <button type="button" onClick={stopVoiceRecording} className="tg-send-btn grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#229ed9] text-white shadow-lg shadow-[#229ed9]/20" aria-label="Отправить голосовое">
                    <Send size={17} />
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => fileRef.current?.click()} className="tg-compose-btn grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 active:bg-slate-100 tg-icon-btn" title="Фото или видео">
                    <Paperclip size={20} />
                  </button>
                  <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Message" className="tg-input-darkfix tg-compose-textarea max-h-24 min-h-8 flex-1 resize-none rounded-[1rem] px-3 py-1.5 text-[14px] leading-5 outline-none focus:ring-2 focus:ring-[#229ed9]/20" rows={1} />
                  {text.trim() || mediaDraft ? (
                    <button disabled={sending || !activeChatId} className="tg-send-btn grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#229ed9] text-white shadow-lg shadow-[#229ed9]/20 disabled:bg-slate-300" aria-label="Отправить">
                      {sending ? <Loader2 className="animate-spin" size={19} /> : <Send size={17} />}
                    </button>
                  ) : (
                    <button type="button" disabled={sending || !activeChatId} onClick={() => void startVoiceRecording()} className="tg-send-btn grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#229ed9] text-white shadow-lg shadow-[#229ed9]/20 disabled:bg-slate-300" aria-label="Записать голосовое">
                      <Mic size={18} />
                    </button>
                  )}
                </>
              )}
            </div>
          </form>
        </section>
      </div>

      {groupInfoOpen && activeChat?.type === "GROUP" ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-md sm:items-center sm:p-5" onClick={() => setGroupInfoOpen(false)}>
          <div className="tg-group-info tg-card w-full max-w-md rounded-t-[2rem] p-4 shadow-2xl sm:rounded-[2rem]" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex items-center justify-between">
              <button onClick={() => setGroupInfoOpen(false)} className="rounded-full px-2 py-1 text-sm font-semibold text-[#229ed9]">Закрыть</button>
              <p className="tg-title text-sm font-bold">Информация</p>
              <span className="w-14" />
            </div>

            <div className="mt-3 text-center">
              <button type="button" onClick={() => groupAvatarRef.current?.click()} className="group relative mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#7bd0ff] via-[#229ed9] to-[#0969a8] text-3xl font-black text-white shadow-xl shadow-[#229ed9]/20">
                {activeChat.avatarData ? <img src={activeChat.avatarData} alt="" className="h-full w-full object-cover" /> : avatarLabel(activeChat.title)}
                <span className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition group-hover:opacity-100"><Camera size={24} /></span>
              </button>
              <input ref={groupAvatarRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void openAvatarEditor(file, "group"); }} />
              <p className="mt-3 text-xl font-black tracking-[-0.03em] text-slate-950">{activeChat.title}</p>
              <p className="text-sm text-slate-500">{activeChat.memberCount ?? activeChat.members.length} участников</p>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2 text-center text-[11px] font-semibold">
              <button onClick={() => void startCall("AUDIO")} className="tg-soft-button rounded-2xl p-3 active:scale-95"><Phone className="mx-auto mb-1" size={20} />Аудио</button>
              <button onClick={() => void startCall("VIDEO")} className="tg-soft-button rounded-2xl p-3 active:scale-95"><Video className="mx-auto mb-1" size={20} />Видео</button>
              <button onClick={() => void renameGroupChat()} className="tg-soft-button rounded-2xl p-3 active:scale-95"><Pencil className="mx-auto mb-1" size={20} />Название</button>
              <button onClick={() => profileAvatarRef.current && setInviteSearch("")} className="tg-soft-button rounded-2xl p-3 active:scale-95"><UserPlus className="mx-auto mb-1" size={20} />Добавить</button>
            </div>

            <div className="tg-soft-surface mt-4 rounded-2xl p-3">
              <label className="tg-theme-field flex h-10 items-center gap-2 rounded-xl px-3 text-sm">
                <Search size={16} />
                <input value={inviteSearch} onChange={(event) => setInviteSearch(event.target.value)} placeholder="Добавить по нику или @username" className="tg-input-darkfix min-w-0 flex-1 bg-transparent outline-none" autoCapitalize="none" />
              </label>
              {inviteResults.length ? (
                <div className="tg-theme-list mt-2 overflow-hidden rounded-xl">
                  {inviteResults.map((user) => (
                    <button key={user.id} type="button" onClick={() => void inviteUserToActiveGroup(user)} className="tg-theme-row flex w-full items-center gap-2 border-b px-2 py-2 text-left last:border-b-0">
                      {user.avatarData ? <img src={user.avatarData} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="grid h-9 w-9 place-items-center rounded-full bg-[#229ed9] text-xs font-bold text-white">{avatarLabel(user.displayName)}</div>}
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.displayName}</span><span className="block truncate text-xs text-[#229ed9]">@{user.username}</span></span>
                      <Plus size={16} className="text-[#229ed9]" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="tg-theme-list mt-4 max-h-56 overflow-y-auto rounded-2xl">
              {activeChat.members.map((member) => (
                <button key={member.id} type="button" onClick={() => openUserProfile(member)} className="tg-theme-row flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0">
                  {member.avatarData ? <img src={member.avatarData} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-[#229ed9] text-sm font-bold text-white">{avatarLabel(member.displayName)}</div>}
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-950">{member.displayName}</span><span className="block truncate text-xs text-[#229ed9]">@{member.username}</span></span>
                </button>
              ))}
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="tg-title text-sm font-bold">Медиа чата</p>
                <span className="tg-muted text-xs">{activeChatMedia.length}</span>
              </div>
              {activeChatMedia.length ? (
                <div className="grid max-h-44 grid-cols-3 gap-1 overflow-y-auto rounded-2xl">
                  {activeChatMedia.slice(-18).reverse().map((item) => (
                    <button key={item.id} type="button" onClick={() => setLightboxMedia({ data: item.mediaData || "", mime: item.mediaMime, name: item.mediaName, type: item.type === "VIDEO" ? "VIDEO" : "IMAGE" })} className="aspect-square overflow-hidden rounded-xl bg-black/10">
                      {item.type === "IMAGE" ? <img src={item.mediaData || ""} alt={item.mediaName || "Медиа"} className="h-full w-full object-cover" /> : <video src={item.mediaData || ""} className="h-full w-full object-cover" muted playsInline />}
                    </button>
                  ))}
                </div>
              ) : <p className="tg-muted rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs">Медиа пока нет</p>}
            </div>

            <button onClick={() => void leaveGroupChat()} className="tg-danger-button mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold active:scale-[0.98]"><LogOut size={18} />Выйти из группы</button>
          </div>
        </div>
      ) : null}

      {profileSheetUser ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-md sm:items-center sm:p-5" onClick={() => setProfileSheetUser(null)}>
          <div className="tg-profile-sheet tg-card w-full max-w-md rounded-t-[2rem] p-4 shadow-2xl sm:rounded-[2rem]" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex items-center justify-between">
              <button onClick={() => setProfileSheetUser(null)} className="rounded-full px-2 py-1 text-sm font-semibold text-[#229ed9]">Закрыть</button>
              <p className="tg-title text-sm font-bold">Профиль</p>
              <span className="w-14" />
            </div>
            <div className="mt-4 text-center">
              {profileSheetUser.avatarData ? <img src={profileSheetUser.avatarData} alt="" className="mx-auto h-28 w-28 rounded-full object-cover shadow-xl" /> : <div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-[#7bd0ff] via-[#229ed9] to-[#0969a8] text-4xl font-black text-white shadow-xl">{avatarLabel(profileSheetUser.displayName)}</div>}
              <p className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950">{profileSheetUser.displayName}</p>
              <p className="text-sm font-semibold text-[#229ed9]">@{profileSheetUser.username}</p>
              {profileSheetUser.createdAt ? <p className="tg-muted mt-1 text-xs">В Pirogram с {dayLabel(profileSheetUser.createdAt)}</p> : null}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 text-center text-[12px] font-semibold">
              <button onClick={() => { setProfileSheetUser(null); if (profileSheetUser.username) void startPrivateChat(profileSheetUser.username); }} className="tg-soft-button rounded-2xl p-3 active:scale-95"><Send className="mx-auto mb-1" size={19} />Сообщение</button>
              <button onClick={() => void startCall("AUDIO")} disabled={!activeChatId} className="tg-soft-button rounded-2xl p-3 active:scale-95 disabled:opacity-50"><Phone className="mx-auto mb-1" size={19} />Аудио</button>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="tg-title text-sm font-bold">Медиа в этом чате</p>
                <span className="tg-muted text-xs">{profileUserMedia.length}</span>
              </div>
              {profileUserMedia.length ? (
                <div className="grid max-h-56 grid-cols-3 gap-1 overflow-y-auto rounded-2xl">
                  {profileUserMedia.slice(-24).reverse().map((item) => (
                    <button key={item.id} type="button" onClick={() => setLightboxMedia({ data: item.mediaData || "", mime: item.mediaMime, name: item.mediaName, type: item.type === "VIDEO" ? "VIDEO" : "IMAGE" })} className="aspect-square overflow-hidden rounded-xl bg-black/10">
                      {item.type === "IMAGE" ? <img src={item.mediaData || ""} alt={item.mediaName || "Медиа"} className="h-full w-full object-cover" /> : <video src={item.mediaData || ""} className="h-full w-full object-cover" muted playsInline />}
                    </button>
                  ))}
                </div>
              ) : <p className="tg-muted rounded-2xl border border-dashed border-slate-200 px-3 py-5 text-center text-xs">В этом чате медиа пока нет</p>}
            </div>
          </div>
        </div>
      ) : null}

      {lightboxMedia ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 p-3" onClick={() => setLightboxMedia(null)}>
          <button type="button" onClick={() => setLightboxMedia(null)} className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur active:scale-95" aria-label="Закрыть">
            <X size={23} />
          </button>
          {lightboxMedia.type === "IMAGE" ? (
            <img src={lightboxMedia.data} alt={lightboxMedia.name || "Фото"} className="max-h-[92dvh] max-w-full rounded-2xl object-contain shadow-2xl" onClick={(event) => event.stopPropagation()} />
          ) : (
            <video src={lightboxMedia.data} controls autoPlay playsInline className="max-h-[92dvh] max-w-full rounded-2xl shadow-2xl" onClick={(event) => event.stopPropagation()} />
          )}
        </div>
      ) : null}

      {avatarEditor ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-md" onClick={() => setAvatarEditor(null)}>
          <div className="tg-modal w-full max-w-sm rounded-[2rem] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <button onClick={() => setAvatarEditor(null)} className="text-sm font-semibold text-slate-500">Отмена</button>
              <p className="tg-title text-sm font-bold">Обрезать фото</p>
              <button onClick={() => void saveAvatarEditor()} className="text-sm font-bold text-[#229ed9]">Готово</button>
            </div>
            <div className="mx-auto grid h-64 w-64 place-items-center overflow-hidden rounded-full bg-slate-100 shadow-inner">
              <img
                src={avatarEditor.source}
                alt="avatar preview"
                className="max-h-none max-w-none select-none"
                draggable={false}
                style={{ transform: `translate(${avatarEditor.offsetX}px, ${avatarEditor.offsetY}px) scale(${avatarEditor.zoom})`, width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-500">Масштаб
                <input type="range" min="1" max="2.4" step="0.02" value={avatarEditor.zoom} onChange={(event) => setAvatarEditor((current) => current ? { ...current, zoom: Number(event.target.value) } : current)} className="mt-2 w-full" />
              </label>
              <label className="block text-xs font-semibold text-slate-500">Сдвиг по горизонтали
                <input type="range" min="-130" max="130" step="1" value={avatarEditor.offsetX} onChange={(event) => setAvatarEditor((current) => current ? { ...current, offsetX: Number(event.target.value) } : current)} className="mt-2 w-full" />
              </label>
              <label className="block text-xs font-semibold text-slate-500">Сдвиг по вертикали
                <input type="range" min="-130" max="130" step="1" value={avatarEditor.offsetY} onChange={(event) => setAvatarEditor((current) => current ? { ...current, offsetY: Number(event.target.value) } : current)} className="mt-2 w-full" />
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {messageMenu ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-5 backdrop-blur-md" onClick={() => setMessageMenu(null)}>
          <div className="tg-message-menu w-full max-w-[330px]" onClick={(event) => event.stopPropagation()}>
            <div className="tg-reaction-menu mx-auto mb-3 flex w-fit items-center gap-2 rounded-full px-2.5 py-2 shadow-2xl">
              {REACTION_EMOJIS.map((emoji) => {
                const reacted = messageMenu.reactions?.some((reaction) => reaction.userId === currentUser.id && reaction.emoji === emoji);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => { void toggleReaction(messageMenu, emoji); setMessageMenu(null); }}
                    className={`tg-reaction-choice ${reacted ? "is-selected" : ""}`}
                    aria-label={`Поставить ${emoji}`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>

            <div className="tg-modal rounded-[1.7rem] p-2.5 shadow-2xl">
              <div className="px-3 pb-2 pt-2 text-center">
                <p className="tg-title text-sm font-bold">Сообщение</p>
                <p className="tg-muted mx-auto mt-1 line-clamp-2 max-w-[240px] text-xs">{replyPreview(messageMenu)}</p>
              </div>
              <div className="grid gap-1">
                <button onClick={() => { setReplyTo(messageMenu); setMessageMenu(null); }} className="tg-menu-action">
                  <Reply size={18} className="text-[#229ed9]" /> Ответить
                </button>
                <button onClick={() => void deleteMessage("me")} className="tg-menu-action text-red-500">
                  <Trash2 size={18} /> Удалить у себя
                </button>
                {messageMenu.senderId === currentUser.id ? (
                  <button onClick={() => void deleteMessage("everyone")} className="tg-menu-action text-red-600">
                    <Trash2 size={18} /> Удалить у всех
                  </button>
                ) : null}
              </div>
              <button onClick={() => setMessageMenu(null)} className="mt-2 w-full rounded-2xl bg-slate-100 px-3 py-3 text-sm font-bold text-slate-600 active:scale-[0.98]">Закрыть</button>
            </div>
          </div>
        </div>
      ) : null}

      {isIncomingRinging && activeCall ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-5 backdrop-blur-md">
          <div className="pointer-events-auto w-full max-w-sm rounded-[2rem] bg-[#111827] p-6 text-center text-white shadow-2xl">
            <div className="mx-auto mb-5 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-[#7bd0ff] via-[#229ed9] to-[#0969a8] text-4xl font-bold shadow-xl shadow-[#229ed9]/25">
              {avatarLabel(activeCall.caller.displayName)}
            </div>
            <p className="text-2xl font-bold tracking-[-0.03em]">{activeCall.caller.displayName}</p>
            <p className="mt-1 text-sm text-white/65">@{activeCall.caller.username}</p>
            <p className="mt-4 text-base font-medium text-white/85">{activeCall.kind === "VIDEO" ? "Входящий видеозвонок" : "Входящий аудиозвонок"}</p>
            <p className="mt-2 text-xs leading-5 text-white/50">Сначала выбери: принять или отклонить. После принятия браузер попросит микрофон/камеру и обычно запомнит разрешение для Pirogram.</p>
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
                    <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#7bd0ff] to-[#229ed9] text-2xl font-bold text-white">{avatarLabel(profileUser.displayName)}</div>
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
