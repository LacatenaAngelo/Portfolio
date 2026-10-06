// Sezione Recupero crediti: multe non pagate oltre il termine -> visura -> diffida -> pratica legale.
// Ogni passaggio si conferma con un pulsante (anche per più multe insieme) e si può annullare.
// Usa le funzioni comuni di app.js (api, apiJson, el, icona, formatoData) e Finestra.
// Realizzato da Angelo Lacatena® (lacatenaangelo.it).
window.Recupero = (() => {
  const soldi = v => (v == null ? '—' : v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
  const SCHEDE = [
    { id: 'scaduta', nome: 'Scadute', aiuto: 'Avviso non pagato entro il termine: scarica l\'elenco delle targhe, mandalo all\'ente per la visura e segnale come inviate.' },
    { id: 'visura', nome: 'In visura', aiuto: 'Targhe mandate all\'ente. Quando parte la diffida, selezionale e premi "Diffida inviata": da quel giorno PARQO conta i giorni.' },
    { id: 'diffida', nome: 'Diffide in corso', aiuto: 'Diffide inviate: se pagano entro la scadenza diventano "Pagate" da sole con il bonifico. Alla scadenza passano in "Da affidare".' },
    { id: 'da-affidare', nome: 'Da affidare', aiuto: 'Diffida scaduta senza pagamento: controlla e conferma "Affida a pratica legale". Da quel momento le vede l\'avvocato.' },
    { id: 'legale', nome: 'Pratica legale', aiuto: 'Multe affidate all\'avvocato. Se una viene pagata dopo, qui (e all\'avvocato) compare "chiudere la pratica".' },
  ];
  let dati = { multe: [], impostazioni: {} };
  let scheda = 'scaduta';
  try { scheda = localStorage.getItem('schedaRecupero') || 'scaduta'; } catch { /* niente */ }
  const scelte = new Set();

  const nellaScheda = (m, s) => (s === 'legale' ? !!m.legaleIl : m.fase === s);
  const conta = s => dati.multe.filter(m => nellaScheda(m, s)).length;

  function schede() {
    $('schedeRecupero').replaceChildren(...SCHEDE.map(s => {
      const n = conta(s.id);
      const urgente = (s.id === 'scaduta' || s.id === 'da-affidare') && n > 0;
      return el('button', {
        type: 'button', role: 'tab', class: 'scheda' + (s.id === scheda ? ' attiva' : ''), 'aria-selected': String(s.id === scheda),
        onclick: () => { scheda = s.id; scelte.clear(); try { localStorage.setItem('schedaRecupero', scheda); } catch { /* niente */ } disegna(); },
      }, s.nome, el('span', { class: 'conta' + (urgente ? ' giallo' : '') }, String(n)));
    }));
    $('aiutoRecupero').textContent = SCHEDE.find(s => s.id === scheda).aiuto;
    // Numerino nel menu: le multe su cui c'è da fare qualcosa.
    const daFare = conta('scaduta') + conta('da-affidare');
    $('navRecupero').hidden = !daFare;
    $('navRecupero').textContent = daFare;
  }

  // Impostazioni del parcheggio (giorni e costo visura), mostrate in alto.
  function impostazioni() {
    const imp = Object.values(dati.impostazioni);
    $('impRecupero').textContent = imp.map(i => `${imp.length > 1 ? i.nome + ': ' : ''}avviso ${i.giorniAvviso} gg · diffida ${i.giorniDiffida} gg · visura ${soldi(i.costoVisura)}`).join('  |  ');
  }

  async function azione(nome, ids, data) {
    const r = await apiJson('POST', '/api/recupero/azione', { ids, azione: nome, data });
    scelte.clear();
    Finestra.avviso(`${r.fatte} multe aggiornate${r.saltate ? ` (${r.saltate} saltate: non erano in questa fase)` : ''}.`);
    await aggiornaTutto();
  }

  function selezionate() {
    const ids = dati.multe.filter(m => nellaScheda(m, scheda) && scelte.has(m.id)).map(m => m.id);
    if (!ids.length) { alert('Seleziona almeno una multa (casella a sinistra), oppure "Seleziona tutte".'); return null; }
    return ids;
  }

  const linkExcel = fase => `/report-recupero?fase=${fase}&parcheggio=${encodeURIComponent(parcheggioScelto)}`;

  function barra() {
    const pulsanti = [];
    const excel = testo => el('a', { class: 'btn contorno', href: linkExcel(scheda) }, icona('i-scarica'), el('span', {}, testo));
    if (scheda === 'scaduta') {
      pulsanti.push(excel('Scarica elenco per la visura'));
      pulsanti.push(el('button', { type: 'button', class: 'btn primario', onclick: () => {
        const ids = selezionate(); if (!ids) return;
        Finestra.modulo({
          titolo: 'Inviate in visura', testo: `${ids.length} targhe mandate all'ente per la visura.`,
          campi: [{ nome: 'data', etichetta: 'Data di invio', tipo: 'date', valore: new Date().toISOString().slice(0, 10) }],
          bottone: 'Conferma', invia: v => azione('visura', ids, v.data),
        });
      } }, icona('i-ok'), el('span', {}, 'Segna come inviate in visura')));
    }
    if (scheda === 'scaduta' || scheda === 'visura') {
      pulsanti.push(el('button', { type: 'button', class: 'btn ' + (scheda === 'visura' ? 'primario' : 'contorno'), onclick: () => {
        const ids = selezionate(); if (!ids) return;
        Finestra.modulo({
          titolo: 'Diffida inviata', testo: `${ids.length} multe. Da questa data PARQO conta i giorni della diffida.`,
          campi: [{ nome: 'data', etichetta: 'Data di invio della diffida', tipo: 'date', valore: new Date().toISOString().slice(0, 10) }],
          bottone: 'Conferma', invia: v => azione('diffida', ids, v.data),
        });
      } }, icona('i-ok'), el('span', {}, 'Diffida inviata')));
    }
    if (scheda === 'visura' || scheda === 'diffida') pulsanti.push(excel('Scarica elenco'));
    if (scheda === 'da-affidare') {
      pulsanti.push(excel('Scarica elenco'));
      pulsanti.push(el('button', { type: 'button', class: 'btn primario', onclick: () => {
        const ids = selezionate(); if (!ids) return;
        if (!confirm(`Affidare ${ids.length} multe a pratica legale? Da quel momento le vedrà l'avvocato.`)) return;
        azione('legale', ids).catch(e => alert(e.message));
      } }, icona('i-ok'), el('span', {}, 'Affida a pratica legale')));
    }
    if (scheda === 'legale') {
      pulsanti.push(excel('Scarica elenco per l\'avvocato'));
      pulsanti.push(el('a', { class: 'btn contorno', href: 'consulta.html' }, icona('i-occhio'), el('span', {}, 'Vedi come l\'avvocato')));
    }
    $('azioniRecupero').replaceChildren(...pulsanti);
  }

  function cellaProprietario(m) {
    const input = el('input', { type: 'text', value: m.proprietario || '', placeholder: 'dalla visura…', 'aria-label': 'Proprietario di ' + m.targa });
    input.addEventListener('change', async () => {
      try { await apiJson('PUT', '/api/recupero/' + m.id, { proprietario: input.value }); m.proprietario = input.value; Finestra.avviso('Salvato.'); } catch (e) { alert(e.message); }
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    return el('td', {}, el('span', { class: 'campo-euro campo-testo' }, input));
  }

  function situazione(m) {
    if (m.chiusa) return el('span', { class: 'etichetta-stato pagata' }, `${m.stato}${m.pagataIl ? ' il ' + formatoData(m.pagataIl) : ''} – chiudere la pratica`);
    if (m.fase === 'scaduta') return el('span', { class: 'etichetta-stato da-pagare' }, `scaduta da ${-m.giorniMancanti} giorni`);
    if (m.fase === 'visura') return el('span', {}, `in visura dal ${formatoData(m.visuraIl)}`, el('div', { class: 'piccolo' }, m.visuraDa));
    if (m.fase === 'diffida') return el('span', {}, `scade il ${formatoData(m.scadenzaDiffida)}`, el('div', { class: 'piccolo' }, m.giorniMancanti === 0 ? 'ultimo giorno' : `tra ${m.giorniMancanti} giorni`));
    if (m.fase === 'da-affidare') return el('span', { class: 'etichetta-stato da-pagare' }, `diffida scaduta il ${formatoData(m.scadenzaDiffida)}`);
    if (m.fase === 'legale') return el('span', {}, `affidata il ${formatoData(m.legaleIl)}`, el('div', { class: 'piccolo' }, m.legaleDa));
    return el('span', {}, '—');
  }

  function tabella() {
    const lista = dati.multe.filter(m => nellaScheda(m, scheda))
      .sort((a, b) => (a.dataMulta || '').localeCompare(b.dataMulta || '') || (a.numero || 0) - (b.numero || 0));
    const tutte = el('input', { type: 'checkbox', 'aria-label': 'Seleziona tutte' });
    tutte.checked = lista.length > 0 && lista.every(m => scelte.has(m.id));
    tutte.addEventListener('change', () => { lista.forEach(m => (tutte.checked ? scelte.add(m.id) : scelte.delete(m.id))); tabella(); });
    $('selezionaTutte').replaceChildren(tutte);
    $('righeRecupero').replaceChildren(...lista.map(m => {
      const c = el('input', { type: 'checkbox', 'aria-label': 'Seleziona ' + m.targa });
      c.checked = scelte.has(m.id);
      c.addEventListener('change', () => { c.checked ? scelte.add(m.id) : scelte.delete(m.id); tutte.checked = lista.every(x => scelte.has(x.id)); });
      const indietro = (m.visuraIl || m.diffidaIl || m.legaleIl) ? el('button', { type: 'button', class: 'link', title: 'Annulla l\'ultimo passaggio (in caso di errore)', onclick: async () => {
        if (!confirm(`Annullare l'ultimo passaggio di ${m.avviso} (${m.targa})?`)) return;
        try { await api('POST', `/api/recupero/${m.id}/indietro`); await aggiornaTutto(); } catch (e) { alert(e.message); }
      } }, 'Indietro') : null;
      return el('tr', { class: m.chiusa ? 'chiusa' : '' },
        el('td', { class: 'stretta' }, m.chiusa ? null : c),
        el('td', {}, el('strong', {}, m.avviso), el('div', { class: 'piccolo' }, m.operatore)),
        el('td', {}, el('strong', { class: 'targa-fissa' }, m.targa || '—')),
        el('td', {}, formatoData(m.dataMulta)),
        el('td', {}, situazione(m)),
        cellaProprietario(m),
        el('td', {}, soldi(m.importoDovuto)),
        el('td', { class: 'stretta' }, el('div', { class: 'azioni-riga' },
          el('button', { type: 'button', class: 'link', onclick: () => apriImmagine(`${m.avviso} · ${m.targa}`, m.foto) }, 'Foto'), indietro)));
    }));
    $('vuotoRecupero').hidden = lista.length > 0;
  }

  function disegna() {
    schede();
    impostazioni();
    barra();
    tabella();
  }

  async function aggiorna() {
    try { dati = await api('GET', '/api/recupero'); disegna(); } catch { /* il server potrebbe essere in riavvio */ }
  }
  // Dopo un passaggio cambiano anche le colonne di Avvisi: aggiorno tutta l'app (che aggiorna anche questa sezione).
  async function aggiornaTutto() {
    if (typeof window.aggiorna === 'function') await window.aggiorna(); else await aggiorna();
  }
  aggiorna();
  return { aggiorna };
})();
