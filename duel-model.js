// ─────────────────────────────────────────────────────────────────────────────
// Jeu « Duel » : le MODÈLE (règles du jeu). Aucun accès au DOM ici.
//
// Même idée que lecture-model.js dans Kana no Katas : ce fichier ne sait pas
// dessiner. Il répond à des questions comme « quelles cartes dans la séance ? »,
// « cette réponse est-elle juste ? », « où en est la progression ? ».
// On peut tout tester dans un terminal : node --test tests/
//
// Vocabulaire :
//   - une CARTE est une question (voir rules.js, carteDe)
//   - un THÈME regroupe les cartes qui se règlent avec la même astuce
//     (par exemple « a ou à », « es ou est »)
//   - la SÉANCE est le petit lot de cartes travaillé d'un coup (5 par défaut)
//   - la PROGRESSION est un objet { idCarte: { box, ok, err, last } }
//     box va de 1 à 5 (boîtes de Leitner) ; une carte jamais vue n'y figure pas
// ─────────────────────────────────────────────────────────────────────────────

const BOITE_MAX = 5;        // boîte où une carte est considérée comme acquise de façon solide
const BOITE_ACQUISE = 4;    // à partir d'ici, on compte la carte comme "acquise" dans les barres
const ECART_REPRISE = 3;    // une carte ratée revient 3 cartes plus loin (une seule fois)

// Charge les règles depuis rules.js, que l'on soit dans Node ou dans le navigateur
const RegleJeu = (typeof module !== 'undefined') ? require('./rules.js') : window.Regles;

// Toutes les cartes du fichier de phrases
function toutesLesCartes(donnees) {
  return donnees.items.map(item => RegleJeu.carteDe(donnees, item));
}

// Les thèmes, dans l'ordre du fichier : [{ key, family, theme, question, rule, cartes }]
function themesDe(cartes) {
  const themes = new Map();
  for (const carte of cartes) {
    if (!themes.has(carte.themeKey)) {
      themes.set(carte.themeKey, {
        key: carte.themeKey, family: carte.family, theme: carte.theme,
        question: carte.question, rule: carte.rule, majeure: carte.majeure, ordre: carte.ordre, cartes: []
      });
    }
    themes.get(carte.themeKey).cartes.push(carte);
  }
  // tri stable : par ordre de priorité, puis ordre du fichier
  return [...themes.values()].map((t, rang) => ({ t, rang }))
    .sort((a, b) => a.t.ordre - b.t.ordre || a.rang - b.rang).map(x => x.t);
}

// Mélange de Fisher-Yates : renvoie une copie mélangée.
// `rng` rend un nombre entre 0 et 1 (Math.random par défaut) ; les tests en passent une fausse.
function melanger(liste, rng = Math.random) {
  const a = liste.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// La boîte d'une carte : 0 si elle n'a jamais été vue
function boiteDe(progression, id) {
  return (progression[id] && progression[id].box) || 0;
}

// Les cartes de la séance : on travaille d'abord les cartes les moins connues
// (jamais vues = boîte 0, puis boîte 1, 2...). À boîte égale, ordre aléatoire.
//   cartes : les cartes parmi lesquelles piocher (un thème, ou tous)
//   nombre : taille de la séance
function choisirSeance(cartes, progression, nombre, rng = Math.random) {
  const melangees = melanger(cartes, rng);
  // tri stable : à boîte égale, l'ordre mélangé est conservé
  const triees = melangees
    .map((carte, rang) => ({ carte, rang, boite: boiteDe(progression, carte.id) }))
    .sort((a, b) => a.boite - b.boite || a.rang - b.rang)
    .map(x => x.carte);
  // la séance finale est remélangée : on ne voit pas "les plus faibles d'abord" dans l'ordre
  return melanger(triees.slice(0, nombre), rng);
}

// Nouvelle progression après une réponse (sans modifier l'ancienne)
//   juste : true si la réponse était bonne DU PREMIER COUP
function enregistrer(progression, id, juste, maintenant = Date.now()) {
  const avant = progression[id] || { box: 0, ok: 0, err: 0 };
  // juste : on monte d'une boîte (une carte nouvelle réussie va en boîte 2) ; ratée : retour en boîte 1
  const box = juste ? Math.min(BOITE_MAX, Math.max(1, avant.box) + 1) : 1;
  return Object.assign({}, progression, {
    [id]: { box, ok: avant.ok + (juste ? 1 : 0), err: avant.err + (juste ? 0 : 1), last: maintenant }
  });
}

// Où en est-on sur un ensemble de cartes ?
//   { total, vues, acquises }
function maitrise(cartes, progression) {
  let vues = 0, acquises = 0;
  for (const carte of cartes) {
    const b = boiteDe(progression, carte.id);
    if (b > 0) vues++;
    if (b >= BOITE_ACQUISE) acquises++;
  }
  return { total: cartes.length, vues, acquises };
}


// ── Scores : historique des séances, points, série de jours, étoiles ─────────
// L'historique est une liste de { t, theme, justes, total } (t = heure en ms).
// Rien ne se perd jamais : on gagne des points, on n'en retire pas.
const POINTS_PAR_REPONSE = 10;     // une réponse juste du premier coup
const HISTORIQUE_MAX = 1000;

// Numéro du jour (heure locale) : deux séances le même jour donnent le même numéro
function jourLocal(t) {
  return Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / 86400000);
}

