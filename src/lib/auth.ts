import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import type { User } from "./types";

const COOKIE = "unigov_session";
const SECRET = process.env.SESSION_SECRET ?? "polity-dev-secret-change-me";

function sign(userId: string): string {
  const mac = crypto.createHmac("sha256", SECRET).update(userId).digest("base64url");
  return `${userId}.${mac}`;
}

function unsign(token: string): string | null {
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const userId = token.slice(0, i);
  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given) ? userId : null;
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const id = unsign(token);
  return id ? (db().users.find((u) => u.id === id) ?? null) : null;
}

export async function startSession(userId: string): Promise<void> {
  (await cookies()).set(COOKIE, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export function publicUser(u: User | null) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, city: u.city, role: u.role, verified: u.verified, idDoc: u.idDoc ?? null };
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function fail(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}
