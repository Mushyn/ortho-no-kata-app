// ─────────────────────────────────────────────────────────────────────────────
// Écran « Les mots » : des mots à retenir, vus un par un (flashcards), puis
// dictés dans un autre ordre : on les entend, on les écrit.
// Ce fichier dessine ; les règles sont dans mots-model.js.
// ─────────────────────────────────────────────────────────────────────────────

class MotsApp {
  constructor(racine, store, donnees) {
    this.racine = racine;
    this.store = store;
    this.cartes = MotsModel.cartesDeMots(donnees);
    this.reglages = store.getReglages();
    this.nouvelleSeance();
  }

  nouvelleSeance() {
    const progression = this.store.getProgression();
    const seance = DuelModel.choisirSeance(this.cartes, progression, this.reglages.nombre);
    this.jeu = new MotsModel.MotsGame(seance, progression);
    this.bilanEnregistre = false;
    this.afficher();
  }

  afficher() {
    const phase = this.jeu.phase;
    if (phase === 'decouverte') return this.decouverte();
    if (phase === 'pret') return this.pret();
    if (phase === 'dictee') return this.dictee();
    return this.bilan();
  }

  // ── Éléments communs ─────────────────────────────────────────────────────
  entete(titre) {
    const j = this.jeu;
    const points = el('div', { class: 'progres', role: 'img', 'aria-label': titre + ', mot ' + j.numero + ' sur ' + j.base });
    for (let i = 0; i < j.base; i++) {
      const fait = j.phase === 'dictee' ? i < j.resultats.size : i < j.index;
      const courant = j.phase === 'dictee' ? i === j.resultats.size : i === j.index;
      points.append(el('i', { class: fait ? 'fait' : (courant ? 'courant' : '') }));
    }
    return el('div', {},
      el('div', { class: 'haut' }, el('a', { class: 'bouton petit', href: './' }, '← Accueil')),
      el('div', { class: 'theme-courant' }, titre), points);
  }

  voixPossible() { return this.reglages.voix && 'speechSynthesis' in window; }

