export interface IncomingMessage {
  from: string;       // numéro E.164
  text: string;
  mediaUrl?: string;
  mediaType?: string;
  timestamp: Date;
  providerId: string;
}

export interface OutgoingMessage {
  to: string;
  text: string;
}

export interface WhatsAppAdapter {
  parseIncoming(rawPayload: unknown): IncomingMessage;
  sendMessage(msg: OutgoingMessage): Promise<void>;
}

// ── MockAdapter ──────────────────────────────────────────────
// Log dans la console — aucun WhatsApp requis pour tester
export class MockAdapter implements WhatsAppAdapter {
  private static messageLog: Array<{ direction: "in" | "out"; msg: IncomingMessage | OutgoingMessage }> = [];

  parseIncoming(rawPayload: unknown): IncomingMessage {
    const p = rawPayload as Record<string, unknown>;
    const msg: IncomingMessage = {
      from: String(p.from ?? ""),
      text: String(p.text ?? ""),
      mediaUrl: p.mediaUrl ? String(p.mediaUrl) : undefined,
      mediaType: p.mediaType ? String(p.mediaType) : undefined,
      timestamp: p.timestamp ? new Date(String(p.timestamp)) : new Date(),
      providerId: String(p.providerId ?? `mock-${Date.now()}`),
    };
    MockAdapter.messageLog.push({ direction: "in", msg });
    console.log("[MockAdapter] ← INCOMING", JSON.stringify(msg, null, 2));
    return msg;
  }

  async sendMessage(msg: OutgoingMessage): Promise<void> {
    MockAdapter.messageLog.push({ direction: "out", msg });
    console.log(`[MockAdapter] → OUTGOING to ${msg.to}:\n  "${msg.text}"`);
  }

  static getLog() {
    return MockAdapter.messageLog;
  }

  static clearLog() {
    MockAdapter.messageLog = [];
  }
}

// ── TwoChatAdapter ───────────────────────────────────────────
export class TwoChatAdapter implements WhatsAppAdapter {
  private apiKey: string;
  private apiUrl: string;

  constructor(apiKey: string, apiUrl = "https://api.2chat.io/v1") {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }

  parseIncoming(rawPayload: unknown): IncomingMessage {
    // TODO: implémenter selon la doc 2Chat
    const p = rawPayload as Record<string, unknown>;
    return {
      from: String(p.from ?? ""),
      text: String((p as Record<string, unknown>)?.message ?? ""),
      timestamp: new Date(),
      providerId: String(p.id ?? ""),
    };
  }

  async sendMessage(msg: OutgoingMessage): Promise<void> {
    // TODO: implémenter l'appel HTTP 2Chat
    await fetch(`${this.apiUrl}/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ to: msg.to, message: msg.text }),
    });
  }
}

// ── TwilioAdapter ────────────────────────────────────────────
export class TwilioAdapter implements WhatsAppAdapter {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
  }

  parseIncoming(rawPayload: unknown): IncomingMessage {
    // TODO: implémenter selon le format Twilio webhook
    const p = rawPayload as Record<string, string>;
    return {
      from: p.From ?? "",
      text: p.Body ?? "",
      mediaUrl: p.MediaUrl0,
      mediaType: p.MediaContentType0,
      timestamp: new Date(),
      providerId: p.MessageSid ?? "",
    };
  }

  async sendMessage(msg: OutgoingMessage): Promise<void> {
    // TODO: implémenter via Twilio REST API
    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          From: `whatsapp:${this.fromNumber}`,
          To: `whatsapp:${msg.to}`,
          Body: msg.text,
        }),
      }
    );
  }
}

// ── WhatsAppCloudAdapter ─────────────────────────────────────
export class WhatsAppCloudAdapter implements WhatsAppAdapter {
  private accessToken: string;
  private phoneNumberId: string;

  constructor(accessToken: string, phoneNumberId: string) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
  }

  parseIncoming(rawPayload: unknown): IncomingMessage {
    const p = rawPayload as Record<string, unknown>;
    const entry = (p.entry as Record<string, unknown>[])?.[0];
    const change = (entry?.changes as Record<string, unknown>[])?.[0];
    const value = change?.value as Record<string, unknown>;
    const messages = value?.messages as Record<string, unknown>[];
    const message = messages?.[0] as Record<string, unknown>;

    if (!message) throw new Error("No message in payload");

    const type = String(message.type ?? "text");
    let text = "";
    let mediaUrl: string | undefined;
    let mediaType: string | undefined;

    if (type === "text") {
      text = String((message.text as Record<string, unknown>)?.body ?? "");
    } else if (type === "image" || type === "audio" || type === "video" || type === "document") {
      const media = message[type] as Record<string, unknown>;
      mediaType = String(media?.mime_type ?? `${type}/jpeg`);
      // L'URL réelle nécessite un appel Media API — on stocke l'ID pour résolution ultérieure
      mediaUrl = `https://graph.facebook.com/v18.0/${media?.id}`;
      text = "";
    }

    return {
      from: `+${String(message.from ?? "")}`,
      text,
      mediaUrl,
      mediaType,
      timestamp: new Date(Number(message.timestamp ?? 0) * 1000),
      providerId: String(message.id ?? ""),
    };
  }

  async sendMessage(msg: OutgoingMessage): Promise<void> {
    const resp = await fetch(
      `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: msg.to,
          type: "text",
          text: { body: msg.text },
        }),
      }
    );
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Meta API error ${resp.status}: ${err}`);
    }
  }
}

// ── Factory ──────────────────────────────────────────────────
export function createAdapter(): WhatsAppAdapter {
  const provider = process.env.WHATSAPP_PROVIDER ?? "mock";

  switch (provider) {
    case "twochat":
      return new TwoChatAdapter(process.env.TWOCHAT_API_KEY ?? "");
    case "twilio":
      return new TwilioAdapter(
        process.env.TWILIO_ACCOUNT_SID ?? "",
        process.env.TWILIO_AUTH_TOKEN ?? "",
        process.env.TWILIO_FROM_NUMBER ?? ""
      );
    case "whatsapp_cloud":
      return new WhatsAppCloudAdapter(
        process.env.META_ACCESS_TOKEN ?? "",
        process.env.META_PHONE_NUMBER_ID ?? ""
      );
    default:
      return new MockAdapter();
  }
}
