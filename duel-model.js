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
        question: carte.question, rule: carte.rule, cartes: []
      });
    }
    themes.get(carte.themeKey).cartes.push(carte);
  }
  return [...themes.values()];
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
  }

  get fini() { return this.index >= this.file.length; }
  get courante() { return this.fini ? null : this.file[this.index]; }
  // numéro affiché "carte 3 sur 5" : nombre de cartes déjà jugées + 1 (les reprises ne comptent pas)
  get numero() { return Math.min(this.resultats.size + 1, this.base); }

  estPremierEssai() { return !!this.courante && !this.resultats.has(this.courante.id); }

  // Les options de la carte en cours. Pour les cartes "choisir", l'ordre est mélangé
  // pour que la place du bouton ne donne pas la réponse ; pour "juger", l'ordre reste fixe.
  options() {
    const c = this.courante;
    if (!c) return [];
    if (!this._ordre || this._ordre.id !== c.id) {
      this._ordre = { id: c.id, options: c.kind === 'choisir' ? melanger(c.options, this.rng) : c.options.slice() };
    }
    return this._ordre.options;
  }

  // L'enfant répond avec une option. Pas de sanction : seul le premier essai compte
  // pour la progression, et une erreur fait revenir la carte un peu plus loin.
  // Retourne { juste, premierEssai, reponse, phrase }
  repondre(option) {
    const carte = this.courante;
    if (!carte) return null;
    const juste = option.value === carte.answer;
    const premierEssai = !this.resultats.has(carte.id);
    if (premierEssai) {
      this.resultats.set(carte.id, juste);
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
      aRevoir: ids.filter(id => !this.resultats.get(id)).map(id => parId.get(id))
    };
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    BOITE_MAX, BOITE_ACQUISE, ECART_REPRISE,
    toutesLesCartes, themesDe, melanger, boiteDe, choisirSeance, enregistrer, maitrise, DuelGame
  };
} else {
  window.DuelModel = { toutesLesCartes, themesDe, melanger, boiteDe, choisirSeance, enregistrer, maitrise, DuelGame, BOITE_ACQUISE };
}
