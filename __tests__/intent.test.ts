/**
 * Tests unitaires sur le parsing d'intention.
 * Ces tests mockent l'API Anthropic pour fonctionner sans clé.
 */

import { jest } from "@jest/globals";

// Mock de l'SDK Anthropic avant tout import
jest.mock("@anthropic-ai/sdk", () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    })),
  };
});

import Anthropic from "@anthropic-ai/sdk";
import { parseIntent } from "@/lib/claude/intent";

function mockAnthropicResponse(jsonContent: string) {
  const instance = new (Anthropic as jest.MockedClass<typeof Anthropic>)();
  (instance.messages.create as jest.MockedFunction<typeof instance.messages.create>).mockResolvedValue({
    id: "msg_test",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: jsonContent }],
    model: "claude-haiku-4-5-20251001",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 50 },
  } as Awaited<ReturnType<typeof instance.messages.create>>);
}

describe("parseIntent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Réinitialiser le mock pour chaque test
    const MockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;
    MockedAnthropic.mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    }) as unknown as InstanceType<typeof Anthropic>);
  });

  it("detecte une mise à jour d'horaire de Chabbat soir", async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      id: "msg_1",
      type: "message",
      role: "assistant",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            intent: "update_schedule",
            confidence: 0.97,
            params: { service_type: "shabbat_evening", time: "19:30", day_of_week: 5 },
            needs_confirmation: true,
            human_summary: "Office du Chabbat soir à 19h30 le vendredi",
          }),
        },
      ],
      model: "claude-haiku-4-5-20251001",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 50 },
    });

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(
      () => ({ messages: { create: mockCreate } }) as unknown as InstanceType<typeof Anthropic>
    );

    const result = await parseIntent("Office du Chabbat soir à 19h30");

    expect(result.intent).toBe("update_schedule");
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.params.service_type).toBe("shabbat_evening");
    expect(result.params.time).toBe("19:30");
    expect(result.needs_confirmation).toBe(true);
  });

  it("detecte une mise à jour du mot du rabbin", async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      id: "msg_2",
      type: "message",
      role: "assistant",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            intent: "update_rabbi_word",
            confidence: 0.99,
            params: { text: "Chabbat chalom à tous !" },
            needs_confirmation: false,
            human_summary: "Mise à jour du message du rabbin",
          }),
        },
      ],
      model: "claude-haiku-4-5-20251001",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 40 },
    });

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(
      () => ({ messages: { create: mockCreate } }) as unknown as InstanceType<typeof Anthropic>
    );

    const result = await parseIntent("Nouveau message du rabbin : Chabbat chalom à tous !");
    expect(result.intent).toBe("update_rabbi_word");
    expect(result.params.text).toBe("Chabbat chalom à tous !");
    expect(result.needs_confirmation).toBe(false);
  });

  it("retourne unclear pour un message incomprehensible", async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      id: "msg_3",
      type: "message",
      role: "assistant",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            intent: "unclear",
            confidence: 0.1,
            params: { reason: "Message sans sens" },
            needs_confirmation: false,
            human_summary: "Je n'ai pas compris votre demande.",
          }),
        },
      ],
      model: "claude-haiku-4-5-20251001",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 20 },
    });

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(
      () => ({ messages: { create: mockCreate } }) as unknown as InstanceType<typeof Anthropic>
    );

    const result = await parseIntent("azeqsd blabla 123");
    expect(result.intent).toBe("unclear");
    expect(result.confidence).toBeLessThan(0.7);
  });

  it("detecte une mise à jour de lien social", async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      id: "msg_4",
      type: "message",
      role: "assistant",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            intent: "update_social",
            confidence: 0.95,
            params: { platform: "facebook", url: "https://facebook.com/synagogue.orhaim" },
            needs_confirmation: false,
            human_summary: "Mise à jour du lien Facebook",
          }),
        },
      ],
      model: "claude-haiku-4-5-20251001",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 30 },
    });

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(
      () => ({ messages: { create: mockCreate } }) as unknown as InstanceType<typeof Anthropic>
    );

    const result = await parseIntent(
      "Notre page Facebook : https://facebook.com/synagogue.orhaim"
    );
    expect(result.intent).toBe("update_social");
    expect(result.params.platform).toBe("facebook");
  });

  it("gere un JSON invalide retourne par le modele", async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      id: "msg_5",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Désolé, je ne peux pas répondre." }],
      model: "claude-haiku-4-5-20251001",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    });

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(
      () => ({ messages: { create: mockCreate } }) as unknown as InstanceType<typeof Anthropic>
    );

    const result = await parseIntent("test");
    expect(result.intent).toBe("unclear");
    expect(result.confidence).toBe(0);
  });

  it("detecte une demande de statut en hebreu translittere", async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      id: "msg_6",
      type: "message",
      role: "assistant",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            intent: "query_status",
            confidence: 0.92,
            params: {},
            needs_confirmation: false,
            human_summary: "Consultation des informations de la synagogue",
          }),
        },
      ],
      model: "claude-haiku-4-5-20251001",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 25 },
    });

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(
      () => ({ messages: { create: mockCreate } }) as unknown as InstanceType<typeof Anthropic>
    );

    const result = await parseIntent("Ma snif, quelles sont les infos ?");
    expect(result.intent).toBe("query_status");
    expect(result.confidence).toBeGreaterThan(0.7);
  });
});
