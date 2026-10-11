// ─────────────────────────────────────────────────────────────────────────────
// Le jeu « Les mots » : les mots invariables, vus puis écrits sous la dictée.
// Aucun accès au DOM : testé avec `node --test`.
//
// Une séance (5 ou 10 mots) a deux temps :
//   1. découverte : chaque mot est montré et lu, un par un (flashcards)
//   2. dictée     : les mêmes mots, dans un autre ordre, on les entend et on les écrit
// La progression utilise les mêmes boîtes que le duel (voir duel-model.js).
// ─────────────────────────────────────────────────────────────────────────────

const Duel = typeof module !== 'undefined' ? require('./duel-model.js') : window.DuelModel;

const CLE_MOTS = 'mots';          // clé de thème dans l'historique des séances
const ECART_REPRISE_MOT = 3;      // un mot raté revient 3 cartes plus loin (une seule fois)

// Les cartes : un mot = une carte. Un mot présent dans deux catégories n'est gardé qu'une fois.
function cartesDeMots(donnees) {
  const vus = new Set();
  const cartes = [];
  for (const cat of donnees.categories) {
    for (const m of cat.mots) {
      if (vus.has(m.mot)) continue;
      vus.add(m.mot);
      cartes.push({ id: 'mot:' + m.mot, mot: m.mot, dit: m.dit || m.mot, categorie: cat.key, groupe: cat.label, officiel: cat.officiel });
    }
  }
  return cartes;
}

// Pour comparer : sans différence de majuscules, d'espaces ni d'apostrophe typographique.
// Les accents, eux, comptent.
function normaliser(texte) {
  return String(texte).normalize('NFC').replace(/[’‘`´]/g, "'").trim().toLowerCase().replace(/\s+/g, ' ');
}

// Compare le mot attendu et ce qui a été écrit. Retourne
//   juste  : true si identiques
//   attendu: les lettres du mot attendu [{ c, ok }] (ok = la lettre est bien dans ce qui a été écrit)
//   ecrit  : les lettres écrites [{ c, ok }] (ok = la lettre est à sa place)
// (plus longue sous-suite commune : une lettre oubliée ou en trop ne décale pas tout)
function comparer(attendu, saisi) {
  const a = Array.from(normaliser(attendu));
  const s = Array.from(normaliser(saisi));
  const t = Array.from({ length: a.length + 1 }, () => new Array(s.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = s.length - 1; j >= 0; j--) {
      t[i][j] = a[i] === s[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    }
  }
  const okA = new Array(a.length).fill(false);
  const okS = new Array(s.length).fill(false);
  let i = 0, j = 0;
  while (i < a.length && j < s.length) {
    if (a[i] === s[j]) { okA[i] = okS[j] = true; i++; j++; }
    else if (t[i + 1][j] >= t[i][j + 1]) i++;
    else j++;
  }
  return {
    juste: a.join('') === s.join(''),
    attendu: a.map((c, k) => ({ c, ok: okA[k] })),
    ecrit: s.map((c, k) => ({ c, ok: okS[k] }))
  };
}

// Un ordre différent de l'ordre de départ (sinon la dictée suivrait les flashcards)
function autreOrdre(cartes, rng = Math.random) {
  if (cartes.length < 2) return cartes.slice();
  for (let essai = 0; essai < 10; essai++) {
    const m = Duel.melanger(cartes, rng);
    if (m.some((c, k) => c.id !== cartes[k].id)) return m;
  }
  return cartes.slice(1).concat(cartes[0]);   // rng bloquée : on décale d'un cran
}

class MotsGame {
  constructor(cartes, progression = {}, rng = Math.random, maintenant = Date.now) {
    this.cartes = cartes.slice();
    this.progression = progression;
    this.rng = rng;
    this.maintenant = maintenant;
    this.phase = cartes.length ? 'decouverte' : 'fini';   // 'decouverte' | 'pret' | 'dictee' | 'fini'
    this.index = 0;
    this.file = this.cartes.slice();       // le paquet courant (la dictée y réinsère les mots ratés)
    this.resultats = new Map();            // id -> true (juste du premier coup) ou false
    this.repris = new Set();
  }

  get base() { return this.cartes.length; }
  get courante() { return this.phase === 'decouverte' || this.phase === 'dictee' ? this.file[this.index] : null; }
  // « mot 3 sur 5 » : dans la dictée, les reprises ne comptent pas
  get numero() {
    return this.phase === 'dictee' ? Math.min(this.resultats.size + 1, this.base) : Math.min(this.index + 1, this.base);
  }

  // Découverte : on passe au mot suivant, puis à l'écran « prêt »
  suivanteDecouverte() {
    if (this.phase !== 'decouverte') return;
    this.index++;
    if (this.index >= this.file.length) this.phase = 'pret';
  }

  // Début de la dictée, dans un autre ordre
  commencerDictee() {
    this.phase = 'dictee';
    this.file = autreOrdre(this.cartes, this.rng);
    this.index = 0;
  }

  // Dictée : le mot écrit. Seul le premier essai compte ; un mot raté revient un peu plus loin.
  repondre(saisie) {
    const carte = this.courante;
    if (this.phase !== 'dictee' || !carte) return null;
    const comparaison = comparer(carte.mot, saisie);
    const premierEssai = !this.resultats.has(carte.id);
    if (premierEssai) {
      this.resultats.set(carte.id, comparaison.juste);
      this.progression = Duel.enregistrer(this.progression, carte.id, comparaison.juste, this.maintenant());
      if (!comparaison.juste && !this.repris.has(carte.id)) {
        this.repris.add(carte.id);
        this.file.splice(Math.min(this.index + 1 + ECART_REPRISE_MOT, this.file.length), 0, carte);
      }
    }
    return { juste: comparaison.juste, premierEssai, attendu: carte.mot, comparaison };
  }

  suivante() {
    if (this.phase !== 'dictee') return;
    this.index++;
    if (this.index >= this.file.length) this.phase = 'fini';
  }

  get fini() { return this.phase === 'fini'; }

  // Bilan : mots justes du premier coup, et mots à revoir (même forme que le duel)
  bilan() {
    const justes = this.cartes.filter(c => this.resultats.get(c.id) === true).length;
    return { total: this.base, justes, sansAide: justes, aRevoir: this.cartes.filter(c => this.resultats.get(c.id) === false) };
  }
}

if (typeof module !== 'undefined') {
  module.exports = { CLE_MOTS, cartesDeMots, normaliser, comparer, autreOrdre, MotsGame };
} else {
  window.MotsModel = { CLE_MOTS, cartesDeMots, normaliser, comparer, autreOrdre, MotsGame };
}
