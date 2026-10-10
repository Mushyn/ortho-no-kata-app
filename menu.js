// ─────────────────────────────────────────────────────────────────────────────
// Accueil : une invitation à jouer, puis la liste des thèmes.
// Aucune règle du jeu ici : tout est dans duel-model.js.
// ─────────────────────────────────────────────────────────────────────────────

// Espaces insécables : « -er / -é » ne doit pas être coupé en fin de ligne
function insecable(texte) { return texte.replace(/ /g, '\u00a0'); }

class MenuApp {
  constructor(racine, store, donnees) {
    this.racine = racine;
    this.store = store;
    this.cartes = DuelModel.toutesLesCartes(donnees);
    this.themes = DuelModel.themesDe(this.cartes);
    this.afficher();
  }

  // Où mène un thème : la leçon la première fois, ensuite directement le jeu
  lien(theme) {
    return lienTheme(this.store.getLecons()[theme.key] ? 'duel.html' : 'lecon.html', theme.key);
  }

  afficher() {
    const progression = this.store.getProgression();
    const historique = this.store.getHistorique();
    const reglages = this.store.getReglages();
    const suggere = DuelModel.themeSuggere(this.themes, progression, historique);
    const points = DuelModel.pointsTotal(historique);
    const serie = DuelModel.serieDeJours(historique);

    this.racine.replaceChildren(
      el('div', { class: 'haut' },
        el('span', { class: 'logo' }, 'Ortho no Kata'),
        el('a', { class: 'pastille', href: 'scores.html', 'aria-label': 'Mes scores : ' + points + ' points' },
          el('span', {}, points + ' pts'),
          serie > 0 ? el('span', {}, '🔥 ' + serie) : null)),

      this.invitation(suggere, historique, reglages),

      el('h2', {}, 'À travailler en priorité'),
      this.liste(this.themes.filter(t => t.majeure), progression, historique),
      el('h2', {}, 'Ensuite'),
      this.liste(this.themes.filter(t => !t.majeure), progression, historique),
      el('h2', {}, 'Tout mélanger'),
      this.liste([{ key: 'tout', theme: 'Mélange', cartes: this.cartes, melange: true }], progression, historique),

      this.reglages(reglages));
  }

  invitation(suggere, historique, reglages) {
    const salut = reglages.prenom ? 'Salut ' + reglages.prenom + ' !' : 'Salut !';
    const aJoue = historique.length > 0;
    return el('section', { class: 'invitation' },
      el('h1', {}, salut),
      el('p', {}, aJoue ? 'On continue avec ' : 'On commence par ', el('span', { class: 'surligne' }, suggere.theme), '. ',
        reglages.nombre + ' cartes, pas de chrono.'),
      el('a', { class: 'bouton principal large', href: this.lien(suggere) },
        aJoue ? 'Jouer : ' + insecable(suggere.theme) : 'Découvrir l\'astuce : ' + insecable(suggere.theme)));
  }

  liste(themes, progression, historique) {
    return el('ul', { class: 'liste' }, themes.map(t => {
      const m = DuelModel.maitrise(t.cartes, progression);
      const nb = t.melange ? historique.length : DuelModel.seancesDuTheme(historique, t.key);
      const etat = m.vues === 0 ? 'À découvrir' : m.acquises + ' acquises sur ' + m.total;
      return el('li', {},
        el('a', { class: 'ligne-theme', href: t.melange ? 'duel.html?theme=tout' : this.lien(t) },
          el('span', {}, el('span', { class: 'nom-theme' }, t.theme), el('br'), el('span', { class: 'etat' }, etat)),
          t.melange ? null : etoiles(DuelModel.etoilesDe(m, nb))),
        t.melange ? null : el('a', { class: 'astuce-lien', href: lienTheme('lecon.html', t.key) }, 'Astuce'));
    }));
  }

  reglages(reglages) {
    const regler = changement => {
      this.store.saveReglages(Object.assign({}, this.store.getReglages(), changement));
      this.afficher();
      document.querySelector('details').open = true;
    };
    const bouton = (texte, actif, action) => el('button', { type: 'button', class: 'bouton petit' + (actif ? ' actif' : ''), 'aria-pressed': actif ? 'true' : 'false', onclick: action }, texte);
    const prenom = el('input', { type: 'text', id: 'prenom', value: reglages.prenom, maxlength: '20', autocomplete: 'off',
      onchange: e => this.store.saveReglages(Object.assign({}, this.store.getReglages(), { prenom: e.target.value.trim() })) });
    const entree = el('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: e => this.importer(e.target.files[0]) });
    this.message = el('p', { class: 'discret', role: 'status' });
    return el('details', {},
      el('summary', {}, 'Réglages et sauvegarde'),
      el('div', { class: 'reglages' },
        el('div', {}, el('label', { for: 'prenom' }, 'Prénom (reste sur ce téléphone)'), prenom),
        el('div', { class: 'ligne' },
          bouton('5 cartes', reglages.nombre === 5, () => regler({ nombre: 5 })),
          bouton('10 cartes', reglages.nombre === 10, () => regler({ nombre: 10 }))),
        el('div', { class: 'ligne' },
          bouton('Voix : oui', reglages.voix, () => regler({ voix: true })),
          bouton('Voix : non', !reglages.voix, () => regler({ voix: false }))),
        el('p', { class: 'discret' }, 'La progression et les scores restent sur ce téléphone. Pour les garder en sécurité ou changer de téléphone, on les exporte dans un fichier.'),
        el('div', { class: 'ligne' },
          el('button', { type: 'button', class: 'bouton petit', onclick: () => this.exporter() }, 'Exporter'),
          el('button', { type: 'button', class: 'bouton petit', onclick: () => entree.click() }, 'Importer')),
        entree, this.message));
  }

  exporter() {
    const blob = new Blob([this.store.exporter()], { type: 'application/json' });
    const lien = el('a', { href: URL.createObjectURL(blob), download: 'ortho-progression.json' });
    document.body.append(lien); lien.click(); lien.remove();
    this.message.textContent = 'Fichier ortho-progression.json préparé.';
  }

  async importer(fichier) {
    if (!fichier) return;
    try {
      this.store.importer(await fichier.text());
      this.afficher();
    } catch (e) {
      this.message.textContent = 'Ce fichier n\'est pas une progression Ortho no Kata.';
    }
  }
}

chargerDonnees()
  .then(donnees => new MenuApp(document.getElementById('app'), createStore(window.localStorage), donnees))
  .catch(() => { document.getElementById('app').replaceChildren(el('p', {}, 'Impossible de charger les phrases. Vérifie la connexion puis recharge la page.')); });
