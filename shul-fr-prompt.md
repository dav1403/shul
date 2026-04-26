# Projet : shul.fr — MVP "No-Interface Agency" pour synagogues

## Contexte et vision

Tu vas construire le MVP d'un service appelé **shul.fr** (ou nom équivalent, le domaine sera configuré plus tard). Le concept : permettre à une synagogue d'avoir une page web publique gérée à 100% via WhatsApp, sans aucune interface d'administration, sans login, sans CMS.

**Public cible** : rabbins, secrétaires de synagogues, présidents d'associations cultuelles juives. Profil non-technique, âgé en moyenne, utilisateurs intensifs de WhatsApp.

**Promesse** : "Envoyez un WhatsApp, votre site web se met à jour."

**Modèle économique** : gratuit au début (objectif : 5-10 synagogues actives en bêta), payant plus tard avec features premium (sous-domaine personnalisé, statistiques, multi-utilisateurs, etc.).

## Architecture cible

- **Framework** : Next.js 14+ (App Router) en TypeScript
- **Hébergement** : Vercel (déploiement automatique depuis GitHub)
- **Base de données** : Supabase (PostgreSQL managé)
- **Storage images** : Supabase Storage
- **Style** : Tailwind CSS
- **Calendrier juif** : intégration avec l'API publique Hebcal (https://www.hebcal.com/home/195/jewish-calendar-rest-api) pour récupérer automatiquement parashiot, zmanim, fêtes
- **WhatsApp** : webhook générique HTTP/JSON découplé du fournisseur (compatible 2Chat, Twilio, WhatsApp Cloud API). Une seule route `/api/whatsapp/webhook` qui accepte un payload normalisé.
- **LLM** : intégration Claude (Anthropic API) pour le parsing d'intention en langage naturel français/hébreu/anglais. Utiliser le modèle `claude-haiku-4-5-20251001` pour minimiser les coûts.

## Structure du projet

```
shul-fr/
├── app/
│   ├── [slug]/
│   │   └── page.tsx           # Page publique de la synagogue (ex: /bethel)
│   ├── api/
│   │   ├── whatsapp/
│   │   │   └── webhook/
│   │   │       └── route.ts   # Webhook WhatsApp générique
│   │   └── hebcal/
│   │       └── route.ts       # Cache wrapper sur l'API Hebcal
│   ├── layout.tsx
│   ├── page.tsx               # Landing page expliquant le service
│   └── globals.css
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── whatsapp/
│   │   ├── adapter.ts         # Couche d'abstraction fournisseur
│   │   └── handlers.ts        # Logique métier des messages entrants
│   ├── claude/
│   │   └── intent.ts          # Parsing d'intention via Claude API
│   └── hebcal/
│       └── client.ts          # Client Hebcal avec cache
├── components/
│   ├── SynagogueHeader.tsx
│   ├── ScheduleCard.tsx
│   ├── SocialLinks.tsx
│   └── ContactBlock.tsx
├── types/
│   └── index.ts
├── .env.local.example
├── README.md
└── package.json
```

## Schéma de base de données (Supabase)

```sql
-- Table principale des synagogues
CREATE TABLE synagogues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,                    -- ex: "bethel" pour shul.fr/bethel
  name TEXT NOT NULL,                            -- "Synagogue Beth El"
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'FR',
  phone TEXT,
  email TEXT,
  photo_url TEXT,                                -- URL Supabase Storage
  rabbi_word TEXT,                               -- Mot du rabbin / actualité courte
  social_facebook TEXT,
  social_instagram TEXT,
  social_whatsapp_group TEXT,
  hebcal_geoname_id INTEGER,                     -- pour zmanim précis (Paris=2988507)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Numéros WhatsApp autorisés à modifier une synagogue
CREATE TABLE authorized_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synagogue_id UUID REFERENCES synagogues(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,                           -- format E.164: +33612345678
  role TEXT DEFAULT 'editor',                    -- editor, admin
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(synagogue_id, phone)
);

-- Horaires d'offices personnalisés (override des défauts Hebcal)
CREATE TABLE custom_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synagogue_id UUID REFERENCES synagogues(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,                    -- 'shabbat_evening', 'shabbat_morning', 'shabbat_mincha', 'weekday_shaharit', etc.
  day_of_week INTEGER,                           -- 0=dimanche, 6=samedi, NULL si toujours
  time TIME NOT NULL,                            -- ex: 08:45
  active_from DATE,                              -- pour horaires saisonniers
  active_until DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log de toutes les modifications via WhatsApp (auditabilité)
CREATE TABLE modification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synagogue_id UUID REFERENCES synagogues(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  raw_message TEXT NOT NULL,
  parsed_intent JSONB,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions de conversation pour onboarding multi-tour
CREATE TABLE conversation_state (
  phone TEXT PRIMARY KEY,
  state TEXT NOT NULL,                           -- 'idle', 'onboarding_name', 'onboarding_address', etc.
  context JSONB DEFAULT '{}',
  synagogue_id UUID REFERENCES synagogues(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Active la **Row Level Security** sur toutes les tables et écris des policies qui permettent uniquement la lecture publique des champs nécessaires pour la page publique de la synagogue.

## Couche d'abstraction WhatsApp (générique)

Crée une interface `WhatsAppAdapter` qui définit :

```typescript
interface IncomingMessage {
  from: string;          // numéro E.164
  text: string;          // contenu texte du message
  mediaUrl?: string;     // URL si image/audio
  mediaType?: string;    // 'image/jpeg', 'audio/ogg', etc.
  timestamp: Date;
  providerId: string;    // id unique du message côté provider
}

