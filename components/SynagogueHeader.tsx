import Image from "next/image";
import type { Synagogue } from "@/types";

interface Props {
  synagogue: Synagogue;
}

export default function SynagogueHeader({ synagogue }: Props) {
  const mapsUrl = synagogue.address && synagogue.city
    ? `https://maps.google.com/?q=${encodeURIComponent(
        `${synagogue.address}, ${synagogue.city}`
      )}`
    : null;

  return (
    <header className="relative">
      {/* Bandeau photo */}
      {synagogue.photo_url ? (
        <div className="relative h-52 w-full overflow-hidden bg-slate-200">
          <Image
            src={synagogue.photo_url}
            alt={synagogue.name}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center bg-gradient-to-r from-primary-700 to-primary-900">
          <span className="text-5xl">🕍</span>
        </div>
      )}

      {/* Nom + adresse */}
      <div
        className={`px-4 py-4 ${
          synagogue.photo_url ? "-mt-16 relative z-10" : ""
        }`}
      >
        <h1 className="text-2xl font-bold text-slate-900 leading-tight">
          {synagogue.name}
        </h1>
        {(synagogue.address || synagogue.city) && (
          <address className="mt-1 not-italic text-slate-600 text-sm">
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted hover:text-primary-600"
              >
                {[synagogue.address, synagogue.postal_code, synagogue.city]
                  .filter(Boolean)
                  .join(", ")}
              </a>
            ) : (
              [synagogue.address, synagogue.postal_code, synagogue.city]
                .filter(Boolean)
                .join(", ")
            )}
          </address>
        )}
      </div>
    </header>
  );
}
