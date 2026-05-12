import { PrismaClient } from "@prisma/client";
import { createCipheriv, createHash, randomBytes } from "crypto";

const ENCRYPTION_PREFIX = "enc:v1:";
const prisma = new PrismaClient();
let cachedKey = null;

function getEncryptionKey() {
  if (cachedKey) return cachedKey;

  const secret = process.env.MESSAGE_ENCRYPTION_KEY?.trim();
  if (!secret) throw new Error("MESSAGE_ENCRYPTION_KEY is required.");

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

function encrypt(value) {
  if (!value || value.startsWith(ENCRYPTION_PREFIX)) return value ?? null;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

async function main() {
  let cursor = undefined;
  let changed = 0;

  while (true) {
    const messages = await prisma.message.findMany({
      take: 100,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, text: true, mediaData: true, mediaName: true }
    });

    if (!messages.length) break;

    for (const message of messages) {
      const nextText = encrypt(message.text);
      const nextMediaData = encrypt(message.mediaData);
      const nextMediaName = encrypt(message.mediaName);

      if (nextText !== message.text || nextMediaData !== message.mediaData || nextMediaName !== message.mediaName) {
        await prisma.message.update({
          where: { id: message.id },
          data: { text: nextText, mediaData: nextMediaData, mediaName: nextMediaName }
        });
        changed += 1;
      }
    }

    cursor = messages.at(-1).id;
  }

  console.log(`Encrypted existing messages: ${changed}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
