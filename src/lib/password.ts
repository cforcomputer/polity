import crypto from "node:crypto";

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(pw, salt, 32).toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(pw, salt, 32);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}
