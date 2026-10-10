// ─────────────────────────────────────────────────────────────────────────────
// Écran « L'astuce » : on explique le truc AVANT de jouer, avec deux exemples
// tirés des vraies phrases du thème. Rien n'est écrit à part : tout vient des
// données (voir leconDe dans duel-model.js).
// ─────────────────────────────────────────────────────────────────────────────

class LeconApp {
  constructor(racine, store, donnees, cleTheme) {
    this.racine = racine;
    this.store = store;
    const themes = DuelModel.themesDe(DuelModel.toutesLesCartes(donnees));
    this.theme = themes.find(t => t.key === cleTheme);
    if (!this.theme) { location.replace('./'); return; }
    this.afficher(DuelModel.leconDe(this.theme));
  }

  afficher(lecon) {
    const jouer = el('a', { class: 'bouton principal large', href: lienTheme('duel.html', this.theme.key), onclick: () => this.store.marquerLecon(this.theme.key) }, 'Compris, on joue');
    this.racine.replaceChildren(
      el('div', { class: 'haut' }, el('a', { class: 'bouton petit', href: './' }, '← Accueil')),
      el('h1', {}, lecon.theme),
      el('div', { class: 'lecon' },
        lecon.mode === 'juger' ? this.blocJuger(lecon) : this.blocChoisir(lecon),
        lecon.rule ? el('div', { class: 'note' }, lecon.rule) : null,
        el('section', { class: 'bloc' }, el('h2', {}, 'Deux exemples'),
          lecon.exemples.map(ex => lecon.mode === 'juger' ? this.exempleJuger(ex) : this.exempleChoisir(ex)))),
      el('div', { class: 'actions' }, jouer));
    jouer.focus({ preventScroll: true });
  }

  // Un seul mot-témoin : on le met à la place du trou, et on écoute
  blocJuger(l) {
    return el('section', { class: 'bloc' },
      el('h2', {}, 'Le truc'),
      el('p', { class: 'gros-mot' }, 'Je mets « ', el('span', { class: 'surligne' }, l.mot), ' » à la place du trou.'),
      el('p', {}, 'Je lis la phrase à voix basse. Est-ce que ça sonne juste ?'),
      el('div', { class: 'regle' },
        el('div', { class: 'resultat-regle oui' }, el('span', { class: 'marque oui' }, '✓'), 'Ça sonne juste', el('span', { class: 'mot' }, l.oui)),
        el('div', { class: 'resultat-regle non' }, el('span', { class: 'marque non' }, '✗'), 'Ça ne sonne pas juste', el('span', { class: 'mot' }, l.non))));
  }

  // -er / -é : deux mots-témoins, on garde celui qui sonne juste
  blocChoisir(l) {
    return el('section', { class: 'bloc' },
      el('h2', {}, 'Le truc'),
      el('p', { class: 'gros-mot' }, 'Je dis la phrase avec « ', el('span', { class: 'surligne' }, l.paire[0].mot), ' », puis avec « ', el('span', { class: 'surligne' }, l.paire[1].mot), ' ».'),
      el('p', {}, 'Une des deux sonne juste. Celle-là me donne la fin du mot.'),
      el('div', { class: 'regle' }, l.paire.map(p =>
        el('div', { class: 'resultat-regle oui' }, el('span', {}, '« ', p.mot, ' » sonne juste'), el('span', { class: 'mot' }, p.fin)))));
  }

  phraseAvecTrou(carte) {
    const [avant, apres] = carte.text.split('___');
    return [avant, el('span', { class: 'trou' }, ' '), apres];
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
