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

// Une étoile (SVG). Pleine = acquise, vide = à gagner.
function etoileSvg(pleine) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M12 2.6l2.8 6.3 6.9.6-5.2 4.6 1.6 6.7L12 17.1l-6.1 3.7 1.6-6.7-5.2-4.6 6.9-.6z');
  path.setAttribute('class', pleine ? 'etoile-pleine' : 'etoile-vide');
  svg.append(path);
  return svg;
}

// Trois étoiles : n pleines
function etoiles(n, max = 3) {
  const conteneur = el('span', { class: 'etoiles', role: 'img', 'aria-label': n + ' étoile' + (n > 1 ? 's' : '') + ' sur ' + max });
  for (let i = 0; i < max; i++) conteneur.append(etoileSvg(i < n));
  return conteneur;
}

// Un mot dans une phrase, mis en évidence au surligneur
function surligne(texte, mot) {
  return avecMotEnGras(texte, mot, 'surligne');
}

// Lien d'une page vers une autre avec le thème en paramètre
function lienTheme(page, cle) { return page + '?theme=' + encodeURIComponent(cle); }

// Date lisible : « 10 oct. »
function dateCourte(t) {
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Met en évidence plusieurs mots dans un texte, dans l'ordre où on les trouve
function surlignerMots(texte, mots) {
  const parts = [];
  let reste = texte;
  for (const mot of mots) {
    const i = reste.indexOf('« ' + mot + ' »');
    if (i < 0) continue;
    const debut = i + 2;
    parts.push(reste.slice(0, debut), el('b', { class: 'surligne' }, mot));
    reste = reste.slice(debut + mot.length);
  }
  parts.push(reste);
  return parts;
}

// Charge la liste des mots du jeu « Les mots »
async function chargerMots() {
  const r = await fetch('data/mots-v1.json');
  if (!r.ok) throw new Error('Mots introuvables');
  return r.json();
}
