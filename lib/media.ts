const MAX_MEDIA_BYTES = 3.5 * 1024 * 1024;
const allowedImage = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const allowedVideo = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const allowedAudio = new Set(["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav"]);

export function detectMessageType(mime?: string) {
  if (!mime) return "FILE" as const;
  const cleanMime = mime.split(";", 1)[0].toLowerCase();
  if (allowedImage.has(cleanMime)) return "IMAGE" as const;
  if (allowedVideo.has(cleanMime)) return "VIDEO" as const;
  return "FILE" as const;
}

export function validateMediaData(mediaData?: string | null, mediaMime?: string | null) {
  if (!mediaData) return null;
  if (!mediaMime) return "У файла нет MIME-типа.";
  if (!mediaData.startsWith(`data:${mediaMime};base64,`)) return "Некорректный формат файла.";
  const base64 = mediaData.split(",", 2)[1] || "";
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_MEDIA_BYTES) return "Файл слишком большой. Максимум 3.5 МБ без отдельного хранилища.";
  const cleanMime = mediaMime.split(";", 1)[0].toLowerCase();
  if (!allowedImage.has(cleanMime) && !allowedVideo.has(cleanMime) && !allowedAudio.has(cleanMime)) {
    return "Можно отправлять фото, видео и голосовые: jpg, png, webp, gif, mp4, webm, mov, audio.";
  }
  return null;
}
