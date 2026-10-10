// ─────────────────────────────────────────────────────────────────────────────
// Écran « L'astuce » : une leçon en 4 étapes, une idée par écran.
//   1. Situer     : de quoi parle-t-on, pourquoi l'oreille ne suffit pas
//   2. Observer   : le mot de substitution qu'on utilise (mordre / mordu...)
//   3. Réfléchir  : deux exemples simples
//   4. Agir       : on fait le test soi-même, sans note, puis on joue
// Les textes viennent des données (champ "lecon" de chaque famille) et les
// exemples des vraies phrases du thème (voir leconDe dans duel-model.js).
// ─────────────────────────────────────────────────────────────────────────────

const ETAPES = [
  { cle: 'situer', nom: 'Situer', question: 'De quoi parle-t-on ?' },
  { cle: 'observer', nom: 'Observer', question: 'Quel est le truc ?' },
  { cle: 'reflechir', nom: 'Réfléchir', question: 'Regardons deux exemples' },
  { cle: 'agir', nom: 'Agir', question: 'À toi de faire le test' }
];

class LeconApp {
  constructor(racine, store, donnees, cleTheme) {
    this.racine = racine;
    this.store = store;
    const themes = DuelModel.themesDe(DuelModel.toutesLesCartes(donnees));
    this.theme = themes.find(t => t.key === cleTheme);
    if (!this.theme) { location.replace('./'); return; }
    this.lecon = DuelModel.leconDe(this.theme);
    this.etape = 0;
    this.afficher();
  }

  aller(n) { this.etape = Math.max(0, Math.min(ETAPES.length - 1, n)); this.afficher(); window.scrollTo(0, 0); }

  afficher() {
    const e = ETAPES[this.etape];
    const corps = { situer: () => this.situer(), observer: () => this.observer(), reflechir: () => this.reflechir(), agir: () => this.agir() }[e.cle]();
    this.racine.replaceChildren(
      el('div', { class: 'haut' }, el('a', { class: 'bouton petit', href: './' }, '← Accueil')),
      el('h1', {}, this.lecon.theme),
      el('ol', { class: 'etapes', 'aria-label': 'Les 4 étapes' }, ETAPES.map((x, i) =>
        el('li', { class: i === this.etape ? 'courante' : (i < this.etape ? 'faite' : '') },
          el('span', { class: 'num' }, String(i + 1)), el('span', { class: 'nom' }, x.nom)))),
      el('section', { class: 'bloc etape' }, el('h2', {}, e.question), corps.contenu),
      corps.actions);
    const premier = this.racine.querySelector('.actions .principal');
    if (premier) premier.focus({ preventScroll: true });
  }

  navigation(suivant) {
    return el('div', { class: 'actions' },
      suivant,
      this.etape > 0 ? el('button', { type: 'button', class: 'bouton', onclick: () => this.aller(this.etape - 1) }, '← Retour') : null);
  }

  boutonSuivant(texte) {
    return el('button', { type: 'button', class: 'bouton principal large', onclick: () => this.aller(this.etape + 1) }, texte || 'Suivant →');
  }

  // 1. Situer
  situer() {
    const t = this.lecon.etapes.situer;
    return { contenu: el('div', {}, t.map(p => el('p', { class: 'texte' }, p))), actions: this.navigation(this.boutonSuivant()) };
  }

  // 2. Observer : le mot de substitution, mis en grand
  observer() {
    const l = this.lecon;
    const grand = l.mode === 'choisir'
      ? el('p', { class: 'gros-mot' }, el('span', { class: 'surligne' }, l.paire[0].mot), ' · ', el('span', { class: 'surligne' }, l.paire[1].mot))
      : el('p', { class: 'gros-mot' }, el('span', { class: 'surligne' }, l.mot));
    const contenu = el('div', {}, l.etapes.observer.map(p => el('p', { class: 'texte' }, p)), grand);
    if (l.rule) contenu.append(el('div', { class: 'note' }, l.rule));
    return { contenu, actions: this.navigation(this.boutonSuivant()) };
  }

  // 3. Réfléchir : deux exemples
  reflechir() {
    const l = this.lecon;
    return {
      contenu: el('div', {}, el('p', { class: 'texte' }, l.etapes.reflechir),
        l.exemples.map(ex => l.mode === 'juger' ? this.exempleJuger(ex) : this.exempleChoisir(ex))),
      actions: this.navigation(this.boutonSuivant())
    };
  }

