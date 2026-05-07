export function cleanIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeLogin(value: string) {
  return cleanIdentifier(value).replace(/^@+/, "");
}

export function normalizeUsername(value: string) {
  return cleanIdentifier(value).replace(/^@+/, "");
}

function validateSlug(value: string, label: string) {
  if (value.length < 3 || value.length > 20) {
    return `${label} должен быть от 3 до 20 символов.`;
  }
  if (!/^[a-z0-9_]+$/.test(value)) {
    return `${label} может содержать только латинские буквы, цифры и подчёркивание.`;
  }
  if (value.startsWith("_") || value.endsWith("_")) {
    return `${label} не должен начинаться или заканчиваться подчёркиванием.`;
  }
  if (value.includes("__")) {
    return `Не используйте два подчёркивания подряд.`;
  }
  return null;
}

export function validateLogin(value: string) {
  return validateSlug(normalizeLogin(value), "Логин");
}

export function validateUsername(value: string) {
  return validateSlug(normalizeUsername(value), "Юзернейм");
}