function enregistrerSeance(historique, entree) {
  return historique.concat([entree]).slice(-HISTORIQUE_MAX);
}

function pointsTotal(historique) {
  return historique.reduce((n, s) => n + (s.sansAide === undefined ? s.justes : s.sansAide) * POINTS_PAR_REPONSE, 0);
}

// Nombre de jours d'affilée avec au moins une séance, en comptant jusqu'à aujourd'hui.
// Si on n'a pas encore joué aujourd'hui, la série d'hier reste en vie.
function serieDeJours(historique, maintenant = Date.now()) {
  const jours = new Set(historique.map(s => jourLocal(s.t)));
  let jour = jourLocal(maintenant);
  if (!jours.has(jour)) jour--;
  let serie = 0;
  while (jours.has(jour)) { serie++; jour--; }
  return serie;
}

function seancesDuTheme(historique, cle) {
  return historique.filter(s => s.theme === cle).length;
}

// Les étoiles d'un thème (0 à 3) : 1 dès qu'on y a joué, 2 à moitié acquis, 3 à 90 % acquis
function etoilesDe(m, nbSeances) {
  if (m.vues === 0 && nbSeances === 0) return 0;
  const part = m.total ? m.acquises / m.total : 0;
  if (part >= 0.9) return 3;
  if (part >= 0.5) return 2;
  return 1;
}

// Le thème à proposer en premier : le moins avancé ; à étoiles égales, ceux à travailler en priorité
function themeSuggere(themes, progression, historique) {
  const notes = themes.map((theme, rang) => {
    const m = maitrise(theme.cartes, progression);
    return { theme, rang, etoiles: etoilesDe(m, seancesDuTheme(historique, theme.key)), part: m.total ? m.acquises / m.total : 0 };
  });
  notes.sort((a, b) => a.etoiles - b.etoiles || (b.theme.majeure - a.theme.majeure) || a.part - b.part || a.rang - b.rang);
  return notes[0].theme;
}

// ── La leçon : l'astuce expliquée avant de jouer ────────────────────────────
// Entièrement tirée des données du thème (même astuce, mêmes phrases que le jeu) :
// aucune règle n'est écrite à part.
function plusCourte(cartes) {
  return cartes.slice().sort((a, b) => a.text.length - b.text.length)[0];
}

function leconDe(theme) {
  const premiere = theme.cartes[0];
  if (premiere.kind === 'choisir') {
    const exemples = Object.keys(premiere.paire).map(fin => {
      const carte = plusCourte(theme.cartes.filter(c => c.answer.endsWith('er') === (fin === 'er')));
      return { carte, reponse: carte.answer, options: carte.options.map(o => ({ label: o.label, mot: o.mot, juste: o.value === carte.answer })) };
    });
    return {
      theme: theme.theme, mode: 'choisir', question: theme.question, rule: theme.rule,
      paire: Object.entries(premiere.paire).map(([fin, mot]) => ({ mot, fin: '-' + fin })),
      exemples
    };
  }
  const oui = premiere.options[0].value;
  const non = premiere.options[1].value;
  const exemples = [oui, non].map(mot => {
    const carte = plusCourte(theme.cartes.filter(c => c.answer === mot));
    return { carte, reponse: mot, juste: mot === oui, test: carte.temoin, mot: carte.temoinMot };
  });
  return { theme: theme.theme, mode: 'juger', question: theme.question, rule: theme.rule, mot: premiere.temoinMot, oui, non, exemples };
}

