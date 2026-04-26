import { createServiceClient } from "@/lib/supabase/server";
import { parseIntent } from "@/lib/claude/intent";
import type { WhatsAppAdapter, IncomingMessage } from "@/lib/whatsapp/adapter";
import type {
  Synagogue,
  ConversationState,
  ConversationStep,
  ParsedIntent,
  ServiceType,
} from "@/types";

// ── Utilitaires ───────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureUniqueSlug(base: string): Promise<string> {
  const db = createServiceClient();
  let slug = base;
  let i = 1;
  while (true) {
    const { data } = await db
      .from("synagogues")
      .select("id")
      .eq("slug", slug)
      .single();
    if (!data) return slug;
    slug = `${base}-${i++}`;
  }
}

async function getConversationState(phone: string): Promise<ConversationState | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("conversation_state")
    .select("*")
    .eq("phone", phone)
    .single();
  return data as ConversationState | null;
}

async function upsertConversationState(
  phone: string,
  state: ConversationStep,
  context: Record<string, unknown>,
  synagogueId?: string
): Promise<void> {
  const db = createServiceClient();
  await db.from("conversation_state").upsert({
    phone,
    state,
    context,
    synagogue_id: synagogueId ?? null,
    updated_at: new Date().toISOString(),
  });
}

async function deleteConversationState(phone: string): Promise<void> {
  const db = createServiceClient();
  await db.from("conversation_state").delete().eq("phone", phone);
}

async function getSynagogueByPhone(phone: string): Promise<Synagogue | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("authorized_phones")
    .select("synagogue_id")
    .eq("phone", phone)
    .single();
  if (!data) return null;

  const { data: syn } = await db
    .from("synagogues")
    .select("*")
    .eq("id", data.synagogue_id)
    .single();
  return syn as Synagogue | null;
}

async function logModification(
  synagogueId: string,
  phone: string,
  rawMessage: string,
  intent: ParsedIntent | null,
  actionTaken: string
): Promise<void> {
  const db = createServiceClient();
  await db.from("modification_log").insert({
    synagogue_id: synagogueId,
    phone,
    raw_message: rawMessage,
    parsed_intent: intent,
    action_taken: actionTaken,
  });
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  shabbat_evening: "Chabbat soir",
  shabbat_morning: "Chabbat matin",
  shabbat_mincha: "Chabbat Mincha",
  shabbat_maariv: "Chabbat Maariv",
  weekday_shaharit: "Shaharit (semaine)",
  weekday_mincha: "Mincha (semaine)",
  weekday_maariv: "Maariv (semaine)",
  rosh_hodesh: "Roch Hodech",
  holiday: "Fête",
};

// ── Onboarding ────────────────────────────────────────────────

async function handleOnboarding(
  msg: IncomingMessage,
  conv: ConversationState | null,
  adapter: WhatsAppAdapter
): Promise<void> {
  const phone = msg.from;
  const text = msg.text.trim();
  const step = conv?.state ?? "idle";
  const ctx = (conv?.context ?? {}) as Record<string, string>;

  if (step === "idle" || step === "onboarding_name") {
    if (!conv || step === "idle") {
      await upsertConversationState(phone, "onboarding_name", {});
      await adapter.sendMessage({
        to: phone,
        text: "Chalom ! Bienvenue sur shul.fr 🕍\n\nJe vais créer la page web de votre synagogue en quelques minutes.\n\nQuel est le nom de votre synagogue ?",
      });
      return;
    }
    // L'utilisateur vient de répondre avec le nom
    await upsertConversationState(phone, "onboarding_address", {
      pending_name: text,
    });
    await adapter.sendMessage({
      to: phone,
      text: `Parfait, "${text}" !\n\nQuelle est l'adresse de la synagogue ? (numéro et nom de rue)`,
    });
    return;
  }

  if (step === "onboarding_address") {
    await upsertConversationState(phone, "onboarding_city", {
      ...ctx,
      pending_address: text,
    });
    await adapter.sendMessage({
      to: phone,
      text: "Dans quelle ville se trouve la synagogue ?",
    });
    return;
  }

  if (step === "onboarding_city") {
    const name = ctx.pending_name ?? "Synagogue";
    const address = ctx.pending_address ?? "";
    const city = text;

    const db = createServiceClient();
    const slug = await ensureUniqueSlug(toSlug(name));

    const { data: syn, error } = await db
      .from("synagogues")
      .insert({ slug, name, address, city })
      .select()
      .single();

    if (error || !syn) {
      await adapter.sendMessage({
        to: phone,
        text: "Une erreur s'est produite. Veuillez réessayer dans quelques instants.",
      });
      return;
    }

    await db
      .from("authorized_phones")
      .insert({ synagogue_id: syn.id, phone, role: "admin" });

    await deleteConversationState(phone);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://shul.fr";
    await adapter.sendMessage({
      to: phone,
      text: `✅ Votre synagogue est en ligne !\n\n🔗 ${siteUrl}/${slug}\n\nVous pouvez maintenant m'envoyer des messages pour mettre à jour les horaires, ajouter une photo, ou modifier les informations. Je suis là 24h/24 !`,
    });
    return;
  }
}

