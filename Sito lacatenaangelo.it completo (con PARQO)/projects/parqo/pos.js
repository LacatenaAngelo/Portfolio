// Parcometri → scheda "Carte (POS)": pagamenti con carta dai resoconti Fabrick (.xlsx), per parcometro e per giorno.
// Il TID (terminale POS) si associa una volta al suo parcometro. Usa le funzioni comuni di app.js.
// Realizzato da Angelo Lacatena® (lacatenaangelo.it).
window.Pos = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const soldi = v => (v == null ? '—' : v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
  const nomeGiorno = iso => GIORNI[new Date(iso + 'T12:00:00').getDay()];
  const valido = p => /autorizzat|accreditat|contabilizzat|eseguit/i.test(p.stato || '') && !/storn|annull|rifiut|negat/i.test(p.stato || '');
  let dati = { pagamenti: [], tid: {}, caricamenti: [], parcometri: [] };

  function svg(tag, attr = {}) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v);
    return e;
  }
  function tip(ev, righe) {
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
  const nascondi = () => { $('suggerimento').hidden = true; };

  // Parcometro di un pagamento: quello associato al suo TID, altrimenti "TID …" da associare.
  const parcDi = p => dati.tid[p.tid] || 'tid:' + p.tid;
  const nomeParc = chiave => {
    if (chiave.startsWith('tid:')) return `TID ${chiave.slice(4)} (da associare)`;
    const n = window.Parcometri ? window.Parcometri.nomeDi(chiave) : chiave;
    return n === chiave ? chiave : `${n} · ${chiave}`;
  };
  const coloreParc = chiave => (chiave.startsWith('tid:') || !window.Parcometri ? 'var(--parc-altri)' : window.Parcometri.coloreDi(chiave));

  function filtrati() {
    const f = $('parcFiltro').value;
    return dati.pagamenti.filter(valido).filter(p => !f || dati.tid[p.tid] === f);
  }

  // ---- TID da associare (e modifica di quelli già associati) ----
  function terminali() {
    // TID mai associati (da qualsiasi parcheggio): arrivano già contati dal server.
    const daAssociare = (dati.tidDaAssociare || []).map(x => x.tid);
    const quanti = Object.fromEntries((dati.tidDaAssociare || []).map(x => [x.tid, x.n]));
    $('posDaAssociare').hidden = !daAssociare.length;
    $('posDaAssociare').textContent = daAssociare.length ? `${daAssociare.length} da associare` : '';
    const box = $('posTid');
    box.hidden = !daAssociare.length;
    if (!daAssociare.length) return;
    box.replaceChildren(
      el('strong', {}, 'A quale parcometro corrisponde il terminale POS?'),
      el('span', { class: 'piccolo' }, 'Il TID è il codice del lettore di carte del parcometro. Si associa una volta sola: poi PARQO lo ricorda.'),
      ...daAssociare.map(t => {
        const scelta = el('select', { class: 'filtro', 'aria-label': 'Parcometro del TID ' + t },
          el('option', { value: '' }, 'Scegli il parcometro…'),
          ...dati.parcometri.map(p => el('option', { value: p.id }, `PARK ${p.park || '?'} · ${p.id}${parcheggi.length > 1 ? ' · ' + ((parcheggi.find(x => x.id === p.parcheggio) || {}).nome || '') : ''}`)));
        const n = quanti[t] || 0;
        return el('div', { class: 'riga-tid' },
          el('span', {}, 'TID ', el('strong', {}, t), ` (${n} pagamenti)`), scelta,
          el('button', { type: 'button', class: 'btn primario', onclick: async () => {
            if (!scelta.value) { scelta.focus(); return; }
            try { await apiJson('PUT', '/api/pos/tid', { tid: t, idParcometro: scelta.value }); await aggiorna(); if (window.Incassi) window.Incassi.aggiorna(); } catch (e) { alert(e.message); }
          } }, 'Associa'));
      }));
  }

  // ---- Numeri principali ----
  function riquadri() {
    const lista = filtrati();
    const mese = new Date().toISOString().slice(0, 7);
    const delMese = lista.filter(p => p.data.startsWith(mese));
    const ultimoGiorno = lista.map(p => p.data.slice(0, 10)).sort().pop();
    const delGiorno = lista.filter(p => ultimoGiorno && p.data.startsWith(ultimoGiorno));
    const ultimo = lista.map(p => p.data).sort().pop();
    const somma = l => l.reduce((t, p) => t + p.lordo, 0);
    const tile = (id, etichetta, valore, sotto) => el('div', { class: 'tile' },
      el('div', { class: 'tile-etichetta' }, icona(id), etichetta), el('div', { class: 'tile-valore' }, valore), el('div', { class: 'tile-sotto' }, sotto));
    $('posKpi').replaceChildren(
      tile('i-monete', 'Incasso POS ultimo giorno', ultimoGiorno ? soldi(somma(delGiorno)) : '—', ultimoGiorno ? `${formatoData(ultimoGiorno)} · ${delGiorno.length} pagamenti` : 'nessun pagamento'),
      tile('i-grafico', 'Incasso POS del mese', soldi(somma(delMese)), new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })),
      tile('i-bonifici', 'Pagamenti del mese', String(delMese.length), delMese.length ? `in media ${soldi(somma(delMese) / delMese.length)}` : '—'),
      tile('i-orologio', 'Ultimo pagamento', ultimo ? `${ultimo.slice(11, 16)}` : '—', ultimo ? formatoData(ultimo) : 'carica un resoconto'),
    );
  }

  // ---- Grafico: colonne per giorno, divise per parcometro ----
  function grafico() {
    const box = $('posGrafico');
    const lista = filtrati();
    const chiavi = [...new Set(lista.map(parcDi))].sort();
    $('posLegenda').replaceChildren(...chiavi.map(k => {
      const v = el('span', { class: 'voce-legenda' });
      const q = el('span', { class: 'quadratino' }); q.style.background = coloreParc(k);
      v.append(q, nomeParc(k));
      return v;
    }));
    const W = Math.floor(box.clientWidth), H = Math.floor(box.clientHeight);
    box.replaceChildren();
    if (W < 50 || H < 50) return;
    const perGiorno = {};
    for (const p of lista) {
      const g = p.data.slice(0, 10);
      perGiorno[g] = perGiorno[g] || { tot: 0, n: 0 };
      perGiorno[g][parcDi(p)] = (perGiorno[g][parcDi(p)] || 0) + p.lordo;
      perGiorno[g].tot += p.lordo;
      perGiorno[g].n++;
    }
    const SX = 44, DX = 4, SU = 18, GIU = 24;
    const quanti = Math.max(1, Math.min(31, Math.floor((W - SX - DX) / 22)));
    const giorni = Object.keys(perGiorno).sort().slice(-quanti);
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'giorni-svg', role: 'img', 'aria-label': 'Incasso POS per giorno, diviso per parcometro' });
    if (!giorni.length) {
      const t = svg('text', { x: W / 2, y: H / 2, class: 'tacca', 'text-anchor': 'middle' });
      t.textContent = 'Nessun pagamento con carta: carica il resoconto di Fabrick';
      s.append(t);
      box.append(s);
      return;
    }
    const max = Math.max(1, ...giorni.map(g => perGiorno[g].tot));
    const passo = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(x => max / x <= 5) || Math.ceil(max / 5);
    const cima = Math.ceil(max / passo) * passo;
    const alto = H - SU - GIU;
    const y = v => SU + alto - (v / cima) * alto;
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
      const presenti = chiavi.filter(k => d[k] > 0);
      presenti.forEach((k, j) => {
        const y1 = y(base), y2 = y(base + d[k]);
        const altezza = Math.max(1, y1 - y2 - (j > 0 ? 2 : 0));
        const ultimo = j === presenti.length - 1;
        gruppo.append(svg('rect', { x: x0, y: y2, width: colonna, height: altezza, fill: coloreParc(k), rx: ultimo ? 4 : 0 }));
        if (ultimo && altezza > 4) gruppo.append(svg('rect', { x: x0, y: y2 + altezza - 4, width: colonna, height: 4, fill: coloreParc(k) }));
        base += d[k];
      });
      s.append(gruppo);
      if (i % ogni === 0 || i === giorni.length - 1) {
        const et = svg('text', { x: x0 + colonna / 2, y: H - 6, class: 'tacca', 'text-anchor': 'middle' });
        et.textContent = g.slice(8, 10) + '/' + g.slice(5, 7);
        s.append(et);
      }
      if (colonna >= 26) {
        const tot = svg('text', { x: x0 + colonna / 2, y: y(d.tot) - 6, class: 'valore-colonna', 'text-anchor': 'middle' });
        tot.textContent = Math.round(d.tot) + ' €';
        s.append(tot);
      }
      const area = svg('rect', { x: SX + i * slot, y: SU, width: slot, height: alto, class: 'area-colonna' });
      area.addEventListener('mousemove', ev => tip(ev, [
        [`${nomeGiorno(g)} ${formatoData(g)}`, null, true],
        ...chiavi.map(k => [`${nomeParc(k)}: ${soldi(d[k] || 0)}`, coloreParc(k)]),
        [`Totale: ${soldi(d.tot)} · ${d.n} pagamenti`, null, true],
      ]));
      area.addEventListener('mouseleave', nascondi);
      s.append(area);
    });
    box.append(s);
  }

  // ---- Tabella per giorno e parcometro ----
  function tabella() {
    const g = {};
    for (const p of filtrati()) {
      const k = p.data.slice(0, 10) + '|' + parcDi(p);
      g[k] = g[k] || { giorno: p.data.slice(0, 10), parc: parcDi(p), n: 0, lordo: 0, netto: 0 };
      g[k].n++; g[k].lordo += p.lordo; g[k].netto += p.netto != null ? p.netto : p.lordo;
    }
    const righe = Object.values(g).sort((a, b) => b.giorno.localeCompare(a.giorno) || a.parc.localeCompare(b.parc));
    $('posRighe').replaceChildren(...righe.map(r => {
      const q = el('span', { class: 'quadratino' }); q.style.background = coloreParc(r.parc);
      return el('tr', {},
        el('td', {}, formatoData(r.giorno)),
        el('td', {}, nomeGiorno(r.giorno)),
        el('td', {}, el('span', { class: 'pill-parc' }, q, nomeParc(r.parc))),
        el('td', {}, String(r.n)),
        el('td', {}, el('span', { class: 'parc-importo' }, soldi(r.lordo))));
    }));
    $('posVuoto').hidden = righe.length > 0;
  }

  // ---- Resoconti caricati (con possibilità di annullare un caricamento sbagliato) ----
  function caricamenti() {
    const lista = [...dati.caricamenti].reverse();
    if (!lista.length) { $('posCaricamenti').replaceChildren(el('li', { class: 'attesa-vuota' }, 'Nessun resoconto caricato.')); return; }
    $('posCaricamenti').replaceChildren(...lista.map(c => el('li', { title: c.nome || '' },
      el('span', { class: 'icona-auto' }, icona('i-report')),
      el('span', { class: 'testo' },
        el('strong', {}, `${c.nuovi} pagamenti nuovi${c.doppi ? ` · ${c.doppi} già presenti` : ''}`),
        el('span', {}, `${new Date(c.il).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })} · ${c.nome || 'resoconto'}`)),
      el('button', { type: 'button', class: 'link pericolo', title: 'Toglie i pagamenti entrati con questo file', onclick: async () => {
        if (!confirm(`Annullare questo caricamento? Vengono tolti i ${c.nuovi} pagamenti entrati con il file.`)) return;
        try { await api('DELETE', '/api/pos/caricamenti/' + c.id); await aggiorna(); if (window.Incassi) window.Incassi.aggiorna(); } catch (e) { alert(e.message); }
      } }, 'Annulla'))));
  }

  function disegna() {
    terminali();
    riquadri();
    grafico();
    tabella();
    caricamenti();
  }

  // Schede "Monete" / "Carte (POS)".
  function scheda(nome) {
    document.querySelectorAll('#schedeParc .scheda').forEach(b => { b.classList.toggle('attiva', b.dataset.parc === nome); b.setAttribute('aria-selected', String(b.dataset.parc === nome)); });
    $('parcMonete').hidden = nome !== 'monete';
    $('parcPos').hidden = nome !== 'pos';
    try { localStorage.setItem('schedaParc', nome); } catch { /* niente */ }
    if (nome === 'pos') disegna(); else if (window.Parcometri) window.Parcometri.aggiorna();
  }
  document.querySelectorAll('#schedeParc .scheda').forEach(b => b.addEventListener('click', () => scheda(b.dataset.parc)));
  try { if (localStorage.getItem('schedaParc') === 'pos') scheda('pos'); } catch { /* niente */ }
  // Dopo un caricamento di resoconto si apre la scheda POS.
  document.querySelectorAll('[data-carica="pos"]').forEach(b => b.addEventListener('click', () => scheda('pos')));
  $('parcFiltro').addEventListener('change', () => { if (!$('parcPos').hidden) disegna(); });

  let attesa = null;
  new ResizeObserver(() => { clearTimeout(attesa); attesa = setTimeout(() => { if (!$('parcPos').hidden) grafico(); }, 80); }).observe($('posGrafico'));

  async function aggiorna() {
    try { dati = await api('GET', '/api/pos'); disegna(); } catch { /* il server potrebbe essere in riavvio */ }
  }
  aggiorna();
  return { aggiorna };
})();
