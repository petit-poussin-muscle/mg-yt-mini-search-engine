// search.js

let docs = [];

// Fonction de normalisation (casse + accents)
function normalize(str) {
  return str
    .normalize('NFD')                // sépare lettres et accents
    .replace(/[\u0300-\u036f]/g, '') // supprime les diacritiques
    .toLowerCase();                  // passe tout en minuscules
}

// Conversion de la durée (secondes) en format mm:ss ou hh:mm:ss
function formatDuration(sec) {
  const s = Number(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = n => n.toString().padStart(2, '0');
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(secs)}`;
  }
  return `${m}:${pad(secs)}`;
}

// Initialisation : chargement des données et écouteurs
async function init() {
  const payload = await fetch('data/index-min.json').then(r => r.json());
  docs = payload.docs.map(doc => ({
    ...doc,
    normalizedTitle: doc.title.map(normalize),
    normalizedBody:  doc.body.map(normalize)
  }));

  // Recherche en temps réel dès le premier caractère
  document.getElementById('q').addEventListener('input', () => doSearch());
  document.querySelectorAll('input[name="scope"]').forEach(el =>
    el.addEventListener('change', () => doSearch())
  );
  document.querySelectorAll('input[name="liveFilter"]').forEach(el =>
    el.addEventListener('change', () => doSearch())
  );

  // Recherche initiale (0 char -> aucun résultat)
  doSearch();
}

// Fonction de recherche et application des filtres
function doSearch() {
  const raw = document.getElementById('q').value;
  const trimmed = raw.trim();
  if (trimmed.length < 1) return;

  // Split mots-clés par espaces, normaliser
  const tokens = trimmed.split(/\s+/).map(normalize).filter(t => t);

  const scope      = document.querySelector('input[name="scope"]:checked').value;
  const liveFilter = document.querySelector('input[name="liveFilter"]:checked').value;

  const results = docs.filter(doc => {
    // filtre live
    if (liveFilter === 'onlyLive' && !doc.live) return false;
    if (liveFilter === 'noLive'   &&  doc.live) return false;

    // pour chaque token, vérifier qu'il est contenu selon le scope
    return tokens.every(token => {
      const inTitle = doc.normalizedTitle.some(kw => kw.includes(token));
      const inBody  = doc.normalizedBody.some(kw => kw.includes(token));
      if (scope === 'title') return inTitle;
      if (scope === 'body')  return inBody;
      return inTitle || inBody;
    });
  });

  display(results);
}

// Fonction d’affichage des résultats
function display(results) {
  const container = document.getElementById('results');
  container.innerHTML = '';
  if (results.length === 0) {
    container.textContent = 'Aucun résultat.';
    return;
  }

  results.forEach(doc => {
    const videoUrl = `https://www.youtube.com/watch?v=${doc.id}`;
    const thumbnail = `https://i.ytimg.com/vi/${doc.id}/hqdefault.jpg`;
    const dateStr = new Date(doc.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const dur = formatDuration(doc.duration);

    const div = document.createElement('div');
    div.className = 'result';
    div.innerHTML = `
      <a href="${videoUrl}" target="_blank">
        <img src="${thumbnail}" alt="Miniature">
      </a>
      <div>
        <a href="${videoUrl}" target="_blank">
          <strong>${doc.title_raw}</strong>
        </a>
        <p>${dur} · Publié le ${dateStr}</p>
      </div>
    `;
    container.appendChild(div);
  });
}

// Lancement de l’application
init();
