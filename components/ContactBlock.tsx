import type { Synagogue } from "@/types";

interface Props {
  synagogue: Synagogue;
}

export default function ContactBlock({ synagogue }: Props) {
  if (!synagogue.phone && !synagogue.email) return null;

  return (
    <section className="px-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <h2 className="font-bold text-slate-900 text-lg mb-3">Contact</h2>
        {synagogue.phone && (
          <a
            href={`tel:${synagogue.phone}`}
            className="flex items-center gap-3 py-2 text-slate-700 hover:text-primary-600 transition-colors"
          >
            <span className="text-xl">📞</span>
            <span className="text-sm">{synagogue.phone}</span>
          </a>
        )}
        {synagogue.email && (
          <a
            href={`mailto:${synagogue.email}`}
            className="flex items-center gap-3 py-2 text-slate-700 hover:text-primary-600 transition-colors"
          >
            <span className="text-xl">✉️</span>
            <span className="text-sm">{synagogue.email}</span>
          </a>
        )}
      </div>
    </section>
  );
}
