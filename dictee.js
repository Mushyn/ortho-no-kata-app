// ─────────────────────────────────────────────────────────────────────────────
// Écran « Mini-dictée » : on tire une dictée de 3 phrases. Pour chaque phrase on
// l'entend, on l'écrit, puis on corrige avec les contextes et les astuces du thème.
// Ce fichier dessine ; les règles sont dans dictees-model.js.
// ─────────────────────────────────────────────────────────────────────────────

class DicteeApp {
  constructor(racine, store, donnees, phrases, cleNiveau) {
    this.racine = racine;
    this.store = store;
    this.niveaux = DicteesModel.niveauxDe(donnees, phrases);
    this.reglages = store.getReglages();
    const etats = DicteesModel.etatDesNiveaux(this.niveaux, store.getProgression(), store.getHistorique());
    const demande = etats.find(e => e.niveau.key === cleNiveau && e.debloque);
    // sans choix valable : le niveau ouvert le plus avancé
    this.etat = demande || etats.filter(e => e.debloque).pop();
    this.niveau = this.etat.niveau;
    this.nouvelleSeance();
  }

  nouvelleSeance() {
    const progression = this.store.getProgression();
    // niveaux déjà ouverts avant la séance : pour annoncer un déblocage une seule fois
    this.ouvertsAuDepart = new Set(DicteesModel.etatDesNiveaux(this.niveaux, progression, this.store.getHistorique()).filter(e => e.debloque).map(e => e.niveau.key));
    const dictee = DicteesModel.choisirDictee(this.niveau.dictees, progression);
    this.jeu = new DicteesModel.DicteeGame(dictee, progression);
    this.bilanEnregistre = false;
    this.intro();
  }

  voixPossible() { return this.reglages.voix && 'speechSynthesis' in window; }

