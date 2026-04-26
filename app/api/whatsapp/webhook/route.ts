import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdapter } from "@/lib/whatsapp/adapter";
import { handleIncomingMessage } from "@/lib/whatsapp/handlers";

// Schéma minimal du payload normalisé
const WebhookPayloadSchema = z.object({
  from: z.string().min(1),
  text: z.string().default(""),
  mediaUrl: z.string().url().optional(),
  mediaType: z.string().optional(),
  timestamp: z.string().optional(),
  providerId: z.string().optional(),
});

// Vérification de signature (HMAC-SHA256) si WHATSAPP_WEBHOOK_SECRET est défini
async function verifySignature(req: NextRequest, body: string): Promise<boolean> {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) return true; // Pas de secret configuré → skip en dev

  const signature = req.headers.get("x-webhook-signature") ?? "";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
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

  // Comparaison en temps constant
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

  const valid = await verifySignature(req, body);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = WebhookPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 422 }
    );
  }

  const adapter = createAdapter();

  try {
    const msg = adapter.parseIncoming(parsed.data);
    // Traitement async sans bloquer la réponse HTTP (WhatsApp attend < 5s)
    handleIncomingMessage(msg, adapter).catch((err) =>
      console.error("[webhook] handleIncomingMessage error:", err)
    );
  } catch (err) {
    console.error("[webhook] parseIncoming error:", err);
    return NextResponse.json({ error: "Parse error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Vérification webhook (GET) pour certains providers (Meta, etc.)
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