class DuelGame {
  // cartes : les cartes de la séance, dans l'ordre ; progression : l'état avant la séance
  constructor(cartes, progression = {}, rng = Math.random, maintenant = Date.now) {
    this.file = cartes.slice();         // les cartes à poser (une carte ratée y est réinsérée)
    this.base = cartes.length;          // nombre de cartes de la séance, sans les reprises
    this.progression = progression;
    this.rng = rng;
    this.maintenant = maintenant;
    this.index = 0;                     // position dans la file
    this.resultats = new Map();         // id -> true (juste du premier coup) ou false
    this.repris = new Set();            // ids déjà réinsérés
    this.aides = new Set();             // ids pour lesquels le coup de pouce a été demandé
  }

  get fini() { return this.index >= this.file.length; }
  get courante() { return this.fini ? null : this.file[this.index]; }
  // numéro affiché "carte 3 sur 5" : nombre de cartes déjà jugées + 1 (les reprises ne comptent pas)
  get numero() { return Math.min(this.resultats.size + 1, this.base); }

  estPremierEssai() { return !!this.courante && !this.resultats.has(this.courante.id); }

  // Les deux mots entre lesquels l'enfant choisit (a / à...), dans un ordre mélangé
  // pour que la place du bouton ne donne pas la réponse.
  options() {
    const c = this.courante;
    if (!c) return [];
    if (!this._ordre || this._ordre.id !== c.id) {
      this._ordre = { id: c.id, options: melanger(c.choix, this.rng).map(mot => ({ label: mot, value: mot })) };
    }
    return this._ordre.options;
  }

  // L'enfant répond avec une option. Pas de sanction : seul le premier essai compte
  // pour la progression, et une erreur fait revenir la carte un peu plus loin.
  //   aide : true s'il a demandé le coup de pouce avant de répondre (la réponse compte,
  //          mais sans les points)
  // Retourne { juste, premierEssai, reponse, phrase }
  repondre(option, aide = false) {
    const carte = this.courante;
    if (!carte) return null;
    const juste = option.value === carte.answer;
    const premierEssai = !this.resultats.has(carte.id);
    if (premierEssai) {
      this.resultats.set(carte.id, juste);
      if (aide) this.aides.add(carte.id);
      this.progression = enregistrer(this.progression, carte.id, juste, this.maintenant());
      if (!juste && !this.repris.has(carte.id)) {
        this.repris.add(carte.id);
        const place = Math.min(this.index + 1 + ECART_REPRISE, this.file.length);
        this.file.splice(place, 0, carte);
      }
    }
    return { juste, premierEssai, reponse: carte.answer, phrase: carte.complete };
  }

  suivante() { if (!this.fini) { this.index++; } }

  // Bilan de la séance : cartes justes du premier coup, et cartes à revoir
  bilan() {
    const ids = [...this.resultats.keys()];
    const parId = new Map(this.file.map(c => [c.id, c]));
    return {
      total: ids.length,
      justes: ids.filter(id => this.resultats.get(id)).length,
      sansAide: ids.filter(id => this.resultats.get(id) && !this.aides.has(id)).length,
      aRevoir: ids.filter(id => !this.resultats.get(id)).map(id => parId.get(id))
    };
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    BOITE_MAX, BOITE_ACQUISE, ECART_REPRISE,
    POINTS_PAR_REPONSE, jourLocal, enregistrerSeance, pointsTotal, serieDeJours, seancesDuTheme, etoilesDe, themeSuggere, leconDe,
    toutesLesCartes, themesDe, melanger, boiteDe, choisirSeance, enregistrer, maitrise, DuelGame
  };
} else {
  window.DuelModel = { toutesLesCartes, themesDe, melanger, boiteDe, choisirSeance, enregistrer, maitrise, DuelGame, BOITE_ACQUISE,
    POINTS_PAR_REPONSE, jourLocal, enregistrerSeance, pointsTotal, serieDeJours, seancesDuTheme, etoilesDe, themeSuggere, leconDe };
}
