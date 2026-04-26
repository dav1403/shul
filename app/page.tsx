import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "shul.fr — Votre synagogue sur le web, depuis WhatsApp",
  description:
    "Donnez à votre synagogue une présence web en quelques minutes. Envoyez un WhatsApp, votre site se met à jour.",
};

const steps = [
  {
    icon: "💬",
    title: "Envoyez un WhatsApp",
    desc: "Contactez notre numéro et donnez le nom et l'adresse de votre synagogue.",
  },
  {
    icon: "🔗",
    title: "Recevez votre lien",
    desc: "En 30 secondes, votre page est en ligne sur shul.fr/votre-synagogue.",
  },
  {
    icon: "✏️",
    title: "Mettez à jour facilement",
    desc: "Envoyez un message pour modifier les horaires, la photo ou l'actualité. Je comprends le français et l'hébreu.",
  },
];

const features = [
  "Horaires des offices automatiquement mis à jour",
  "Intégration du calendrier hébraïque (Hebcal)",
  "Allumage des bougies et paracha chaque semaine",
  "Photo de la synagogue",
  "Mot du rabbin / actualités",
  "Liens Facebook, Instagram, groupe WhatsApp",
  "Page optimisée mobile pour les fidèles",
  "Zéro interface, zéro mot de passe",
];

export default function HomePage() {
  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
  const waUrl = waNumber
    ? `https://wa.me/${waNumber.replace("+", "")}?text=${encodeURIComponent(
        "Bonjour, je souhaite créer la page de ma synagogue sur shul.fr"
      )}`
    : "#";

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-800 to-primary-950 text-white px-6 py-16 text-center">
        <div className="mx-auto max-w-xl">
          <div className="text-6xl mb-4">🕍</div>
          <h1 className="text-3xl font-bold leading-tight mb-4">
            Votre synagogue sur le web,{" "}
            <span className="text-primary-300">depuis WhatsApp</span>
          </h1>
          <p className="text-primary-100 text-lg mb-8">
            Pas d&apos;interface. Pas de mot de passe. Juste WhatsApp.
          </p>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white text-primary-900 font-semibold px-8 py-3 text-lg shadow-lg hover:bg-primary-50 transition-colors"
          >
            💬 Créer ma page gratuitement
          </a>
        </div>
      </section>

      {/* Exemple */}
      <section className="bg-slate-50 px-6 py-12 text-center">
        <p className="text-slate-500 text-sm mb-2">Exemple de page générée</p>
        <Link
          href="/bethel"
          className="inline-flex items-center gap-1 text-primary-700 font-medium underline decoration-dotted hover:text-primary-900"
        >
          shul.fr/bethel →
        </Link>
      </section>

      {/* Comment ça marche */}
      <section className="px-6 py-14 max-w-xl mx-auto">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">
          Comment ça marche ?
        </h2>
        <div className="space-y-6">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-xl">
                {step.icon}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{step.title}</h3>
                <p className="text-slate-600 text-sm mt-1">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 px-6 py-14">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">
            Tout ce qu&apos;il faut, rien de plus
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-700 text-sm">
                <span className="text-primary-600 mt-0.5">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-6 py-16 text-center bg-primary-900 text-white">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">Gratuit pour les 10 premières synagogues</h2>
          <p className="text-primary-200 mb-8">
            Bêta ouverte — rejoignez les premières synagogues sur shul.fr
          </p>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white text-primary-900 font-semibold px-8 py-3 text-lg hover:bg-primary-50 transition-colors"
          >
            💬 Démarrer maintenant
          </a>
        </div>
      </section>

      <footer className="border-t border-slate-100 px-6 py-8 text-center text-xs text-slate-400">
        <p>shul.fr — Service gratuit en bêta</p>
      </footer>
    </div>
  );
}
