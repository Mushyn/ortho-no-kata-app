// ─────────────────────────────────────────────────────────────────────────────
// Accueil : une invitation à jouer, puis la liste des thèmes.
// Aucune règle du jeu ici : tout est dans duel-model.js.
// ─────────────────────────────────────────────────────────────────────────────

// Espaces insécables : « -er / -é » ne doit pas être coupé en fin de ligne
function insecable(texte) { return texte.replace(/ /g, '\u00a0').replace(/-/g, '\u2011'); }

class MenuApp {
  constructor(racine, store, donnees, mots) {
    this.racine = racine;
    this.store = store;
    this.cartesMots = mots ? MotsModel.cartesDeMots(mots) : [];
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
    const niveau = DuelModel.niveauDe(points);

    this.racine.replaceChildren(
      el('div', { class: 'haut' },
        el('span', { class: 'logo' }, el('img', { src: 'icons/logo.svg', alt: '', width: 36, height: 36 }), el('span', { class: 'logo-nom' }, 'Ortho no Kata')),
        el('a', { class: 'pastille', href: 'scores.html', 'aria-label': 'Mes scores : niveau ' + niveau.niveau + ', ' + points + ' points' },
          el('span', { class: 'niveau-puce' }, 'Niv. ' + niveau.niveau),
          serie > 0 ? el('span', {}, '🔥 ' + serie) : null)),

      this.mission(suggere, historique, reglages, niveau),

      el('h2', {}, 'Ton parcours'),
      this.parcours(suggere, progression, historique),
      this.carteMots(progression, historique),

      this.reglages(reglages));
  }

  // La mission du jour : une seule chose à faire, un gros bouton
  mission(suggere, historique, reglages, niveau) {
    const salut = reglages.prenom ? 'Salut ' + reglages.prenom + ' !' : 'Salut !';
    const aJoue = historique.length > 0;
    const faite = DuelModel.seancesAujourdhui(historique) > 0;
    const titre = !aJoue ? 'Ta première mission' : (faite ? 'Mission accomplie' : 'Mission du jour');
    return el('section', { class: 'mission' },
      el('div', { class: 'etat-mission' + (faite ? ' ok' : '') }, faite ? '✓ ' + salut : salut),
      el('h1', {}, titre),
      el('p', {},
        !aJoue ? 'Découvre le truc du thème ' : (faite ? 'Tu peux continuer avec ' : 'Aujourd\'hui : '),
        el('span', { class: 'surligne' }, insecable(suggere.theme)),
        '. ' + reglages.nombre + ' cartes, pas de chrono.'),
      el('a', { class: 'bouton principal large', href: this.lien(suggere) }, faite ? 'Encore une séance' : 'C\'est parti'),
      el('div', { class: 'niveau' },
        el('div', { class: 'niveau-ligne' },
          el('span', {}, 'Niveau ' + niveau.niveau),
          el('span', {}, niveau.dans + ' / ' + niveau.pour + ' pts')),
        el('div', { class: 'barre xp', role: 'img', 'aria-label': niveau.dans + ' points sur ' + niveau.pour + ' pour le prochain niveau' },
          el('i', { style: 'width:' + niveau.dans + '%' }))));
  }

  // Le parcours : les thèmes dans l'ordre conseillé, puis le défi final
  parcours(suggere, progression, historique) {
    const etapes = this.themes.map((theme, i) => ({ theme, numero: i + 1 }));
    const noeuds = etapes.map(({ theme, numero }) => {
      const m = DuelModel.maitrise(theme.cartes, progression);
      const etoilesTheme = DuelModel.etoilesDe(m, DuelModel.seancesDuTheme(historique, theme.key));
      const ici = theme.key === suggere.key;
      const fait = etoilesTheme === 3;
      const etat = m.vues === 0 ? 'À découvrir' : m.acquises + ' acquises sur ' + m.total;
      return el('li', { class: 'noeud' + (fait ? ' fait' : '') + (ici ? ' ici' : '') },
        el('span', { class: 'rond', 'aria-hidden': 'true' }, fait ? '✓' : String(numero)),
        el('div', { class: 'noeud-carte' },
          el('a', { class: 'noeud-lien', href: this.lien(theme) },
            el('span', {},
              ici ? el('span', { class: 'tag-ici' }, 'Tu es ici') : null, ici ? el('br') : null,
              el('span', { class: 'nom-theme' }, theme.theme), el('br'),
              el('span', { class: 'etat' }, etat)),
            etoiles(etoilesTheme)),
          el('div', { class: 'noeud-pied' },
            el('span', { class: 'etat' }, theme.majeure ? 'À travailler en priorité' : ''),
            el('a', { href: lienTheme('lecon.html', theme.key) }, 'Revoir l\'astuce'))));
    });
    const m = DuelModel.maitrise(this.cartes, progression);
    const defi = el('li', { class: 'noeud boss' },
      el('span', { class: 'rond', 'aria-hidden': 'true' }, '🏆'),
      el('div', { class: 'noeud-carte' },
        el('a', { class: 'noeud-lien', href: 'duel.html?theme=tout' },
          el('span', {},
            el('span', { class: 'nom-theme' }, 'Défi final : le mélange'), el('br'),
            el('span', { class: 'etat' }, 'Tous les thèmes ensemble. ' + (m.vues === 0 ? 'Quand tu te sens prêt.' : m.acquises + ' acquises sur ' + m.total))))));
    return el('ol', { class: 'parcours' }, noeuds, defi);
  }

  // Le jeu des mots invariables : un seul bloc, après le parcours
  carteMots(progression, historique) {
    if (!this.cartesMots.length) return null;
    const m = DuelModel.maitrise(this.cartesMots, progression);
    const nb = DuelModel.seancesDuTheme(historique, MotsModel.CLE_MOTS);
    return el('section', { class: 'noeud-mots' },
      el('h2', {}, 'Les mots à connaître'),
      el('div', { class: 'noeud-carte' },
        el('a', { class: 'noeud-lien', href: 'mots.html' },
          el('span', {},
            el('span', { class: 'nom-theme' }, 'Écoute et écris'), el('br'),
            el('span', { class: 'etat' }, m.vues === 0 ? 'Les mots invariables, ' + this.nombreDeMots() + ' à la fois' : m.acquises + ' acquis sur ' + m.total)),
          etoiles(DuelModel.etoilesDe(m, nb)))));
  }

  nombreDeMots() { return this.store.getReglages().nombre; }

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
        el('div', {}, el('label', {}, 'Ambiance'),
          el('div', { class: 'ligne' },
            bouton('Arcade', reglages.theme === 'arcade', () => this.ambiance('arcade')),
            bouton('Sport', reglages.theme === 'sport', () => this.ambiance('sport')),
            bouton('Dojo', reglages.theme === 'dojo', () => this.ambiance('dojo')))),
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

  // Change l'ambiance tout de suite, sans recharger
  ambiance(nom) {
    this.store.saveReglages(Object.assign({}, this.store.getReglages(), { theme: nom }));
    document.documentElement.setAttribute('data-theme', nom);
    this.afficher();
    document.querySelector('details').open = true;
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

Promise.all([chargerDonnees(), chargerMots().catch(() => null)])
  .then(([donnees, mots]) => new MenuApp(document.getElementById('app'), createStore(window.localStorage), donnees, mots))
  .catch(() => { document.getElementById('app').replaceChildren(el('p', {}, 'Impossible de charger les phrases. Vérifie la connexion puis recharge la page.')); });
