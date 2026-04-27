import { NextRequest, NextResponse } from "next/server";
import { createAdapter } from "@/lib/whatsapp/adapter";
import { handleIncomingMessage } from "@/lib/whatsapp/handlers";

// Vérification de signature HMAC-SHA256 avec META_APP_SECRET
// Meta signe le payload avec l'App Secret (pas le verify token)
async function verifyMetaSignature(req: NextRequest, body: string): Promise<boolean> {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return true; // skip si non configuré

  const signature = req.headers.get("x-hub-signature-256") ?? "";
  if (!signature) return true;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected =
    "sha256=" +
    Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(req: NextRequest) {
  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const valid = await verifyMetaSignature(req, body);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Meta envoie des notifications de statut (delivered, read) — on les ignore
  const p = rawPayload as Record<string, unknown>;
  const firstEntry = (p.entry as Record<string, unknown>[])?.[0];
  const firstChange = (firstEntry?.changes as Record<string, unknown>[])?.[0];
  const value = firstChange?.value as Record<string, unknown>;
  if (value && !value.messages) {
    return NextResponse.json({ ok: true }); // statut update, rien à faire
  }

  const adapter = createAdapter();

  try {
    const msg = adapter.parseIncoming(rawPayload);
    handleIncomingMessage(msg, adapter).catch((err) =>
      console.error("[webhook] handleIncomingMessage error:", err)
    );
  } catch (err) {
    console.error("[webhook] parseIncoming error:", err);
    // On retourne 200 quand même pour que Meta ne réessaie pas en boucle
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

// Vérification webhook GET — Meta envoie hub.mode, hub.verify_token, hub.challenge
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_SECRET) {
    return new NextResponse(challenge ?? "ok");
  }

  return NextResponse.json({ ok: true });
}
