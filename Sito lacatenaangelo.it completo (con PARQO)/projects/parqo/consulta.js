// Consultazione in sola lettura (ruolo Visualizzatore, es. l'avvocato): solo le multe non pagate.
// Realizzato da Angelo Lacatena® (lacatenaangelo.it).
const $ = id => document.getElementById(id);
let multe = [];

function el(tag, attributi = {}, ...figli) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attributi)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v != null) e.setAttribute(k, v);
  }
  for (const f of figli) if (f != null) e.append(f);
  return e;
}
const formatoData = iso => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

async function chiama(metodo, url, dati) {
  const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: dati ? JSON.stringify(dati) : undefined });
  if (r.status === 401) { location.href = 'login.html'; throw new Error('Accesso richiesto'); }
  if (r.status === 403 && r.headers.get('X-Accesso') === 'sospeso') { location.href = 'login.html'; throw new Error('Accesso sospeso'); }
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.errore || 'Errore ' + r.status);
  return corpo;
}

const soldi = v => (v == null ? '—' : v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));

function disegna() {
  const cerca = $('cerca').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const lista = multe.filter(m => !cerca || (m.targa || '').includes(cerca) || String(m.numero || '') === cerca || (m.proprietario || '').toUpperCase().replace(/[^A-Z0-9]/g, '').includes(cerca))
    // Prima le pratiche aperte, poi quelle da chiudere (pagate o annullate dopo l'affidamento).
    .sort((a, b) => Number(a.chiusa) - Number(b.chiusa) || (a.legaleIl || '').localeCompare(b.legaleIl || '') || (a.numero || 0) - (b.numero || 0));
  $('righe').replaceChildren(...lista.map(m => el('tr', { class: m.chiusa ? 'chiusa' : '' },
    el('td', {}, el('strong', {}, m.avviso), el('div', { class: 'piccolo' }, m.parcheggio || '')),
    el('td', {}, el('strong', { class: 'targa-fissa' }, m.targa || '—')),
    el('td', {}, formatoData(m.dataMulta)),
    el('td', {}, m.proprietario || '—'),
    el('td', {}, m.diffidaIl ? `inviata il ${formatoData(m.diffidaIl)}` : '—', m.scadenzaDiffida ? el('div', { class: 'piccolo' }, `scaduta il ${formatoData(m.scadenzaDiffida)}`) : null),
    el('td', {}, formatoData(m.legaleIl)),
    el('td', {}, soldi(m.importoDovuto)),
    el('td', {}, m.chiusa
      ? el('span', { class: 'etichetta-stato pagata' }, `${m.stato.toUpperCase()}${m.pagataIl ? ' il ' + formatoData(m.pagataIl) : ''} – chiudere la pratica`)
      : el('span', { class: 'etichetta-stato da-pagare' }, 'Non pagata')),
    el('td', { class: 'stretta' }, el('button', { type: 'button', class: 'link', onclick: () => apriFoto(m) }, 'Foto')))));
  $('vuoto').hidden = lista.length > 0;
  const aperte = multe.filter(m => !m.chiusa).length;
  $('conteggio').textContent = `${aperte} pratiche aperte${multe.length > aperte ? ` · ${multe.length - aperte} da chiudere` : ''}`;
}

function apriFoto(m) {
  $('finestraTitolo').textContent = `${m.avviso} · ${m.targa || ''} · ${formatoData(m.dataMulta)}`;
  $('finestraImmagine').src = fotoDemo(m.foto);
  $('finestraFoto').showModal();
}
$('bottoneChiudi').onclick = () => $('finestraFoto').close();
$('finestraFoto').addEventListener('click', e => { if (e.target === $('finestraFoto')) $('finestraFoto').close(); });
$('cerca').addEventListener('input', disegna);

function applicaTema(scuro) {
  if (scuro) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
  $('bottoneTema').querySelector('use').setAttribute('href', scuro ? '#i-sole' : '#i-luna');
  $('bottoneTema').title = scuro ? 'Tema chiaro' : 'Tema scuro';
}
applicaTema(document.documentElement.dataset.theme === 'dark');
$('bottoneTema').onclick = () => {
  const scuro = document.documentElement.dataset.theme !== 'dark';
  applicaTema(scuro);
  try { localStorage.setItem('tema', scuro ? 'dark' : ''); } catch { /* niente */ }
};

