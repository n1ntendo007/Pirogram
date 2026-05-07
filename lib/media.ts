const MAX_MEDIA_BYTES = 3.5 * 1024 * 1024;
const allowedImage = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const allowedVideo = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export function detectMessageType(mime?: string) {
  if (!mime) return "FILE" as const;
  if (allowedImage.has(mime)) return "IMAGE" as const;
  if (allowedVideo.has(mime)) return "VIDEO" as const;
  return "FILE" as const;
}

export function validateMediaData(mediaData?: string | null, mediaMime?: string | null) {
  if (!mediaData) return null;
  if (!mediaMime) return "У файла нет MIME-типа.";
  if (!mediaData.startsWith(`data:${mediaMime};base64,`)) return "Некорректный формат файла.";
  const base64 = mediaData.split(",", 2)[1] || "";
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_MEDIA_BYTES) return "Файл слишком большой. Максимум 3.5 МБ без отдельного хранилища.";
  if (!allowedImage.has(mediaMime) && !allowedVideo.has(mediaMime)) {
    return "Можно отправлять только изображения и видео: jpg, png, webp, gif, mp4, webm, mov.";
  }
  return null;
}
