import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getHebcalData } from "@/lib/hebcal/client";
import SynagogueHeader from "@/components/SynagogueHeader";
import ScheduleCard from "@/components/ScheduleCard";
import ContactBlock from "@/components/ContactBlock";
import SocialLinks from "@/components/SocialLinks";
import type { Synagogue, CustomSchedule, HebcalData } from "@/types";

// ISR : revalidation toutes les 5 minutes
export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

async function getSynagogue(slug: string): Promise<Synagogue | null> {
  const db = createServerClient();
  const { data } = await db
    .from("synagogues")
    .select("*")
    .eq("slug", slug)
    .single();
  return data as Synagogue | null;
}

async function getSchedules(synagogueId: string): Promise<CustomSchedule[]> {
  const db = createServerClient();
  const { data } = await db
    .from("custom_schedules")
    .select("*")
    .eq("synagogue_id", synagogueId)
    .order("service_type");
  return (data ?? []) as CustomSchedule[];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const synagogue = await getSynagogue(slug);
  if (!synagogue) return { title: "Synagogue introuvable" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://shul";
  const description = `Horaires des offices, informations pratiques et actualités de la ${synagogue.name} à ${synagogue.city ?? "France"}.`;

  return {
    title: synagogue.name,
    description,
    openGraph: {
      title: synagogue.name,
      description,
      url: `${siteUrl}/${slug}`,
      siteName: "shul",
      images: synagogue.photo_url
        ? [{ url: synagogue.photo_url, alt: synagogue.name }]
        : [],
      locale: "fr_FR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: synagogue.name,
      description,
    },
  };
}

export default async function SynagoguePage({ params }: Props) {
  const { slug } = await params;
  const synagogue = await getSynagogue(slug);
  if (!synagogue) notFound();

  const [schedules, hebcal] = await Promise.all([
    getSchedules(synagogue.id),
    synagogue.hebcal_geoname_id
      ? getHebcalData(synagogue.hebcal_geoname_id).catch(() => null)
      : Promise.resolve(null),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://shul";

  // JSON-LD structuré pour SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "PlaceOfWorship",
    name: synagogue.name,
    religion: "Judaism",
    url: `${siteUrl}/${slug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: synagogue.address,
      addressLocality: synagogue.city,
      postalCode: synagogue.postal_code,
      addressCountry: synagogue.country,
    },
    telephone: synagogue.phone,
    email: synagogue.email,
    image: synagogue.photo_url,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-lg bg-white min-h-screen shadow-sm">
          {/* Header : nom, photo, adresse */}
          <SynagogueHeader synagogue={synagogue} />

          <main className="pb-8 pt-2 space-y-4">
            {/* Prochain office + horaires */}
            <ScheduleCard schedules={schedules} hebcal={hebcal} />

            {/* Mot du rabbin */}
            {synagogue.rabbi_word && (
              <section className="px-4">
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                  <h2 className="font-bold text-slate-900 text-lg mb-2">
                    📜 Mot du rabbin
                  </h2>
                  <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                    {synagogue.rabbi_word}
                  </p>
                </div>
              </section>
            )}

            {/* Contact */}
            <ContactBlock synagogue={synagogue} />

            {/* Réseaux sociaux */}
            <SocialLinks synagogue={synagogue} />
          </main>

          {/* Footer discret */}
          <footer className="border-t border-slate-100 px-4 py-6 text-center">
            <p className="text-xs text-slate-400">
              Site géré via{" "}
              <a
                href={siteUrl}
                className="underline decoration-dotted hover:text-slate-600"
              >
                shul
              </a>{" "}
              — Créez le vôtre gratuitement
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
