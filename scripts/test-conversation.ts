/**
 * Simule une conversation WhatsApp complète d'onboarding via le MockAdapter.
 * Exécuter avec : npm run test:conversation
 * Prérequis : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY dans .env.local
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Charger .env.local
dotenv.config({ path: path.join(__dirname, "../.env.local") });

import { MockAdapter } from "../lib/whatsapp/adapter";
import { handleIncomingMessage } from "../lib/whatsapp/handlers";

const ADMIN_PHONE = "+33699000001";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendMessage(
  adapter: MockAdapter,
  from: string,
  text: string,
  mediaUrl?: string,
  mediaType?: string
) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📱 USER [${from}]: "${text}"`);
  console.log("=".repeat(60));

  const msg = adapter.parseIncoming({
    from,
    text,
    mediaUrl,
    mediaType,
    timestamp: new Date().toISOString(),
    providerId: `test-${Date.now()}`,
  });

  await handleIncomingMessage(msg, adapter);
  await delay(500); // Laisser le temps aux promesses de se résoudre
}

async function main() {
  console.log("\n🚀 Démarrage du test de conversation shul.fr\n");

  MockAdapter.clearLog();
  const adapter = new MockAdapter();

  // ── Phase 1 : Onboarding d'un nouveau numéro ────────────────
  console.log("\n📋 PHASE 1 : ONBOARDING\n");

  // Premier contact → doit déclencher l'onboarding
  await sendMessage(adapter, ADMIN_PHONE, "Bonjour");
  await delay(200);

  // Répondre avec le nom de la synagogue
  await sendMessage(adapter, ADMIN_PHONE, "Synagogue Or Haim");
  await delay(200);

  // Répondre avec l'adresse
  await sendMessage(adapter, ADMIN_PHONE, "12 rue de la Paix");
  await delay(200);

  // Répondre avec la ville → doit créer la synagogue et envoyer l'URL
  await sendMessage(adapter, ADMIN_PHONE, "Lyon");
  await delay(500);

  // ── Phase 2 : Mises à jour via Claude ──────────────────────
  console.log("\n📋 PHASE 2 : MISES À JOUR\n");

  // Modifier un horaire de Chabbat (doit demander confirmation)
  await sendMessage(
    adapter,
    ADMIN_PHONE,
    "L'office du Chabbat soir est à 19h30"
  );
  await delay(200);

  // Confirmer
  await sendMessage(adapter, ADMIN_PHONE, "oui");
  await delay(200);

  // Mettre à jour le mot du rabbin
  await sendMessage(
    adapter,
    ADMIN_PHONE,
    "Nouveau message : Chabbat chalom à tous ! Office spécial vendredi soir pour Roch Hodech."
  );
  await delay(200);

  // Modifier Mincha (semaine, sans confirmation)
  await sendMessage(adapter, ADMIN_PHONE, "Mincha en semaine à 18h45");
  await delay(200);

  // Consulter le statut
  await sendMessage(adapter, ADMIN_PHONE, "Quelles sont les infos de ma synagogue ?");
  await delay(200);

  // ── Phase 3 : Message ambigu ────────────────────────────────
  console.log("\n📋 PHASE 3 : MESSAGE AMBIGU\n");

  await sendMessage(adapter, ADMIN_PHONE, "azeqsd 123 blabla");
  await delay(200);

  // ── Résumé ──────────────────────────────────────────────────
  const log = MockAdapter.getLog();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Test terminé — ${log.length} messages échangés`);
  const outgoing = log.filter((e) => e.direction === "out");
  console.log(`   Réponses envoyées : ${outgoing.length}`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err);
  process.exit(1);
});
