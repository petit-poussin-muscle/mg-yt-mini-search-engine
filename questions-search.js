// questions-search.js

let docs = [];

// Fonction de normalisation (casse + accents)
function normalize(str) {
  return str
    .normalize('NFD')                // sépare lettres et accents
    .replace(/[\u0300-\u036f]/g, '') // supprime les diacritiques
    .toLowerCase();                  // tout en minuscules
}

// Conversion de la durée (secondes) en format mm:ss ou hh:mm:ss
function formatDuration(sec) {
  const s = Number(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = n => n.toString().padStart(2, '0');
  return h > 0
    ? `${h}:${pad(m)}:${pad(secs)}`
    : `${m}:${pad(secs)}`;
}

// Initialisation : chargement des données et écouteurs
async function init() {
    // list the files you want to merge (add 2026, 2027... as needed)
  const files = [
    { path: 'data/questions-2024-min.json', cache: true },
    { path: 'data/questions-2025-min.json', cache: false }
  ];

  // safe fetch helper (accepts optional fetch options)
  async function fetchJsonSafe(path, opts) {
    try {
      const res = opts ? await fetch(path, opts) : await fetch(path);
      if (!res.ok) return { updated: null, docs: [] };
      return await res.json();
    } catch (e) {
      return { updated: null, docs: [] };
    }
  }

  // merge files: concat docs and keep the latest updated timestamp
  let mergedDocs = [];
  let lastUpdate = null;
  for (const f of files) {
    const opts = (f.cache === false) ? { cache: 'no-store' } : undefined;
    const json = await fetchJsonSafe(f.path, opts);
    if (Array.isArray(json.docs)) mergedDocs.push(...json.docs);
    if (json.updated) {
      const u = new Date(json.updated);
      if (!lastUpdate || u > lastUpdate) lastUpdate = u;
    }
  }

  // build payload-like object (similar shape to original single-file payload)
  const payload = {
    updated: lastUpdate ? lastUpdate.toISOString() : undefined,
    docs: mergedDocs
  };

  // Préparation des docs pour la recherche
  docs = payload.docs.map(doc => ({
    ...doc,
    normalizedTitle: normalize(doc.t),
    normalizedBody: normalize(doc.q)
  }));

  // Affiche date de mise à jour et nombre de questions
  const d = new Date(payload.updated);
  document.getElementById('updated-date').textContent =
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('video-count').textContent = payload.docs.length;

  // Liaison recherche et tri (texte et select#sort uniquement)
  document.getElementById('q').addEventListener('input',  doSearch);
  document.getElementById('sort').addEventListener('change', doSearch);

  // Recherche initiale
  doSearch();
}

// Fonction de recherche et tri
function doSearch() {
  const raw = document.getElementById('q').value.trim();
  if (raw.length < 1) {
    document.getElementById('result-count').textContent = '';
    document.getElementById('results').innerHTML = '';
    return;
  }

  const tokens = raw.split(/\s+/).map(normalize).filter(t => t);
  const sortVal = document.getElementById('sort').value;

  let results = docs.filter(doc =>
    tokens.every(token =>
      doc.normalizedTitle.includes(token) ||
      doc.normalizedBody.includes(token)
    )
  );

  // Tri selon le select
  results.sort((a, b) => {
    switch (sortVal) {
      case 'date_asc':     return new Date(a.at) - new Date(b.at);
      case 'date_desc':    return new Date(b.at) - new Date(a.at);
      case 'duration_asc': return a.d - b.d;
      case 'duration_desc':return b.d - a.d;
      case 'question_asc':    return a.q.localeCompare(b.q);
      case 'question_desc':   return b.q.localeCompare(a.q);
      default:             return 0;
    }
  });

  display(results);
}

// Affichage des résultats
function display(results) {
  const container = document.getElementById('results');
  const countEl   = document.getElementById('result-count');
  container.innerHTML = '';
  countEl.textContent = `${results.length} résultat${results.length > 1 ? 's' : ''}`;

  if (results.length === 0) {
    container.textContent = 'Aucun résultat.';
    return;
  }

  results.forEach(doc => {
    // Lien YouTube incluant le timestamp t pour démarrer à la question
    const videoUrl = `https://www.youtube.com/watch?v=${doc.i}&t=${doc.s}s`;
    const thumb    = `https://i.ytimg.com/vi/${doc.i}/hqdefault.jpg`;
    const dateStr  = new Date(doc.at)
                        .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const dur      = formatDuration(doc.d);

    const div = document.createElement('div');
    div.className = 'result';
    div.innerHTML = `
      <a href="${videoUrl}" target="_blank">
        <img src="${thumb}" alt="Miniature">
      </a>
      <div>
        <a href="${videoUrl}" target="_blank"><strong>${doc.q}</strong></a>
        <p>${doc.t}</p>
        <p>${dur} · Publié le ${dateStr}</p>
      </div>
    `;
    container.appendChild(div);
  });
}

// Lancement
init();
