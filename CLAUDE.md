# CLAUDE.md — SHUL

## Identité du projet

MVP "No-Interface Agency" — synagogues gèrent leur page web 100 % via WhatsApp.
Concept : un WhatsApp envoyé = la page publique se met à jour. Zéro interface, zéro mot de passe.

- **Repo GitHub :** github.com/dav1403/shul (remote vérifié 23/06/2026 ; `shul-fr` existe aussi sur GitHub mais le remote local pointe sur `shul`)
- **Chemin local :** `C:\Users\David\AI\SHUL\`
- **Stack :** Next.js 14 App Router + Supabase + Claude Haiku + Hebcal + Tailwind
- **Déploiement :** Vercel actif depuis 27/04/2026 — prod live `https://shul-two.vercel.app` (HTTP 200 vérifié 23/06/2026)
- **Domaine cible :** shul.fr (non encore acquis)

## Architecture

```
app/
├── [slug]/page.tsx        — Page publique SSR+ISR 5min
├── api/whatsapp/webhook/  — Webhook générique (mock/greenapi/twochat/twilio/whatsapp_cloud)
├── api/hebcal/            — Proxy cache Hebcal (6h)
├── privacy/page.tsx       — Page RGPD
└── page.tsx               — Landing page

lib/
├── whatsapp/adapter.ts    — Adaptateurs : Mock + GreenAPI + 2Chat + Twilio + WhatsApp Cloud
├── whatsapp/handlers.ts   — Logique métier (onboarding, intentions, confirmation)
├── claude/intent.ts       — Parsing multilingue fr/he/en via Haiku
└── hebcal/client.ts       — Cache 6h + zmanim + fêtes

supabase/
├── schema.sql             — DDL complet + RLS
└── seed.sql               — Synagogue "bethel" (Paris, geoname 2988507)
```

## État au 23/06/2026

**Code :** MVP complet, déployé sur Vercel (prod live). Supabase et provider WhatsApp réels pas encore branchés.

Ce qui est implémenté et fonctionnel :
- Pipeline WhatsApp complet : onboarding multi-tour → parsing Claude → confirmation → apply
- **5 adaptateurs provider** : MockAdapter, GreenAPIAdapter (ajouté commit f31581c), TwoChatAdapter, TwilioAdapter, WhatsAppCloudAdapter
- Page publique SSR+ISR avec SEO complet (JSON-LD PlaceOfWorship, OG tags)
- Intégration Hebcal (zmanim, paracha, fêtes)
- Suite de 6 tests unitaires (intent parsing)
- Script de conversation complète pour tester sans provider
- Politique de confidentialité RGPD
- Facebook domain verification meta-tag (commit b931ec8)

Ce qui manque avant lancement réel :
1. ~~Déploiement Vercel~~ ✅ live sur https://shul-two.vercel.app
2. Projet Supabase créé et schema.sql exécuté (prérequis absolu)
3. Choix et branchement d'un provider WhatsApp (recommandé : GreenAPI — €10/mois, sans validation Meta)
4. Variables d'env prod configurées sur Vercel (Supabase + Anthropic + provider WA)
5. Domaine shul.fr ou équivalent (non acquis)
6. Test de bout-en-bout avec un vrai téléphone

⚠️ **3 fichiers modifiés non commités** (état au 23/06/2026) : `.env.local.example`, `lib/whatsapp/handlers.ts`, `tailwind.config.ts` — ces fichiers contiennent les corrections de bugs du 12/06 (voir section Bugs ci-dessous) mais ne sont PAS encore commités ni poussés.

## Variables d'environnement requises

Voir `.env.local.example` — les clés essentielles :
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `WHATSAPP_PROVIDER` (défaut : `mock`)
- Selon le provider : `GREENAPI_ID_INSTANCE` + `GREENAPI_API_TOKEN`

## Décisions techniques

- **Modèle Claude :** `claude-haiku-4-5-20251001` (coût minimal, ~$0.001 par message) — (à re-vérifier le 23/06/2026 : model ID potentiellement périmé, vérifier sur console.anthropic.com)
- **Provider WhatsApp recommandé :** GreenAPI (€10/mois pour un numéro selon commit f31581c — la fiche indiquait €15/mois, corrigé ; sandbox gratuit, pas de validation Meta)
- **Confirmation systématique** pour changements d'horaire Chabbat (sensible)
- **RLS Supabase :** lecture publique sur synagogues + custom_schedules ; écriture service_role uniquement
- **Image upload :** Supabase Storage bucket `public` ; WhatsApp Cloud nécessite Authorization header pour télécharger les médias (voir handlers.ts)

## Bugs corrigés le 12/06/2026

1. `tailwind.config.ts` : référençait `var(--font-geist-sans)` mais layout utilise Inter → corrigé vers `"Inter"`
2. `handlers.ts` : `logModification` recevait `intent.human_summary` comme rawMessage au lieu du message brut → corrigé, rawMessage propagé depuis `handleIncomingMessage`
3. `handlers.ts` : `update_contact` envoyait un UPDATE vide si aucun paramètre parsé → guard ajouté
4. `handlers.ts` : `handlePhotoUpload` avec WhatsApp Cloud échouait silencieusement (401) → Authorization header conditionnel ajouté
5. `.env.local.example` : `NEXT_PUBLIC_WHATSAPP_NUMBER` manquant → ajouté

## Dette technique restante

- **Twilio sendMessage** : pas de vérification du statut HTTP de retour (ne throw pas en cas d'erreur)
- **WhatsApp Cloud media** : nécessite un appel intermédiaire à l'API Media pour résoudre l'URL avant téléchargement (implémentation partielle)
- **HMAC webhook validation partielle** : validation de signature Meta implémentée (commit 8b51f39, `META_APP_SECRET`) — mais les autres providers (GreenAPI, 2Chat, Twilio) n'ont PAS de vérification de signature ; `WHATSAPP_WEBHOOK_SECRET` présent en config mais non généralisé
- **Pas de rate limiting** sur le webhook — un acteur malveillant pourrait spam Claude Haiku
- **Modèle Anthropic** : `claude-haiku-4-5-20251001` — vérifier si ce model ID est toujours valide (peut évoluer)
- **ISR 5min** : en prod, envisager revalidatePath() depuis le webhook pour une mise à jour instantanée post-modification

## Potentiel de généralisation ("No-Interface Agency")

Le pattern est 100 % verticalisable :
- Commerces / restaurants : horaires d'ouverture, plat du jour, fermetures exceptionnelles
- Associations : annonces, événements, coordonnées
- Mosquées / Églises : même concept, vocabulaire adapté
- Médecins / Cabinets : disponibilités, coordonnées

Effort d'adaptation : changer le vocabulaire liturgique dans le system prompt Claude + adapter les service_types. Le core pipeline (adapter → intent → apply → DB → ISR page) est réutilisable à l'identique.
