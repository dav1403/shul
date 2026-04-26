import type { HebcalData, HebcalShabbat, HebcalHoliday } from "@/types";

// Cache en mémoire — TTL 6h
const cache = new Map<string, { data: HebcalData; expiresAt: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface HebcalItem {
  title: string;
  date: string;
  category: string;
  subcat?: string;
  hebrew?: string;
  memo?: string;
  link?: string;
}

interface HebcalApiResponse {
  title?: string;
  date?: string;
  location?: { title?: string };
  items?: HebcalItem[];
}

function parseShabbatFromItems(items: HebcalItem[]): HebcalShabbat {
  const today = new Date();
  const shabbat: HebcalShabbat = {
    candle_lighting: null,
    havdalah: null,
    parasha: null,
    date: "",
  };

  for (const item of items) {
    if (item.category === "candles") {
      shabbat.candle_lighting = item.title.replace("Candle lighting: ", "").replace("Allumage des bougies: ", "");
      // Extraire la date de l'item
      shabbat.date = item.date ?? "";
    }
    if (item.category === "havdalah") {
      shabbat.havdalah = item.title.replace("Havdalah: ", "");
    }
    if (item.category === "parashat") {
      shabbat.parasha = item.hebrew ?? item.title;
    }
  }

  // Si pas de date trouvée, prendre le prochain vendredi
  if (!shabbat.date) {
    const d = new Date(today);
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
    shabbat.date = d.toISOString().split("T")[0];
  }

  return shabbat;
}

function parseHolidaysFromItems(items: HebcalItem[]): HebcalHoliday[] {
  return items
    .filter((item) => item.category === "holiday" || item.category === "roshchodesh")
    .slice(0, 10)
    .map((item) => ({
      title: item.hebrew ?? item.title,
      date: item.date ?? "",
      category: item.category,
    }));
}

export async function getHebcalData(geonameId: number): Promise<HebcalData> {
  const cacheKey = String(geonameId);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const url = `https://www.hebcal.com/shabbat?cfg=json&geonameid=${geonameId}&M=on&lg=fr`;
    const resp = await fetch(url, {
      next: { revalidate: 21600 }, // 6h côté Next.js aussi
    });

    if (!resp.ok) throw new Error(`Hebcal HTTP ${resp.status}`);

    const json = (await resp.json()) as HebcalApiResponse;
    const items: HebcalItem[] = json.items ?? [];

    const data: HebcalData = {
      shabbat: parseShabbatFromItems(items),
      upcoming_holidays: parseHolidaysFromItems(items),
      location: json.location?.title ?? `GeoID ${geonameId}`,
    };

    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } catch (err) {
    console.error("[Hebcal] Erreur réseau, fallback sans zmanim:", err);

    // Fallback gracieux : données vides mais structure valide
    const fallback: HebcalData = {
      shabbat: {
        candle_lighting: null,
        havdalah: null,
        parasha: null,
        date: "",
      },
      upcoming_holidays: [],
      location: "Paris",
    };

    // Cache le fallback 15 minutes seulement pour réessayer vite
    cache.set(cacheKey, { data: fallback, expiresAt: Date.now() + 15 * 60 * 1000 });
    return fallback;
  }
}

// Formate l'heure d'allumage des bougies en heure locale FR
export function formatCandleLighting(isoTime: string | null): string | null {
  if (!isoTime) return null;
  try {
    // Hebcal renvoie parfois "19:45" directement, parfois "2024-05-10T19:45:00+02:00"
    if (isoTime.includes("T")) {
      const date = new Date(isoTime);
      return date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      });
    }
    return isoTime;
  } catch {
    return isoTime;
  }
}
