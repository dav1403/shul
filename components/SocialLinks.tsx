import type { Synagogue } from "@/types";

interface Props {
  synagogue: Synagogue;
}

export default function SocialLinks({ synagogue }: Props) {
  const links = [
    {
      key: "facebook",
      url: synagogue.social_facebook,
      label: "Facebook",
      icon: "📘",
    },
    {
      key: "instagram",
      url: synagogue.social_instagram,
      label: "Instagram",
      icon: "📸",
    },
    {
      key: "whatsapp",
      url: synagogue.social_whatsapp_group,
      label: "Groupe WhatsApp",
      icon: "💬",
    },
  ].filter((l) => Boolean(l.url));

  if (links.length === 0) return null;

  return (
    <section className="px-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <h2 className="font-bold text-slate-900 text-lg mb-3">Suivez-nous</h2>
        <div className="flex flex-wrap gap-3">
          {links.map((link) => (
            <a
              key={link.key}
              href={link.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full bg-slate-50 border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-primary-50 hover:border-primary-200 transition-colors"
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