// ── Gestion des intentions ────────────────────────────────────

async function applyIntent(
  intent: ParsedIntent,
  synagogue: Synagogue,
  phone: string,
  adapter: WhatsAppAdapter
): Promise<void> {
  const db = createServiceClient();

  switch (intent.intent) {
    case "update_schedule": {
      const { service_type, time, day_of_week } = intent.params as {
        service_type: ServiceType;
        time: string;
        day_of_week?: number;
      };

      // Upsert: supprime l'ancien et insère le nouveau pour ce type
      await db
        .from("custom_schedules")
        .delete()
        .eq("synagogue_id", synagogue.id)
        .eq("service_type", service_type)
        .is("day_of_week", day_of_week ?? null);

      await db.from("custom_schedules").insert({
        synagogue_id: synagogue.id,
        service_type,
        time,
        day_of_week: day_of_week ?? null,
      });

      const label = SERVICE_TYPE_LABELS[service_type] ?? service_type;
      await adapter.sendMessage({
        to: phone,
        text: `✅ ${label} mis à jour : ${time}`,
      });
      await logModification(synagogue.id, phone, intent.human_summary, intent, `update_schedule:${service_type}:${time}`);
      break;
    }

    case "update_rabbi_word": {
      const { text } = intent.params as { text: string };
      await db
        .from("synagogues")
        .update({ rabbi_word: text })
        .eq("id", synagogue.id);
      await adapter.sendMessage({
        to: phone,
        text: "✅ Le message du rabbin a été mis à jour.",
      });
      await logModification(synagogue.id, phone, intent.human_summary, intent, "update_rabbi_word");
      break;
    }

    case "update_social": {
      const { platform, url } = intent.params as {
        platform: "facebook" | "instagram" | "whatsapp";
        url: string;
      };
      const fieldMap = {
        facebook: "social_facebook",
        instagram: "social_instagram",
        whatsapp: "social_whatsapp_group",
      };
      await db
        .from("synagogues")
        .update({ [fieldMap[platform]]: url })
        .eq("id", synagogue.id);
      await adapter.sendMessage({
        to: phone,
        text: `✅ Lien ${platform} mis à jour.`,
      });
      await logModification(synagogue.id, phone, intent.human_summary, intent, `update_social:${platform}`);
      break;
    }

    case "update_contact": {
      const { phone: newPhone, email } = intent.params as {
        phone?: string;
        email?: string;
      };
      const updates: Record<string, string> = {};
      if (newPhone) updates.phone = newPhone;
      if (email) updates.email = email;
      await db.from("synagogues").update(updates).eq("id", synagogue.id);
      await adapter.sendMessage({
        to: phone,
        text: "✅ Coordonnées mises à jour.",
      });
      await logModification(synagogue.id, phone, intent.human_summary, intent, "update_contact");
      break;
    }

    case "update_photo": {
      await adapter.sendMessage({
        to: phone,
        text: "📷 Envoyez-moi directement la photo en image et je la publierai.",
      });
      break;
    }

    case "query_status": {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://shul.fr";
      await adapter.sendMessage({
        to: phone,
        text: `🕍 *${synagogue.name}*\n📍 ${synagogue.address ?? ""}, ${synagogue.city ?? ""}\n🔗 ${siteUrl}/${synagogue.slug}`,
      });
      break;
    }

    case "unclear":
    default:
      await adapter.sendMessage({
        to: phone,
        text: `Je n'ai pas bien compris votre demande. Pouvez-vous reformuler ?\n\nExemples :\n• "Office du Chabbat soir à 19h30"\n• "Mise à jour Mincha 18h45"\n• "Nouveau message du rabbin : Chabbat chalom !"`,
      });
  }
}

