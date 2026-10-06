// PARQO - interfaccia. Realizzato da Angelo Lacatena® (lacatenaangelo.it).
const $ = id => document.getElementById(id);
let multe = [];
let bonifici = [];
let operatori = [];
// Scheda aperta nella tabella degli avvisi: id dell'operatore, '' = multe senza operatore.
let schedaOperatore = null;
try { schedaOperatore = localStorage.getItem('schedaOperatore'); } catch { /* niente */ }
let aperta = null;
let filtroStato = 'tutti';
// Parcheggio scelto in alto ('' = tutti): viaggia con ogni richiesta, il server risponde solo con i suoi dati.
let parcheggi = [];
let parcheggioScelto = '';
try { parcheggioScelto = localStorage.getItem('parcheggio') || ''; } catch { /* niente */ }

async function api(metodo, url, corpo, intestazioni = {}) {
  const r = await fetch(url, { method: metodo, body: corpo, headers: { 'X-Parcheggio': parcheggioScelto, ...intestazioni } });
  // Sessione scaduta o uscita da un'altra scheda: si torna alla pagina di accesso.
  if (r.status === 401) { location.href = 'login.html'; throw new Error('Accesso richiesto'); }
  if (r.status === 403 && r.headers.get('X-Accesso') === 'sospeso') { location.href = 'login.html'; throw new Error('Accesso sospeso'); }
  const dati = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dati.errore || 'Errore ' + r.status);
  return dati;
}
const apiJson = (metodo, url, dati) => api(metodo, url, JSON.stringify(dati), { 'Content-Type': 'application/json' });

async function aggiorna() {
  [multe, bonifici, operatori] = await Promise.all([api('GET', '/api/multe'), api('GET', '/api/bonifici'), api('GET', '/api/operatori')]);
  preparaOperatori();
  disegna();
  if (window.Parcometri) window.Parcometri.aggiorna();
  if (window.Incassi) window.Incassi.aggiorna();
  if (window.Pos) window.Pos.aggiorna();
  if (window.EasyPark) window.EasyPark.aggiorna();
  if (window.Recupero) window.Recupero.aggiorna();
  // Il report si riscrive circa 1 secondo dopo ogni modifica.
  setTimeout(aggiornaReport, 1500);
}

function el(tag, attributi = {}, ...figli) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attributi)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) e.setAttribute(k, v);
  }
  for (const f of figli) if (f != null) e.append(f);
  return e;
}

function icona(id) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  u.setAttribute('href', '#' + id);
  s.append(u);
  return s;
}

function formatoData(iso) {
  if (!iso) return '—';
  const [a, m, g] = iso.slice(0, 10).split('-');
  return `${g}/${m}/${a}`;
}
const euro = v => (v == null ? '—' : v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));

function aggiornaMulta(nuova) {
  multe = multe.some(x => x.id === nuova.id) ? multe.map(x => (x.id === nuova.id ? nuova : x)) : [...multe, nuova];
}

const daVerificare = m => !!m.operatoreDaVerificare || (m.stato === 'Annullata' ? !!m.motivoDaVerificare : !!(m.numeroDaVerificare || m.targaDaVerificare || m.dataDaVerificare || m.pagamentoDaVerificare));

// ================= Operatori =================

const operatoreDi = id => operatori.find(o => o.id === id);
const nomeOperatore = id => { const o = operatoreDi(id); return o ? `${o.nome} ${o.cognome}` : ''; };
// Ogni operatore ha il suo blocchetto: lo stesso numero in due operatori diversi non è un doppione.
const stessoBlocchetto = (a, b) => !a.operatore || !b.operatore || a.operatore === b.operatore;

// Menu degli operatori (dashboard e finestra della foto), riempiti una volta sola.
function preparaOperatori() {
  // Si rifanno a ogni aggiornamento: cambiando parcheggio cambiano gli operatori.
  const filtro = $('filtroOperatore');
  let scelto = filtro.value;
  if (filtro.options.length === 1) { try { scelto = localStorage.getItem('filtroOperatore') || ''; } catch { /* niente */ } }
  filtro.replaceChildren(el('option', { value: '' }, 'Tutti gli operatori'), ...operatori.map(o => el('option', { value: o.id }, `${o.nome} ${o.cognome}`)));
  filtro.value = operatori.some(o => o.id === scelto) ? scelto : '';
  filtro.hidden = operatori.length < 2;
  $('finestraOperatore').replaceChildren(el('option', { value: '' }, 'Operatore da assegnare'), ...operatori.map(o => el('option', { value: o.id }, `Operatore: ${o.nome} ${o.cognome}`)));
  const valide = [...operatori.map(o => o.id), ''];
  if (!valide.includes(schedaOperatore)) schedaOperatore = operatori.length ? operatori[0].id : '';
}

function scegliScheda(id) {
  schedaOperatore = id;
  try { localStorage.setItem('schedaOperatore', id); } catch { /* niente */ }
  disegnaTabella();
}

// Chi ha fatto la multa: se la lettura è incerta (o manca) si sceglie qui, confrontando con la scritta.
function campoOperatore(m) {
  const scelta = el('select', { 'aria-label': 'Operatore di ' + m.avviso },
    el('option', { value: '' }, 'Scegli operatore…'),
    ...operatori.map(o => { const op = el('option', { value: o.id }, `${o.nome} ${o.cognome} (${o.matricola})`); op.selected = o.id === m.operatore; return op; }));
  const box = el('div', { class: 'campo operatore-box verifica' }, el('span', { class: 'etichetta-operatore' }, 'Operatore'), scelta);
  const salva = async () => {
    if (!scelta.value) { scelta.focus(); return; }
    try { aggiornaMulta(await apiJson('PUT', '/api/multe/' + m.id, { operatore: scelta.value })); disegna(); } catch (e) { alert('Non salvato: ' + e.message); }
  };
  scelta.addEventListener('change', salva);
  box.append(el('button', { type: 'button', class: 'conferma', title: "L'operatore è giusto", onclick: salva }, 'Conferma'));
  if (m.ritagli && m.ritagli.operatore) {
    box.append(el('img', { class: 'ritaglio operatore', src: fotoDemo(m.ritagli.operatore), alt: 'Nome e matricola scritti sulla multa', loading: 'lazy', title: 'Nome e matricola scritti sulla multa', onclick: () => apriFoto(m) }));
  }
  return box;
}
const bonificoInAttesa = b => !b.voci.length || b.voci.some(v => !v.multaId);

