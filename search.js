// search.js

let docs = [];
let currentTokens = []; // pour stocker les mots-clés de recherche

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
    const files = [
    { path: "data/index-live-2024-min.json",     key: "live",    cache: true },
    { path: "data/index-nonlive-2024-min.json",  key: "nonlive", cache: true },
    { path: "data/index-live-2025-min.json",     key: "live",    cache: false },
    { path: "data/index-nonlive-2025-min.json",  key: "nonlive", cache: false }
  ];

  // safe fetch helper (minimal)
  async function fetchJsonSafe(path, opts) {
    try {
      const res = opts ? await fetch(path, opts) : await fetch(path);
      if (!res.ok) return { updated: null, docs: [] };
      return await res.json();
    } catch (e) {
      return { updated: null, docs: [] };
    }
  }

  // group incoming files by their key and merge docs + pick latest updated
  const grouped = {};
  let globalLastUpdate = null;

  for (const f of files) {
    const opts = (f.cache === false) ? { cache: 'no-store' } : undefined;
    const json = await fetchJsonSafe(f.path, opts);

    if (!grouped[f.key]) grouped[f.key] = { docsRaw: [], lastUpdated: null };

    if (Array.isArray(json.docs)) grouped[f.key].docsRaw.push(...json.docs);

    if (json.updated) {
      const u = new Date(json.updated);
      if (!grouped[f.key].lastUpdated || u > grouped[f.key].lastUpdated) grouped[f.key].lastUpdated = u;
      if (!globalLastUpdate || u > globalLastUpdate) globalLastUpdate = u;
    }
  }

  // build objects compatible with your original code (liveData / nonliveData)
  const liveData = {
    updated: grouped.live?.lastUpdated ? grouped.live.lastUpdated.toISOString() : undefined,
    docs: grouped.live?.docsRaw || []
  };
  const nonliveData = {
    updated: grouped.nonlive?.lastUpdated ? grouped.nonlive.lastUpdated.toISOString() : undefined,
    docs: grouped.nonlive?.docsRaw || []
  };

  docs = [
    ...liveData.docs.map(doc => ({ ...doc, live: true })),
    ...nonliveData.docs.map(doc => ({ ...doc, live: false }))
  ].map(doc => ({
    ...doc,
    normalizedTitle: normalize(doc.t).split(/\s+/).filter(Boolean),
    normalizedBody: doc.b.map(item => normalize(Object.keys(item)[0]))
  }));

  const qEl = document.getElementById('q');
  const sortEl = document.getElementById('sort');
  const showTCEl = document.getElementById('show-timecodes');

  qEl.addEventListener('input', doSearch);
  sortEl.addEventListener('change', doSearch);
  document.querySelectorAll('input[name="scope"]').forEach(el => el.addEventListener('change', doSearch));
  document.querySelectorAll('input[name="liveFilter"]').forEach(el => el.addEventListener('change', doSearch));
  showTCEl.addEventListener('change', doSearch);

  doSearch();
}

// Recherche + filtres + tri
function doSearch() {
  const raw = document.getElementById('q').value.trim();
  if (!raw) {
    document.getElementById('result-count').textContent = '';
    document.getElementById('results').innerHTML = '';
    currentTokens = [];
    return;
  }
  currentTokens = raw.split(/\s+/).map(normalize).filter(Boolean);
  const scope = document.querySelector('input[name="scope"]:checked').value;
  const liveFilter = document.querySelector('input[name="liveFilter"]:checked').value;
  const sortVal = document.getElementById('sort').value;

  let results = docs.filter(doc => {
    if (liveFilter === 'onlyLive' && !doc.live) return false;
    if (liveFilter === 'noLive' && doc.live) return false;
    return currentTokens.every(token => {
      const inTitle = doc.normalizedTitle.some(kw => kw.includes(token));
      const inBody = doc.normalizedBody.some(kw => kw.includes(token));
      if (scope === 'title') return inTitle;
      if (scope === 'body') return inBody;
      return inTitle || inBody;
    });
  });

  results.sort((a, b) => {
    switch (sortVal) {
      case 'date_asc': return new Date(a.at) - new Date(b.at);
      case 'date_desc': return new Date(b.at) - new Date(a.at);
      case 'duration_asc': return a.d - b.d;
      case 'duration_desc': return b.d - a.d;
      case 'title_asc': return a.t.localeCompare(b.t);
      case 'title_desc': return b.t.localeCompare(a.t);
      default: return 0;
    }
  });

  display(results);
}

// Affichage des résultats
function display(results) {
  const container = document.getElementById('results');
  container.innerHTML = '';
  document.getElementById('result-count').textContent = `${results.length} résultat${results.length > 1 ? 's' : ''}`;

  if (!results.length) {
    container.textContent = 'Aucun résultat.';
    return;
  }

  const showTC = document.getElementById('show-timecodes').checked;

  results.forEach(doc => {
    const videoUrl = `https://www.youtube.com/watch?v=${doc.i}`;
    const thumbnail = `https://i.ytimg.com/vi/${doc.i}/hqdefault.jpg`;
    const dateStr = new Date(doc.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const dur = formatDuration(doc.d);

    // Conteneur principal en bloc
    const div = document.createElement('div');
    div.className = 'result';
    div.style.display = 'block';
    div.style.marginBottom = '1em';

    // Wrapper flex pour image + info
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';

    const imgLink = document.createElement('a');
    imgLink.href = videoUrl;
    imgLink.target = '_blank';
    const img = document.createElement('img');
    img.src = thumbnail;
    img.alt = 'Miniature';
    img.style.width = '120px';
    img.style.height = '90px';
    img.style.objectFit = 'cover';
    imgLink.appendChild(img);

    const info = document.createElement('div');
    info.style.marginLeft = '1em';
    info.innerHTML = `<a href="${videoUrl}" target="_blank"><strong>${doc.t}</strong></a><p>${dur} · Publié le ${dateStr}</p>`;

    wrapper.appendChild(imgLink);
    wrapper.appendChild(info);
    div.appendChild(wrapper);

    // Timecodes sous le wrapper, une ligne par mot-clé
    if (showTC && doc.b?.length) {
      const filtered = doc.b.filter(item => normalize(Object.keys(item)[0]).startsWith(
        currentTokens.find(tok => normalize(Object.keys(item)[0]).startsWith(tok))
      ));
      filtered.forEach(item => {
        const kw = Object.keys(item)[0];
        const timesArr = item[kw];
        // Création des liens pour chaque timecode
        const links = timesArr.length > 0 ? timesArr.map(t => {
          const disp = formatDuration(t);
          return `<a href="${videoUrl}&t=${t}s" target="_blank">${disp}</a>`;
        }).join(', ') : 'timecode non trouvé';
        const p = document.createElement('p');
        p.className = 'timecodes';
        p.style.margin = '0.3em 0 0 2.5em'; // indent sous wrapper
        // Afficher le mot-clé suivi des liens (pas de crochets)
        p.innerHTML = `${kw} : ${links}`;
        div.appendChild(p);
      });
    }

    container.appendChild(div);
  });
}

init();
