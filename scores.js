// ─────────────────────────────────────────────────────────────────────────────
// Écran « Mes scores » : tout ce qui est conservé, rien ne se perd jamais.
// ─────────────────────────────────────────────────────────────────────────────

class ScoresApp {
  constructor(racine, store, donnees, mots, dictees) {
    const cartes = DuelModel.toutesLesCartes(donnees);
    const themes = DuelModel.themesDe(cartes);
    const progression = store.getProgression();
    const historique = store.getHistorique();
    const noms = new Map(themes.map(t => [t.key, t.theme]));
    noms.set('tout', 'Mélange');
    noms.set(MotsModel.CLE_MOTS, 'Les mots');
    const niveauxDictee = dictees ? DicteesModel.niveauxDe(dictees, donnees) : [];
    niveauxDictee.forEach(n => noms.set(DicteesModel.cleDeThemeDictee(n.key), 'Dictées : ' + n.label));
    const cartesMots = mots ? MotsModel.cartesDeMots(mots) : [];

    const points = DuelModel.pointsTotal(historique);
    const serie = DuelModel.serieDeJours(historique);
    const derniers = historique.slice(-10).reverse();

    racine.replaceChildren(
      el('div', { class: 'haut' }, el('a', { class: 'bouton petit', href: './' }, '← Accueil')),
      el('h1', {}, 'Mes scores'),
      el('div', { class: 'chiffres' },
        this.chiffre(DuelModel.niveauDe(points).niveau, 'niveau'),
        this.chiffre(points, 'points'),
        this.chiffre(serie, serie > 1 ? 'jours de suite' : 'jour de suite'),
        this.chiffre(historique.length, historique.length > 1 ? 'séances' : 'séance')),

      el('h2', {}, 'Mes thèmes'),
      el('ul', { class: 'liste' }, themes.map(t => {
        const m = DuelModel.maitrise(t.cartes, progression);
        const pct = m.total ? Math.round(100 * m.acquises / m.total) : 0;
        return el('li', {}, el('div', { class: 'ligne-theme' },
          el('span', { style: 'flex:1' },
            el('span', { class: 'nom-theme' }, t.theme), el('br'),
            el('span', { class: 'etat' }, m.vues === 0 ? 'À découvrir' : m.acquises + ' acquises sur ' + m.total),
            el('div', { class: 'barre', role: 'img', 'aria-label': pct + ' pour cent acquis' }, el('i', { style: 'width:' + pct + '%' }))),
          etoiles(DuelModel.etoilesDe(m, DuelModel.seancesDuTheme(historique, t.key)))));
      }), this.ligneMots(cartesMots, progression, historique),
        niveauxDictee.map(n => this.ligneDictee(n, progression, historique))),

      el('h2', {}, 'Mes dernières séances'),
      derniers.length
        ? el('ul', { class: 'seances' }, derniers.map(s => el('li', {},
            el('span', {}, dateCourte(s.t) + ' : ' + (noms.get(s.theme) || s.theme)),
            el('b', {}, s.justes + ' / ' + s.total))))
        : el('p', { class: 'vide' }, 'Pas encore de séance. La première prend cinq minutes.'),

      el('div', { class: 'actions' }, el('a', { class: 'bouton principal large', href: './' }, 'Jouer')));
  }

  // Les mots invariables : une ligne de plus dans la liste des thèmes
  ligneMots(cartes, progression, historique) {
    if (!cartes.length) return null;
    const m = DuelModel.maitrise(cartes, progression);
    const pct = m.total ? Math.round(100 * m.acquises / m.total) : 0;
    return el('li', {}, el('div', { class: 'ligne-theme' },
      el('span', { style: 'flex:1' },
        el('span', { class: 'nom-theme' }, 'Les mots'), el('br'),
        el('span', { class: 'etat' }, m.vues === 0 ? 'À découvrir' : m.acquises + ' acquis sur ' + m.total),
        el('div', { class: 'barre', role: 'img', 'aria-label': pct + ' pour cent acquis' }, el('i', { style: 'width:' + pct + '%' }))),
      etoiles(DuelModel.etoilesDe(m, DuelModel.seancesDuTheme(historique, MotsModel.CLE_MOTS)))));
  }

  // Une ligne par niveau de mini-dictée
  ligneDictee(niveau, progression, historique) {
    const m = DuelModel.maitrise(niveau.cartes, progression);
    const pct = m.total ? Math.round(100 * m.acquises / m.total) : 0;
    return el('li', {}, el('div', { class: 'ligne-theme' },
      el('span', { style: 'flex:1' },
        el('span', { class: 'nom-theme' }, 'Dictées : ' + niveau.label), el('br'),
        el('span', { class: 'etat' }, m.vues === 0 ? 'À découvrir' : m.acquises + ' phrases acquises sur ' + m.total),
        el('div', { class: 'barre', role: 'img', 'aria-label': pct + ' pour cent acquis' }, el('i', { style: 'width:' + pct + '%' }))),
      etoiles(DuelModel.etoilesDe(m, DuelModel.seancesDuTheme(historique, DicteesModel.cleDeThemeDictee(niveau.key))))));
  }

  chiffre(valeur, libelle) {
    return el('div', { class: 'chiffre' }, el('b', {}, valeur), el('span', {}, libelle));
  }
}

Promise.all([chargerDonnees(), chargerMots().catch(() => null), chargerDictees().catch(() => null)])
  .then(([donnees, mots, dictees]) => new ScoresApp(document.getElementById('app'), createStore(window.localStorage), donnees, mots, dictees))
  .catch(() => { document.getElementById('app').replaceChildren(el('p', {}, 'Impossible de charger les phrases. Vérifie la connexion puis recharge la page.')); });
