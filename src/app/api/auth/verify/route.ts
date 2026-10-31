import { currentUser, fail, json, publicUser } from "@/lib/auth";
import { save } from "@/lib/db";
import { describeError, readIdDocument } from "@/lib/ai";

const MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type Media = (typeof MEDIA)[number];

function tokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length > 1);
}

/** Registered first and last name must both appear on the document (middle names may differ). */
function namesMatch(registered: string, onId: string): boolean {
  const reg = tokens(registered);
  const id = new Set(tokens(onId));
  return reg.length >= 2 && id.has(reg[0]) && id.has(reg.at(-1)!);
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return fail("Sign in first.", 401);
  const b = (await req.json()) as { image?: string; mediaType?: string; sample?: boolean };

  if (b.sample) {
    user.verified = true;
    user.idDoc = {
      type: "California Driver License (sample)",
      nameOnId: user.name.toUpperCase(),
      expiry: "2030-01-01",
      method: "sample",
      verifiedAt: new Date().toISOString(),
    };
    save();
    return json({ user: publicUser(user), result: { ok: true, reasons: [] } });
  }

  if (!b.image || !MEDIA.includes(b.mediaType as Media)) return fail("Upload a JPG, PNG, WEBP or GIF photo of your ID.");
  if (b.image.length > 7_000_000) return fail("Image is too large; use a photo under 5 MB.");

  let doc;
  try {
    doc = await readIdDocument(b.image, b.mediaType as Media);
  } catch (e) {
    return fail(`We couldn't read the document right now (${describeError(e)}). Try again or use the sample ID.`, 502);
  }

  const reasons: string[] = [];
  if (!doc.is_identity_document) reasons.push("This doesn't look like a government-issued photo ID.");
  if (doc.is_identity_document && !namesMatch(user.name, doc.full_name))
    reasons.push(`The name on the ID (“${doc.full_name || "unreadable"}”) doesn't match your registration (“${user.name}”).`);
  if (doc.expiry_date && Date.parse(doc.expiry_date) < Date.now()) reasons.push(`The document expired on ${doc.expiry_date}.`);
  if (doc.issues) reasons.push(`Reviewer note: ${doc.issues}`);

  const ok = doc.is_identity_document && namesMatch(user.name, doc.full_name) && !(doc.expiry_date && Date.parse(doc.expiry_date) < Date.now());
  if (ok) {
    user.verified = true;
    // Keep only the extracted fields; the image itself is never stored.
    user.idDoc = { type: doc.document_type, nameOnId: doc.full_name, expiry: doc.expiry_date, method: "ai", verifiedAt: new Date().toISOString() };
    save();
  }
  return json({ user: publicUser(user), result: { ok, reasons, extracted: { type: doc.document_type, name: doc.full_name, expiry: doc.expiry_date, issuer: doc.issuer } } });
}
