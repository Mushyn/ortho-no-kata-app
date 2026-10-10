// Enregistrement du service worker et bandeau « Nouvelle version disponible ».
// Comme dans Kana no Katas : la mise à jour n'est activée QUE quand l'utilisateur appuie
// sur le bouton (pas de rechargement par surprise pendant une séance).
(function () {
  if (!('serviceWorker' in navigator)) return;

  // Vrai si l'appli était déjà installée avant cette visite : seulement dans ce cas, un
  // changement de service worker est une MISE À JOUR (sinon c'est la première installation,
  // et il ne faut surtout pas recharger la page).
  const etaitInstallee = !!navigator.serviceWorker.controller;

  function montrerBandeau(worker) {
    const bandeau = document.getElementById('maj');
    if (!bandeau) return;
    bandeau.classList.add('visible');
    bandeau.querySelector('button').addEventListener('click', () => worker.postMessage('SKIP_WAITING'));
  }

  navigator.serviceWorker.register('sw.js').then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) montrerBandeau(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nouveau = reg.installing;
      if (!nouveau) return;
      nouveau.addEventListener('statechange', () => {
        if (nouveau.state === 'installed' && navigator.serviceWorker.controller) montrerBandeau(nouveau);
      });
    });
  }).catch(() => { /* hors HTTPS ou file:// : l'appli marche quand même, sans mode hors ligne */ });

  let rechargement = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (rechargement || !etaitInstallee) return;
    rechargement = true;
    location.reload();
  });
})();
