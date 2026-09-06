/**
 * Filet anti-dérive des briques layOS vendorées sous lib/vendor/layos/.
 *
 * Même mécanique que YONI (test/vendorParity.test.js) et ProcedureFrance
 * (test/vendor-claude.test.ts) : layOS est un repo séparé, donc on ne peut pas
 * lire la source canonique depuis ici. La parité est figée sous forme d'un
 * SHA-256 du contenu normalisé de la copie vendorée, committé dans ce test.
 *
 * MISE À JOUR : brique modifiée en amont → re-copier la brique dans
 * lib/vendor/layos/, relancer `npm test`, remplacer le hash attendu par le hash
 * « obtenu » affiché dans le message d'échec.
 *
 * Normalisation (identique dans les autres projets, ne rien y ajouter) :
 *   1. CRLF → LF
 *   2. suppression du bandeau de provenance en tête de fichier
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { extractJson } from "@/lib/vendor/layos/claude";

/** Bandeau de provenance : bloc de commentaire en tête, encadré de tirets. */
const BANNER_RE = /^\/\* -{10,}\r?\n(?: \*.*\r?\n)*? \* -{10,} \*\/\r?\n+/;

const readVendored = (brick: string, ext = "ts"): string =>
  fs.readFileSync(path.join(__dirname, "..", "lib", "vendor", "layos", `${brick}.${ext}`), "utf8");

/** CRLF → LF puis retrait du bandeau. Aucune autre transformation. */
const normalize = (source: string): string =>
  source.replace(/\r\n/g, "\n").replace(BANNER_RE, "");

const sha256 = (text: string): string =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");

/**
 * SHA-256 du contenu normalisé de bricks/claude.ts (layOS, HEAD 11c00f4).
 * Identique aux hashs attendus par YONI et ProcedureFrance, qui vendorent la
 * même brique : trois consommateurs, une seule source.
 */
const CLAUDE_SHA256 = "04cc54ea89b9f793c8cb1035219a5f8c7616ccfbca4f74a125b024adc0464628";

describe("vendoring B2 claude.ts", () => {
  it("porte un bandeau de provenance pointant vers layOS", () => {
    const source = readVendored("claude").replace(/\r\n/g, "\n");
    expect(BANNER_RE.test(source)).toBe(true);
    expect(source).toContain("dav1403/layOS -> bricks/claude.ts");
  });

  it("est identique bit-à-bit à la brique amont", () => {
    const actual = sha256(normalize(readVendored("claude")));
    expect(actual).toBe(CLAUDE_SHA256);
  });
});

describe("extractJson (parse 3 étages)", () => {
  it("étage 1 : JSON direct", () => {
    expect(extractJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it("étage 2 : fences ```json retirées", () => {
    expect(extractJson<{ valid: boolean }>('```json\n{"valid":true}\n```')).toEqual({
      valid: true,
    });
  });

  it("étage 3 : premier objet extrait au milieu de prose", () => {
    const raw = 'Voici : {"intent":"query_status"} et voilà.';
    expect(extractJson<{ intent: string }>(raw).intent).toBe("query_status");
  });

  it("lève une erreur explicite si aucun JSON exploitable", () => {
    expect(() => extractJson("aucun json ici")).toThrow(/aucun JSON exploitable/);
  });
});
