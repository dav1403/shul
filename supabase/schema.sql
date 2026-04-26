-- ============================================================
-- shul.fr — Schéma Supabase
-- Coller dans l'éditeur SQL de Supabase puis exécuter
-- ============================================================

-- Table principale des synagogues
CREATE TABLE synagogues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'FR',
  phone TEXT,
  email TEXT,
  photo_url TEXT,
  rabbi_word TEXT,
  social_facebook TEXT,
  social_instagram TEXT,
  social_whatsapp_group TEXT,
  hebcal_geoname_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Numéros WhatsApp autorisés à modifier une synagogue
CREATE TABLE authorized_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synagogue_id UUID REFERENCES synagogues(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  role TEXT DEFAULT 'editor',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(synagogue_id, phone)
);

-- Horaires d'offices personnalisés
CREATE TABLE custom_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synagogue_id UUID REFERENCES synagogues(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  day_of_week INTEGER,
  time TIME NOT NULL,
  active_from DATE,
  active_until DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log de toutes les modifications via WhatsApp
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
  state TEXT NOT NULL DEFAULT 'idle',
  context JSONB DEFAULT '{}',
  synagogue_id UUID REFERENCES synagogues(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER synagogues_updated_at
  BEFORE UPDATE ON synagogues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER conversation_state_updated_at
  BEFORE UPDATE ON conversation_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE synagogues ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE modification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_state ENABLE ROW LEVEL SECURITY;

-- Lecture publique des synagogues (page publique)
CREATE POLICY "synagogues_public_read" ON synagogues
  FOR SELECT USING (true);

-- Lecture publique des horaires (page publique)
CREATE POLICY "schedules_public_read" ON custom_schedules
  FOR SELECT USING (true);

-- Seul le service_role peut écrire (webhook via clé service)
CREATE POLICY "synagogues_service_write" ON synagogues
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "authorized_phones_service_write" ON authorized_phones
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "schedules_service_write" ON custom_schedules
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "modification_log_service_write" ON modification_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "conversation_state_service_write" ON conversation_state
  FOR ALL USING (auth.role() = 'service_role');