// ================= Sezioni (Dashboard, Avvisi, Bonifici, Report) =================

const VISTE = ['dashboard', 'avvisi', 'bonifici', 'recupero', 'parcometri', 'easypark', 'incassi', 'report', 'parcheggi', 'utenti'];
// Sezioni delle multe: non ci sono nei parcheggi che non gestiscono multe (es. comunali).
const VISTE_MULTE = ['dashboard', 'avvisi', 'bonifici'];

const parcheggioAttuale = () => parcheggi.find(p => p.id === parcheggioScelto) || null;
// Cosa c'è nel parcheggio scelto (con "Tutti": in almeno un parcheggio).
function haServizio(nome) {
  const lista = parcheggioAttuale() ? [parcheggioAttuale()] : parcheggi;
  if (!lista.length) return true;
  return lista.some(p => (nome === 'multe' ? p.multe : !!(p.servizi && p.servizi[nome])));
}
const conMulte = () => haServizio('multe');
// Sezione -> servizio che la fa comparire.
const SERVIZIO_VISTA = { dashboard: 'multe', avvisi: 'multe', bonifici: 'multe', recupero: 'multe', easypark: 'easypark' };
const vistaDisponibile = v => (v === 'parcometri' ? haServizio('parcometri') || haServizio('pos') : !SERVIZIO_VISTA[v] || haServizio(SERVIZIO_VISTA[v]));

// Menu del parcheggio in alto, riempito dall'elenco dei parcheggi.
async function caricaParcheggi() {
  try { parcheggi = (await api('GET', '/api/parcheggi')).parcheggi; } catch { return; }
  if (!parcheggi.some(p => p.id === parcheggioScelto)) parcheggioScelto = '';
  const scelta = $('sceltaParcheggio');
  scelta.replaceChildren(el('option', { value: '' }, 'Tutti i parcheggi'), ...parcheggi.map(p => el('option', { value: p.id }, p.nome)));
  scelta.value = parcheggioScelto;
  // Con un solo parcheggio il menu non serve.
  scelta.hidden = parcheggi.length < 2;
  applicaParcheggio();
}

function applicaParcheggio() {
  document.querySelectorAll('.voce').forEach(a => { a.hidden = !vistaDisponibile(a.dataset.vista); });
  // Parcometri: le schede "Monete" e "Carte (POS)" solo se il parcheggio le ha.
  const monete = document.querySelector('#schedeParc [data-parc=monete]'), carte = document.querySelector('#schedeParc [data-parc=pos]');
  monete.hidden = !haServizio('parcometri');
  carte.hidden = !haServizio('pos');
  if (monete.hidden && !carte.hidden && monete.classList.contains('attiva')) carte.click();
  if (carte.hidden && !monete.hidden && carte.classList.contains('attiva')) monete.click();
  document.querySelectorAll('[data-excel]').forEach(a => { a.href = linkExcel(a.dataset.excel); });
  const attuale = location.hash.slice(1) || 'dashboard';
  if (VISTE.includes(attuale) && !vistaDisponibile(attuale)) location.hash = '#' + (VISTE.find(vistaDisponibile) || 'incassi');
  if (window.Parcheggi && location.hash === '#parcheggi') window.Parcheggi.aggiorna();
}

// "Scarica Excel" di una sezione: solo i fogli di quella pagina, per il parcheggio scelto (o tutti).
// Il report completo di ogni parcheggio è nella pagina "Report Excel".
function linkExcel(sezione) {
  // In Parcometri conta la scheda aperta: Monete o Carte (POS).
  if (sezione === 'parcometri' && !$('parcPos').hidden) sezione = 'pos';
  return `/report-sezione?sezione=${sezione}&parcheggio=${encodeURIComponent(parcheggioScelto)}`;
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-excel]');
  if (a) a.href = linkExcel(a.dataset.excel);
});

$('sceltaParcheggio').addEventListener('change', () => {
  parcheggioScelto = $('sceltaParcheggio').value;
  try { localStorage.setItem('parcheggio', parcheggioScelto); } catch { /* niente */ }
  applicaParcheggio();
  aggiorna();
});

function mostraVista() {
  const predefinita = conMulte() ? 'dashboard' : (VISTE.find(vistaDisponibile) || 'incassi');
  const nome = VISTE.includes(location.hash.slice(1)) ? location.hash.slice(1) : predefinita;
  // La sezione Utenti è solo del founder.
  if (nome === 'utenti' && document.querySelector('.voce[data-vista="utenti"]').classList.contains('solo-founder')) { location.hash = '#' + predefinita; return; }
  for (const v of VISTE) {
    const sezione = $('vista-' + v);
    const visibile = v === nome;
    if (sezione.hidden === visibile) {
      sezione.hidden = !visibile;
      // Riavvio l'animazione di entrata.
      if (visibile) { sezione.style.animation = 'none'; void sezione.offsetWidth; sezione.style.animation = ''; }
    }
  }
  document.querySelectorAll('.voce').forEach(a => a.classList.toggle('attiva', a.dataset.vista === nome));
  $('app').classList.remove('menu-aperto');
  if (nome === 'report') aggiornaReport();
  if (nome === 'parcometri' && window.Parcometri) window.Parcometri.aggiorna();
  if (nome === 'incassi' && window.Incassi) window.Incassi.aggiorna();
  if (nome === 'utenti' && window.Utenti) window.Utenti.aggiorna();
  if (nome === 'parcheggi' && window.Parcheggi) window.Parcheggi.aggiorna();
  if (nome === 'easypark' && window.EasyPark) window.EasyPark.aggiorna();
  if (nome === 'recupero' && window.Recupero) window.Recupero.aggiorna();
}
window.addEventListener('hashchange', mostraVista);

// Dalla dashboard: un riquadro porta alla tabella già filtrata.
function vai(filtro) {
  if (filtro.vista) { location.hash = '#' + filtro.vista; return; }
  // Dalla dashboard filtrata per operatore si apre la sua scheda.
  if ($('filtroOperatore').value) schedaOperatore = $('filtroOperatore').value;
  impostaFiltro(filtro.stato || 'tutti');
  location.hash = '#avvisi';
}

