import { fail, json, publicUser, startSession } from "@/lib/auth";
import { db, newId, save } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export async function POST(req: Request) {
  const b = (await req.json()) as { name?: string; email?: string; password?: string; dob?: string; city?: string };
  const name = b.name?.trim() ?? "";
  const email = b.email?.trim().toLowerCase() ?? "";
  if (name.split(/\s+/).length < 2) return fail("Enter your full legal name (first and last).");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Enter a valid email address.");
  if ((b.password ?? "").length < 8) return fail("Password must be at least 8 characters.");
  if (!b.dob || Number.isNaN(Date.parse(b.dob))) return fail("Enter your date of birth.");
  const age = (Date.now() - Date.parse(b.dob)) / (365.25 * 86_400_000);
  if (age < 13) return fail("You must be at least 13 to create a UniGov account.");
  if (!b.city?.trim()) return fail("Choose your city of residence.");
  const store = db();
  if (store.users.some((u) => u.email === email)) return fail("An account with this email already exists.", 409);
  const user = {
    id: newId("u"),
    name,
    email,
    passwordHash: hashPassword(b.password!),
    dob: b.dob,
    city: b.city.trim(),
    role: "citizen" as const,
    verified: false,
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  save();
  await startSession(user.id);
  return json({ user: publicUser(user) });
}
