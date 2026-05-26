import { NextRequest, NextResponse } from "next/server";
import { createAdapter } from "@/lib/whatsapp/adapter";
import { handleIncomingMessage } from "@/lib/whatsapp/handlers";

export async function POST(req: NextRequest) {
  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const adapter = createAdapter();

  let msg;
  try {
    msg = adapter.parseIncoming(rawPayload);
  } catch {
    // Payload non pertinent (status update, événement ignoré) — on acquitte sans traiter
    return NextResponse.json({ ok: true });
  }

  handleIncomingMessage(msg, adapter).catch((err) =>
    console.error("[webhook] handleIncomingMessage error:", err)
  );

  return NextResponse.json({ ok: true });
}

// Vérification webhook GET — utilisé par Meta (hub.challenge) et ignoré par les autres providers
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
