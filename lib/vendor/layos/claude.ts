/* ---------------------------------------------------------------------------
 * VENDORED — brique layOS B2. Source canonique :
 *   dav1403/layOS -> bricks/claude.ts
 * Ne pas modifier ici : corriger la brique en amont puis re-copier le fichier
 * tel quel (le contenu doit rester identique bit-à-bit à la source).
 * ------------------------------------------------------------------------- */

/**
 * B2 (TS) — Wrapper Claude commun : client paresseux + parse JSON 3 étages + retry.
 *
 * Un des 3 artefacts JUMEAUX à API identique (voir aussi `claude_client.py`,
 * `claude.gs`). Même surface : askText / askJSON<T> / askVision, parse JSON en
 * 3 étages, retry exponentiel sur 429 / 5xx / réseau, modèle paramétrable.
 *
 * ⚠️ Ne JAMAIS figer un ID de modèle dans un consommateur : passer `model` ou
 * laisser le défaut (Haiku). Les IDs valides vivent dans ~/.claude/CLAUDE.md.
 *
 * Consommateurs cibles (TS) : LITIGES, YONI, ProcedureFrance, ACQ-Engine, SHUL.
 * Source d'extraction : LITIGES/lib/anthropic.ts (singleton paresseux + parse 3 étages).
 *
 * Dépendance : `@anthropic-ai/sdk`. Clé : env `ANTHROPIC_API_KEY`.
 *
 * Usage :
 *   import { askJSON, askText } from './claude';
 *   const { verdict } = await askJSON<{ verdict: string }>('Classe: ...');
 *   const summary = await askText('Résume en 1 phrase: ...');
 */

import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_RETRIES = 4;

let _client: Anthropic | null = null;

/** Client Anthropic instancié à la première utilisation (clé lue depuis l'env). */
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('claude: ANTHROPIC_API_KEY manquante dans l\'environnement');
  _client = new Anthropic({ apiKey });
  return _client;
}

export interface AskOpts {
  model?: string;
  maxTokens?: number;
  system?: string;
  /** Blocs image (base64) pour askVision. */
  images?: Array<{ mediaType: string; data: string }>;
  /**
   * Blocs document (base64) — PDF uniquement côté API Anthropic.
   * Ajouté le 03/09/2026 pour ProcedureFrance (analyse de courriers PDF), qui
   * envoyait déjà un bloc `document` en direct. Additif : sans `documents`, le
   * comportement de la brique est strictement inchangé.
   */
  documents?: Array<{ data: string; mediaType?: 'application/pdf' }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Vrai si l'erreur mérite un retry (429, 5xx, réseau). */
function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429 || (status !== undefined && status >= 500)) return true;
  const code = (err as { code?: string })?.code;
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND';
}

/** Appel brut avec retry exponentiel + jitter. Renvoie le texte concaténé. */
export async function askText(prompt: string, opts: AskOpts = {}): Promise<string> {
  const attachments = [
    ...(opts.documents ?? []).map((doc) => ({
      type: 'document' as const,
      source: {
        type: 'base64' as const,
        media_type: (doc.mediaType ?? 'application/pdf') as 'application/pdf',
        data: doc.data,
      },
    })),
    ...(opts.images ?? []).map((img) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        // Le SDK n'accepte que ces 4 types MIME ; `mediaType` reste un string
        // côté appelant (validation à sa charge), on le rétrécit ici.
        media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: img.data,
      },
    })),
  ];

  const content: Anthropic.MessageParam['content'] = attachments.length
    ? [...attachments, { type: 'text' as const, text: prompt }]
    : prompt;

  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const msg = await client().messages.create({
        model: opts.model || DEFAULT_MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        ...(opts.system ? { system: opts.system } : {}),
        messages: [{ role: 'user', content }],
      });
      return msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === MAX_RETRIES - 1) throw err;
      await sleep(2 ** attempt * 500 + Math.floor(Math.random() * 250));
    }
  }
  throw lastErr;
}

/** askText avec une (ou plusieurs) image(s). Sucre au-dessus de askText. */
export function askVision(
  prompt: string,
  images: Array<{ mediaType: string; data: string }>,
  opts: AskOpts = {},
): Promise<string> {
  return askText(prompt, { ...opts, images });
}

/**
 * Parse JSON en 3 étages : direct → strip fences ```json → regex du 1er objet {...}.
 * Exporté pour être testable / réutilisable seul.
 */
export function extractJson<T = unknown>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch { /* étage 2 */ }
  const fenced = raw.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(fenced) as T;
  } catch { /* étage 3 */ }
  const match = raw.match(/[{[][\s\S]*[}\]]/);
  if (match) return JSON.parse(match[0]) as T;
  throw new Error('claude.extractJson: aucun JSON exploitable dans la réponse');
}

/** askText + parse JSON 3 étages, typé. */
export async function askJSON<T = unknown>(prompt: string, opts: AskOpts = {}): Promise<T> {
  const raw = await askText(prompt, opts);
  return extractJson<T>(raw);
}