interface OutgoingMessage {
  to: string;
  text: string;
}

interface WhatsAppAdapter {
  parseIncoming(rawPayload: unknown): IncomingMessage;
  sendMessage(msg: OutgoingMessage): Promise<void>;
}
```

Implémente trois adaptateurs vides mais correctement typés :
- `TwoChatAdapter` (à compléter plus tard)
- `TwilioAdapter` (à compléter plus tard)
- `WhatsAppCloudAdapter` (à compléter plus tard)

Le choix de l'adaptateur se fait via une variable d'env `WHATSAPP_PROVIDER`. Pour le MVP, ajoute aussi un `MockAdapter` qui log dans la console — ça permettra de tester le pipeline sans WhatsApp branché.

## Logique conversationnelle (handlers)

Le webhook reçoit un message, identifie l'expéditeur, et applique cette logique :

**1. Si numéro inconnu** → démarrer l'onboarding :
- État `onboarding_name` : "Bonjour ! Bienvenue sur shul.fr. Quel est le nom de votre synagogue ?"
- État `onboarding_address` : "Parfait. Quelle est l'adresse de Beth El ?"
- État `onboarding_city` : "Dans quelle ville ?"
- État `onboarding_done` : créer la synagogue avec un slug auto-généré (kebab-case du nom, vérifier l'unicité), répondre avec l'URL `https://shul.fr/bethel`, ajouter le numéro dans `authorized_phones`.

