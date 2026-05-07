import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export function validatePasswordStrength(password: string) {
  if (password.length < 8) return "Пароль должен быть минимум 8 символов.";
  if (password.length > 128) return "Пароль слишком длинный.";
  if (!/[A-Za-zА-Яа-я]/.test(password) || !/\d/.test(password)) {
    return "Добавьте в пароль хотя бы одну букву и одну цифру.";
  }
  return null;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
