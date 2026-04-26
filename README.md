# shul

MVP "No-Interface Agency" pour synagogues — gérez votre site web 100% via WhatsApp.

## Concept

Un rabbin ou secrétaire envoie un WhatsApp → la page publique de la synagogue se met à jour automatiquement. Zéro interface, zéro mot de passe.

## Stack

- **Next.js 14** (App Router, SSR + ISR)
- **Supabase** (PostgreSQL + Storage)
- **Claude Haiku** (parsing d'intention multilingue fr/he/en)
- **Hebcal API** (calendrier hébraïque, zmanim, fêtes)
- **Tailwind CSS**
- **Vercel** (déploiement)

---

## Installation

### 1. Cloner et installer les dépendances

```bash
git clone https://github.com/dav1403/shul-fr.git
cd shul-fr
npm install
```

### 2. Configurer Supabase

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Dans l'éditeur SQL (Database → SQL Editor), collez et exécutez le contenu de :
   - `supabase/schema.sql` (crée les tables + RLS)
   - `supabase/seed.sql` (synagogue d'exemple "bethel")
3. Dans Storage, créez un bucket nommé `public` (accès public activé)

### 3. Obtenir une clé Anthropic

1. Créez un compte sur [console.anthropic.com](https://console.anthropic.com)
2. Créez une clé API dans Settings → API Keys

### 4. Configurer les variables d'environnement

```bash
cp .env.local.example .env.local
```

Remplissez `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

ANTHROPIC_API_KEY=sk-ant-...

WHATSAPP_PROVIDER=mock
WHATSAPP_WEBHOOK_SECRET=votre-secret

NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 5. Lancer en local

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) pour la landing page.  
Ouvrez [http://localhost:3000/bethel](http://localhost:3000/bethel) pour la page d'exemple.

---

## Tester le flow WhatsApp avec MockAdapter

Le MockAdapter simule WhatsApp dans la console, sans aucun fournisseur branché.

### Script de conversation complet

```bash
npm run test:conversation
```

Ce script simule :
1. Un onboarding depuis un numéro inconnu (nom → adresse → ville → création)
2. Mise à jour d'un horaire de Chabbat (avec confirmation)
3. Mise à jour du mot du rabbin
4. Mise à jour Mincha semaine
5. Consultation du statut
6. Message ambigu → réponse d'aide

### Tests unitaires (parsing d'intention)

```bash
npm test
```

6 cas testés : horaire Chabbat, mot du rabbin, message incompréhensible, lien social, JSON invalide, statut en hébreu translittéré.

### Test manuel via le webhook

Avec `WHATSAPP_PROVIDER=mock`, envoyez une requête HTTP :

```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"from": "+33612345678", "text": "Office du Chabbat soir à 19h30"}'
```

---

## Déploiement sur Vercel

1. Poussez le code sur GitHub
2. Importez le repo sur [vercel.com](https://vercel.com)
3. Configurez les variables d'environnement dans les settings Vercel
4. Changez `WHATSAPP_PROVIDER` vers `twochat`, `twilio` ou `whatsapp_cloud` selon votre fournisseur
5. Configurez le webhook de votre fournisseur WhatsApp vers `https://votre-domaine.vercel.app/api/whatsapp/webhook`

---

## Architecture

```
app/
├── [slug]/page.tsx        # Page publique SSR+ISR (5min)
├── api/whatsapp/webhook/  # Webhook générique entrant
├── api/hebcal/            # Proxy cache Hebcal
└── page.tsx               # Landing page

lib/
├── whatsapp/
│   ├── adapter.ts         # MockAdapter + TwoChatAdapter + TwilioAdapter + WhatsAppCloudAdapter
│   └── handlers.ts        # Onboarding multi-tour + routing intentions
├── claude/intent.ts       # Parsing multilingue via Claude Haiku
├── hebcal/client.ts       # Cache 6h + zmanim + fêtes
└── supabase/              # Clients anon (SSR) et service_role (API)

supabase/
├── schema.sql             # DDL + RLS
└── seed.sql               # Synagogue bethel d'exemple
```

---

## Variables d'environnement complètes

| Variable | Requis | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL de votre projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Clé service Supabase (webhook uniquement) |
| `ANTHROPIC_API_KEY` | ✅ | Clé API Anthropic |
| `WHATSAPP_PROVIDER` | ✅ | `mock` / `twochat` / `twilio` / `whatsapp_cloud` |
| `WHATSAPP_WEBHOOK_SECRET` | Recommandé | Secret HMAC pour valider les webhooks |
| `NEXT_PUBLIC_SITE_URL` | Recommandé | URL publique du site |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Optionnel | Numéro WA affiché sur la landing |
