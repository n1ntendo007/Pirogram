import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENCRYPTION_PREFIX = "enc:v1:";
const FAILED_DECRYPT_TEXT = "[сообщение не удалось расшифровать]";

let cachedKey: Buffer | null = null;

function getEncryptionKey() {
  if (cachedKey) return cachedKey;

  const secret = process.env.MESSAGE_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new Error("MESSAGE_ENCRYPTION_KEY is required to encrypt messages.");
  }

  if (/^[a-f0-9]{64}$/i.test(secret)) {
    cachedKey = Buffer.from(secret, "hex");
    return cachedKey;
  }

  const base64Key = Buffer.from(secret, "base64");
  if (base64Key.length === 32) {
    cachedKey = base64Key;
    return cachedKey;
  }

  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("MESSAGE_ENCRYPTION_KEY must be at least 32 characters, or a 32-byte base64/hex key.");
  }

  cachedKey = createHash("sha256").update(secret, "utf8").digest();
  return cachedKey;
}

export function isEncryptedMessageField(value: string | null | undefined) {
  return Boolean(value?.startsWith(ENCRYPTION_PREFIX));
}

export function encryptMessageField(value: string | null | undefined) {
  if (!value) return null;
  if (isEncryptedMessageField(value)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptMessageField(value: string | null | undefined, fallback: string | null = null) {
  if (!value) return null;
  if (!isEncryptedMessageField(value)) return value;

  try {
    const payload = value.slice(ENCRYPTION_PREFIX.length);
    const [ivRaw, tagRaw, encryptedRaw] = payload.split(".");
    if (!ivRaw || !tagRaw || !encryptedRaw) return fallback;

    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return fallback;
  }
}

type MessageLike = {
  text?: string | null;
  mediaData?: string | null;
  mediaName?: string | null;
  replyTo?: MessageLike | null;
};

export function decryptMessage<T extends MessageLike>(message: T): T {
  return {
    ...message,
    ...("text" in message ? { text: decryptMessageField(message.text, FAILED_DECRYPT_TEXT) } : {}),
    ...("mediaData" in message ? { mediaData: decryptMessageField(message.mediaData) } : {}),
    ...("mediaName" in message ? { mediaName: decryptMessageField(message.mediaName) } : {}),
    ...("replyTo" in message ? { replyTo: message.replyTo ? decryptMessage(message.replyTo) : null } : {})
  };
}

export function decryptMessages<T extends MessageLike>(messages: T[]): T[] {
  return messages.map(decryptMessage);
}
