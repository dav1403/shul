/**
 * Tests unitaires sur le parsing d'intention.
 * L'SDK Anthropic est mocké : ces tests tournent sans clé réseau.
 *
 * ⚠️ Depuis l'intégration de la brique layOS B2, le client Anthropic est un
 * singleton paresseux CONSTRUIT UNE SEULE FOIS pour tout le fichier de test.
 * On ne peut donc plus ré-implémenter le constructeur test par test : le mock
 * expose un `messages.create` stable (`mockCreate`) que chaque test reconfigure.
 */

const mockCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { parseIntent } from "@/lib/claude/intent";

/** La brique refuse de tourner sans clé (client paresseux). */
process.env.ANTHROPIC_API_KEY = "dummy-key-for-tests";

/** Réponse SDK minimale : uniquement ce que la brique lit (`content`). */
function reply(blocks: Array<Record<string, unknown>>) {
  return { content: blocks };
}

const textReply = (text: string) => reply([{ type: "text", text }]);

const jsonReply = (payload: Record<string, unknown>) =>
  textReply(JSON.stringify(payload));

describe("parseIntent", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("detecte une mise à jour d'horaire de Chabbat soir", async () => {
    mockCreate.mockResolvedValue(
      jsonReply({
        intent: "update_schedule",
        confidence: 0.97,
        params: { service_type: "shabbat_evening", time: "19:30", day_of_week: 5 },
        needs_confirmation: true,
        human_summary: "Office du Chabbat soir à 19h30 le vendredi",
      })
    );

    const result = await parseIntent("Office du Chabbat soir à 19h30");

    expect(result.intent).toBe("update_schedule");
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.params.service_type).toBe("shabbat_evening");
    expect(result.params.time).toBe("19:30");
    expect(result.needs_confirmation).toBe(true);
  });

  it("passe le modèle et le prompt système à la brique", async () => {
    mockCreate.mockResolvedValue(
      jsonReply({
        intent: "query_status",
        confidence: 0.9,
        params: {},
        needs_confirmation: false,
        human_summary: "Consultation",
      })
    );

    await parseIntent("infos ?");

    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe("claude-haiku-4-5-20251001");
    expect(call.max_tokens).toBe(512);
    expect(call.system).toContain("synagogues");
  });

  it("detecte une mise à jour du mot du rabbin", async () => {
    mockCreate.mockResolvedValue(
      jsonReply({
        intent: "update_rabbi_word",
        confidence: 0.99,
        params: { text: "Chabbat chalom à tous !" },
        needs_confirmation: false,
        human_summary: "Mise à jour du message du rabbin",
      })
    );

    const result = await parseIntent("Nouveau message du rabbin : Chabbat chalom à tous !");
    expect(result.intent).toBe("update_rabbi_word");
    expect(result.params.text).toBe("Chabbat chalom à tous !");
    expect(result.needs_confirmation).toBe(false);
  });

  it("retourne unclear pour un message incomprehensible", async () => {
    mockCreate.mockResolvedValue(
      jsonReply({
        intent: "unclear",
        confidence: 0.1,
        params: { reason: "Message sans sens" },
        needs_confirmation: false,
        human_summary: "Je n'ai pas compris votre demande.",
      })
    );

    const result = await parseIntent("azeqsd blabla 123");
    expect(result.intent).toBe("unclear");
    expect(result.confidence).toBeLessThan(0.7);
  });

  it("detecte une mise à jour de lien social", async () => {
    mockCreate.mockResolvedValue(
      jsonReply({
        intent: "update_social",
        confidence: 0.95,
        params: { platform: "facebook", url: "https://facebook.com/synagogue.orhaim" },
        needs_confirmation: false,
        human_summary: "Mise à jour du lien Facebook",
      })
    );

    const result = await parseIntent(
      "Notre page Facebook : https://facebook.com/synagogue.orhaim"
    );
    expect(result.intent).toBe("update_social");
    expect(result.params.platform).toBe("facebook");
  });

  it("gere un JSON invalide retourne par le modele", async () => {
    mockCreate.mockResolvedValue(textReply("Désolé, je ne peux pas répondre."));

    const result = await parseIntent("test");
    expect(result.intent).toBe("unclear");
    expect(result.confidence).toBe(0);
  });

  it("ignore un bloc thinking en tête de réponse", async () => {
    // Régression : l'ancien code lisait `content[0]` et retombait en "unclear"
    // dès que la pensée adaptative insère un bloc `thinking` devant le texte.
    mockCreate.mockResolvedValue(
      reply([
        { type: "thinking", thinking: "L'utilisateur veut changer un horaire." },
        {
          type: "text",
          text: JSON.stringify({
            intent: "update_schedule",
            confidence: 0.95,
            params: { service_type: "weekday_mincha", time: "18:00" },
            needs_confirmation: false,
            human_summary: "Mincha en semaine à 18h00",
          }),
        },
      ])
    );

    const result = await parseIntent("Mincha à 18h en semaine");
    expect(result.intent).toBe("update_schedule");
    expect(result.params.service_type).toBe("weekday_mincha");
  });

  it("retente un 429 transitoire au lieu de dégrader en unclear", async () => {
    const rateLimited = Object.assign(new Error("rate limited"), { status: 429 });
    mockCreate.mockRejectedValueOnce(rateLimited).mockResolvedValueOnce(
      jsonReply({
        intent: "query_status",
        confidence: 0.9,
        params: {},
        needs_confirmation: false,
        human_summary: "Consultation des informations",
      })
    );

    const result = await parseIntent("Ma snif, quelles sont les infos ?");
    expect(result.intent).toBe("query_status");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("laisse remonter une panne d'API plutôt que de la maquiller en unclear", async () => {
    mockCreate.mockRejectedValue(
      Object.assign(new Error("bad request"), { status: 400 })
    );

    await expect(parseIntent("test")).rejects.toThrow("bad request");
  });
});
