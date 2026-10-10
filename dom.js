// Petit outil pour construire des éléments sans innerHTML (pas d'injection possible).
// el('button', { class: 'principal', onclick: f }, 'Texte', autreElement)
function el(tag, attrs, ...enfants) {
  const n = document.createElement(tag);
  for (const [cle, val] of Object.entries(attrs || {})) {
    if (val === false || val === null || val === undefined) continue;
    if (cle.startsWith('on')) n.addEventListener(cle.slice(2), val);
    else if (cle === 'class') n.className = val;
    else n.setAttribute(cle, val === true ? '' : val);
  }
  for (const e of enfants.flat()) {
    if (e === null || e === undefined || e === false) continue;
    n.append(e.nodeType ? e : document.createTextNode(String(e)));
  }
  return n;
}

// Découpe `texte` autour de `mot` et met le mot en gras : « Il <b>avait</b> mal »
function avecMotEnGras(texte, mot, classe) {
  const i = mot ? texte.indexOf(mot) : -1;
  if (i < 0) return [texte];
  return [texte.slice(0, i), el('b', { class: classe || '' }, mot), texte.slice(i + mot.length)];
}

// Charge le fichier de phrases
async function chargerDonnees() {
  const r = await fetch('data/phrases-v1.json');
  if (!r.ok) throw new Error('Phrases introuvables');
  return r.json();
}
