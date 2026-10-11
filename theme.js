// Applique l'ambiance choisie (arcade, sport, sakura) avant que la page s'affiche, pour éviter un flash.
(function () {
  try {
    var r = JSON.parse(localStorage.getItem('ortho:reglages') || '{}');
    if (r.theme === 'dojo') r.theme = 'sakura';   // ancien nom de l'ambiance
    if (r.theme) document.documentElement.setAttribute('data-theme', r.theme);
  } catch (e) { /* stockage indisponible : ambiance par défaut */ }
})();