  lire(texte) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texte);
      u.lang = 'fr-FR';
      u.rate = 0.85;
      speechSynthesis.speak(u);
    } catch (e) { /* pas de voix disponible : on ne fait rien */ }
  }

  boutonEcouter(carte, grand) {
    if (!this.voixPossible()) return null;
    return el('button', { type: 'button', class: grand ? 'bouton ecouter' : 'bouton', onclick: () => this.lire(carte.dit) },
      el('span', { 'aria-hidden': 'true' }, '🔊'), ' ', grand ? 'Écouter le mot' : 'Écouter');
  }

  // ── 1. Découverte : un mot, en grand, qu'on lit et qu'on écoute ─────────
  decouverte() {
    const carte = this.jeu.courante;
    const dernier = this.jeu.index + 1 >= this.jeu.file.length;
    this.racine.replaceChildren(
      this.entete('Regarde bien les mots'),
      el('div', { class: 'carte-mot' },
        el('div', { class: 'groupe-mot' }, carte.groupe),
        el('div', { class: 'mot-grand', lang: 'fr' }, carte.mot),
        this.boutonEcouter(carte)),
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'bouton principal large', onclick: () => { this.jeu.suivanteDecouverte(); this.afficher(); } },
          dernier ? 'J\'ai tout vu' : 'Mot suivant →')));
    if (this.voixPossible()) this.lire(carte.dit);
  }

  // ── 2. Écran « prêt » ────────────────────────────────────────────────────
  pret() {
    this.racine.replaceChildren(
      el('div', { class: 'haut' }, el('a', { class: 'bouton petit', href: './' }, '← Accueil')),
      el('div', { class: 'bloc etape' },
        el('h2', {}, 'À toi d\'écrire !'),
        el('p', { class: 'texte' }, 'Tu as vu les ' + this.jeu.base + ' mots. Maintenant, dans un autre ordre : tu écoutes chaque mot et tu l\'écris.')),
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'bouton principal large', onclick: () => { this.jeu.commencerDictee(); this.afficher(); } }, 'C\'est parti')));
  }

  // ── 3. Dictée : on entend le mot, on l'écrit ─────────────────────────────
  dictee() {
    const carte = this.jeu.courante;
    const champ = this.champ();
    const valider = el('button', { type: 'button', class: 'bouton principal large' }, 'Valider');
    const zone = el('div', { 'aria-live': 'polite' });
    const ecouter = this.boutonEcouter(carte, true);
    const envoyer = () => { if (champ.value.trim()) this.verifier(carte, champ, valider, zone); };
    valider.addEventListener('click', envoyer);
    champ.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); envoyer(); } });

    this.racine.replaceChildren(
      this.entete('Écoute et écris'),
      el('div', { class: 'dictee' },
        ecouter || el('p', { class: 'texte' }, 'Le son est coupé : écris le mot « ' + carte.mot + ' ».'),
        el('label', { for: 'saisie' }, 'Écris le mot'),
        champ, zone),
      el('div', { class: 'actions' }, valider));
    if (this.voixPossible()) this.lire(carte.dit);
    champ.focus({ preventScroll: true });
  }

  // Un champ d'écriture sans aide : pas de correcteur, pas de majuscule automatique
  champ() {
    return el('input', { type: 'text', id: 'saisie', class: 'saisie', autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off',
      spellcheck: 'false', enterkeyhint: 'done', lang: 'fr', 'aria-label': 'Écris le mot que tu entends' });
  }

  // Les lettres d'un mot, celles qui manquent ou qui sont fausses en rouge
  lettres(liste, classeFausse) {
    return liste.map(l => el('span', { class: l.ok ? 'l-ok' : classeFausse }, l.c === ' ' ? ' ' : l.c));
  }

  verifier(carte, champ, valider, zone) {
    const r = this.jeu.repondre(champ.value);
    this.store.saveProgression(this.jeu.progression);
    champ.disabled = true;
    const suivant = () => { this.jeu.suivante(); this.afficher(); };

    if (r.juste) {
      zone.replaceChildren(el('div', { class: 'verdict juste' }, el('h2', {}, 'Bravo !'), el('p', { class: 'mot-verifie' }, carte.mot)));
      valider.textContent = this.jeu.index + 1 >= this.jeu.file.length ? 'Terminer' : 'Mot suivant →';
      valider.onclick = null;
      valider.replaceWith(this.boutonSuite(valider.textContent, suivant));
      return;
    }
    // Raté : on montre l'écart, puis on recopie le mot avant de continuer
    const copie = this.champ();
    copie.id = 'copie';
    copie.setAttribute('aria-label', 'Recopie le mot');
    copie.disabled = false;
    const message = el('p', { class: 'discret' }, r.premierEssai ? 'Ce mot reviendra dans un instant.' : '');
    const suite = this.boutonSuite(this.jeu.index + 1 >= this.jeu.file.length ? 'Terminer' : 'Mot suivant →', suivant);
    suite.disabled = true;
    copie.addEventListener('input', () => {
      suite.disabled = MotsModel.normaliser(copie.value) !== MotsModel.normaliser(carte.mot);
      message.textContent = suite.disabled ? '' : 'C\'est ça. Tu peux continuer.';
    });
    zone.replaceChildren(el('div', { class: 'verdict rate' },
      el('h2', {}, 'Pas tout à fait'),
      el('p', { class: 'discret' }, 'Tu as écrit :'),
      el('p', { class: 'mot-verifie' }, this.lettres(r.comparaison.ecrit, 'l-faux')),
      el('p', { class: 'discret' }, 'Le mot :'),
      el('p', { class: 'mot-verifie' }, this.lettres(r.comparaison.attendu, 'l-manque')),
      el('label', { for: 'copie' }, 'Recopie-le'),
      copie, message));
    valider.replaceWith(suite);
    copie.focus({ preventScroll: true });
    copie.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (!suite.disabled) suite.click(); } });
  }

  boutonSuite(texte, action) {
    return el('button', { type: 'button', class: 'bouton principal large', onclick: action }, texte);
  }

  // ── 4. Bilan ─────────────────────────────────────────────────────────────
  bilan() {
    const b = this.jeu.bilan();
    const maintenant = Date.now();
    let historique = this.store.getHistorique();
    if (!this.bilanEnregistre) {
      historique = DuelModel.enregistrerSeance(historique, { t: maintenant, theme: MotsModel.CLE_MOTS, justes: b.justes, sansAide: b.sansAide, total: b.total });
      this.store.saveHistorique(historique);
      this.bilanEnregistre = true;
    }
    const gagnes = b.sansAide * DuelModel.POINTS_PAR_REPONSE;
    const apres = DuelModel.niveauDe(DuelModel.pointsTotal(historique));
    const avant = DuelModel.niveauDe(DuelModel.pointsTotal(historique) - gagnes);
    const serie = DuelModel.serieDeJours(historique, maintenant);
    const m = DuelModel.maitrise(this.cartes, this.store.getProgression());

    this.racine.replaceChildren(
      el('div', { class: 'haut' }, el('a', { class: 'bouton petit', href: './' }, '← Accueil')),
      el('div', { class: 'bilan' },
        el('div', { class: 'tampon' }, b.justes + ' / ' + b.total),
        el('div', { class: 'gain' }, b.justes === b.total ? 'Tous les mots du premier coup !' : b.justes + ' du premier coup. Les autres reviendront.'),
        apres.niveau > avant.niveau ? el('div', { class: 'gain' }, '🎉 Niveau ' + apres.niveau + ' atteint !') : null,
        el('div', { class: 'gain' }, '+ ' + gagnes + ' points', serie > 0 ? '  🔥 ' + serie + (serie > 1 ? ' jours' : ' jour') + ' de suite' : ''),
        el('div', { class: 'gain' }, 'Les mots ', etoiles(DuelModel.etoilesDe(m, DuelModel.seancesDuTheme(historique, MotsModel.CLE_MOTS)))),
        b.aRevoir.length ? el('div', { class: 'a-revoir' }, el('strong', {}, 'À revoir :'),
          el('ul', {}, b.aRevoir.map(c => el('li', {}, c.mot)))) : null,
        el('div', { class: 'actions' },
          el('button', { type: 'button', class: 'bouton principal large', onclick: () => this.nouvelleSeance() }, 'Encore ' + this.reglages.nombre + ' mots'),
          el('a', { class: 'bouton large', href: './' }, 'Accueil'),
          el('a', { class: 'bouton large', href: 'scores.html' }, 'Mes scores'))));
  }
}

chargerMots()
  .then(donnees => new MotsApp(document.getElementById('app'), createStore(window.localStorage), donnees))
  .catch(() => { document.getElementById('app').replaceChildren(el('p', {}, 'Impossible de charger les mots. Vérifie la connexion puis recharge la page.')); });
