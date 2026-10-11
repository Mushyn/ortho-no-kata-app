// ─────────────────────────────────────────────────────────────────────────────
// Les RÈGLES : à partir d'une phrase à trou, quel est le thème, quelle est
// l'astuce (la question posée), et quelle(s) phrase(s) "témoin" montrer.
//
// Aucun accès au DOM ici : ce fichier sert à la fois à l'appli (navigateur),
// au script de contrôle des phrases et aux tests (Node).
//
// Principe (voir TRUCS.md, section A) : l'appli met elle-même le mot témoin dans
// la phrase. L'enfant n'a qu'un geste : juger "ça sonne juste ?".
// ─────────────────────────────────────────────────────────────────────────────

// Les règles qui s'appliquent à un item : thème, question, témoin...
// Une famille peut avoir des "variants" selon la paire de choix (et/est ou es/est).
// Retourne null si la famille a des variants et que la paire de choix n'en a pas.
function reglesDe(donnees, item) {
  const famille = donnees.families[item.family];
  if (!famille) return null;
  const cle = item.choices.slice().sort().join('|');
  const variante = famille.variants && famille.variants[cle];
  if (famille.variants && !variante) return null;
  const theme = (variante && variante.theme) || famille.theme || item.choices.join(' ou ');
  return Object.assign({}, famille, variante || {}, { theme });
}

// La phrase avec le trou remplacé par un mot
function remplir(donnees, item, mot) {
  return item.text.replace(donnees.blank, mot);
}

// Les phrases "témoin" d'un item et, pour chacune, si elle est correcte.
//   - famille -er / -é : deux phrases (mordre et mordu), une seule est correcte
//   - autres familles : une phrase, correcte si la réponse fait partie de "confirms"
function testsDeLItem(donnees, item) {
  const regles = reglesDe(donnees, item);
  if (regles.witnessPair) {
    const finit = item.answer.endsWith('er') ? 'er' : 'é';
    return Object.entries(regles.witnessPair).map(([fin, mot]) => ({
      phrase: remplir(donnees, item, mot),
      mot,
      juste: fin === finit,
      valeur: item.choices.find(c => (fin === 'er') === c.endsWith('er'))
    }));
  }
  const mot = (regles.witnessByAnswer && regles.witnessByAnswer[item.answer]) || regles.witness;
  return [{
    phrase: remplir(donnees, item, mot),
    mot,
    juste: regles.confirms.includes(item.answer),
    valeur: null
  }];
}

// La CARTE : tout ce dont l'écran a besoin pour poser une question.
//   kind 'juger' : une phrase témoin, deux boutons "Oui, ça sonne juste" / "Non"
//   kind 'choisir' : deux phrases témoin, on touche celle qui sonne juste
//   options : [{ label, value }] ; value est le mot (parmi item.choices) que ce geste désigne
function carteDe(donnees, item) {
  const regles = reglesDe(donnees, item);
  const base = {
    id: item.id,
    family: item.family,
    theme: regles.theme,
    themeKey: item.family + ':' + regles.theme,
    question: regles.question,
    rule: regles.rule || null,
    lecon: regles.lecon || null,
    majeure: !!regles.majeure,
    ordre: regles.ordre || 99,
    paire: regles.witnessPair || null,
    ecrit: !!regles.ecrit,   // témoin qui se juge à l'écrit (l'oreille ne distingue pas : es / est)
    text: item.text,
    complete: remplir(donnees, item, item.answer),
    choices: item.choices.slice(),
    answer: item.answer
  };

  // Ce qu'on montre APRÈS la réponse (ou en coup de pouce) : l'astuce appliquée à CETTE phrase
  const tests = testsDeLItem(donnees, item);
  base.choix = item.choices.slice();       // les deux mots entre lesquels l'enfant choisit
  base.tests = tests.map(t => ({ phrase: t.phrase, mot: t.mot, juste: t.juste }));
  if (regles.witnessPair) {
    const bon = tests.find(t => t.juste);
    const mots = Object.values(regles.witnessPair);
    base.truc = {
      mots,
      texte: 'Je dis la phrase avec « ' + mots[0] + ' », puis avec « ' + mots[1] + ' ». Celle qui sonne juste me donne la fin du mot : « ' +
        Object.entries(regles.witnessPair).map(([fin, mot]) => mot + ' » = -' + fin).join(', « ') + '.'
    };
    base.conclusion = '« ' + bon.mot + ' » sonne juste : on écrit « ' + item.answer + ' ».';
    const options = tests.map(t => ({ label: t.phrase, mot: t.mot, value: t.valeur }));
    return Object.assign(base, { kind: 'choisir', options });
  }
  const ouiMot = item.choices.find(c => regles.confirms.includes(c));
  const nonMot = item.choices.find(c => !regles.confirms.includes(c));
  base.truc = {
    mots: [tests[0].mot],
    texte: 'Je mets « ' + tests[0].mot + ' » à la place du trou et je lis la phrase. ' + (regles.ecrit ? 'Si la phrase est correcte' : 'Si ça sonne juste') + ', j\'écris « ' + ouiMot +
      ' ». ' + (regles.ecrit ? 'Sinon' : 'Si ça ne sonne pas juste') + ', j\'écris « ' + nonMot + ' ».'
  };
  base.conclusion = (regles.ecrit ? (tests[0].juste ? 'La phrase est correcte' : 'La phrase n\'est pas correcte') : (tests[0].juste ? 'Ça sonne juste' : 'Ça ne sonne pas juste')) + ' : on écrit « ' + item.answer + ' ».';

  const oui = item.choices.find(c => regles.confirms.includes(c));
  const non = item.choices.find(c => !regles.confirms.includes(c));
  const test = testsDeLItem(donnees, item)[0];
  return Object.assign(base, {
    kind: 'juger',
    temoin: test.phrase,
    temoinMot: test.mot,
    options: [
      { label: regles.ecrit ? 'Oui, elle est correcte' : 'Oui, ça sonne juste', value: oui },
      { label: 'Non', value: non }
    ]
  });
}

if (typeof module !== 'undefined') {
  module.exports = { reglesDe, remplir, testsDeLItem, carteDe };
} else {
  window.Regles = { reglesDe, remplir, testsDeLItem, carteDe };
}