  lire(texte, lent) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texte);
      u.lang = 'fr-FR';
      u.rate = lent ? 0.6 : 0.85;
      speechSynthesis.speak(u);
    } catch (e) { /* pas de voix disponible : on ne fait rien */ }
  }

  haut() { return el('div', { class: 'haut' }, el('a', { class: 'bouton petit', href: './' }, '← Accueil')); }

  // ── Introduction : la dictée du jour et ce qu'on y travaille ─────────────
  intro() {
    const d = this.jeu.dictee;
    this.racine.replaceChildren(
      this.haut(),
      el('div', { class: 'bloc etape' },
        el('h2', {}, 'Mini-dictée : ' + d.titre),
        el('p', { class: 'texte' }, this.niveau.label + '. ' + this.jeu.base + ' phrases : tu écoutes, tu écris, puis on corrige ensemble.'),
        el('p', { class: 'texte' }, 'On travaille : ', el('span', { class: 'surligne' }, d.objectif), '.'),
        el('p', { class: 'discret' }, 'N\'oublie pas la majuscule au début et le point à la fin.')),
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'bouton principal large', onclick: () => { this.jeu.commencer(); this.phrase(); } }, 'C\'est parti')));
  }

  entete() {
    const j = this.jeu;
    const points = el('div', { class: 'progres', role: 'img', 'aria-label': 'Phrase ' + j.numero + ' sur ' + j.base });
    for (let i = 0; i < j.base; i++) points.append(el('i', { class: i < j.resultats.size ? 'fait' : (i === j.resultats.size ? 'courant' : '') }));
    return el('div', {}, this.haut(), el('div', { class: 'theme-courant' }, 'Écoute et écris la phrase'), points);
  }

  // Un champ d'écriture sans aide : pas de correcteur, pas de majuscule automatique
  champ(id, etiquette) {
    return el('textarea', { id, class: 'saisie phrase-saisie', rows: '3', autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off',
      spellcheck: 'false', enterkeyhint: 'done', lang: 'fr', 'aria-label': etiquette });
  }

  // ── Une phrase : on écoute, on écrit ─────────────────────────────────────
  phrase() {
    const carte = this.jeu.courante;
    const champ = this.champ('saisie', 'Écris la phrase que tu entends');
    const valider = el('button', { type: 'button', class: 'bouton principal large' }, 'Valider');
    const zone = el('div', { 'aria-live': 'polite' });
    const envoyer = () => { if (champ.value.trim()) this.verifier(carte, champ, valider, zone); };
    valider.addEventListener('click', envoyer);
    champ.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); envoyer(); } });

    const voix = this.voixPossible()
      ? el('div', { class: 'ligne' },
          el('button', { type: 'button', class: 'bouton ecouter', onclick: () => this.lire(carte.texte, false) }, el('span', { 'aria-hidden': 'true' }, '🔊'), 'Écouter la phrase'),
          el('button', { type: 'button', class: 'bouton', onclick: () => this.lire(carte.texte, true) }, el('span', { 'aria-hidden': 'true' }, '🐢'), 'Plus lentement'))
      : el('p', { class: 'texte' }, 'Le son est coupé : écris la phrase « ' + carte.texte + ' ».');
    this.racine.replaceChildren(this.entete(),
      el('div', { class: 'dictee' }, voix, el('label', { for: 'saisie' }, 'Écris la phrase'), champ, zone),
      el('div', { class: 'actions' }, valider));
    if (this.voixPossible()) this.lire(carte.texte, false);
    champ.focus({ preventScroll: true });
  }

  // Les mots d'une phrase : les faux en rouge (écrit) ou soulignés en vert (à écrire)
  mots(texte, liste, classeFausse) {
    const sortie = [];
    let fin = 0;
    for (const m of liste) {
      if (m.debut > fin) sortie.push(texte.slice(fin, m.debut));
      sortie.push(m.ok ? m.t : el('span', { class: classeFausse }, m.t));
      fin = m.fin;
    }
    return sortie;
  }

  verifier(carte, champ, valider, zone) {
    const r = this.jeu.repondre(champ.value);
    this.store.saveProgression(this.jeu.progression);
    champ.disabled = true;
    const dernier = this.jeu.index + 1 >= this.jeu.file.length;
    const suivant = () => { this.jeu.suivante(); this.jeu.fini ? this.bilan() : this.phrase(); };
    const bouton = this.boutonSuite(dernier ? 'Terminer' : 'Phrase suivante →', suivant);

    if (r.juste) {
      zone.replaceChildren(el('div', { class: 'verdict juste' }, el('h2', {}, 'Bravo !'), el('p', { class: 'phrase-verifiee' }, carte.texte)));
      valider.replaceWith(bouton);
      return;
    }
    const copie = this.champ('copie', 'Recopie la phrase');
    const message = el('p', { class: 'discret' }, r.premierEssai ? 'Cette phrase reviendra dans un instant.' : '');
    bouton.disabled = true;
    copie.addEventListener('input', () => {
      bouton.disabled = !DicteesModel.comparerPhrase(carte.texte, copie.value).juste;
      message.textContent = bouton.disabled ? '' : 'C\'est ça. Tu peux continuer.';
    });
    copie.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (!bouton.disabled) bouton.click(); } });

    zone.replaceChildren(el('div', { class: 'verdict rate' },
      el('h2', {}, 'Pas tout à fait'),
      el('p', { class: 'discret' }, 'Tu as écrit :'),
      el('p', { class: 'phrase-verifiee' }, this.mots(champ.value.trim(), r.comparaison.ecrit, 'l-faux')),
      el('p', { class: 'discret' }, 'La phrase :'),
      el('p', { class: 'phrase-verifiee' }, this.mots(carte.texte, r.comparaison.attendu, 'l-manque')),
      this.corrections(carte, r.erreurs),
      el('label', { for: 'copie' }, 'Recopie la phrase'), copie, message));
    valider.replaceWith(bouton);
    copie.focus({ preventScroll: true });
  }

  // Les contextes et astuces : un bloc par point à corriger
  corrections(carte, erreurs) {
    const blocs = erreurs.points.map(p => {
      const k = p.correction;
      let contenu;
      if (k.type === 'test') {
        contenu = [
          el('p', { class: 'truc' }, k.question),
          ...k.tests.map(t => el('div', { class: 'test' }, el('span', { class: 'marque ' + (t.juste ? 'oui' : 'non') }, t.juste ? '✓' : '✗'), el('span', {}, surligne(t.phrase, t.mot)))),
          el('div', { class: 'conclusion' }, k.conclusion)];
      } else if (k.lignes) {
        contenu = k.lignes.map(l => el('p', { class: 'truc' }, l));
      } else {
        contenu = el('p', { class: 'truc' }, 'Regarde bien la fin du mot « ', el('b', {}, p.mot), ' ».');
      }
      return el('div', { class: 'correction' }, el('div', { class: 'truc-titre' }, 'Pour « ' + p.mot + ' » : ' + k.theme), contenu);
    });
    if (erreurs.autres.length) {
      blocs.push(el('p', { class: 'discret' }, 'À revoir aussi : ' + erreurs.autres.map(m => '« ' + m + ' »').join(', ') + '.'));
    }
    return blocs;
  }

  boutonSuite(texte, action) {
    return el('button', { type: 'button', class: 'bouton principal large', onclick: action }, texte);
  }

  // ── Bilan ────────────────────────────────────────────────────────────────
  bilan() {
    const b = this.jeu.bilan();
    const maintenant = Date.now();
    const cle = DicteesModel.cleDeThemeDictee(this.niveau.key);
    let historique = this.store.getHistorique();
    if (!this.bilanEnregistre) {
      historique = DuelModel.enregistrerSeance(historique, { t: maintenant, theme: cle, justes: b.justes, sansAide: b.sansAide, total: b.total });
      this.store.saveHistorique(historique);
      this.bilanEnregistre = true;
    }
    const gagnes = b.sansAide * DuelModel.POINTS_PAR_REPONSE;
    const apres = DuelModel.niveauDe(DuelModel.pointsTotal(historique));
    const avant = DuelModel.niveauDe(DuelModel.pointsTotal(historique) - gagnes);
    const serie = DuelModel.serieDeJours(historique, maintenant);
    const etats = DicteesModel.etatDesNiveaux(this.niveaux, this.store.getProgression(), historique);
    const etat = etats.find(e => e.niveau.key === this.niveau.key);
    const suivant = etats[etats.indexOf(etat) + 1];
    const debloque = suivant && suivant.debloque && !this.ouvertsAuDepart.has(suivant.niveau.key);

    this.racine.replaceChildren(
      this.haut(),
      el('div', { class: 'bilan' },
        el('div', { class: 'tampon' }, b.justes + ' / ' + b.total),
        el('div', { class: 'gain' }, b.justes === b.total ? 'Dictée sans faute !' : b.justes + ' phrases du premier coup. Les autres reviendront.'),
        apres.niveau > avant.niveau ? el('div', { class: 'gain' }, '🎉 Niveau ' + apres.niveau + ' atteint !') : null,
        debloque ? el('div', { class: 'gain' }, '🔓 ' + suivant.niveau.label + ' débloqué !') : null,
        el('div', { class: 'gain' }, '+ ' + gagnes + ' points', serie > 0 ? '  🔥 ' + serie + (serie > 1 ? ' jours' : ' jour') + ' de suite' : ''),
        el('div', { class: 'gain' }, this.niveau.label + ' ', etoiles(etat.etoiles)),
        b.aRevoir.length ? el('div', { class: 'a-revoir' }, el('strong', {}, 'À revoir :'),
          el('ul', {}, b.aRevoir.map(c => el('li', {}, c.texte)))) : null,
        el('div', { class: 'actions' },
          el('button', { type: 'button', class: 'bouton principal large', onclick: () => this.nouvelleSeance() }, 'Une autre dictée'),
          el('a', { class: 'bouton large', href: './' }, 'Accueil'),
          el('a', { class: 'bouton large', href: 'scores.html' }, 'Mes scores'))));
  }
}

Promise.all([chargerDictees(), chargerDonnees()])
  .then(([dictees, phrases]) => new DicteeApp(document.getElementById('app'), createStore(window.localStorage), dictees, phrases, new URLSearchParams(location.search).get('niveau')))
  .catch(() => { document.getElementById('app').replaceChildren(el('p', {}, 'Impossible de charger les dictées. Vérifie la connexion puis recharge la page.')); });