function impostaFiltro(f) {
  filtroStato = f;
  document.querySelectorAll('#filtriStato .chip').forEach(c => c.classList.toggle('attivo', c.dataset.filtro === f));
  disegnaTabella();
}
document.querySelectorAll('#filtriStato .chip').forEach(c => c.addEventListener('click', () => impostaFiltro(c.dataset.filtro)));

// ================= Celle della tabella degli avvisi =================

const CHIAVI = { targa: 'targa', data: 'dataMulta', numero: 'numero' };
const DA_VERIFICARE = { targa: 'targaDaVerificare', data: 'dataDaVerificare', numero: 'numeroDaVerificare' };

function cellaCampo(m, campo) {
  const incerto = m[DA_VERIFICARE[campo]];
  const chiave = CHIAVI[campo];
  const input = el('input', {
    type: campo === 'data' ? 'date' : 'text',
    class: campo === 'data' ? '' : campo,
    value: m[chiave] || '',
    maxlength: campo === 'targa' ? 10 : campo === 'numero' ? 5 : undefined,
    inputmode: campo === 'numero' ? 'numeric' : undefined,
    'aria-label': { targa: 'Targa', data: 'Data multa', numero: 'Numero avviso' }[campo],
    title: incerto ? 'Lettura incerta: controlla con la scritta sotto e correggi se serve' : '',
  });
  const salvato = el('span', { class: 'salvato' }, 'Salvato');
  const box = el('div', { class: 'campo' + (incerto ? ' verifica' : '') }, input);
  const conferma = el('button', { type: 'button', class: 'conferma', title: 'Il valore è giusto' }, 'Conferma');
  const salva = async () => {
    const valore = campo === 'targa' ? input.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
      : campo === 'numero' ? input.value.replace(/\D/g, '') : input.value;
    if (String(valore) === String(m[chiave] || '') && !box.classList.contains('verifica')) return;
    try {
      const nuova = await apiJson('PUT', '/api/multe/' + m.id, { [chiave]: valore });
      Object.assign(m, nuova);
      input.value = nuova[chiave] || '';
      box.classList.toggle('verifica', !!nuova[DA_VERIFICARE[campo]]);
      salvato.classList.add('visibile');
      setTimeout(() => salvato.classList.remove('visibile'), 1500);
      if (campo === 'numero') disegna(); else aggiornaRiepiloghi();
    } catch (e) { alert('Non salvato: ' + e.message); }
  };
  input.addEventListener('change', salva);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  // Un valore incerto si conferma solo con il pulsante, dopo averlo confrontato con la scritta.
  conferma.addEventListener('click', () => { if (input.value) salva(); else input.focus(); });
  if (m.ritagli && m.ritagli[campo]) {
    box.append(el('img', { class: 'ritaglio', src: fotoDemo(m.ritagli[campo]), alt: 'Scritta originale', loading: 'lazy', title: 'Scritta sulla multa (clicca per la foto intera)', onclick: () => apriFoto(m) }));
  }
  if (campo === 'targa' && m.targaLetta) box.append(el('span', { class: 'piccolo' }, `corretta dal bonifico (letta ${m.targaLetta})`));
  if (campo === 'numero' && m.numeroLetto) box.append(el('span', { class: 'piccolo' }, `corretto dal bonifico (letto ${m.numeroLetto})`));
  if (campo === 'data' && (m.campiVuoti || []).includes('data') && !m.dataMulta) box.append(el('span', { class: 'piccolo' }, 'casella vuota sul modulo'));
  if (campo === 'data' && incerto && m.notaData) box.append(el('span', { class: 'piccolo' }, m.notaData));
  if (campo === 'numero' && m.numero && multe.some(x => x.id !== m.id && x.numero === m.numero && stessoBlocchetto(x, m))) {
    box.append(el('span', { class: 'segnalazione' }, 'numero doppio: controlla'));
  }
  box.append(conferma, salvato);
  return el('td', {}, box);
}

function cellaAvviso(m) {
  const td = cellaCampo(m, 'numero');
  td.classList.add('avviso');
  td.firstChild.prepend(el('span', { class: 'etichetta-avviso' }, 'AVVISO'));
  if (m.moduloRiconosciuto === false) td.append(el('span', { class: 'avviso-modulo' }, 'modulo non riconosciuto'));
  if (m.operatoreDaVerificare || !m.operatore) td.append(campoOperatore(m));
  return td;
}

const STATI = ['Da pagare', 'Pagata', 'Annullata'];
const classeStato = stato => ({ 'Da pagare': 'da-pagare', Pagata: 'pagata', Annullata: 'annullata' }[stato] || 'da-pagare');

function cellaStato(m) {
  const scelta = el('select', { class: 'stato ' + classeStato(m.stato), 'aria-label': 'Stato di ' + m.avviso },
    ...STATI.map(v => { const o = el('option', { value: v }, v); o.selected = v === m.stato; return o; }));
  scelta.addEventListener('change', async () => {
    try {
      aggiornaMulta(await apiJson('PUT', '/api/multe/' + m.id, { stato: scelta.value }));
      disegna();
    } catch (e) { alert('Non salvato: ' + e.message); scelta.value = m.stato; }
  });
  const box = el('div', { class: 'stato-box' }, scelta);
  const pagamenti = m.pagamenti || [];
  const ultimo = pagamenti[pagamenti.length - 1];
  if (ultimo && ultimo.data) box.append(el('span', { class: 'piccolo' }, 'pagata il ' + formatoData(ultimo.data)));
  if (m.segnalazione) box.append(el('span', { class: 'segnalazione' }, m.segnalazione));
  if (m.stato === 'Annullata') box.append(campoMotivo(m));
  if (m.pagamentoDaVerificare && ultimo) {
    // Abbinamento incerto: si conferma o si stacca.
    box.append(el('div', { class: 'verifica-pagamento' },
      el('span', {}, m.motivoVerifica || 'Abbinamento da verificare'),
      el('div', { class: 'azioni' },
        el('button', { type: 'button', class: 'conferma visibile', onclick: async () => {
          try { aggiornaMulta(await apiJson('PUT', '/api/multe/' + m.id, { confermaPagamento: true })); disegna(); } catch (e) { alert(e.message); }
        } }, 'Conferma'),
        el('button', { type: 'button', class: 'link', onclick: () => stacca(m, ultimo.bonificoId) }, 'Non è questa'))));
  }
  return el('td', {}, box);
}