$('esci').onclick = async () => { await chiama('POST', '/api/uscita').catch(() => {}); location.href = 'login.html'; };
$('bottonePassword').onclick = () => Finestra.cambiaPassword((vecchia, nuova) => chiama('POST', '/api/profilo/password', { vecchia, nuova }));

async function aggiorna() {
  try { multe = await chiama('GET', '/api/consulta'); disegna(); } catch { /* server in riavvio */ }
}

(async () => {
  const { utente } = await chiama('GET', '/api/sessione');
  $('nomeUtente').textContent = utente.nome;
  $('ruoloUtente').textContent = utente.nomeRuolo;
  const aggiornaScudo = async () => DueFattori.prepara($('bottoneDueFattori'), (await chiama('GET', '/api/sessione')).utente, aggiornaScudo);
  DueFattori.prepara($('bottoneDueFattori'), utente, aggiornaScudo);
  // Founder e admin arrivano qui da "Vedi come Visualizzatore": pulsante per tornare indietro.
  if (utente.ruolo === 'founder' || utente.ruolo === 'admin') {
    $('anteprima').hidden = false;
    $('esci').hidden = true;
    $('bottonePassword').hidden = true;
  }
  await aggiorna();
  // Aggiornamento automatico: i dati cambiano quando l'ufficio carica bonifici o multe.
  setInterval(aggiorna, 60000);
})();

// Sul telefono le tabelle diventano schede: ogni cella riceve il nome della sua colonna.
function etichettaColonne(tabella) {
  const nomi = [...tabella.querySelectorAll('thead th')].map(th => th.textContent.trim());
  for (const tr of tabella.tBodies[0] ? tabella.tBodies[0].rows : []) {
    let i = 0;
    for (const td of tr.cells) { td.dataset.etichetta = nomi[i] || ''; i += td.colSpan || 1; }
  }
}
let etichetteInAttesa = false;
new MutationObserver(() => {
  if (etichetteInAttesa) return;
  etichetteInAttesa = true;
  requestAnimationFrame(() => { etichetteInAttesa = false; document.querySelectorAll('table.tabella').forEach(etichettaColonne); });
}).observe(document.body, { childList: true, subtree: true });

// Se una tabella non entra nel suo riquadro (a qualsiasi larghezza), diventa "a schede": niente scorre di lato.
function adattaTabelle() {
  for (const box of document.querySelectorAll('.scorri')) {
    const t = box.querySelector('table.tabella');
    if (!t || !box.clientWidth) continue;
    box.classList.remove('a-schede');
    if (t.scrollWidth > box.clientWidth + 1) box.classList.add('a-schede');
  }
}
let adattaInAttesa = false;
const adattaPresto = () => {
  if (adattaInAttesa) return;
  adattaInAttesa = true;
  setTimeout(() => { adattaInAttesa = false; adattaTabelle(); }, 30);
};
window.addEventListener('resize', adattaPresto);
// (solo 'hidden', non 'class': le classi le cambia adattaTabelle stessa e si creerebbe un giro infinito)
new MutationObserver(adattaPresto).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

// Controllo continuo della sessione: se la persona viene bloccata, scollegata o la sua azienda sospesa,
// torna subito alla pagina di accesso (invece di restare sui dati già aperti).
async function controllaSessione() {
  try {
    const r = await fetch('/api/sessione', { cache: 'no-store' });
    if (r.status === 401) { location.href = 'login.html'; return; }
    const { utente } = await r.json();
    if (!utente || utente.ruolo === 'utente' || !utente.azienda || utente.azienda.stato !== 'attiva') location.href = 'login.html';
  } catch { /* server momentaneamente non raggiungibile: si riprova */ }
}
setInterval(controllaSessione, 10000);
window.addEventListener('focus', controllaSessione);
document.addEventListener('visibilitychange', () => { if (!document.hidden) controllaSessione(); });
