// Pagina Parcheggi: elenco dei parcheggi, nuovo/modifica, parcometri e operatori di ciascuno.
// Usa le funzioni comuni di app.js (api, apiJson, el, icona) e Finestra. Realizzato da Angelo Lacatena® (lacatenaangelo.it).
window.Parcheggi = (() => {
  let dati = { parcheggi: [], operatori: [], parcometri: [] };
  const festiviTesto = p => (p.festivi || []).map(f => `${f.giorno.slice(3, 5)}/${f.giorno.slice(0, 2)} ${f.nome}`).join('\n');
  const nomeParcheggio = id => (dati.parcheggi.find(p => p.id === id) || {}).nome || '—';

  // Finestra per nuovo parcheggio o modifica.
  function modulo(p) {
    Finestra.modulo({
      titolo: p ? 'Modifica parcheggio' : 'Nuovo parcheggio',
      testo: p ? '' : 'Dopo averlo creato, sceglilo nel menu in alto: gli scontrini dei parcometri nuovi caricati lì finiscono in questo parcheggio.',
      campi: [
        { nome: 'nome', etichetta: 'Nome del parcheggio', tipo: 'text', valore: p ? p.nome : '', segnaposto: 'es. Parcheggio Via Roma' },
        { nome: 'citta', etichetta: 'Città', tipo: 'text', valore: p ? p.citta : '', facoltativo: true },
        { nome: 'indirizzo', etichetta: 'Indirizzo', tipo: 'text', valore: p ? p.indirizzo : '', facoltativo: true },
        { nome: 'multe', etichetta: 'Multe con il nostro modulo (foto delle multe)', tipo: 'checkbox', valore: p ? p.multe : false },
        { nome: 'parcometri', etichetta: 'Parcometri a monete (scontrini)', tipo: 'checkbox', valore: p ? !!(p.servizi && p.servizi.parcometri) : true },
        { nome: 'pos', etichetta: 'Pagamenti con carta ai parcometri (POS Fabrick)', tipo: 'checkbox', valore: p ? !!(p.servizi && p.servizi.pos) : true },
        { nome: 'easypark', etichetta: 'EasyPark', tipo: 'checkbox', valore: p ? !!(p.servizi && p.servizi.easypark) : false },
        { nome: 'abbonamenti', etichetta: 'Abbonamenti', tipo: 'checkbox', valore: p ? !!(p.servizi && p.servizi.abbonamenti) : false },
        { nome: 'giorniAvviso', etichetta: 'Recupero crediti – giorni per pagare l\'avviso', tipo: 'number', valore: p && p.recupero && p.recupero.giorniAvviso != null ? p.recupero.giorniAvviso : 15, facoltativo: true },
        { nome: 'giorniDiffida', etichetta: 'Recupero crediti – giorni per pagare dopo la diffida', tipo: 'number', valore: p && p.recupero && p.recupero.giorniDiffida != null ? p.recupero.giorniDiffida : 15, facoltativo: true },
        { nome: 'costoVisura', etichetta: 'Recupero crediti – costo della visura (€, si aggiunge ai 30 € dell\'avviso)', tipo: 'text', valore: p && p.recupero && p.recupero.costoVisura != null ? String(p.recupero.costoVisura).replace('.', ',') : '0', facoltativo: true },
        { nome: 'festivi', etichetta: 'Festivi locali, uno per riga (es. 05/02 Sant\'Agata). Domeniche e festivi nazionali sono già inclusi.', tipo: 'textarea', valore: p ? festiviTesto(p) : '', segnaposto: '05/02 Patrono' },
      ],
      bottone: p ? 'Salva' : 'Crea parcheggio',
      invia: async v => {
        if (p) await apiJson('PUT', '/api/parcheggi/' + p.id, v);
        else await apiJson('POST', '/api/parcheggi', v);
        Finestra.avviso(p ? 'Parcheggio aggiornato.' : 'Parcheggio creato.');
        await aggiorna();
        await caricaParcheggi();
      },
    });
  }

  function moduloOperatore(o) {
    Finestra.modulo({
      titolo: o ? 'Modifica operatore' : 'Nuovo operatore',
      testo: o ? '' : 'PARQO riconoscerà da solo il suo nome e la matricola scritti sulle multe.',
      campi: [
        { nome: 'nome', etichetta: 'Nome', tipo: 'text', valore: o ? o.nome : '' },
        { nome: 'cognome', etichetta: 'Cognome', tipo: 'text', valore: o ? o.cognome : '' },
        { nome: 'matricola', etichetta: 'Matricola (tesserino)', tipo: 'text', valore: o ? o.matricola : '' },
        { nome: 'dal', etichetta: 'In servizio dal (facoltativo)', tipo: 'date', facoltativo: true, valore: o ? o.dal || '' : '' },
        { nome: 'al', etichetta: 'Fino al (facoltativo: se ha lasciato o passato la matricola)', tipo: 'date', facoltativo: true, valore: o ? o.al || '' : '' },
        { nome: 'parcheggio', etichetta: 'Parcheggio in cui lavora', tipo: 'select', valore: o ? o.parcheggio : (dati.parcheggi.find(p => p.multe) || dati.parcheggi[0] || {}).id,
          opzioni: dati.parcheggi.filter(p => p.multe || (o && o.parcheggio === p.id)).map(p => [p.id, p.nome]) },
      ],
      bottone: o ? 'Salva' : 'Aggiungi operatore',
      invia: async v => {
        if (o) await apiJson('PUT', '/api/operatori/' + o.id, v);
        else await apiJson('POST', '/api/operatori', v);
        Finestra.avviso('Operatore salvato.');
        await aggiorna();
      },
    });
  }

  function schede() {
    $('elencoParcheggi').replaceChildren(...dati.parcheggi.map(p => {
      const vuoto = !p.conteggi.multe && !p.conteggi.operatori && !p.conteggi.parcometri;
      return el('div', { class: 'card parcheggio-card' + (p.id === parcheggioScelto ? ' scelto' : '') },
        el('span', { class: 'pill-multe' + (p.multe ? '' : ' no') }, [p.multe ? 'Multe' : null, ...Object.entries({ parcometri: 'Parcometri', pos: 'POS', easypark: 'EasyPark', abbonamenti: 'Abbonamenti' }).filter(([k]) => p.servizi && p.servizi[k]).map(([, n]) => n)].filter(Boolean).join(' · ') || 'Nessun servizio attivo'),
        el('h2', {}, p.nome),
        el('div', { class: 'dettagli' },
          el('span', {}, [p.indirizzo, p.citta].filter(Boolean).join(' · ') || 'Indirizzo non indicato'),
          el('span', {}, (p.festivi || []).length ? 'Festivi locali: ' + p.festivi.map(f => `${f.giorno.slice(3, 5)}/${f.giorno.slice(0, 2)} ${f.nome}`).join(', ') : 'Nessun festivo locale'),
          el('span', {}, 'Report: ' + p.fileReport)),
        el('div', { class: 'numeri' },
          ...(p.multe ? [el('span', {}, el('strong', {}, String(p.conteggi.multe)), 'multe')] : []),
          el('span', {}, el('strong', {}, String(p.conteggi.parcometri)), 'parcometri'),
          ...(p.multe ? [el('span', {}, el('strong', {}, String(p.conteggi.operatori)), 'operatori')] : [])),
        el('div', { class: 'azioni-riga orizzontale' },
          el('button', { type: 'button', class: 'link', onclick: () => modulo(p) }, 'Modifica'),
          el('button', { type: 'button', class: 'link', onclick: () => { $('sceltaParcheggio').value = p.id; $('sceltaParcheggio').dispatchEvent(new Event('change')); disegna(); } }, 'Apri'),
          vuoto && dati.parcheggi.length > 1 ? el('button', { type: 'button', class: 'link pericolo', onclick: async () => {
            if (!confirm(`Eliminare il parcheggio "${p.nome}"?`)) return;
            try { await api('DELETE', '/api/parcheggi/' + p.id); await aggiorna(); await caricaParcheggi(); } catch (e) { alert(e.message); }
          } }, 'Elimina') : null));
    }));
  }

  const sceltaParcheggio = (valore, filtro, salva) => {
    const s = el('select', { class: 'filtro' }, ...dati.parcheggi.filter(filtro).map(p => { const o = el('option', { value: p.id }, p.nome); o.selected = p.id === valore; return o; }));
    s.addEventListener('change', () => salva(s.value).catch(e => { alert(e.message); s.value = valore; }));
    return s;
  };

  function tabelle() {
    $('righeParcometriParcheggio').replaceChildren(...dati.parcometri.map(x => el('tr', {},
      el('td', {}, el('strong', {}, x.park ? `PARK ${x.park}` : 'Parcometro')),
      el('td', {}, x.id),
      el('td', {}, sceltaParcheggio(x.parcheggio, () => true, async v => {
        await apiJson('PUT', '/api/parcheggi/parcometro', { idParcometro: x.id, parcheggio: v });
        Finestra.avviso('Parcometro spostato.');
        await aggiorna();
        if (window.Parcometri) window.Parcometri.aggiorna();
      })))));
    $('vuotoParcometriParcheggio').hidden = dati.parcometri.length > 0;
    $('righeOperatori').replaceChildren(...dati.operatori.map(o => el('tr', {},
      el('td', {}, el('strong', {}, `${o.nome} ${o.cognome}`)),
      el('td', {}, o.matricola, o.dal || o.al ? el('div', { class: 'piccolo' }, `${o.dal ? 'dal ' + o.dal.split('-').reverse().join('/') : ''}${o.al ? ' fino al ' + o.al.split('-').reverse().join('/') : ''}`) : null),
      el('td', {}, nomeParcheggio(o.parcheggio)),
      el('td', { class: 'stretta' }, el('button', { type: 'button', class: 'link', onclick: () => moduloOperatore(o) }, 'Modifica')))));
  }

  function disegna() {
    schede();
    tabelle();
  }

  $('nuovoParcheggio').onclick = () => modulo(null);
  $('nuovoOperatore').onclick = () => moduloOperatore(null);

  async function aggiorna() {
    try { dati = await api('GET', '/api/parcheggi'); disegna(); } catch { /* server in riavvio */ }
  }
  return { aggiorna };
})();