// Motivo dell'annullamento: letto dalla scritta a mano sulla foto barrata, modificabile.
// I motivi già usati vengono suggeriti, così restano scritti tutti allo stesso modo.
function campoMotivo(m) {
  const input = el('input', {
    type: 'text', class: 'motivo', list: 'motiviNoti', value: m.motivoAnnullamento || '',
    placeholder: 'Motivo annullamento…', 'aria-label': 'Motivo annullamento',
  });
  const box = el('div', { class: 'campo motivo-box' + (m.motivoDaVerificare ? ' verifica' : '') },
    el('span', { class: 'etichetta-motivo' }, 'Motivo'), input);
  const salva = async () => {
    try {
      aggiornaMulta(await apiJson('PUT', '/api/multe/' + m.id, { motivoAnnullamento: input.value }));
      disegna();
    } catch (e) { alert('Non salvato: ' + e.message); }
  };
  input.addEventListener('change', salva);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  box.append(el('button', { type: 'button', class: 'conferma', title: 'Il motivo è giusto', onclick: () => { if (input.value) salva(); else input.focus(); } }, 'Conferma'));
  if (m.ritagli && m.ritagli.motivo) {
    box.append(el('img', { class: 'ritaglio motivo', src: fotoDemo(m.ritagli.motivo), alt: 'Motivo scritto sulla foto', loading: 'lazy', title: 'Motivo scritto sulla foto barrata' }));
  }
  return box;
}

// Colonne "Diffida" e "Pratica legale": a che punto è il recupero di una multa non pagata.
function celleRecupero(m) {
  const f = m.faseRecupero || {};
  const r = m.recupero || {};
  const vai = () => { location.hash = '#recupero'; };
  let diffida = el('span', { class: 'piccolo' }, '—');
  if (r.diffidaIl) diffida = el('span', {}, `inviata il ${formatoData(r.diffidaIl)}`, f.scadenzaDiffida ? el('div', { class: 'piccolo' }, `scade il ${formatoData(f.scadenzaDiffida)}`) : null);
  else if (r.visuraIl) diffida = el('span', {}, `in visura dal ${formatoData(r.visuraIl)}`);
  else if (f.fase === 'scaduta') diffida = el('button', { type: 'button', class: 'link etichetta-stato da-pagare', onclick: vai, title: 'Apri Recupero crediti' }, 'scaduta: da inviare');
  else if (f.fase === 'in-termine' && f.scadenzaAvviso) diffida = el('span', { class: 'piccolo' }, `in termine fino al ${formatoData(f.scadenzaAvviso)}`);
  let legale = el('span', { class: 'piccolo' }, '—');
  if (r.legaleIl) legale = el('span', { class: 'etichetta-stato annullata' }, `dal ${formatoData(r.legaleIl)}`);
  else if (f.fase === 'da-affidare') legale = el('button', { type: 'button', class: 'link etichetta-stato da-pagare', onclick: vai, title: 'Apri Recupero crediti' }, 'da affidare');
  return [el('td', {}, diffida), el('td', {}, legale)];
}

// Suggerimenti per il campo "Motivo": tutti i motivi già usati.
function aggiornaMotiviNoti() {
  const motivi = [...new Set(multe.map(m => m.motivoAnnullamento).filter(Boolean))].sort();
  let lista = $('motiviNoti');
  if (!lista) { lista = el('datalist', { id: 'motiviNoti' }); document.body.append(lista); }
  lista.replaceChildren(...motivi.map(v => el('option', { value: v })));
}

async function stacca(m, bonificoId) {
  if (!confirm(`Togliere il bonifico da ${m.avviso}? La multa torna "Da pagare" e il bonifico va tra quelli in attesa.`)) return;
  try {
    await apiJson('POST', `/api/multe/${m.id}/stacca`, { bonificoId });
    await aggiorna();
  } catch (e) { alert(e.message); }
}

// ================= Disegno =================

// Ricerca e filtro per stato (valgono per tutte le schede).
function multeFiltrate() {
  const cerca = $('cerca').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return [...multe].sort((a, b) => (a.numero || 1e9) - (b.numero || 1e9)).filter(m => {
    if (cerca && !(m.targa || '').includes(cerca) && String(m.numero || '') !== cerca) return false;
    if (filtroStato === 'verifica') return daVerificare(m);
    return filtroStato === 'tutti' || m.stato === filtroStato;
  });
}

const nellaScheda = (m, id) => (id ? m.operatore === id : !operatoreDi(m.operatore));

function disegnaSchede(filtrate) {
  const schede = operatori.map(o => ({ id: o.id, nome: `${o.nome} ${o.cognome}`, matricola: o.matricola }));
  // Multe di cui non si sa l'operatore: scheda a parte, solo se ce ne sono.
  if (multe.some(m => nellaScheda(m, ''))) schede.push({ id: '', nome: 'Da assegnare' });
  if (!schede.some(s => s.id === schedaOperatore)) schedaOperatore = schede.length ? schede[0].id : '';
  // Cercando una targa, se nella scheda aperta non c'è passo alla scheda che la contiene.
  if ($('cerca').value.trim() && !filtrate.some(m => nellaScheda(m, schedaOperatore))) {
    const altra = schede.find(s => filtrate.some(m => nellaScheda(m, s.id)));
    if (altra) schedaOperatore = altra.id;
  }
  $('schedeOperatori').replaceChildren(...schede.map(s => el('button', {
    type: 'button', role: 'tab', class: 'scheda' + (s.id === schedaOperatore ? ' attiva' : '') + (s.id === '' ? ' da-assegnare' : ''),
    'aria-selected': String(s.id === schedaOperatore), onclick: () => scegliScheda(s.id),
  }, s.nome, s.matricola ? el('span', { class: 'matricola' }, 'matr. ' + s.matricola) : null,
  el('span', { class: 'conta' }, String(filtrate.filter(m => nellaScheda(m, s.id)).length)))));
}

