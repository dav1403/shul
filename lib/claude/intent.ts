import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ParsedIntent } from "@/types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans la gestion de synagogues. Tu analyses des messages WhatsApp envoyés par des responsables de synagogue (rabbins, secrétaires, présidents).

Tu comprends le français, l'anglais, et l'hébreu translittéré. Tu connais le vocabulaire liturgique juif :
- Chabbat (Shabbat, Shabbes) : jour de repos du vendredi soir au samedi soir
- Mincha : office de l'après-midi
- Arvit / Maariv : office du soir
- Shaharit : office du matin
- Havdala : cérémonie de fin du Chabbat
- Kidouch : bénédiction sur le vin
- Roch Hodech : début du mois hébraïque
- Parasha : portion de la Torah de la semaine
- Zman / Zmanim : horaires liturgiques calculés astronomiquement
- Séoudah : repas festif
- Simha : événement joyeux
- Torah : les cinq livres de Moïse
- Haftara : lecture des prophètes
- Alya : montée à la Torah

Tu retournes UNIQUEMENT du JSON valide, jamais de texte libre.

Format de sortie :
{
  "intent": string,        // l'une des valeurs ci-dessous
  "confidence": number,    // 0.0 à 1.0
  "params": object,        // paramètres spécifiques à l'intention
  "needs_confirmation": boolean,
  "human_summary": string  // résumé en français naturel de ce que tu as compris
}

Valeurs possibles pour "intent" :
- "update_schedule" : modifier un horaire d'office
  params: { service_type: string, time: string (HH:MM), day_of_week?: number (0=dim, 6=sam) }
- "update_photo" : l'utilisateur envoie ou veut changer la photo
  params: {}
- "update_rabbi_word" : mettre à jour le message/actualité du rabbin
  params: { text: string }
- "update_social" : ajouter/modifier un lien réseau social
  params: { platform: "facebook"|"instagram"|"whatsapp", url: string }
- "update_contact" : modifier téléphone ou email
  params: { phone?: string, email?: string }
- "query_status" : l'utilisateur veut voir les infos de sa synagogue
  params: {}
- "unclear" : message ambigu ou incompréhensible
  params: { reason: string }

Règles :
- needs_confirmation = true pour tout changement d'horaire de Chabbat
- confidence < 0.7 → utiliser "unclear"
- Normalise les horaires en format 24h HH:MM
- service_type doit être l'un de : shabbat_evening, shabbat_morning, shabbat_mincha, shabbat_maariv, weekday_shaharit, weekday_mincha, weekday_maariv, rosh_hodesh, holiday`;

const ParsedIntentSchema = z.object({
  intent: z.enum([
    "update_schedule",
    "update_photo",
    "update_rabbi_word",
    "update_social",
    "update_contact",
    "query_status",
    "unclear",
  ]),
  confidence: z.number().min(0).max(1),
  params: z.record(z.unknown()),
  needs_confirmation: z.boolean(),
  human_summary: z.string(),
});

export async function parseIntent(message: string): Promise<ParsedIntent> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: message }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    return fallbackUnclear("Réponse inattendue du modèle");
  }

  let raw: unknown;
  try {
    // Extrait le JSON même si le modèle ajoute des backticks
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Pas de JSON trouvé");
    raw = JSON.parse(jsonMatch[0]);
  } catch {
    return fallbackUnclear("Impossible de parser la réponse JSON");
  }

  const result = ParsedIntentSchema.safeParse(raw);
  if (!result.success) {
    return fallbackUnclear("Format JSON invalide");
  }

  return result.data as ParsedIntent;
}

function fallbackUnclear(reason: string): ParsedIntent {
  return {
    intent: "unclear",
    confidence: 0,
    params: { reason },
    needs_confirmation: false,
    human_summary: "Je n'ai pas compris votre demande.",
  };
}
