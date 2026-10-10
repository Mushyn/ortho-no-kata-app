// ─────────────────────────────────────────────────────────────────────────────
// Écran du Duel. Une phrase, deux mots, un choix. Si c'est juste : bravo. Si c'est
// raté : on réexplique l'astuce sur CETTE phrase, et la carte revient un peu plus loin.
// Un « coup de pouce » optionnel montre le test avant de répondre.
// Ce fichier dessine et relaie les touches ; les règles sont dans duel-model.js.
// ─────────────────────────────────────────────────────────────────────────────

class DuelApp {
  constructor(racine, store, donnees, cleTheme) {
    this.racine = racine;
    this.store = store;
    this.cartes = DuelModel.toutesLesCartes(donnees);
    const themes = DuelModel.themesDe(this.cartes);
    this.theme = cleTheme === 'tout' ? null : themes.find(t => t.key === cleTheme) || null;
    this.cle = this.theme ? this.theme.key : 'tout';
    this.titre = this.theme ? this.theme.theme : 'Mélange';
    this.reglages = store.getReglages();
    this.nouvelleSeance();
  }

  nouvelleSeance() {
    const source = this.theme ? this.theme.cartes : this.cartes;
    const progression = this.store.getProgression();
    const seance = DuelModel.choisirSeance(source, progression, this.reglages.nombre);
    this.jeu = new DuelModel.DuelGame(seance, progression);
    this.bilanEnregistre = false;
    this.question();
  }

  // ── Écran « question » : la phrase et deux mots ──────────────────────────
  question() {
    if (this.jeu.fini) return this.bilan();
    const carte = this.jeu.courante;
    this.aide = false;

    this.zonePhrase = el('div', { class: 'phrase', 'aria-live': 'polite' }, this.phraseAvecTrou(carte));
    this.boutons = this.jeu.options().map(option => {
      const b = el('button', { type: 'button', class: 'bouton', onclick: () => this.repondre(carte, option, b) }, option.label);
      b._option = option;
      return b;
    });
    this.zoneAide = el('div', { 'aria-live': 'polite' });
    this.zonePouce = el('div', { class: 'pouce' },
      el('button', { type: 'button', class: 'bouton petit', onclick: () => this.coupDePouce(carte) }, '💡 Un coup de pouce'));
    this.zoneRetour = el('div', { 'aria-live': 'polite' });

    this.racine.replaceChildren(
      this.entete(),
      el('div', { class: 'theme-courant' }, el('span', {}, this.titre + (this.theme ? '' : ' : ' + carte.theme))),
      this.zonePhrase,
      el('div', { class: 'choix' }, this.boutons),
      this.zonePouce, this.zoneAide, this.zoneRetour);
  }

  entete() {
    const j = this.jeu;
    const points = el('div', { class: 'progres', role: 'img', 'aria-label': 'Carte ' + j.numero + ' sur ' + j.base });
    for (let i = 0; i < j.base; i++) {
      points.append(el('i', { class: i < j.resultats.size ? 'fait' : (i === j.resultats.size ? 'courant' : '') }));
    }
    return el('div', {},
      el('div', { class: 'haut' },
        el('a', { class: 'bouton petit', href: './' }, '← Accueil'),
        this.theme ? el('a', { class: 'bouton petit', href: lienTheme('lecon.html', this.theme.key) }, 'L\'astuce') : null),
      points);
  }

  // La phrase avec le trou visible, ou avec le mot écrit à la place du trou
  phraseAvecTrou(carte, reponse) {
    const [avant, apres] = carte.text.split('___');
    const milieu = reponse ? el('span', { class: 'bonne-reponse' }, reponse) : el('span', { class: 'trou' }, ' ');
    return [avant, milieu, apres];
  }

  // ── Coup de pouce : le test, sans la conclusion ─────────────────────────
  coupDePouce(carte) {
    this.aide = true;
    this.zonePouce.replaceChildren();
    const mots = carte.tests.map(t => t.mot);
    this.zoneAide.replaceChildren(el('div', { class: 'bloc coup-de-pouce' },
      el('p', {}, carte.tests.length > 1
        ? 'Je dis la phrase avec « ' + mots[0] + ' », puis avec « ' + mots[1] + ' » : laquelle sonne juste ?'
        : 'Je mets « ' + mots[0] + ' » à la place du trou. Ça sonne juste ?'),
      carte.tests.map(t => el('div', { class: 'test' }, el('span', { class: 'phrase-ex' }, surligne(t.phrase, t.mot))))));
  }