function disegnaTabella() {
  const filtrate = multeFiltrate();
  disegnaSchede(filtrate);
  const lista = filtrate.filter(m => nellaScheda(m, schedaOperatore));
  const tutteScheda = multe.filter(m => nellaScheda(m, schedaOperatore));
  const corpo = $('righe');
  corpo.replaceChildren(...lista.map(m => {
    const azioni = el('td', { class: 'stretta' }, el('div', { class: 'azioni-riga' },
      el('button', { class: 'link', type: 'button', onclick: () => apriFoto(m) }, 'Foto'),
      ...(m.pagamenti || []).map(p => el('button', { class: 'link', type: 'button', title: 'Screenshot del bonifico', onclick: () => apriFoto(m, p.foto, 'bonifico') }, 'Bonifico')),
      m.pec ? el('a', { class: 'link', href: fotoDemo(m.pec.pdf), target: '_blank', rel: 'noopener', title: 'PEC con cui è stata annullata: ' + (m.pec.nomeOriginale || '') }, 'PEC') : null,
      m.annullamento ? el('button', { class: 'link', type: 'button', title: 'Foto barrata che ha annullato la multa', onclick: () => apriFoto(m, m.annullamento.foto, 'annullamento') }, 'Foto X') : null));
    const riga = el('tr', {}, cellaAvviso(m), cellaCampo(m, 'targa'), cellaCampo(m, 'data'), cellaStato(m), ...celleRecupero(m), azioni);
    if (m.stato === 'Annullata') riga.classList.add('annullata');
    return riga;
  }));
  $('vuoto').hidden = lista.length > 0;
  $('vuoto').textContent = multe.length ? 'Nessuna multa con questi filtri.' : 'Nessuna multa. Carica le prime foto con "Carica multe".';
  const conta = s => tutteScheda.filter(m => m.stato === s).length;
  $('conteggio').textContent = (lista.length === tutteScheda.length ? `${tutteScheda.length} multe` : `${lista.length} di ${tutteScheda.length} multe`)
    + ` · ${conta('Da pagare')} da pagare · ${conta('Pagata')} pagate · ${conta('Annullata')} annullate`;
}

function disegnaUltime() {
  const ultime = [...multe].sort((a, b) => (b.caricataIl || '').localeCompare(a.caricataIl || '') || (b.numero || 0) - (a.numero || 0)).slice(0, 12);
  $('ultime').replaceChildren(...ultime.map(m => el('li', {
    onclick: () => { $('cerca').value = m.targa || ''; impostaFiltro('tutti'); location.hash = '#avvisi'; },
    title: 'Apri nella tabella',
  },
  el('span', { class: 'icona-auto' }, icona('i-auto')),
  el('span', { class: 'testo' }, el('strong', {}, `${m.avviso} · ${m.targa || '—'}`), el('span', {}, formatoData(m.dataMulta) + (operatoreDi(m.operatore) ? ' · ' + operatoreDi(m.operatore).nome : ''))),
  el('span', { class: 'etichetta-stato ' + classeStato(m.stato) }, m.stato))));
}

function disegnaAttesa() {
  const inAttesa = bonifici.filter(bonificoInAttesa);
  $('attesaConta').textContent = inAttesa.length;
  const daPagare = [...multe].filter(m => m.stato === 'Da pagare').sort((a, b) => (a.numero || 1e9) - (b.numero || 1e9));
  if (!inAttesa.length) {
    $('attesaElenco').replaceChildren(el('li', { class: 'attesa-vuota' }, 'Nessun bonifico in attesa.'));
    $('attesaElenco').firstChild.style.display = 'block';
    return;
  }
  $('attesaElenco').replaceChildren(...inAttesa.map(b => {
    const scelta = el('select', { 'aria-label': 'Avviso da abbinare' },
      el('option', { value: '' }, 'Abbina a…'),
      ...daPagare.map(m => el('option', { value: m.id }, `${m.avviso} · ${m.targa || '—'} · ${formatoData(m.dataMulta)}${m.operatore ? ' · ' + nomeOperatore(m.operatore) : ''}`)));
    const trovate = b.voci.filter(v => !v.multaId).map(v => `${v.numero ? 'n. ' + v.numero + ' · ' : ''}${v.targa}`);
    return el('li', {},
      el('img', { src: fotoDemo(b.foto), alt: 'Bonifico', onclick: () => apriImmagine('Bonifico', b.foto) }),
      el('div', { class: 'attesa-testo' },
        el('strong', {}, trovate.length ? trovate.join(', ') : 'Nessuna targa nella causale'),
        el('span', {}, `${b.importo != null ? euro(b.importo) + ' · ' : ''}pagato il ${formatoData(b.dataPagamento)}`),
        el('span', { class: 'causale', title: b.causale || '' }, b.causale || '')),
      el('div', { class: 'attesa-azioni' },
        scelta,
        el('button', { type: 'button', class: 'btn contorno', onclick: async () => {
          if (!scelta.value) { scelta.focus(); return; }
          try { await apiJson('POST', `/api/bonifici/${b.id}/abbina`, { multaId: scelta.value }); await aggiorna(); } catch (e) { alert(e.message); }
        } }, 'Abbina'),
        el('button', { type: 'button', class: 'link pericolo', onclick: () => eliminaBonifico(b) }, 'Elimina')));
  }));
}

async function eliminaBonifico(b) {
  if (!confirm('Eliminare questo bonifico? Lo screenshot viene spostato nel cestino dell\'archivio e le multe abbinate tornano "Da pagare".')) return;
  try { await api('DELETE', '/api/bonifici/' + b.id); await aggiorna(); } catch (e) { alert(e.message); }
}

