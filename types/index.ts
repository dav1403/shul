export interface Synagogue {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  rabbi_word: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_whatsapp_group: string | null;
  hebcal_geoname_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface AuthorizedPhone {
  id: string;
  synagogue_id: string;
  phone: string;
  role: "editor" | "admin";
  created_at: string;
}

export interface CustomSchedule {
  id: string;
  synagogue_id: string;
  service_type: ServiceType;
  day_of_week: number | null;
  time: string;
  active_from: string | null;
  active_until: string | null;
  created_at: string;
}

export type ServiceType =
  | "shabbat_evening"
  | "shabbat_morning"
  | "shabbat_mincha"
  | "shabbat_maariv"
  | "weekday_shaharit"
  | "weekday_mincha"
  | "weekday_maariv"
  | "rosh_hodesh"
  | "holiday";

export interface ModificationLog {
  id: string;
  synagogue_id: string;
  phone: string;
  raw_message: string;
  parsed_intent: ParsedIntent | null;
  action_taken: string | null;
  created_at: string;
}

export interface ConversationState {
  phone: string;
  state: ConversationStep;
  context: ConversationContext;
  synagogue_id: string | null;
  updated_at: string;
}

export type ConversationStep =
  | "idle"
  | "onboarding_name"
  | "onboarding_address"
  | "onboarding_city"
  | "onboarding_done"
  | "awaiting_confirmation";

export interface ConversationContext {
  pending_name?: string;
  pending_address?: string;
  pending_city?: string;
  pending_action?: ParsedIntent;
}

export interface ParsedIntent {
  intent: IntentType;
  confidence: number;
  params: Record<string, unknown>;
  needs_confirmation: boolean;
  human_summary: string;
}

export type IntentType =
  | "update_schedule"
  | "update_photo"
  | "update_rabbi_word"
  | "update_social"
  | "update_contact"
  | "query_status"
  | "unclear";

export interface HebcalShabbat {
  candle_lighting: string | null;
  havdalah: string | null;
  parasha: string | null;
  date: string;
}

export interface HebcalHoliday {
  title: string;
  date: string;
  category: string;
}

export interface HebcalData {
  shabbat: HebcalShabbat;
  upcoming_holidays: HebcalHoliday[];
  location: string;
}
