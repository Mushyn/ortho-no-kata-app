// ─────────────────────────────────────────────────────────────────────────────
// La mini-dictée : une dictée de 3 phrases = 3 cartes. On entend une phrase, on
// l'écrit, puis on corrige avec les contextes et les astuces du thème.
// Aucun accès au DOM : testé avec `node --test`.
//
// Dans les données, les points à surveiller sont balisés dans la phrase :
//   {mot|famille}            point corrigé par un texte (voir "astuces")
//   {mot|famille|autre}      point corrigé par un test de remplacement : "autre" est
//                            l'autre mot possible (a / à, on / ont...). La famille vient
//                            de phrases-v1.json ou de "regles" dans le fichier des dictées.
// ─────────────────────────────────────────────────────────────────────────────

const DuelDict = typeof module !== 'undefined' ? require('./duel-model.js') : window.DuelModel;
const ReglesDict = typeof module !== 'undefined' ? require('./rules.js') : window.Regles;

const ECART_REPRISE_PHRASE = 3;     // une phrase ratée revient 3 cartes plus loin (une seule fois)
const NIVEAU_SUIVANT_ETOILES = 2;   // étoiles à avoir dans un niveau pour débloquer le suivant
const MOTIF = /\{([^|}]+)\|([^|}]+)(?:\|([^}]+))?\}/g;

function cleDeThemeDictee(niveau) { return 'dictee:' + niveau; }

// "Mon château {est|et_est_es|et} haut." -> le texte propre et la liste des points (avec leur place)
function lireBalises(source) {
  let texte = '';
  let reste = 0;
  const points = [];
  for (const m of source.matchAll(MOTIF)) {
    texte += source.slice(reste, m.index);
    const debut = texte.length;
    texte += m[1];
    points.push({ mot: m[1], famille: m[2], autre: m[3] || null, debut, fin: texte.length });
    reste = m.index + m[0].length;
  }
  texte += source.slice(reste);
  return { texte, points };
}

// Le contexte et l'astuce d'un point, pour CETTE phrase
function correctionDe(donnees, familles, texte, point) {
  const astuce = donnees.astuces && donnees.astuces[point.famille];
  if (astuce) return { type: 'texte', theme: astuce.theme, lignes: astuce.lignes, sources: astuce.sources };
  // Test de remplacement : on réutilise les règles du duel (rules.js)
  const famille = familles[point.famille];
  if (!famille) throw new Error('Famille inconnue : ' + point.famille + ' (' + texte + ')');
  // -er / -é : l'autre mot s'en déduit (regarder / regardé)
  if (!point.autre && famille.witnessPair) point.autre = point.mot.endsWith('er') ? point.mot.slice(0, -2) + 'é' : point.mot.slice(0, -1) + 'er';
  if (!point.autre) throw new Error('Il manque l\'autre mot possible pour « ' + point.mot + ' » dans : ' + texte);
  const item = { id: 'point', family: point.famille, text: texte.slice(0, point.debut) + '___' + texte.slice(point.fin), choices: [point.mot, point.autre], answer: point.mot };
  const carte = ReglesDict.carteDe({ blank: '___', families: familles, items: [] }, item);
  return { type: 'test', theme: carte.theme, question: carte.question, tests: carte.tests, conclusion: carte.conclusion, truc: carte.truc.texte, rule: carte.rule, sources: (familles[point.famille].sources || []) };
}

// Les niveaux, leurs dictées, leurs cartes (une carte = une phrase)
//   donnees : le fichier des dictées ; phrases : le fichier phrases-v1.json (pour les familles)
function niveauxDe(donnees, phrases) {
  const familles = Object.assign({}, phrases.families, donnees.regles);
  return donnees.niveaux.map(niveau => {
    const dictees = niveau.dictees.map(dictee => {
      const cartes = dictee.phrases.map((source, i) => {
        const { texte, points } = lireBalises(source);
        return {
          id: dictee.id + '-' + (i + 1), niveau: niveau.key, dicteeId: dictee.id, titre: dictee.titre, objectif: dictee.objectif,
          texte, points: points.map(p => Object.assign(p, { correction: correctionDe(donnees, familles, texte, p) }))
        };
      });
      return { id: dictee.id, titre: dictee.titre, objectif: dictee.objectif, cartes };
    });
    return { key: niveau.key, label: niveau.label, dictees, cartes: dictees.flatMap(d => d.cartes) };
  });
}

