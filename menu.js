// ─────────────────────────────────────────────────────────────────────────────
// Écran d'accueil : choisir UN thème (une astuce à la fois), régler, sauvegarder.
// Le menu ne contient aucune règle du jeu : tout est dans duel-model.js.
// ─────────────────────────────────────────────────────────────────────────────

class MenuApp {
  constructor(racine, store, donnees) {
    this.racine = racine;
    this.store = store;
    this.cartes = DuelModel.toutesLesCartes(donnees);
    this.themes = DuelModel.themesDe(this.cartes);
    this.afficher();
  }

  afficher() {
    const progression = this.store.getProgression();
    const reglages = this.store.getReglages();
    this.racine.replaceChildren(
      el('h1', {}, 'Ortho no Kata'),
      el('p', { class: 'discret' }, 'Un thème à la fois. Une astuce, quelques phrases, c\'est tout.'),
      el('div', { class: 'themes' },
        this.themes.map(t => this.carteTheme(t, progression, reglages)),
        this.carteMelange(progression, reglages)),
      this.blocReglages(reglages),
      this.blocSauvegarde()
    );
  }

  carteTheme(theme, progression, reglages) {
    const m = DuelModel.maitrise(theme.cartes, progression);
    return el('a', { class: 'theme', href: 'duel.html?theme=' + encodeURIComponent(theme.key) },
      el('div', { class: 'nom' }, theme.theme),
      el('div', { class: 'astuce' }, theme.question),
      this.barre(m),
      el('div', { class: 'etat' }, this.texteEtat(m)));
  }

  carteMelange(progression) {
    const m = DuelModel.maitrise(this.cartes, progression);
    return el('a', { class: 'theme', href: 'duel.html?theme=tout' },
      el('div', { class: 'nom' }, 'Mélange'),
      el('div', { class: 'astuce' }, 'Tous les thèmes ensemble. À essayer quand les thèmes isolés sont solides.'),
      this.barre(m),
      el('div', { class: 'etat' }, this.texteEtat(m)));
  }

  barre(m) {
    const pct = m.total ? Math.round(100 * m.acquises / m.total) : 0;
    return el('div', { class: 'barre', role: 'img', 'aria-label': pct + ' pour cent acquis' }, el('i', { style: 'width:' + pct + '%' }));
  }

  texteEtat(m) {
    if (m.vues === 0) return 'Pas encore commencé';
    return m.acquises + ' acquises sur ' + m.total + ' (' + m.vues + ' vues)';
  }

  blocReglages(reglages) {
    const bouton = (texte, actif, action) => el('button', { type: 'button', class: 'choix' + (actif ? ' actif' : ''), 'aria-pressed': actif ? 'true' : 'false', onclick: action }, texte);
    const regler = changement => {
      this.store.saveReglages(Object.assign({}, this.store.getReglages(), changement));
      this.afficher();
    };
    return el('section', {},
      el('h2', {}, 'Réglages'),
      el('div', { class: 'reglages' },
        el('div', { class: 'ligne' },
          bouton('5 cartes', reglages.nombre === 5, () => regler({ nombre: 5 })),
          bouton('10 cartes', reglages.nombre === 10, () => regler({ nombre: 10 }))),
        el('div', { class: 'ligne' },
          bouton('Voix : oui', reglages.voix, () => regler({ voix: true })),
          bouton('Voix : non', !reglages.voix, () => regler({ voix: false })))));
  }

  blocSauvegarde() {
    const entree = el('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: e => this.importer(e.target.files[0]) });
    this.message = el('p', { class: 'discret', role: 'status' });
    return el('section', {},
      el('h2', {}, 'Ma progression'),
      el('p', { class: 'discret' }, 'Elle reste sur ce téléphone. Pour la garder en sécurité ou la changer de téléphone, on l\'exporte dans un fichier.'),
      el('div', { class: 'ligne' },
        el('button', { type: 'button', onclick: () => this.exporter() }, 'Exporter'),
        el('button', { type: 'button', onclick: () => entree.click() }, 'Importer')),
      entree, this.message);
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