function disegnaBonifici() {
  const righe = [...bonifici].sort((a, b) => (b.caricatoIl || '').localeCompare(a.caricatoIl || ''))
    .flatMap(b => (b.voci.length ? b.voci : [{}]).map(v => ({ b, v })));
  $('righeBonifici').replaceChildren(...righe.map(({ b, v }) => {
    const esito = !v.multaId ? ['In attesa', 'attesa'] : v.sicuro ? ['Abbinato', 'pagata'] : ['Da confermare', 'attesa'];
    return el('tr', {},
      el('td', {}, formatoData(b.dataPagamento)),
      el('td', {}, euro(b.importo)),
      el('td', {}, v.numero ? String(v.numero) : '—'),
      el('td', {}, el('strong', {}, v.targa || '—')),
      el('td', {}, v.avviso || '—'),
      el('td', {}, el('span', { class: 'etichetta-stato ' + esito[1] }, esito[0])),
      el('td', { class: 'stretta' }, el('div', { class: 'azioni-riga' },
        el('button', { type: 'button', class: 'link', onclick: () => apriImmagine('Bonifico · ' + (b.causale || ''), b.foto) }, 'Screenshot'),
        el('button', { type: 'button', class: 'link pericolo', onclick: () => eliminaBonifico(b) }, 'Elimina'))));
  }));
  $('vuotoBonifici').hidden = righe.length > 0;
}

// Contatori nel menu, campanella e numeri della dashboard.
function aggiornaRiepiloghi() {
  const verifica = multe.filter(daVerificare).length;
  const attesa = bonifici.filter(bonificoInAttesa).length;
  $('navVerifica').hidden = !verifica;
  $('navVerifica').textContent = verifica;
  $('navAttesa').hidden = !attesa;
  $('navAttesa').textContent = attesa;
  $('pallino').hidden = !verifica;
  $('pallino').textContent = verifica;
  $('campana').title = verifica ? `${verifica} multe da verificare` : 'Niente da verificare';
  // Filtro "operatore" della dashboard: vale per tutti i numeri e i grafici.
  const op = $('filtroOperatore').value;
  window.Statistiche.disegna({ multe: op ? multe.filter(m => m.operatore === op) : multe, bonifici, periodo: $('periodo').value, vai });
}

function disegna() {
  aggiornaMotiviNoti();
  disegnaTabella();
  disegnaUltime();
  disegnaAttesa();
  disegnaBonifici();
  aggiornaRiepiloghi();
}

$('periodo').addEventListener('change', aggiornaRiepiloghi);
$('filtroOperatore').addEventListener('change', () => {
  try { localStorage.setItem('filtroOperatore', $('filtroOperatore').value); } catch { /* niente */ }
  aggiornaRiepiloghi();
});
$('cerca').addEventListener('input', () => {
  if (location.hash !== '#avvisi') location.hash = '#avvisi';
  disegnaTabella();
});
$('campana').addEventListener('click', () => { impostaFiltro('verifica'); location.hash = '#avvisi'; });

// ================= Report Excel =================

async function aggiornaReport() {
  try {
    const r = await api('GET', '/api/report');
    const ora = r.aggiornatoIl ? new Date(r.aggiornatoIl).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    $('reportStato').textContent = r.errore ? r.errore : `Aggiornati il ${ora}`;
    $('reportStato').classList.toggle('errore', !!r.errore);
    $('reportPercorso').textContent = r.percorso ? r.percorso.replace(/[\\/][^\\/]+$/, '') : '';
    $('reportFile').replaceChildren(...(r.file || []).map(f => el('li', {},
      el('span', { class: 'icona-auto' }, icona('i-report')),
      el('span', { class: 'testo' }, el('strong', {}, f.nome), el('span', {}, f.errore || f.nomeParcheggio)),
      el('a', { class: 'btn contorno', href: 'report/' + encodeURIComponent(f.nome) }, icona('i-scarica'), el('span', {}, 'Scarica')))));
  } catch { /* il server potrebbe essere in riavvio */ }
}

$('reportCartella').onclick = async () => {
  const attuale = await api('GET', '/api/report').catch(() => ({}));
  Finestra.modulo({
    titolo: 'Cartella del report',
    testo: `In quale cartella salvare MulteUni.xlsx? Es. la cartella di Google Drive "Multe Uni Catania". Ora: ${attuale.cartella || '—'}`,
    campi: [{ nome: 'cartella', etichetta: 'Percorso della cartella', tipo: 'text' }],
    bottone: 'Salva',
    invia: async v => { await apiJson('POST', '/api/report/cartella', { cartella: v.cartella }); setTimeout(aggiornaReport, 1500); },
  });
};
setInterval(aggiornaReport, 20000);

// ================= Finestra foto =================

function apriFoto(m, foto = m.foto, tipo = 'multa') {
  const extra = { bonifico: ' · bonifico', annullamento: ' · foto di annullamento' }[tipo] || '';
  apriImmagine(m.avviso + (m.targa ? ' · ' + m.targa : '') + extra, foto, tipo === 'multa' ? m : null);
}

function apriImmagine(titolo, foto, multaEliminabile = null) {
  aperta = multaEliminabile;
  $('finestraTitolo').textContent = titolo.length > 90 ? titolo.slice(0, 90) + '…' : titolo;
  $('finestraImmagine').src = fotoDemo(foto);
  $('bottoneElimina').hidden = !multaEliminabile;
  // Dalla foto si può cambiare l'operatore (anche se era stato riconosciuto con sicurezza).
  $('finestraOperatore').hidden = !multaEliminabile;
  if (multaEliminabile) $('finestraOperatore').value = operatoreDi(multaEliminabile.operatore) ? multaEliminabile.operatore : '';
  $('finestraFoto').showModal();
}

$('bottoneChiudi').onclick = () => $('finestraFoto').close();
$('finestraOperatore').onchange = async () => {
  if (!aperta || !$('finestraOperatore').value) return;
  try { aggiornaMulta(aperta = await apiJson('PUT', '/api/multe/' + aperta.id, { operatore: $('finestraOperatore').value })); disegna(); } catch (e) { alert('Non salvato: ' + e.message); }
};
$('finestraFoto').addEventListener('click', e => { if (e.target === $('finestraFoto')) $('finestraFoto').close(); });
$('bottoneElimina').onclick = async () => {
  if (!aperta) return;
  if (!confirm(`Eliminare ${aperta.avviso}? La foto viene spostata nel cestino dell'archivio.`)) return;
  try {
    await api('DELETE', '/api/multe/' + aperta.id);
    $('finestraFoto').close();
    await aggiorna();
  } catch (e) { alert(e.message); }
};

// ================= Caricamento =================

const confrontoNomi = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });

function descriviMulta(m) {
  if (m.esito === 'annullamento') return `barrata con X: annullato ${m.avviso} (${m.targa})`;
  if (m.esito === 'pec') return `PEC: annullato ${m.avviso} (${m.targa} del ${formatoData(m.dataMulta)})${m.segnalazione ? ' · ' + m.segnalazione : ''}`;
  if (m.esito === 'pec-nuova') return `PEC: multa non ancora in archivio, creata già annullata: ${m.avviso} · ${m.targa || '—'} · ${formatoData(m.dataMulta)}`;
  const incerto = m.numeroDaVerificare || m.targaDaVerificare || m.dataDaVerificare || m.operatoreDaVerificare ? ' (da verificare)' : '';
  const chi = m.operatore ? ` · ${nomeOperatore(m.operatore)}` : ' · operatore da assegnare';
  const annullata = m.stato === 'Annullata' ? ' · barrata con X: annullata' : '';
  const pagata = (m.pagamentiAbbinati || []).length ? ' · trovato il bonifico: Pagata' : '';
  return `${m.avviso} · ${m.targa || '—'} · ${formatoData(m.dataMulta)}${chi}${incerto}${annullata}${pagata}`;
}

function descriviBonifico(b) {
  if (!b.voci.length) return 'nessuna targa trovata nella causale: in attesa';
  return b.voci.map(v => (v.multaId
    ? `${v.avviso} Pagata${v.sicuro ? '' : ' (da confermare)'}`
    : `in attesa: nessuna multa ${v.numero ? 'n. ' + v.numero + ' ' : ''}${v.targa}`)).join(' · ');
}

function descriviScontrini(r) {
  const parti = r.letture.map(l => `${l.idParcometro || '?'}: ${l.sessione != null ? (l.sessione / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : '—'}${l.daVerificare ? ' (da verificare)' : ''}`);
  return parti.join(' · ') + (r.saltate ? ` · ${r.saltate} già caricati` : '');
}

function descriviPos(r) {
  const parti = [`${r.nuovi} pagamenti nuovi`];
  if (r.doppi) parti.push(`${r.doppi} già caricati prima`);
  if (r.aggiornati) parti.push(`${r.aggiornati} aggiornati (es. stornati)`);
  if (r.tidDaAssociare && r.tidDaAssociare.length) parti.push(`TID da associare: ${r.tidDaAssociare.join(', ')}`);
  return parti.join(' · ');
}

const eExcel = f => /\.xlsx$/i.test(f.name);
const eImmagine = f => f.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(f.name);
const eImmagineOPdf = f => eImmagine(f) || f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

let timerCoda = null;
async function carica(files, tipo) {
  const lista = [...files].filter(tipo === 'pos' ? eExcel : tipo === 'multe' ? eImmagineOPdf : eImmagine)
    .sort((a, b) => confrontoNomi.compare(a.name, b.name));
  if (!lista.length) { alert(tipo === 'pos' ? 'Seleziona il resoconto Excel (.xlsx) di Fabrick.' : tipo === 'multe' ? 'Seleziona foto delle multe o PDF delle PEC.' : 'Nessuna immagine valida selezionata.'); return; }
  const cosa = { multe: 'foto', bonifici: 'bonifico', parcometri: 'foto degli scontrini', pos: 'resoconto POS' }[tipo];

  clearTimeout(timerCoda);
  $('coda').hidden = false;
  const voci = lista.map(f => el('li', {}, f.name + ' — in attesa'));
  $('codaElenco').replaceChildren(...voci);
  let fatte = 0;
  const aggiornaBarra = () => {
    $('barra').style.width = (100 * fatte / lista.length) + '%';
    $('codaTitolo').textContent = fatte < lista.length ? `Lettura ${cosa} ${fatte + 1} di ${lista.length}…` : `Fatto: ${lista.length} ${{ bonifici: 'bonifici', pos: 'resoconti' }[tipo] || 'foto'} elaborati`;
  };
  aggiornaBarra();

  for (let i = 0; i < lista.length; i++) {
    const f = lista[i];
    voci[i].className = 'corso';
    voci[i].textContent = f.name + ' — lettura in corso…';
    try {
      const r = await api('POST', '/api/' + tipo, f, { 'Content-Type': 'application/octet-stream', 'X-Nome-File': encodeURIComponent(f.name) });
      voci[i].className = 'ok';
      voci[i].textContent = `${f.name} → ${{ multe: descriviMulta, bonifici: descriviBonifico, parcometri: descriviScontrini, pos: descriviPos }[tipo](r)}`;
      await aggiorna();
    } catch (e) {
      voci[i].className = 'errore';
      voci[i].textContent = `${f.name} — ${e.message}`;
    }
    fatte++;
    aggiornaBarra();
  }
  // Il pannello resta un po' per leggere l'esito, poi si chiude da solo (a meno di errori).
  if (!voci.some(v => v.className === 'errore')) timerCoda = setTimeout(() => { $('coda').hidden = true; }, 8000);
}
$('codaChiudi').onclick = () => { $('coda').hidden = true; };

// Pulsanti "Carica multe" / "Carica bonifici" ovunque nella pagina.
const SCELTE = { multe: 'sceltaMulte', bonifici: 'sceltaBonifici', parcometri: 'sceltaParcometri', pos: 'sceltaPos' };
document.querySelectorAll('[data-carica]').forEach(b => b.addEventListener('click', () => $(SCELTE[b.dataset.carica]).click()));
$('sceltaMulte').onchange = e => { carica(e.target.files, 'multe'); e.target.value = ''; };
$('sceltaBonifici').onchange = e => { carica(e.target.files, 'bonifici'); e.target.value = ''; };
$('sceltaParcometri').onchange = e => { carica(e.target.files, 'parcometri'); e.target.value = ''; };
$('sceltaPos').onchange = e => { carica(e.target.files, 'pos'); e.target.value = ''; };