// ── Dicter : comme à l'école, la ponctuation est dite à voix haute ─────────
// « Demain, nous irons. » devient « Demain, virgule, nous irons, point. »
const PONCTUATION_DITE = {
  ',': ', virgule, ', '.': ', point. ', '?': ", point d'interrogation. ",
  '!': ", point d'exclamation. ", ':': ', deux points, ', ';': ', point-virgule, ',
  '\u00ab': ', ouvrez les guillemets, ', '\u00bb': ', fermez les guillemets, '
};
function dicter(texte) {
  const propre = String(texte).normalize('NFC').replace(/[\u2019\u2018`\u00b4]/g, "'");
  return propre.replace(/\s*([,.?!:;\u00ab\u00bb])\s*/g, (m, signe) => PONCTUATION_DITE[signe]).trim();
}

// ── Comparaison mot à mot ──────────────────────────────────────────────────
// Un mot = des lettres (avec l'apostrophe qui les suit : « l' », « qu' »), un signe de ponctuation = un mot.
// Les majuscules et les accents comptent ; les espaces autour de la ponctuation, non.
// Le « œ » est difficile à taper : « oe » est accepté à sa place (sœur = soeur), dans le texte attendu comme dans la saisie
function sansLigature(texte) { return texte.replace(/\u0153/g, 'oe').replace(/\u0152/g, 'Oe').replace(/\u00e6/g, 'ae').replace(/\u00c6/g, 'Ae'); }
function decouper(texte) {
  const propre = String(texte).normalize('NFC').replace(/[’‘`´]/g, "'");
  return Array.from(propre.matchAll(/[\p{L}\p{N}-]+'?|[^\s\p{L}\p{N}]/gu)).map(m => ({ t: m[0], c: sansLigature(m[0]), debut: m.index, fin: m.index + m[0].length }));
}

function comparerPhrase(attendu, saisi) {
  const a = decouper(attendu);
  const s = decouper(saisi);
  const t = Array.from({ length: a.length + 1 }, () => new Array(s.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = s.length - 1; j >= 0; j--) {
      t[i][j] = a[i].c === s[j].c ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    }
  }
  const okA = new Array(a.length).fill(false);
  const okS = new Array(s.length).fill(false);
  let i = 0, j = 0;
  while (i < a.length && j < s.length) {
    if (a[i].c === s[j].c) { okA[i] = okS[j] = true; i++; j++; }
    else if (t[i + 1][j] >= t[i][j + 1]) i++;
    else j++;
  }
  return {
    juste: a.length === s.length && okA.every(Boolean),
    // juste, mais « oe » écrit à la place de « œ » : remarque non bloquante
    ligature: a.length === s.length && okA.every(Boolean) && /[\u0153\u00e6]/i.test(attendu) && !/[\u0153\u00e6]/i.test(saisi),
    attendu: a.map((x, k) => Object.assign({}, x, { ok: okA[k] })),
    ecrit: s.map((x, k) => Object.assign({}, x, { ok: okS[k] }))
  };
}

// Qu'est-ce qui est faux, point par point ?
//   points : les points de la phrase dont un mot est faux ou manquant
//   autres : les mots faux hors des points (texte attendu), pour un message plus simple
function erreursDe(carte, comparaison) {
  const fauxTokens = comparaison.attendu.filter(x => !x.ok);
  const points = carte.points.filter(p => fauxTokens.some(x => x.debut >= p.debut && x.debut < p.fin));
  const autres = fauxTokens.filter(x => !carte.points.some(p => x.debut >= p.debut && x.debut < p.fin)).map(x => x.t);
  return { points, autres };
}

// ── Choix de la dictée, déblocage des niveaux ───────────────────────────────
// La dictée dont les phrases sont le moins bien sues (jamais faites d'abord), au hasard à égalité
function choisirDictee(dictees, progression, rng = Math.random) {
  const notes = DuelDict.melanger(dictees, rng).map((d, rang) => ({
    d, rang, note: d.cartes.reduce((n, c) => n + DuelDict.boiteDe(progression, c.id), 0)
  }));
  notes.sort((x, y) => x.note - y.note || x.rang - y.rang);
  return notes[0].d;
}

// Pour l'accueil : pour chaque niveau, sa maîtrise, ses étoiles, et s'il est ouvert
function etatDesNiveaux(niveaux, progression, historique) {
  let precedentOk = true;
  return niveaux.map(niveau => {
    const m = DuelDict.maitrise(niveau.cartes, progression);
    const etoiles = DuelDict.etoilesDe(m, DuelDict.seancesDuTheme(historique, cleDeThemeDictee(niveau.key)));
    const etat = { niveau, maitrise: m, etoiles, debloque: precedentOk };
    precedentOk = precedentOk && etoiles >= NIVEAU_SUIVANT_ETOILES;
    return etat;
  });
}

// ── La séance : une dictée, phrase par phrase ───────────────────────────────
class DicteeGame {
  constructor(dictee, progression = {}, maintenant = Date.now) {
    this.dictee = dictee;
    this.cartes = dictee.cartes.slice();
    this.file = this.cartes.slice();
    this.progression = progression;
    this.maintenant = maintenant;
    this.phase = 'intro';              // 'intro' | 'dictee' | 'fini'
    this.index = 0;
    this.resultats = new Map();        // id -> true (juste du premier coup) ou false
    this.repris = new Set();
  }

  get base() { return this.cartes.length; }
  get courante() { return this.phase === 'dictee' ? this.file[this.index] : null; }
  get numero() { return Math.min(this.resultats.size + 1, this.base); }
  get fini() { return this.phase === 'fini'; }

  commencer() { if (this.phase === 'intro') this.phase = 'dictee'; }

  // Seul le premier essai compte ; une phrase ratée revient un peu plus loin
  repondre(saisie) {
    const carte = this.courante;
    if (!carte) return null;
    const comparaison = comparerPhrase(carte.texte, saisie);
    const premierEssai = !this.resultats.has(carte.id);
    if (premierEssai) {
      this.resultats.set(carte.id, comparaison.juste);
      this.progression = DuelDict.enregistrer(this.progression, carte.id, comparaison.juste, this.maintenant());
      if (!comparaison.juste && !this.repris.has(carte.id)) {
        this.repris.add(carte.id);
        this.file.splice(Math.min(this.index + 1 + ECART_REPRISE_PHRASE, this.file.length), 0, carte);
      }
    }
    return { juste: comparaison.juste, premierEssai, comparaison, erreurs: erreursDe(carte, comparaison) };
  }

  suivante() {
    if (this.phase !== 'dictee') return;
    this.index++;
    if (this.index >= this.file.length) this.phase = 'fini';
  }

  bilan() {
    const justes = this.cartes.filter(c => this.resultats.get(c.id) === true).length;
    return { total: this.base, justes, sansAide: justes, aRevoir: this.cartes.filter(c => this.resultats.get(c.id) === false) };
  }
}

if (typeof module !== 'undefined') {
  module.exports = { cleDeThemeDictee, lireBalises, niveauxDe, dicter, decouper, comparerPhrase, erreursDe, choisirDictee, etatDesNiveaux, DicteeGame, NIVEAU_SUIVANT_ETOILES };
} else {
  window.DicteesModel = { cleDeThemeDictee, lireBalises, niveauxDe, dicter, decouper, comparerPhrase, erreursDe, choisirDictee, etatDesNiveaux, DicteeGame, NIVEAU_SUIVANT_ETOILES };
}