**2. Si numéro connu** → parser l'intention via Claude :
- Appeler Claude (Haiku) avec un system prompt qui demande de retourner du JSON structuré
- Intentions possibles :
  - `update_schedule` (modifier un horaire d'office)
  - `update_photo` (l'utilisateur envoie une photo)
  - `update_rabbi_word` (mettre à jour le mot du rabbin)
  - `update_social` (ajouter/modifier un lien social)
  - `update_contact` (modifier téléphone ou email)
  - `query_status` (que sait-on sur ma synagogue)
  - `unclear` (demander clarification)
- Appliquer la modification, confirmer en langage naturel, logger dans `modification_log`.

**3. Pour les actions sensibles** (changement d'horaire de Chabbat) → demander confirmation avant d'appliquer :
- "J'ai compris : office du Chabbat soir à 19h30. Je publie ? (oui/non)"

**4. Si message contient une image** → la stocker dans Supabase Storage, mettre à jour `photo_url`.

## System prompt pour Claude (parsing d'intention)

À mettre dans `lib/claude/intent.ts`. Le prompt doit :
- Comprendre le français, l'hébreu translittéré, l'anglais
- Connaître le vocabulaire juif liturgique (Chabbat, Mincha, Arvit, Shaharit, Roch Hodech, parasha, zman, etc.)
- Retourner uniquement du JSON, jamais de texte libre
- Inclure un champ `confidence` (0 à 1) pour permettre au système de demander clarification si < 0.7

Format de sortie attendu :

```json
{
  "intent": "update_schedule",
  "confidence": 0.95,
  "params": {
    "service_type": "shabbat_evening",
    "time": "19:30",
    "day_of_week": 5
  },
  "needs_confirmation": true,
  "human_summary": "Office du Chabbat soir à 19h30 le vendredi"
}
```

## Page publique `/[slug]`

Design **mobile-first**, minimaliste, élégant. Usage en condition réelle : un fidèle qui vérifie l'horaire du Chabbat sur son téléphone le vendredi après-midi.

Sections de la page (dans cet ordre) :

1. **Header** : nom de la synagogue, photo en bandeau si présente, adresse cliquable (lien vers Google Maps)
2. **Prochain office** : encart visuel proéminent affichant le prochain Chabbat ou la prochaine fête, avec horaire d'allumage des bougies (depuis Hebcal) et horaires personnalisés depuis `custom_schedules`
3. **Horaires de la semaine** : tableau ou liste des offices quotidiens
4. **Mot du rabbin / actualité** : si `rabbi_word` est rempli
5. **Contact** : téléphone, email, avec liens cliquables (`tel:`, `mailto:`)
6. **Réseaux sociaux** : icônes vers Facebook, Instagram, groupe WhatsApp
7. **Footer discret** : "Site géré via shul.fr — Créez le vôtre gratuitement"

**Important** :
- SEO solide : balises meta, OpenGraph, JSON-LD (type `PlaceOfWorship` avec `religion: Judaism`)
- Police lisible, contrastes élevés (utilisateurs souvent âgés)
- Pas de JavaScript bloquant, page rendue côté serveur (SSR) avec ISR de 5 minutes pour la fraîcheur
- Indique clairement la date et heure de la prochaine entrée et sortie de Chabbat

## Intégration Hebcal

Crée un client `lib/hebcal/client.ts` qui :
- Récupère les horaires liturgiques (zmanim) pour la synagogue selon son `hebcal_geoname_id`
- Récupère les fêtes juives à venir (30 jours)
- Cache en mémoire (Map simple) pour 6h
- Gère les erreurs réseau gracieusement (fallback sur affichage sans zmanim)

Endpoint Hebcal type : `https://www.hebcal.com/shabbat?cfg=json&geonameid={id}&M=on`

## Variables d'environnement

`.env.local.example` :

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# WhatsApp
WHATSAPP_PROVIDER=mock              # mock | twochat | twilio | whatsapp_cloud
WHATSAPP_WEBHOOK_SECRET=            # pour vérifier les signatures entrantes

# Optionnel
NEXT_PUBLIC_SITE_URL=https://shul.fr
```

## Ce que tu dois livrer

1. **Tout le code du projet** dans une structure prête à `git init` et `vercel deploy`
2. **Un README.md complet** expliquant :
   - Comment installer les dépendances
   - Comment configurer Supabase (lien vers le SQL d'init à coller dans l'éditeur Supabase)
   - Comment obtenir une clé Anthropic
   - Comment lancer en local
   - Comment déployer sur Vercel
   - Comment tester le flow WhatsApp avec le `MockAdapter`
3. **Un fichier `supabase/schema.sql`** contenant tout le DDL prêt à exécuter
4. **Un fichier `supabase/seed.sql`** avec une synagogue d'exemple (`bethel`) pour pouvoir voir la page `/bethel` immédiatement
5. **Une suite de tests minimale** sur la logique de parsing d'intention (au moins 5 cas)
6. **Un script `scripts/test-conversation.ts`** qui simule une conversation WhatsApp complète d'onboarding via le MockAdapter, pour valider le pipeline sans avoir branché de provider

## Contraintes et qualité

- TypeScript strict (`"strict": true`)
- Aucun `any` non justifié
- Gestion d'erreurs propre partout (try/catch, jamais de promesses non awaitées)
- Composants React fonctionnels, pas de classes
- Le code doit être lisible par quelqu'un qui n'est pas le rédacteur — commentaires brefs sur les parties non évidentes uniquement
- Respecter les conventions Next.js App Router (Server Components par défaut, `'use client'` seulement quand nécessaire)
- Validation runtime des entrées avec Zod (notamment pour le webhook WhatsApp et la sortie JSON de Claude)

## Hors-scope (ne PAS implémenter pour le MVP)

- Authentification / login utilisateur
- Tableau de bord administratif
- Système de paiement
- Multi-langues de l'interface (le contenu peut être en français, c'est tout)
- Application mobile native
- Notifications push
- Système d'événements complexes (juste le mot du rabbin texte simple suffit)
- Sous-domaines personnalisés (Phase 2)
- Multi-utilisateurs avec rôles complexes (juste : numéro autorisé = peut tout modifier)

## Démarrage

Commence par :
1. Initialiser le projet Next.js 14 avec TypeScript et Tailwind
2. Créer le schéma Supabase
3. Construire la page publique `/[slug]` qui lit la base de données (avec une synagogue seedée)
4. Implémenter le webhook WhatsApp avec le MockAdapter
5. Connecter Claude pour le parsing d'intention
6. Faire fonctionner le flow d'onboarding de bout en bout via le script de test
7. Brancher Hebcal
8. Polir le design de la page publique

À chaque étape, vérifie que ça compile et que les tests passent avant de passer à la suivante.