// Trascinando file sulla finestra compare la scelta "Multe" / "Bonifici".
let trascinamenti = 0;
// File veri, ma anche foto trascinate da WhatsApp, che arrivano come "indirizzo dell'immagine"
// (data:… oppure blob:…) invece che come file: senza questo il browser prova ad aprirle (about:blank#blocked).
const conFile = e => [...(e.dataTransfer?.types || [])].some(t => t === 'Files' || t === 'text/uri-list' || t === 'text/html');
async function fileTrascinati(dt) {
  if (dt.files && dt.files.length) return [...dt.files];
  const testo = [dt.getData('text/uri-list'), dt.getData('text/plain'), dt.getData('text/html')].join('\n');
  const indirizzi = [...new Set((testo.match(/(data:(?:image\/[a-z+]+|application\/pdf);base64,[A-Za-z0-9+/=]+|blob:[^\s"'<>]+|https?:[^\s"'<>]+)/g) || []))];
  const trovati = [];
  for (const [i, u] of indirizzi.entries()) {
    try {
      let b;
      if (u.startsWith('data:')) {
        // Immagine dentro l'indirizzo: si decodifica qui (niente rete).
        const [testa, dati] = u.split(',');
        const bin = atob(dati);
        const byte = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) byte[k] = bin.charCodeAt(k);
        b = new Blob([byte], { type: testa.slice(5).split(';')[0] });
      } else b = await (await fetch(u)).blob();
      if (!/^image\/|^application\/pdf/.test(b.type)) continue;
      const est = b.type === 'application/pdf' ? 'pdf' : (b.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      trovati.push(new File([b], `whatsapp-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${i + 1}.${est}`, { type: b.type }));
    } catch { /* indirizzo non leggibile da qui (es. blob di un'altra pagina) */ }
  }
  return trovati;
}
const MSG_WHATSAPP = "Questa foto non si riesce a prendere trascinandola.\n\nFai così: tasto destro sulla foto in WhatsApp → Copia, poi qui in PARQO premi Ctrl+V.\n(Oppure salvala sul PC e trascina il file.)";
window.addEventListener('dragenter', e => { if (!conFile(e)) return; e.preventDefault(); trascinamenti++; $('rilascio').hidden = false; });
window.addEventListener('dragleave', e => { if (!conFile(e)) return; trascinamenti = Math.max(0, trascinamenti - 1); if (!trascinamenti) $('rilascio').hidden = true; });
window.addEventListener('dragover', e => { if (conFile(e)) e.preventDefault(); });
window.addEventListener('drop', e => { if (!conFile(e)) return; e.preventDefault(); trascinamenti = 0; $('rilascio').hidden = true; });
document.querySelectorAll('.rilascio-zona').forEach(z => {
  z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('sopra'); });
  z.addEventListener('dragleave', () => z.classList.remove('sopra'));
  z.addEventListener('drop', async e => {
    e.preventDefault(); e.stopPropagation();
    z.classList.remove('sopra'); trascinamenti = 0; $('rilascio').hidden = true;
    // Un file CSV è il report di EasyPark (chiede mese e parcheggio).
    const csv = [...e.dataTransfer.files].find(f => /\.csv$/i.test(f.name));
    if (csv && window.EasyPark) { window.EasyPark.chiediECarica(csv); return; }
    // Nella zona dei parcometri: le foto sono scontrini, i file Excel sono resoconti POS.
    if (z.dataset.tipo === 'parcometri' && [...e.dataTransfer.files].some(eExcel)) {
      carica([...e.dataTransfer.files].filter(eExcel), 'pos').then(() => {
        if ([...e.dataTransfer.files].some(eImmagine)) carica([...e.dataTransfer.files].filter(eImmagine), 'parcometri');
      });
      return;
    }
    if (!e.dataTransfer.files.length) {
      const trovati = await fileTrascinati(e.dataTransfer);
      if (!trovati.length) { alert(MSG_WHATSAPP); return; }
      carica(trovati, z.dataset.tipo);
      return;
    }
    carica(e.dataTransfer.files, z.dataset.tipo);
  });
});

// Incolla (Ctrl+V) un'immagine copiata, es. da WhatsApp: va nella sezione aperta.
document.addEventListener('paste', e => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
  const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
  if (!files.length) return;
  e.preventDefault();
  const vista = location.hash.slice(1) || 'dashboard';
  const tipo = vista === 'bonifici' ? 'bonifici' : vista === 'parcometri' ? 'parcometri' : 'multe';
  const ora = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const rinominate = files.map((f, i) => new File([f], `incollata-${ora}${files.length > 1 ? '-' + (i + 1) : ''}.${f.type === 'application/pdf' ? 'pdf' : (f.type.split('/')[1] || 'png')}`, { type: f.type }));
  carica(rinominate, tipo);
});

// ================= Tema chiaro / scuro =================

function applicaTema(scuro) {
  if (scuro) document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  const b = $('bottoneTema');
  b.querySelector('use').setAttribute('href', scuro ? '#i-sole' : '#i-luna');
  b.title = scuro ? 'Tema chiaro' : 'Tema scuro';
  b.setAttribute('aria-label', scuro ? 'Passa al tema chiaro' : 'Passa al tema scuro');
}
applicaTema(document.documentElement.dataset.theme === 'dark');
$('bottoneTema').onclick = () => {
  const scuro = document.documentElement.dataset.theme !== 'dark';
  applicaTema(scuro);
  try { localStorage.setItem('tema', scuro ? 'dark' : ''); } catch { /* memoria del browser non disponibile */ }
  // I grafici leggono i colori al momento del disegno: li ridisegno con quelli nuovi.
  aggiornaRiepiloghi();
  if (window.Parcometri) window.Parcometri.aggiorna();
  if (window.Incassi) window.Incassi.aggiorna();
};

// ================= Menu =================

try { if (localStorage.getItem('menuRidotto') === '1') $('app').classList.add('ridotta'); } catch { /* memoria del browser non disponibile */ }
$('bottoneLato').onclick = () => {
  const ridotta = $('app').classList.toggle('ridotta');
  try { localStorage.setItem('menuRidotto', ridotta ? '1' : '0'); } catch { /* niente */ }
};
$('apriMenu').onclick = () => $('app').classList.add('menu-aperto');
$('velo').onclick = () => $('app').classList.remove('menu-aperto');

// Prima i parcheggi (per sapere quali sezioni mostrare), poi i dati.
caricaParcheggi().finally(() => {
  mostraVista();
  aggiorna().catch(e => alert('Impossibile caricare l\'archivio: ' + e.message));
});

// Sul telefono le tabelle diventano schede: ogni cella riceve il nome della sua colonna.
function etichettaColonne(tabella) {
  const nomi = [...tabella.querySelectorAll('thead th')].filter(th => !th.hidden).map(th => th.textContent.trim());
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
