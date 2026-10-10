// ─────────────────────────────────────────────────────────────────────────────
// Écran du Duel. Une question par écran, un seul geste, un retour immédiat sans
// punition. Ce fichier dessine et relaie les touches ; les règles sont dans
// duel-model.js (testé sans navigateur).
// ─────────────────────────────────────────────────────────────────────────────

class DuelApp {
  constructor(racine, store, donnees, cleTheme) {
    this.racine = racine;
    this.store = store;
    this.cartes = DuelModel.toutesLesCartes(donnees);
    this.theme = cleTheme === 'tout' ? null : DuelModel.themesDe(this.cartes).find(t => t.key === cleTheme) || null;
    this.titre = this.theme ? this.theme.theme : 'Mélange';
    this.reglages = store.getReglages();
    this.nouvelleSeance();
  }

  nouvelleSeance() {
    const source = this.theme ? this.theme.cartes : this.cartes;
    const progression = this.store.getProgression();
    const seance = DuelModel.choisirSeance(source, progression, this.reglages.nombre);
    this.jeu = new DuelModel.DuelGame(seance, progression);
    this.question();
  }

  // ── Écran « question » ───────────────────────────────────────────────────
  question() {
    if (this.jeu.fini) return this.bilan();
    const carte = this.jeu.courante;
    const options = this.jeu.options();
    this.boutons = [];

    const phrase = el('div', { class: 'phrase', 'aria-live': 'polite' }, this.phraseAvecTrou(carte));
    const consigne = el('p', { class: 'consigne' }, carte.question);
    const zone = el('div', { class: 'reponses ' + (carte.kind === 'choisir' ? 'choisir' : 'deux') });
    options.forEach(option => {
      // le <span> évite que le bouton (flex) supprime les espaces autour du mot en gras
      const contenu = el('span', {}, carte.kind === 'choisir' ? avecMotEnGras(option.label, option.mot) : option.label);
      const bouton = el('button', { type: 'button', onclick: () => this.repondre(carte, option, bouton) }, contenu);
      bouton._option = option;
      this.boutons.push(bouton);
      zone.append(bouton);
    });

    this.retour = el('div', { 'aria-live': 'polite' });
    this.racine.replaceChildren(
      this.entete(),
      el('div', { class: 'jeu' },
        el('div', { class: 'theme-titre' }, this.titre + (this.theme ? '' : ' : ' + carte.theme)),
        phrase,
        consigne,
        carte.kind === 'juger' ? el('div', { class: 'temoin' }, avecMotEnGras(carte.temoin, carte.temoinMot)) : null,
        zone,
        this.retour));
  }

  entete() {
    const j = this.jeu;
    const points = el('div', { class: 'points', 'aria-label': 'Carte ' + j.numero + ' sur ' + j.base });
    for (let i = 0; i < j.base; i++) {
      points.append(el('i', { class: i < j.resultats.size ? 'fait' : (i === j.resultats.size ? 'courant' : '') }));
    }
    return el('div', {},
      el('div', { class: 'entete' }, el('a', { class: 'bouton retour', href: './' }, '← Menu')),
      points);
  }

  // La phrase avec un trou visible : « Léa ___ mal » devient « Léa [   ] mal »
  phraseAvecTrou(carte, reponse) {
    const [avant, apres] = carte.text.split('___');
    const milieu = reponse ? el('span', { class: 'mot-juste' }, reponse) : el('span', { class: 'trou' }, ' ');
    return [avant, milieu, apres];
  }

  // ── Réponse : retour immédiat, jamais de punition ───────────────────────
  repondre(carte, option, boutonTouche) {
    const r = this.jeu.repondre(option);
    this.store.saveProgression(this.jeu.progression);

    this.boutons.forEach(b => {
      b.disabled = true;
      if (b._option.value === carte.answer) b.classList.add('juste');
      else if (b === boutonTouche) b.classList.add('autre');
    });
    this.racine.querySelector('.phrase').replaceChildren(...this.phraseAvecTrou(carte, carte.answer));

    const suivant = el('button', { type: 'button', class: 'principal', onclick: () => { this.jeu.suivante(); this.question(); window.scrollTo(0, 0); } },
      this.jeu.index + 1 >= this.jeu.file.length ? 'Terminer' : 'Suivant');
    const actions = el('div', { class: 'actions' }, suivant, this.boutonVoix(carte));

    const message = r.juste
      ? el('div', { class: 'retour-info juste' }, el('strong', {}, 'Bien vu !'))
      : el('div', { class: 'retour-info revoir' },
          el('strong', {}, 'C\'était « ' + carte.answer + ' ».'),
          el('div', {}, r.premierEssai ? 'Pas grave : on la revoit dans un instant.' : 'On la reverra une autre fois.'));
    if (!r.juste && carte.rule) message.append(el('div', { class: 'regle' }, carte.rule));

    this.retour.replaceChildren(message, actions);
    suivant.focus({ preventScroll: true });
    suivant.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  boutonVoix(carte) {
    if (!this.reglages.voix || !('speechSynthesis' in window)) return null;
    return el('button', { type: 'button', class: 'voix', onclick: () => this.lire(carte.complete) }, '🔊 Écouter la phrase');
  }

  lire(texte) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texte);
      u.lang = 'fr-FR';
      u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch (e) { /* pas de voix disponible : on ne fait rien */ }
  }

  // ── Écran « bilan » ───────────────────────────────────────────────────────
  bilan() {
    const b = this.jeu.bilan();
    const revoir = b.aRevoir.length
      ? el('div', { class: 'revoir-liste' },
          el('strong', {}, 'À revoir :'),
          el('ul', {}, b.aRevoir.map(c => el('li', {}, c.complete))))
      : null;
    this.racine.replaceChildren(
      el('div', { class: 'entete' }, el('a', { class: 'bouton retour', href: './' }, '← Menu')),
      el('div', { class: 'bilan' },
        el('h1', {}, 'Séance terminée'),
        el('div', { class: 'gros' }, b.justes + ' / ' + b.total),
        el('p', {}, b.justes === b.total ? 'Tout du premier coup. Bravo !' : 'du premier coup. Les autres reviendront.'),
        revoir,
        el('div', { class: 'actions' },
          el('button', { type: 'button', class: 'principal', onclick: () => this.nouvelleSeance() }, 'Encore ' + this.reglages.nombre + ' cartes'),
          el('a', { class: 'bouton', href: './' }, 'Autre thème'))));
  }
}

chargerDonnees()
  .then(donnees => {
    const cle = new URLSearchParams(location.search).get('theme') || 'tout';
    new DuelApp(document.getElementById('app'), createStore(window.localStorage), donnees, cle);
  })
  .catch(() => { document.getElementById('app').replaceChildren(el('p', {}, 'Impossible de charger les phrases. Vérifie la connexion puis recharge la page.')); });
