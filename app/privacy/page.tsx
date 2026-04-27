import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — shul",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Politique de confidentialité
      </h1>
      <p className="text-slate-500 text-sm mb-8">Dernière mise à jour : avril 2026</p>

      <div className="prose prose-slate space-y-6 text-slate-700 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Qui sommes-nous ?</h2>
          <p>
            shul est un service permettant aux synagogues de gérer leur page web publique
            via WhatsApp. Ce service est exploité à titre personnel et n&apos;est pas affilié
            à Meta Platforms ou WhatsApp Inc.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Données collectées</h2>
          <p>Dans le cadre de notre service, nous collectons :</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Le numéro de téléphone WhatsApp des administrateurs de synagogues</li>
            <li>Les informations de la synagogue (nom, adresse, horaires, photo)</li>
            <li>Le contenu des messages WhatsApp envoyés pour gérer la page</li>
            <li>Les journaux d&apos;activité (modifications effectuées)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Utilisation des données</h2>
          <p>Les données sont utilisées exclusivement pour :</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Afficher la page publique de la synagogue</li>
            <li>Traiter les messages WhatsApp et mettre à jour les informations</li>
            <li>Assurer la sécurité du service (vérification des numéros autorisés)</li>
          </ul>
          <p className="mt-2">
            Nous n&apos;utilisons pas vos données à des fins publicitaires et ne les
            partageons pas avec des tiers, sauf obligation légale.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Conservation des données</h2>
          <p>
            Les données sont conservées tant que la synagogue utilise le service.
            Sur demande, nous pouvons supprimer l&apos;ensemble des données associées
            à un numéro de téléphone.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification
            et de suppression de vos données. Pour exercer ces droits, contactez-nous
            à l&apos;adresse ci-dessous.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Contact</h2>
          <p>
            Pour toute question relative à la confidentialité :{" "}
            <a
              href="mailto:davidlayani1@gmail.com"
              className="text-primary-700 underline"
            >
              davidlayani1@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
