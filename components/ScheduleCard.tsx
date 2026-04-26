import type { CustomSchedule, HebcalData } from "@/types";
import { formatCandleLighting } from "@/lib/hebcal/client";

interface Props {
  schedules: CustomSchedule[];
  hebcal: HebcalData | null;
}

const SERVICE_LABELS: Record<string, string> = {
  shabbat_evening: "Chabbat soir (Arvit)",
  shabbat_morning: "Chabbat matin (Shaharit)",
  shabbat_mincha: "Chabbat Mincha",
  shabbat_maariv: "Chabbat Maariv / Havdala",
  weekday_shaharit: "Shaharit",
  weekday_mincha: "Mincha",
  weekday_maariv: "Maariv",
  rosh_hodesh: "Roch Hodech",
  holiday: "Fête",
};

function formatTime(t: string) {
  // t est au format "HH:MM:SS" depuis Postgres ou "HH:MM"
  return t.slice(0, 5);
}

function formatShabbatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Paris",
    });
  } catch {
    return dateStr;
  }
}

export default function ScheduleCard({ schedules, hebcal }: Props) {
  const shabbatSchedules = schedules.filter((s) =>
    s.service_type.startsWith("shabbat_")
  );
  const weeklySchedules = schedules.filter(
    (s) => !s.service_type.startsWith("shabbat_")
  );

  const candleLighting = hebcal
    ? formatCandleLighting(hebcal.shabbat.candle_lighting)
    : null;
  const shabbatDate = hebcal ? formatShabbatDate(hebcal.shabbat.date) : null;

  return (
    <section className="space-y-6 px-4">
      {/* Prochain Chabbat */}
      <div className="rounded-2xl bg-primary-50 border border-primary-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">✡️</span>
          <div>
            <h2 className="font-bold text-slate-900 text-lg leading-tight">
              Prochain Chabbat
            </h2>
            {hebcal?.shabbat.parasha && (
              <p className="text-primary-700 text-sm font-medium">
                Paracha {hebcal.shabbat.parasha}
              </p>
            )}
            {shabbatDate && (
              <p className="text-slate-500 text-xs capitalize">{shabbatDate}</p>
            )}
          </div>
        </div>

        {/* Allumage des bougies depuis Hebcal */}
        {candleLighting && (
          <div className="flex justify-between items-center py-2 border-b border-primary-200">
            <span className="text-slate-700 text-sm">🕯️ Allumage des bougies</span>
            <span className="font-semibold text-slate-900">{candleLighting}</span>
          </div>
        )}

        {/* Offices du Chabbat */}
        {shabbatSchedules.map((s) => (
          <div
            key={s.id}
            className="flex justify-between items-center py-2 border-b border-primary-100 last:border-0"
          >
            <span className="text-slate-700 text-sm">
              {SERVICE_LABELS[s.service_type] ?? s.service_type}
            </span>
            <span className="font-semibold text-slate-900">{formatTime(s.time)}</span>
          </div>
        ))}

        {shabbatSchedules.length === 0 && !candleLighting && (
          <p className="text-slate-500 text-sm text-center py-2">
            Horaires à venir
          </p>
        )}
      </div>

      {/* Offices de la semaine */}
      {weeklySchedules.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <h2 className="font-bold text-slate-900 text-lg mb-3">
            Offices de la semaine
          </h2>
          {weeklySchedules.map((s) => (
            <div
              key={s.id}
              className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0"
            >
              <span className="text-slate-700 text-sm">
                {SERVICE_LABELS[s.service_type] ?? s.service_type}
              </span>
              <span className="font-semibold text-slate-900">{formatTime(s.time)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Fêtes à venir */}
      {hebcal && hebcal.upcoming_holidays.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <h2 className="font-bold text-slate-900 text-lg mb-3">
            Prochaines fêtes
          </h2>
          {hebcal.upcoming_holidays.slice(0, 5).map((h, i) => (
            <div
              key={i}
              className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0"
            >
              <span className="text-slate-700 text-sm">{h.title}</span>
              <span className="text-slate-500 text-sm">
                {new Date(h.date).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
