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
  private phoneNumber: string;
  private apiUrl: string;

  constructor(apiKey: string, phoneNumber: string, apiUrl = "https://api.2chat.io/v1") {
    this.apiKey = apiKey;
    this.phoneNumber = phoneNumber;
    this.apiUrl = apiUrl;
  }

  parseIncoming(rawPayload: unknown): IncomingMessage {
    const p = rawPayload as Record<string, unknown>;
    // 2Chat envoie { event: "message:received", data: { from, body, id, timestamp, media_url, mime_type } }
    if (p.event !== "message:received") throw new Error("Not an incoming message event");
    const data = p.data as Record<string, unknown>;
    return {
      from: String(data?.from ?? ""),
      text: String(data?.body ?? ""),
      mediaUrl: data?.media_url ? String(data.media_url) : undefined,
      mediaType: data?.mime_type ? String(data.mime_type) : undefined,
      timestamp: data?.timestamp ? new Date(Number(data.timestamp) * 1000) : new Date(),
      providerId: String(data?.id ?? ""),
    };
  }

  async sendMessage(msg: OutgoingMessage): Promise<void> {
    const resp = await fetch(`${this.apiUrl}/messages/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "user-api-key": this.apiKey,
      },
      body: JSON.stringify({
        phone_number: msg.to,
        message: msg.text,
        channel_number: this.phoneNumber,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`2Chat API error ${resp.status}: ${err}`);
    }
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

// ── GreenAPIAdapter ──────────────────────────────────────────
export class GreenAPIAdapter implements WhatsAppAdapter {
  private idInstance: string;
  private apiToken: string;
  private apiUrl: string;

  constructor(idInstance: string, apiToken: string) {
    this.idInstance = idInstance;
    this.apiToken = apiToken;
    this.apiUrl = `https://api.green-api.com/waInstance${idInstance}`;
  }

  parseIncoming(rawPayload: unknown): IncomingMessage {
    const p = rawPayload as Record<string, unknown>;
    // Green API envoie plusieurs typeWebhook — on ne traite que les messages entrants
    if (p.typeWebhook !== "incomingMessageReceived") throw new Error("Not an incoming message");

    const senderData = p.senderData as Record<string, unknown>;
    const messageData = p.messageData as Record<string, unknown>;
    const typeMessage = String(messageData?.typeMessage ?? "");

    // Green API format: "79001234567@c.us" → E.164: "+79001234567"
    const rawSender = String(senderData?.sender ?? "");
    const from = "+" + rawSender.replace("@c.us", "");

    let text = "";
    let mediaUrl: string | undefined;
    let mediaType: string | undefined;

    if (typeMessage === "textMessage") {
      const textData = messageData.textMessageData as Record<string, unknown>;
      text = String(textData?.textMessage ?? "");
    } else if (["imageMessage", "videoMessage", "audioMessage", "documentMessage"].includes(typeMessage)) {
      const fileData = messageData.fileMessageData as Record<string, unknown>;
      mediaUrl = String(fileData?.downloadUrl ?? "");
      mediaType = String(fileData?.mimeType ?? "");
      text = String(fileData?.caption ?? "");
    }

    return {
      from,
      text,
      mediaUrl,
      mediaType,
      timestamp: p.timestamp ? new Date(Number(p.timestamp) * 1000) : new Date(),
      providerId: String(p.idMessage ?? ""),
    };
  }

  async sendMessage(msg: OutgoingMessage): Promise<void> {
    // E.164 "+79001234567" → Green API format "79001234567@c.us"
    const chatId = msg.to.replace("+", "") + "@c.us";

    const resp = await fetch(`${this.apiUrl}/sendMessage/${this.apiToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message: msg.text }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Green API error ${resp.status}: ${err}`);
    }
  }
}

// ── Factory ──────────────────────────────────────────────────
export function createAdapter(): WhatsAppAdapter {
  const provider = process.env.WHATSAPP_PROVIDER ?? "mock";

  switch (provider) {
    case "greenapi":
      return new GreenAPIAdapter(
        process.env.GREENAPI_ID_INSTANCE ?? "",
        process.env.GREENAPI_API_TOKEN ?? ""
      );
    case "twochat":
      return new TwoChatAdapter(
        process.env.TWOCHAT_API_KEY ?? "",
        process.env.TWOCHAT_PHONE_NUMBER ?? ""
      );
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