// ── Handler principal ─────────────────────────────────────────

export async function handleIncomingMessage(
  msg: IncomingMessage,
  adapter: WhatsAppAdapter
): Promise<void> {
  const phone = msg.from;

  // Gestion des images : stocker dans Supabase Storage
  if (msg.mediaUrl && msg.mediaType?.startsWith("image/")) {
    await handlePhotoUpload(msg, adapter);
    return;
  }

  const conv = await getConversationState(phone);
  const synagogue = await getSynagogueByPhone(phone);

  // Numéro inconnu → onboarding
  if (!synagogue) {
    await handleOnboarding(msg, conv, adapter);
    return;
  }

  // Numéro en attente de confirmation
  if (conv?.state === "awaiting_confirmation") {
    const pendingAction = conv.context.pending_action as ParsedIntent | undefined;
    if (pendingAction && ["oui", "yes", "כן", "o"].includes(msg.text.trim().toLowerCase())) {
      await deleteConversationState(phone);
      await applyIntent(pendingAction, synagogue, phone, adapter);
    } else {
      await deleteConversationState(phone);
      await adapter.sendMessage({
        to: phone,
        text: "Action annulée. Je reste à votre disposition.",
      });
    }
    return;
  }

  // Numéro connu → parser l'intention
  const intent = await parseIntent(msg.text);

  // Actions de Chabbat → demander confirmation
  if (intent.needs_confirmation) {
    await upsertConversationState(
      phone,
      "awaiting_confirmation",
      { pending_action: intent },
      synagogue.id
    );
    await adapter.sendMessage({
      to: phone,
      text: `J'ai compris : ${intent.human_summary}\n\nJe publie ? (oui / non)`,
    });
    return;
  }

  await applyIntent(intent, synagogue, phone, adapter);
}

async function handlePhotoUpload(
  msg: IncomingMessage,
  adapter: WhatsAppAdapter
): Promise<void> {
  const db = createServiceClient();
  const synagogue = await getSynagogueByPhone(msg.from);
  if (!synagogue || !msg.mediaUrl) return;

  try {
    const resp = await fetch(msg.mediaUrl);
    const buffer = await resp.arrayBuffer();
    const ext = msg.mediaType?.split("/")[1] ?? "jpg";
    const path = `synagogues/${synagogue.slug}/photo.${ext}`;

    const { data, error } = await db.storage
      .from("public")
      .upload(path, buffer, {
        contentType: msg.mediaType,
        upsert: true,
      });

    if (error) throw error;

    const { data: urlData } = db.storage.from("public").getPublicUrl(data.path);
    await db
      .from("synagogues")
      .update({ photo_url: urlData.publicUrl })
      .eq("id", synagogue.id);

    await adapter.sendMessage({
      to: msg.from,
      text: "✅ Photo mise à jour sur votre page !",
    });
  } catch (err) {
    console.error("[handlePhotoUpload]", err);
    await adapter.sendMessage({
      to: msg.from,
      text: "Erreur lors de l'upload de la photo. Veuillez réessayer.",
    });
  }
}
