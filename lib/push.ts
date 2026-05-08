import webpush from "web-push";
import { db } from "@/lib/db";

let configured = false;

function configureWebPush() {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || "";
}

export async function notifyChatMembers(chatId: string, senderId: string, payload: { title: string; body: string; url?: string }) {
  if (!configureWebPush()) return;

  // Pirogram считает пользователя онлайн, если приложение недавно отправляло heartbeat.
  // Тогда push не нужен: человек и так видит чат/звонок внутри приложения.
  const offlineCutoff = new Date(Date.now() - 45_000);
  const members = await db.chatMember.findMany({
    where: {
      chatId,
      userId: { not: senderId },
      user: { updatedAt: { lt: offlineCutoff } }
    },
    select: { userId: true }
  });
  if (!members.length) return;

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId: { in: members.map((member) => member.userId) } }
  });

  await Promise.allSettled(
    subscriptions.map((subscription) =>
      webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth }
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url || "/chat",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png"
        })
      )
    )
  );
}