  // 4. Agir : l'enfant fait le test lui-même
  agir() {
    const carte = this.lecon.agir;
    const l = this.lecon;
    const zone = el('div', { class: 'agir' });
    const verdict = el('div', { class: 'verdict-agir', 'aria-live': 'polite' });
    const jouer = el('a', { class: 'bouton principal large', href: lienTheme('duel.html', this.theme.key), onclick: () => this.store.marquerLecon(this.theme.key) }, 'Je sais, on joue !');
    jouer.hidden = true;

    const reponses = el('div', { class: l.mode === 'juger' ? 'choix' : 'choix-phrases' });
    const repondre = (option, bouton) => {
      if (option.value === carte.answer) {
        reponses.querySelectorAll('button').forEach(b => { b.disabled = true; });
        bouton.classList.add('juste');
        verdict.replaceChildren(el('div', { class: 'verdict juste' }, el('b', {}, 'Bravo, tu as fait le test !'),
          el('p', {}, carte.conclusion), el('p', { class: 'phrase-ex' }, carte.complete)));
        jouer.hidden = false; jouer.focus({ preventScroll: true });
      } else {
        bouton.disabled = true; bouton.classList.add('rate');
        verdict.replaceChildren(el('div', { class: 'verdict rate' }, el('b', {}, 'Pas celle-là. '),
          l.mode === 'juger' ? 'Relis la phrase à voix basse, avec le mot à la place du trou.' : 'Relis les deux phrases à voix basse et choisis celle qui sonne juste.'));
      }
    };

    if (l.mode === 'juger') {
      zone.append(
        el('p', { class: 'texte' }, 'Voici une phrase avec un trou :'),
        el('div', { class: 'phrase-ex gros' }, this.phraseAvecTrou(carte)),
        el('p', { class: 'texte' }, 'On met « ', el('b', {}, carte.temoinMot), ' » à la place du trou :'),
        el('div', { class: 'phrase-ex gros test-agir' }, surligne(carte.temoin, carte.temoinMot)),
        el('p', { class: 'texte' }, 'Est-ce que ça sonne juste ?'));
      carte.options.forEach(o => reponses.append(el('button', { type: 'button', class: 'bouton', onclick: ev => repondre(o, ev.currentTarget) }, o.label)));
    } else {
      zone.append(
        el('p', { class: 'texte' }, 'Voici une phrase avec un trou :'),
        el('div', { class: 'phrase-ex gros' }, this.phraseAvecTrou(carte)),
        el('p', { class: 'texte' }, 'On essaie les deux mots. Touche la phrase qui sonne juste :'));
      carte.options.forEach(o => reponses.append(el('button', { type: 'button', class: 'bouton phrase-bouton', onclick: ev => repondre(o, ev.currentTarget) }, el('span', {}, surligne(o.label, o.mot)))));
    }
    zone.append(reponses, verdict);
    return { contenu: zone, actions: el('div', { class: 'actions' }, jouer, this.etape > 0 ? el('button', { type: 'button', class: 'bouton', onclick: () => this.aller(this.etape - 1) }, '← Retour') : null) };
  }

  phraseAvecTrou(carte) {
    const [avant, apres] = carte.text.split('___');
    return [avant, el('span', { class: 'trou' }, ' '), apres];
  }

  exempleJuger(ex) {
    return el('div', { class: 'exemple' },
      el('div', { class: 'phrase-ex' }, this.phraseAvecTrou(ex.carte)),
      el('div', { class: 'test' }, el('span', { class: 'marque ' + (ex.juste ? 'oui' : 'non') }, ex.juste ? '✓' : '✗'),
        el('span', {}, surligne(ex.test, ex.mot))),
      el('div', {}, ex.juste ? 'Ça sonne juste : ' : 'Ça ne sonne pas juste : ', el('b', {}, ex.reponse)));
  }

  exempleChoisir(ex) {
    return el('div', { class: 'exemple' },
      el('div', { class: 'phrase-ex' }, this.phraseAvecTrou(ex.carte)),
      ex.options.map(o => el('div', { class: 'test' }, el('span', { class: 'marque ' + (o.juste ? 'oui' : 'non') }, o.juste ? '✓' : '✗'),
        el('span', {}, surligne(o.label, o.mot)))),
      el('div', {}, 'On écrit : ', el('b', {}, ex.reponse)));
  }
}

chargerDonnees()
  .then(donnees => new LeconApp(document.getElementById('app'), createStore(window.localStorage), donnees, new URLSearchParams(location.search).get('theme')))
  .catch(() => { document.getElementById('app').replaceChildren(el('p', {}, 'Impossible de charger les phrases. Vérifie la connexion puis recharge la page.')); });