  // ── Réponse : bravo, ou on réexplique ───────────────────────────────────
  repondre(carte, option, boutonTouche) {
    const r = this.jeu.repondre(option, this.aide);
    this.store.saveProgression(this.jeu.progression);

    this.boutons.forEach(b => {
      b.disabled = true;
      if (b._option.value === carte.answer) b.classList.add('juste');
      else if (b === boutonTouche) b.classList.add('rate');
    });
    this.zonePhrase.replaceChildren(...this.phraseAvecTrou(carte, carte.answer));
    this.zonePouce.replaceChildren();
    this.zoneAide.replaceChildren();

    const suivant = el('button', { type: 'button', class: 'bouton principal large',
      onclick: () => { this.jeu.suivante(); this.question(); window.scrollTo(0, 0); } },
      this.jeu.index + 1 >= this.jeu.file.length ? 'Terminer' : 'Suivant');
    const voix = this.boutonVoix(carte);
    const explication = carte.tests.map(t => el('div', { class: 'test' },
      el('span', { class: 'marque ' + (t.juste ? 'oui' : 'non') }, t.juste ? '✓' : '✗'),
      el('span', {}, surligne(t.phrase, t.mot))));

    const verdict = r.juste
      ? el('div', { class: 'verdict juste' }, el('h2', {}, 'Bravo !'),
          el('div', { class: 'conclusion' }, carte.conclusion))
      : el('div', { class: 'verdict rate' }, el('h2', {}, 'Pas tout à fait'),
          el('p', { class: 'truc-titre' }, 'Le truc :'),
          el('p', { class: 'truc' }, surlignerMots(carte.truc.texte, carte.truc.mots)),
          carte.rule ? el('div', { class: 'note' }, carte.rule) : null,
          el('p', { class: 'truc-titre' }, 'Sur cette phrase :'),
          explication,
          el('div', { class: 'conclusion' }, carte.conclusion),
          el('p', { class: 'discret' }, r.premierEssai ? 'Cette phrase reviendra dans un instant.' : 'On la reverra une autre fois.'));

    this.zoneRetour.replaceChildren(verdict, el('div', { class: 'actions' }, suivant, voix));
    suivant.focus({ preventScroll: true });
    suivant.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  boutonVoix(carte) {
    if (!this.reglages.voix || !('speechSynthesis' in window)) return null;
    return el('button', { type: 'button', class: 'bouton petit', onclick: () => this.lire(carte.complete) }, '🔊 Écouter la phrase');
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

  // ── Écran « bilan » : le tampon, les points, la série ───────────────────
  bilan() {
    const b = this.jeu.bilan();
    const maintenant = Date.now();
    let historique = this.store.getHistorique();
    if (!this.bilanEnregistre) {
      historique = DuelModel.enregistrerSeance(historique, { t: maintenant, theme: this.cle, justes: b.justes, sansAide: b.sansAide, total: b.total });
      this.store.saveHistorique(historique);
      this.bilanEnregistre = true;
    }
    const gagnes = b.sansAide * DuelModel.POINTS_PAR_REPONSE;
    const apres = DuelModel.niveauDe(DuelModel.pointsTotal(historique));
    const avant = DuelModel.niveauDe(DuelModel.pointsTotal(historique) - gagnes);
    const serie = DuelModel.serieDeJours(historique, maintenant);
    const progression = this.store.getProgression();
    const m = DuelModel.maitrise(this.theme ? this.theme.cartes : this.cartes, progression);
    const nb = this.theme ? DuelModel.seancesDuTheme(historique, this.cle) : historique.length;

    this.racine.replaceChildren(
      el('div', { class: 'haut' }, el('a', { class: 'bouton petit', href: './' }, '← Accueil')),
      el('div', { class: 'bilan' },
        el('div', { class: 'tampon' }, b.justes + ' / ' + b.total),
        el('div', { class: 'gain' }, b.justes === b.total ? 'Tout du premier coup !' : b.justes + ' du premier coup. Les autres reviendront.'),
        apres.niveau > avant.niveau ? el('div', { class: 'gain' }, '🎉 Niveau ' + apres.niveau + ' atteint !') : null,
        el('div', { class: 'gain' }, '+ ' + gagnes + ' points', serie > 0 ? '  🔥 ' + serie + (serie > 1 ? ' jours' : ' jour') + ' de suite' : ''),
        this.theme ? el('div', { class: 'gain' }, this.titre + ' ', etoiles(DuelModel.etoilesDe(m, nb))) : null,
        b.aRevoir.length ? el('div', { class: 'a-revoir' }, el('strong', {}, 'À revoir :'),
          el('ul', {}, b.aRevoir.map(c => el('li', {}, c.complete)))) : null,
        el('div', { class: 'actions' },
          el('button', { type: 'button', class: 'bouton principal large', onclick: () => this.nouvelleSeance() }, 'Encore ' + this.reglages.nombre + ' cartes'),
          el('a', { class: 'bouton large', href: './' }, 'Autre thème'),
          el('a', { class: 'bouton large', href: 'scores.html' }, 'Mes scores'))));
  }
}

chargerDonnees()
  .then(donnees => new DuelApp(document.getElementById('app'), createStore(window.localStorage), donnees, new URLSearchParams(location.search).get('theme') || 'tout'))
  .catch(() => { document.getElementById('app').replaceChildren(el('p', {}, 'Impossible de charger les phrases. Vérifie la connexion puis recharge la page.')); });
