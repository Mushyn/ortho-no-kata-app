// ─────────────────────────────────────────────────────────────────────────────
// Stockage local (progression, réglages). Les données personnelles de Louis
// restent dans son navigateur : rien n'est envoyé nulle part.
//
// Comme dans Kana no Katas, on INJECTE le stockage (createStore(storage)) :
// - dans le navigateur on passe localStorage
// - dans les tests on passe un faux stockage
// - si localStorage est bloqué (navigation privée...), on retombe sur la mémoire
// ─────────────────────────────────────────────────────────────────────────────

const PREFIXE = 'ortho:';
const REGLAGES_PAR_DEFAUT = { nombre: 5, voix: true, prenom: '' };

function createStore(storage) {
  const memoire = new Map();   // repli quand le stockage est indisponible

  function lire(cle) {
    try {
      const v = storage ? storage.getItem(PREFIXE + cle) : null;
      if (v !== null && v !== undefined) return v;
    } catch (e) { /* stockage bloqué : on utilise la mémoire */ }
    return memoire.has(cle) ? memoire.get(cle) : null;
  }

  function ecrire(cle, texte) {
    memoire.set(cle, texte);
    try { if (storage) storage.setItem(PREFIXE + cle, texte); } catch (e) { /* idem */ }
  }

  function get(cle, parDefaut) {
    const brut = lire(cle);
    if (brut === null) return parDefaut;
    try { return JSON.parse(brut); } catch (e) { return parDefaut; }
  }

  function set(cle, valeur) { ecrire(cle, JSON.stringify(valeur)); }

  return {
    get, set,
    getProgression: () => get('progression', {}),
    saveProgression: p => set('progression', p),
    getReglages: () => Object.assign({}, REGLAGES_PAR_DEFAUT, get('reglages', {})),
    saveReglages: r => set('reglages', r),
    // Historique des séances (scores conservés) et leçons déjà vues
    getHistorique: () => get('historique', []),
    saveHistorique: h => set('historique', h),
    getLecons: () => get('lecons', {}),
    marquerLecon(cle) { const l = get('lecons', {}); l[cle] = true; set('lecons', l); },
    // Export / import de la progression en fichier JSON (sauvegarde, changement de téléphone)
    exporter: () => JSON.stringify({ app: 'ortho-no-kata', version: 1, progression: get('progression', {}), historique: get('historique', []), lecons: get('lecons', {}), reglages: get('reglages', {}) }),
    importer(texte) {
      const o = JSON.parse(texte);
      if (!o || o.app !== 'ortho-no-kata' || typeof o.progression !== 'object') throw new Error('Fichier non reconnu');
      set('progression', o.progression);
      if (Array.isArray(o.historique)) set('historique', o.historique);
      if (o.lecons && typeof o.lecons === 'object') set('lecons', o.lecons);
      if (o.reglages) set('reglages', o.reglages);
    }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createStore, REGLAGES_PAR_DEFAUT };
} else {
  window.createStore = createStore;
}
