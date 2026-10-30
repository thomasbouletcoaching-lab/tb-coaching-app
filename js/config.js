// Réglages publics de TB my Coach (aucun secret ici : ce fichier est visible de tous).
export const CONFIG = {
  coachName: "Thomas Boulet",
  coachTitle: "Coach diplômé STAPS · Paris",
  calendly: "https://calendly.com/thomboulet/appel-de-check-in-avec-ton-coach",
  instagram: "",
  email: "",
  supabaseUrl: "https://xtapitojdvicgcaygeqj.supabase.co",
  supabaseKey: "sb_publishable_c1EzH7XuWPwsCizxuFCUTg_G3Z82B_M",
};

// Les formules. Les liens de paiement Stripe se collent dans `pay` quand ils sont prêts.
// Les identifiants (free, premium, essentiel, suivi, avance, surmesure) sont ceux du serveur : ne pas les changer.
// Prix pensés pour la conversion : .99 sur l'app (achat d'impulsion), prix ronds sur le coaching (prestige),
// une offre d'ancrage en haut (Élite, places limitées) pour rendre l'offre du milieu évidente, l'annuel très avantageux.
export const TRIAL_DAYS = 7;
export const OFFERS = [
  { id: "free", rank: 0, name: "Gratuit", price: "0 €", per: "", msgs: "Messages avec Thomas réservés aux coachés",
    tagline: "L'essentiel, pour toujours.",
    feats: ["Apprendre : tous les chapitres de base", "Journal alimentaire : calories, macros, fibres, base Ciqual et produits de marque", "Carnet de séance, minuteur, séances libres", "6 programmes complets : reprise, débutant salle, maison, dos, street workout"] },
  { id: "premium", rank: 1, name: "Bâtisseur", price: "14,99 €", per: "/mois", alt: "ou 99,99 € par an, soit 5 mois offerts", msgs: "Messages avec Thomas : avec le coaching",
    tagline: "L'app complète, pour avancer seul avec ma méthode.", ribbon: "7 jours d'essai offerts",
    feats: ["Tout le Gratuit", "Les 111 programmes (salle, maison, street, force, femmes, parents, santé) et les cycles de 12 semaines", "Charges calculées et surcharge progressive selon ton RPE, alertes plateau et blessure", "Plan alimentaire selon ton profil, ton régime et ton nombre de repas, modifiable au gramme", "Recettes, batch cooking, liste de courses et budget par magasin", "Vitamines, minéraux et compléments : ce qu'il te faut, à quelle dose", "Bilan énergétique, statistiques, photos et mensurations", "Créer et modifier tes propres programmes"],
    pay: { month: "", year: "" } },
  { id: "essentiel", rank: 2, name: "Fraternité", price: "59 €", per: "/mois", msgs: "10 messages par semaine",
    tagline: "Avancer avec d'autres hommes, et un coach qui garde un œil sur toi.",
    feats: ["Tout Bâtisseur", "Le groupe privé des bâtisseurs : entraide et défis", "Un live questions-réponses par mois avec Thomas", "2 corrections vidéo de ta technique par mois", "Bilan mensuel commenté", "Version experte des connaissances et module maillons faibles"] },
  { id: "suivi", rank: 3, name: "Coaching Essentiel", price: "99 €", per: "/mois", msgs: "20 messages par semaine",
    tagline: "Ton programme et ton plan, écrits pour toi.",
    feats: ["Tout Fraternité", "Programme 100 % sur mesure : ta semaine, ta salle ou ta maison", "Plan alimentaire selon tes goûts et ton budget de courses", "Bilan chaque semaine, ajustements chaque mois", "Réponse sous 24 h"] },
  { id: "avance", rank: 4, name: "Coaching personnalisé", price: "Sur candidature", per: "", msgs: "Messages avec Thomas, réponse sous 24 h",
    tagline: "Ton programme et ta technique, suivis de près par Thomas.", ribbon: "Sur candidature",
    feats: ["Tout le Coaching Essentiel", "Corrections vidéo illimitées", "Ajustements chaque semaine", "Un appel visio de 30 min par mois", "Suivi global de ta progression"] },
  { id: "surmesure", rank: 5, name: "Coaching Élite", price: "339 €", per: "/mois", msgs: "Messages et vocaux illimités, réponse prioritaire",
    tagline: "Le mentorat complet. Je ne prends que 5 hommes à la fois.",
    feats: ["Tout le Coaching Proximité", "Disponibilité quasi directe (vocaux prioritaires)", "Un appel toutes les 2 semaines", "Nutrition revue au détail, adaptée à chaque imprévu", "Une séance en salle offerte (Paris)"] },
];
// Comparatif des offres : [ligne, gratuit, Bâtisseur, Fraternité, coaching]
export const COMPARE = [
  ["Apprendre (chapitres de base)", "✓", "✓", "✓", "✓"], ["Journal alimentaire et carnet", "✓", "✓", "✓", "✓"],
  ["Programmes", "6", "111", "111", "Sur mesure"], ["Surcharge progressive automatique", "–", "✓", "✓", "✓"], ["Plan alimentaire, recettes, courses", "–", "✓", "✓", "Sur mesure"],
  ["Micronutriments et compléments", "–", "✓", "✓", "✓"], ["Stats, photos, bilan énergétique", "–", "✓", "✓", "✓"], ["Groupe, live, corrections vidéo", "–", "–", "✓", "✓"],
  ["Connaissances version experte", "–", "–", "✓", "✓"], ["Bilans par Thomas", "–", "–", "Mensuel", "Hebdo"], ["Messages avec Thomas", "–", "–", "10 / sem.", "20+ / sem."],
];
// Ce qui est proposé à la vente dans l'app : Gratuit, Bâtisseur, et le coaching personnalisé sur candidature.
// Les autres formules restent dans la base (le coach peut les attribuer) mais ne sont plus affichées.
export const PUBLIC_OFFERS = OFFERS.filter(o => ["free", "premium", "avance"].includes(o.id));
export const offer = (id) => OFFERS.find(o => o.id === id) || OFFERS[0];
export const MSGS_PER_WEEK = { free: 0, premium: 0, essentiel: 10, suivi: 20, avance: 50, surmesure: null };
// Programmes accessibles sans Premium
export const ALL_FREE = false; // fin de la phase de test : essai de 7 jours, puis Gratuit ou Bâtisseur
export const FREE_PROGRAMS = ["tb-rep2", "tb-rep3", "bk-home-rien-30", "bk-sa-dos3-30", "bk-sw-deb3", "bk-bb-fbdeb3-45"];
export const FREE_WEEKS = 4;
export const FREE_FAVORITES = 5;
