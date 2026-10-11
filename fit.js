// ─────────────────────────────────────────────────────────────────────────────
// Une page = un écran. On mesure si le contenu dépasse la hauteur de l'écran et,
// si oui, on réduit tout d'un coup (polices, zones, boutons) avec le "zoom" CSS
// de la zone principale, juste ce qu'il faut pour que tout tienne.
//   - la hauteur de #app vaut 100dvh / zoom (voir style.css)
//   - plancher de zoom : data-zoom-min sur <body> (0.55 par défaut). En dessous,
//     le texte serait trop petit : on laisse alors défiler.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  const app = document.getElementById('app');
  if (!app) return;
  const plancher = parseFloat(document.body.dataset.zoomMin || '0.55');
  let attente = false;

  function tient(z) {
    app.style.setProperty('--z', String(z));
    return app.scrollHeight <= app.clientHeight + 1;
  }

  let raison = '';
  function ajuster() {
    attente = false;
    // Pendant la saisie, le clavier réduit la fenêtre : on garde la taille déjà réglée
    const actif = document.activeElement;
    if (raison === 'resize' && actif && actif.tagName === 'INPUT' && actif.type === 'text') return;
    if (tient(1)) return;
    let bas = plancher, haut = 1;
    if (!tient(bas)) return;          // trop long même au plancher : défilement
    for (let i = 0; i < 8; i++) {
      const milieu = (bas + haut) / 2;
      if (tient(milieu)) bas = milieu; else haut = milieu;
    }
    tient(Math.floor(bas * 100) / 100);
  }

  function planifier(e) {
    raison = e && e.type === 'resize' ? 'resize' : '';
    if (attente) return;
    attente = true;
    requestAnimationFrame(ajuster);
  }

  new MutationObserver(planifier).observe(app, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', planifier);
  window.addEventListener('orientationchange', planifier);
  window.addEventListener('load', planifier);
  document.addEventListener('toggle', planifier, true);
  document.addEventListener('focusout', planifier, true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(planifier);
  planifier();
})();
