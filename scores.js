// ─────────────────────────────────────────────────────────────────────────────
// Écran « Mes scores » : tout ce qui est conservé, rien ne se perd jamais.
// ─────────────────────────────────────────────────────────────────────────────

class ScoresApp {
  constructor(racine, store, donnees) {
    const cartes = DuelModel.toutesLesCartes(donnees);
    const themes = DuelModel.themesDe(cartes);
    const progression = store.getProgression();
    const historique = store.getHistorique();
    const noms = new Map(themes.map(t => [t.key, t.theme]));
    noms.set('tout', 'Mélange');

    const points = DuelModel.pointsTotal(historique);
    const serie = DuelModel.serieDeJours(historique);
    const derniers = historique.slice(-10).reverse();

    racine.replaceChildren(
      el('div', { class: 'haut' }, el('a', { class: 'bouton petit', href: './' }, '← Accueil')),
      el('h1', {}, 'Mes scores'),
      el('div', { class: 'chiffres' },
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
      })),

      el('h2', {}, 'Mes dernières séances'),
      derniers.length
        ? el('ul', { class: 'seances' }, derniers.map(s => el('li', {},
            el('span', {}, dateCourte(s.t) + ' : ' + (noms.get(s.theme) || s.theme)),
            el('b', {}, s.justes + ' / ' + s.total))))
        : el('p', { class: 'vide' }, 'Pas encore de séance. La première prend cinq minutes.'),

      el('div', { class: 'actions' }, el('a', { class: 'bouton principal large', href: './' }, 'Jouer')));
  }

  chiffre(valeur, libelle) {
    return el('div', { class: 'chiffre' }, el('b', {}, valeur), el('span', {}, libelle));
  }
}

chargerDonnees()
  .then(donnees => new ScoresApp(document.getElementById('app'), createStore(window.localStorage), donnees))
  .catch(() => { document.getElementById('app').replaceChildren(el('p', {}, 'Impossible de charger les phrases. Vérifie la connexion puis recharge la page.')); });
