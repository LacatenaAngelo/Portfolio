// Sezione Parcometri: incassi giornalieri dagli scontrini "MANAGEMENT", totale nei parcometri, svuotamenti.
// Usa le funzioni comuni di app.js (api, apiJson, el, icona, formatoData, apriImmagine).
// Realizzato da Angelo Lacatena® (lacatenaangelo.it).
window.Parcometri = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const COLORI = ['var(--parc-1)', 'var(--parc-2)', 'var(--parc-3)'];
  const soldi = cent => (cent == null ? '—' : (cent / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
  const dataOraBreve = iso => (iso ? `${formatoData(iso)} ${iso.slice(11, 16)}` : '—');
  let dati = { letture: [], svuotamenti: [] };

  function svg(tag, attr = {}) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v);
    return e;
  }

  // Il colore segue il parcometro (ordine fisso per ID), non la posizione nel grafico.
  function parcometri() {
    return [...new Set(dati.letture.map(l => l.idParcometro).filter(Boolean))].sort();
  }
  const coloreDi = id => COLORI[parcometri().indexOf(id)] || 'var(--parc-altri)';
  const nomeDi = id => { const l = dati.letture.find(x => x.idParcometro === id); return l && l.park ? `PARK ${l.park}` : id; };

  function mostraTip(ev, righe) {
    const t = $('suggerimento');
    t.replaceChildren(...righe.map(([testo, colore, forte]) => {
      const r = el('div', { class: 'tip-riga' });
      if (colore) { const q = el('span', { class: 'tip-colore' }); q.style.background = colore; r.append(q); }
      r.append(el('span', { class: forte ? 'tip-forte' : '' }, testo));
      return r;
    }));
    t.hidden = false;
    t.style.left = Math.min(ev.clientX + 14, innerWidth - t.offsetWidth - 8) + 'px';
    t.style.top = Math.min(ev.clientY + 14, innerHeight - t.offsetHeight - 8) + 'px';
  }
  const nascondiTip = () => { $('suggerimento').hidden = true; };

  // "24/09" oppure "23-24/09" se lo scontrino comprende anche giorni con il report saltato.
  function etichettaGiorni(l, lunga) {
    const f = lunga ? formatoData : iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);
    const primo = (l.giorniSaltati || [])[0];
    if (!primo) return f(l.data);
    return primo.slice(5, 7) === l.data.slice(5, 7) && !lunga ? `${primo.slice(8, 10)}-${f(l.data)}` : `${f(primo)} - ${f(l.data)}`;
  }

  function filtrate() {
    const f = $('parcFiltro').value;
    return dati.letture.filter(l => !f || l.idParcometro === f);
  }

  // ---- Riquadri ----
  function riquadri() {
    const lista = filtrate();
    const conIncasso = lista.filter(l => l.incasso != null);
    const ultimoGiorno = conIncasso.map(l => l.data).sort().pop();
    const ultimaRiga = conIncasso.filter(l => l.data === ultimoGiorno).sort((a, b) => (b.giorniSaltati || []).length - (a.giorniSaltati || []).length)[0];
    const incUltimo = conIncasso.filter(l => l.data === ultimoGiorno).reduce((s, l) => s + l.incasso, 0);
    const mese = new Date().toISOString().slice(0, 7);
    const incMese = conIncasso.filter(l => l.data.startsWith(mese)).reduce((s, l) => s + l.incasso, 0);
    const ultime = {};
    for (const l of lista) if (l.sessione != null && (!ultime[l.idParcometro] || l.al > ultime[l.idParcometro].al)) ultime[l.idParcometro] = l;
    const nelParcometro = Object.values(ultime).reduce((s, l) => s + l.sessione, 0);
    const svuot = dati.svuotamenti.filter(v => !$('parcFiltro').value || v.idParcometro === $('parcFiltro').value)[0];
    const tile = (id, etichetta, valore, sotto) => el('div', { class: 'tile' },
      el('div', { class: 'tile-etichetta' }, icona(id), etichetta),
      el('div', { class: 'tile-valore' }, valore),
      el('div', { class: 'tile-sotto' }, sotto));
    $('parcKpi').replaceChildren(
      tile('i-monete', 'Incassato l\'ultimo giorno', ultimoGiorno ? soldi(incUltimo) : '—', ultimoGiorno
        ? ((ultimaRiga.giorniSaltati || []).length ? `${etichettaGiorni(ultimaRiga, true)} (report saltato)` : `${formatoData(ultimoGiorno)} · ${ultimaRiga.giorno}`)
        : 'servono due scontrini di giorni diversi'),
      tile('i-grafico', 'Incassato questo mese', soldi(incMese), new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })),
      tile('i-cassa', 'Nei parcometri ora', soldi(nelParcometro), `${Object.keys(ultime).length} parcometri, all'ultimo scontrino`),
      tile('i-annulla', 'Ultimo svuotamento', svuot ? soldi(svuot.prelevato) : '—', svuot ? `${nomeDi(svuot.idParcometro)} · ${dataOraBreve(svuot.data)}` : 'nessuno registrato'),
    );
  }

  // ---- Grafico: incassato per giorno, colonne divise per parcometro ----
  function grafico() {
    const box = $('parcGrafico');
    const ids = parcometri().filter(id => !$('parcFiltro').value || id === $('parcFiltro').value);
    $('parcLegenda').replaceChildren(...ids.map(id => {
      const v = el('span', { class: 'voce-legenda' });
      const q = el('span', { class: 'quadratino' }); q.style.background = coloreDi(id);
      v.append(q, `${nomeDi(id)} · ${id}`);
      return v;
    }));
    const W = Math.floor(box.clientWidth), H = Math.floor(box.clientHeight);
    box.replaceChildren();
    if (W < 50 || H < 50) return;
    const perGiorno = {};
    for (const l of filtrate()) {
      if (l.incasso == null) continue;
      perGiorno[l.data] = perGiorno[l.data] || { tot: 0, giorno: l.giorno, etichetta: etichettaGiorni(l), lunga: etichettaGiorni(l, true) };
      if ((l.giorniSaltati || []).length) { perGiorno[l.data].etichetta = etichettaGiorni(l); perGiorno[l.data].lunga = etichettaGiorni(l, true); }
      perGiorno[l.data][l.idParcometro] = (perGiorno[l.data][l.idParcometro] || 0) + l.incasso;
      perGiorno[l.data].tot += l.incasso;
    }
    const SX = 44, DX = 4, SU = 18, GIU = 24;
    const quanti = Math.max(1, Math.min(31, Math.floor((W - SX - DX) / 22)));
    const giorni = Object.keys(perGiorno).sort().slice(-quanti);
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'giorni-svg', role: 'img', 'aria-label': 'Incassato per giorno, diviso per parcometro' });
    if (!giorni.length) {
      const t = svg('text', { x: W / 2, y: H / 2, class: 'tacca', 'text-anchor': 'middle' });
      t.textContent = 'Servono almeno due scontrini di giorni diversi per calcolare l\'incasso';
      s.append(t);
      box.append(s);
      return;
    }
    const max = Math.max(1, ...giorni.map(g => perGiorno[g].tot)) / 100;
    const passo = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(p => max / p <= 5) || Math.ceil(max / 5);
    const cima = Math.ceil(max / passo) * passo;
    const alto = H - SU - GIU;
    const y = euro => SU + alto - (euro / cima) * alto;
    const slot = (W - SX - DX) / giorni.length;
    const colonna = Math.min(48, slot * 0.58);
    const ogni = Math.ceil(40 / slot);
    for (let v = 0; v <= cima + 1e-9; v += passo) {
      s.append(svg('line', { x1: SX, x2: W - DX, y1: y(v), y2: y(v), class: v === 0 ? 'asse' : 'griglia' }));
      const t = svg('text', { x: SX - 8, y: y(v) + 4, class: 'tacca', 'text-anchor': 'end' });
      t.textContent = v + ' €';
      s.append(t);
    }
    giorni.forEach((g, i) => {
      const d = perGiorno[g];
      const x0 = SX + i * slot + (slot - colonna) / 2;
      const gruppo = svg('g', { class: 'colonna', style: `animation-delay:${Math.min(i * 30, 400)}ms` });
      let base = 0;
      const presenti = ids.filter(id => d[id] > 0);
      presenti.forEach((id, j) => {
        const v = d[id] / 100;
        const y1 = y(base), y2 = y(base + v);
        const altezza = Math.max(1, y1 - y2 - (j > 0 ? 2 : 0));
        const cimaCol = j === presenti.length - 1;
        gruppo.append(svg('rect', { x: x0, y: y2, width: colonna, height: altezza, fill: coloreDi(id), rx: cimaCol ? 4 : 0 }));
        if (cimaCol && altezza > 4) gruppo.append(svg('rect', { x: x0, y: y2 + altezza - 4, width: colonna, height: 4, fill: coloreDi(id) }));
        base += v;
      });
      s.append(gruppo);
      if (i % ogni === 0 || i === giorni.length - 1) {
        const et = svg('text', { x: x0 + colonna / 2, y: H - 6, class: 'tacca', 'text-anchor': 'middle' });
        et.textContent = d.etichetta;
        s.append(et);
      }
      if (colonna >= 26) {
        const tot = svg('text', { x: x0 + colonna / 2, y: y(d.tot / 100) - 6, class: 'valore-colonna', 'text-anchor': 'middle' });
        tot.textContent = Math.round(d.tot / 100) + ' €';
        s.append(tot);
      }
      const area = svg('rect', { x: SX + i * slot, y: SU, width: slot, height: alto, class: 'area-colonna' });
      area.addEventListener('mousemove', ev => mostraTip(ev, [
        [d.lunga.includes(' - ') ? `${d.lunga} (report saltato: incasso sommato qui)` : `${d.giorno} ${formatoData(g)}`, null, true],
        ...ids.map(id => [`${nomeDi(id)}: ${soldi(d[id] || 0)}`, coloreDi(id)]),
        [`Totale: ${soldi(d.tot)}`, null, true],
      ]));
      area.addEventListener('mouseleave', nascondiTip);
      s.append(area);
    });
    box.append(s);
  }

  // ---- Svuotamenti ----
  function svuotamenti() {
    const lista = dati.svuotamenti.filter(v => !$('parcFiltro').value || v.idParcometro === $('parcFiltro').value);
    if (!lista.length) {
      $('parcSvuotamenti').replaceChildren(el('li', { class: 'attesa-vuota' }, 'Nessuno svuotamento registrato. Viene rilevato da solo quando cambia la data "dal" sullo scontrino.'));
      return;
    }
    $('parcSvuotamenti').replaceChildren(...lista.map(v => el('li', { title: 'Prelievo = ultimo totale letto prima dello svuotamento' },
      el('span', { class: 'icona-auto' }, icona('i-cassa')),
      el('span', { class: 'testo' }, el('strong', {}, `${nomeDi(v.idParcometro)} · ${soldi(v.prelevato)}`), el('span', {}, `svuotato il ${dataOraBreve(v.data)}`)))));
  }

  // ---- Tabella ----
  function cellaTotale(l) {
    const input = el('input', { type: 'text', inputmode: 'decimal', value: l.sessione == null ? '' : (l.sessione / 100).toFixed(2).replace('.', ','), 'aria-label': 'Totale nel parcometro' });
    const box = el('span', { class: 'campo-euro' + (l.daVerificare ? ' verifica' : '') }, input, '€');
    input.addEventListener('change', async () => {
      try { await apiJson('PUT', '/api/parcometri/' + l.id, { sessione: input.value }); await aggiorna(); } catch (e) { alert('Non salvato: ' + e.message); }
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    return el('td', {}, box);
  }

  // Data non letta: la si inserisce a mano (quella dello scontrino, riga "al:").
  function cellaData(l) {
    const input = el('input', { type: 'date', 'aria-label': 'Data dello scontrino' });
    input.addEventListener('change', async () => {
      if (!input.value) return;
      try { await apiJson('PUT', '/api/parcometri/' + l.id, { al: input.value }); await aggiorna(); } catch (e) { alert('Non salvato: ' + e.message); }
    });
    return el('td', {}, el('span', { class: 'campo-euro verifica' }, input));
  }

  function cellaControlli(l) {
    const box = el('div', { class: 'controlli' });
    if (l.daVerificare) {
      box.append(el('span', { class: 'segnalazione' }, 'Da verificare: ' + (l.motivi || []).join(', ')));
      box.append(el('button', { type: 'button', class: 'conferma visibile', onclick: async () => {
        try { await apiJson('PUT', '/api/parcometri/' + l.id, { conferma: true }); await aggiorna(); } catch (e) { alert(e.message); }
      } }, 'Conferma'));
    } else {
      box.append(el('span', { class: 'ok' }, l.corretta ? 'Corretto a mano' : 'Conti tornano'));
    }
    for (const a of l.avvisi || []) box.append(el('span', { class: 'nota-grigia' }, a));
    for (const n of l.note || []) box.append(el('span', { class: 'nota-grigia' }, n));
    return el('td', {}, box);
  }

  function tabella() {
    const lista = filtrate();
    $('parcRighe').replaceChildren(...lista.map(l => {
      const q = el('span', { class: 'quadratino' }); q.style.background = coloreDi(l.idParcometro);
      if (l.tipo === 'saltato') {
        return el('tr', { class: 'saltato' },
          el('td', {}, el('span', { class: 'pill-parc' }, q, nomeDi(l.idParcometro)), el('div', { class: 'piccolo' }, l.idParcometro)),
          el('td', {}, formatoData(l.data)),
          el('td', {}, l.giorno),
          el('td', { colspan: 3 }, el('span', { class: 'nota-saltato' }, icona('i-orologio'), (l.avvisi || [])[0] || 'report saltato')),
          el('td', {}));
      }
      return el('tr', {},
        el('td', {}, el('span', { class: 'pill-parc' }, q, `${nomeDi(l.idParcometro)}`), el('div', { class: 'piccolo' }, l.idParcometro || 'ID non letto')),
        l.data ? el('td', {}, formatoData(l.data), el('div', { class: 'piccolo' }, `ore ${(l.al || '').slice(11, 16)}`)) : cellaData(l),
        el('td', {}, l.giorno || '—'),
        el('td', {}, el('span', { class: 'parc-importo' }, soldi(l.incasso))),
        cellaTotale(l),
        cellaControlli(l),
        el('td', { class: 'stretta' }, el('div', { class: 'azioni-riga' },
          l.foto ? el('button', { type: 'button', class: 'link', onclick: () => apriImmagine(`Scontrino ${nomeDi(l.idParcometro)} · ${formatoData(l.data)}`, l.foto) }, 'Foto') : el('span', { class: 'piccolo' }, 'a mano'),
          el('button', { type: 'button', class: 'link pericolo', onclick: async () => {
            if (!confirm(`Eliminare lo scontrino di ${nomeDi(l.idParcometro)} del ${formatoData(l.data)}?`)) return;
            try { await api('DELETE', '/api/parcometri/' + l.id); await aggiorna(); } catch (e) { alert(e.message); }
          } }, 'Elimina'))));
    }));
    $('parcVuoto').hidden = lista.length > 0;
  }

  function filtro() {
    const sel = $('parcFiltro'), scelto = sel.value;
    sel.replaceChildren(el('option', { value: '' }, 'Tutti i parcometri'), ...parcometri().map(id => el('option', { value: id }, `${nomeDi(id)} · ${id}`)));
    sel.value = parcometri().includes(scelto) ? scelto : '';
  }

  function disegna() {
    filtro();
    riquadri();
    grafico();
    svuotamenti();
    tabella();
    const verifica = dati.letture.filter(l => l.daVerificare).length;
    $('navParc').hidden = !verifica;
    $('navParc').textContent = verifica;
  }

  $('parcFiltro').addEventListener('change', disegna);

  // Scontrino inserito a mano: quando la foto non si legge (o manca uno dei parcometri).
  $('parcManuale').onclick = () => {
    const noti = parcometri();
    const oggi = new Date(), iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    Finestra.modulo({
      titolo: 'Aggiungi scontrino a mano',
      testo: 'Copia i dati dallo scontrino "MANAGEMENT": parcometro, le due date (dal / al) e il totale SESSIONE.',
      campi: [
        noti.length
          ? { nome: 'idParcometro', etichetta: 'Parcometro', tipo: 'select', opzioni: noti.map(id => [id, `${nomeDi(id)} · ID ${id}`]), valore: $('parcFiltro').value || noti[0] }
          : { nome: 'idParcometro', etichetta: 'ID Parc. (es. 211301)', tipo: 'text' },
        { nome: 'dal', etichetta: 'dal (ultimo svuotamento)', tipo: 'date', facoltativo: true },
        { nome: 'al', etichetta: 'al (data dello scontrino)', tipo: 'date', valore: iso(oggi) },
        { nome: 'oraAl', etichetta: 'Ora dello scontrino (es. 17:56)', tipo: 'text', facoltativo: true, segnaposto: '18:00' },
        { nome: 'sessione', etichetta: 'Totale SESSIONE in € (es. 197,95)', tipo: 'text' },
      ],
      bottone: 'Aggiungi',
      invia: async v => { await apiJson('POST', '/api/parcometri/manuale', v); await aggiornaDati(); Finestra.avviso('Scontrino aggiunto.'); },
    });
  };
  let attesa = null;
  new ResizeObserver(() => { clearTimeout(attesa); attesa = setTimeout(grafico, 80); }).observe($('parcGrafico'));

  async function aggiornaDati() {
    try { dati = await api('GET', '/api/parcometri'); disegna(); } catch { /* il server potrebbe essere in riavvio */ }
  }
  aggiornaDati();
  return { aggiorna: aggiornaDati, coloreDi, nomeDi, parcometri };
})();
