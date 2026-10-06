// Statistiche della dashboard: numeri principali, indicatori, quota per stato e colonne per giorno.
// Disegnato in SVG, senza librerie. Realizzato da Angelo Lacatena® (lacatenaangelo.it).
(() => {
  // Ordine fisso delle serie: il colore segue lo stato, non la posizione.
  const SERIE = [
    { stato: 'Da pagare', nome: 'Da pagare', colore: 'var(--serie-da-pagare)' },
    { stato: 'Pagata', nome: 'Pagate', colore: 'var(--serie-pagata)' },
    { stato: 'Annullata', nome: 'Annullate', colore: 'var(--serie-annullata)' },
  ];
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const perc = (n, tot) => (tot ? Math.round((n / tot) * 1000) / 10 : 0).toLocaleString('it-IT') + '%';
  const intero = v => Math.round(v).toLocaleString('it-IT');
  const dataBreve = iso => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : 'n.d.');
  const dataLunga = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : 'senza data');
  const animazioniRidotte = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function svg(tag, attr = {}) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v);
    return e;
  }
  function nodo(tag, classe, testo) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (testo != null) e.textContent = testo;
    return e;
  }
  function icona(id) {
    const s = svg('svg');
    s.append(svg('use', { href: '#' + id }));
    return s;
  }

  // Numero che "sale" fino al valore nuovo.
  function conta(el, valore, formato) {
    const da = Number(el.dataset.valore || 0);
    el.dataset.valore = valore;
    if (animazioniRidotte() || da === valore) { el.textContent = formato(valore); return; }
    const inizio = performance.now(), durata = 650;
    const passo = ora => {
      const t = Math.min(1, (ora - inizio) / durata);
      const e = 1 - Math.pow(1 - t, 3);
      el.textContent = formato(da + (valore - da) * e);
      if (t < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  // ---- Suggerimento al passaggio del mouse ----
  function mostra(evento, righe) {
    const t = $('suggerimento');
    t.replaceChildren(...righe.map(([testo, colore, forte]) => {
      const r = nodo('div', 'tip-riga');
      if (colore) { const q = nodo('span', 'tip-colore'); q.style.background = colore; r.append(q); }
      r.append(nodo('span', forte ? 'tip-forte' : '', testo));
      return r;
    }));
    t.hidden = false;
    const x = Math.min(evento.clientX + 14, window.innerWidth - t.offsetWidth - 8);
    const y = Math.min(evento.clientY + 14, window.innerHeight - t.offsetHeight - 8);
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  }
  function nascondi() { $('suggerimento').hidden = true; }

  // ---- Periodo scelto ----
  function nelPeriodo(multe, periodo) {
    if (periodo === 'tutto') return multe;
    const oggi = new Date();
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let dal;
    if (periodo === 'oggi') dal = iso(oggi);
    else if (periodo === 'mese') dal = iso(new Date(oggi.getFullYear(), oggi.getMonth(), 1));
    else dal = iso(new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - (Number(periodo) - 1)));
    return multe.filter(m => m.dataMulta && m.dataMulta >= dal && m.dataMulta <= iso(oggi));
  }

  // ---- Indicatori ----
  function indicatori(conteggi, tot, inAttesa, vai) {
    const kpi = $('kpi');
    // Valori precedenti: i numeri "salgono" da lì al valore nuovo.
    const vecchi = [...kpi.querySelectorAll('.tile-valore')].map(x => x.dataset.valore);
    let indice = 0;
    const tile = (id, etichetta, valore, sotto, filtro) => {
      const d = nodo('div', 'tile cliccabile');
      d.tabIndex = 0;
      d.setAttribute('role', 'button');
      const e = nodo('div', 'tile-etichetta');
      e.append(icona(id), document.createTextNode(etichetta));
      const v = nodo('div', 'tile-valore', '0');
      if (vecchi[indice] != null) v.dataset.valore = vecchi[indice];
      indice++;
      d.append(e, v, nodo('div', 'tile-sotto', sotto));
      d.addEventListener('click', () => vai(filtro));
      d.addEventListener('keydown', ev => { if (ev.key === 'Enter') vai(filtro); });
      conta(v, valore, intero);
      return d;
    };
    kpi.replaceChildren(
      tile('i-ok', 'Pagate', conteggi.Pagata, perc(conteggi.Pagata, tot) + ' del totale', { stato: 'Pagata' }),
      tile('i-orologio', 'Da pagare', conteggi['Da pagare'], perc(conteggi['Da pagare'], tot) + ' del totale', { stato: 'Da pagare' }),
      tile('i-annulla', 'Annullate', conteggi.Annullata, 'tasso di annullamento ' + perc(conteggi.Annullata, tot), { stato: 'Annullata' }),
      tile('i-attesa', 'Bonifici in attesa', inAttesa, 'senza multa abbinata', { vista: 'bonifici' }),
    );
  }

  // ---- Quota per stato ----
  function quota(conteggi, tot) {
    $('legendaQuota').replaceChildren(...SERIE.map(s => {
      const v = nodo('span', 'voce-legenda');
      const q = nodo('span', 'quadratino'); q.style.background = s.colore;
      v.append(q, document.createTextNode(s.nome), nodo('b', '', `${conteggi[s.stato]} · ${perc(conteggi[s.stato], tot)}`));
      return v;
    }));
    const box = $('quota');
    box.replaceChildren();
    const W = 1000, H = 12, GAP = 3;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', class: 'quota-svg', role: 'img',
      'aria-label': SERIE.map(x => `${x.nome} ${conteggi[x.stato]}`).join(', ') });
    const presenti = SERIE.filter(x => conteggi[x.stato] > 0);
    let x = 0;
    presenti.forEach((serie, i) => {
      const n = conteggi[serie.stato];
      const largo = (n / tot) * W - (i < presenti.length - 1 ? GAP : 0);
      const r = svg('rect', { x, y: 0, width: Math.max(largo, 1), height: H, fill: serie.colore, rx: 3 });
      r.addEventListener('mousemove', ev => mostra(ev, [[serie.nome, serie.colore, true], [`${n} multe · ${perc(n, tot)}`]]));
      r.addEventListener('mouseleave', nascondi);
      s.append(r);
      x += largo + GAP;
    });
    if (!tot) s.append(svg('rect', { x: 0, y: 0, width: W, height: H, fill: '#eef0f4', rx: 3, class: 'quota-vuota' }));
    box.append(s);
  }

  // ---- Colonne per giorno (si adatta allo spazio disponibile) ----
  let ultimoGiorni = null;
  let firmaDati = '';
  function giorni(multe) {
    ultimoGiorni = multe;
    // Le colonne "crescono" solo quando i numeri cambiano davvero, non a ogni ridisegno.
    const firma = JSON.stringify(multe.map(m => [m.dataMulta, m.stato]).sort());
    const anima = firma !== firmaDati;
    firmaDati = firma;
    const box = $('giorni');
    const W = Math.floor(box.clientWidth), H = Math.floor(box.clientHeight);
    box.replaceChildren();
    $('legendaGiorni').replaceChildren(...SERIE.map(s => {
      const v = nodo('span', 'voce-legenda');
      const q = nodo('span', 'quadratino'); q.style.background = s.colore;
      v.append(q, document.createTextNode(s.nome));
      return v;
    }));
    if (W < 50 || H < 50) return;

    const perGiorno = {};
    for (const m of multe) {
      const g = m.dataMulta || '';
      perGiorno[g] = perGiorno[g] || { 'Da pagare': 0, Pagata: 0, Annullata: 0, tot: 0 };
      perGiorno[g][m.stato] = (perGiorno[g][m.stato] || 0) + 1;
      perGiorno[g].tot++;
    }
    const SX = 30, DX = 4, SU = 18, GIU = 24;
    // Quanti giorni entrano: almeno ~22px a colonna.
    const quanti = Math.max(1, Math.min(31, Math.floor((W - SX - DX) / 22)));
    const chiavi = Object.keys(perGiorno).sort((a, b) => (a || '9').localeCompare(b || '9')).slice(-quanti);
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'giorni-svg' + (anima ? '' : ' fermo'), role: 'img', 'aria-label': 'Multe per giorno, divise per stato' });
    if (!chiavi.length) {
      const t = svg('text', { x: W / 2, y: H / 2, class: 'tacca', 'text-anchor': 'middle' });
      t.textContent = 'Nessuna multa nel periodo scelto';
      s.append(t);
      box.append(s);
      return;
    }
    const max = Math.max(1, ...chiavi.map(k => perGiorno[k].tot));
    const passo = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : Math.ceil(max / 50) * 10;
    const cima = Math.ceil(max / passo) * passo;
    const alto = H - SU - GIU;
    const y = v => SU + alto - (v / cima) * alto;
    const slot = (W - SX - DX) / chiavi.length;
    const colonna = Math.min(48, slot * 0.58);
    // Etichette delle date: solo quante ne entrano senza sovrapporsi.
    const ogni = Math.ceil(40 / slot);

    for (let v = 0; v <= cima; v += passo) {
      s.append(svg('line', { x1: SX, x2: W - DX, y1: y(v), y2: y(v), class: v === 0 ? 'asse' : 'griglia' }));
      const t = svg('text', { x: SX - 8, y: y(v) + 4, class: 'tacca', 'text-anchor': 'end' });
      t.textContent = v;
      s.append(t);
    }
    chiavi.forEach((k, i) => {
      const d = perGiorno[k];
      const x0 = SX + i * slot + (slot - colonna) / 2;
      const g = svg('g', { class: 'colonna', style: `animation-delay:${Math.min(i * 30, 400)}ms` });
      let base = 0;
      const presenti = SERIE.filter(serie => d[serie.stato] > 0);
      presenti.forEach((serie, j) => {
        const n = d[serie.stato];
        const y1 = y(base), y2 = y(base + n);
        // 2px di stacco tra i segmenti; angoli arrotondati solo in cima, base dritta sull'asse.
        const altezza = Math.max(1, y1 - y2 - (j > 0 ? 2 : 0));
        const cima = j === presenti.length - 1;
        g.append(svg('rect', { x: x0, y: y2, width: colonna, height: altezza, fill: serie.colore, rx: cima ? 4 : 0 }));
        if (cima && altezza > 4) g.append(svg('rect', { x: x0, y: y2 + altezza - 4, width: colonna, height: 4, fill: serie.colore }));
        base += n;
      });
      s.append(g);
      if (i % ogni === 0 || i === chiavi.length - 1) {
        const et = svg('text', { x: x0 + colonna / 2, y: H - 6, class: 'tacca', 'text-anchor': 'middle' });
        et.textContent = dataBreve(k);
        s.append(et);
      }
      if (colonna >= 16) {
        const tot = svg('text', { x: x0 + colonna / 2, y: y(d.tot) - 6, class: 'valore-colonna', 'text-anchor': 'middle' });
        tot.textContent = d.tot;
        s.append(tot);
      }
      const area = svg('rect', { x: SX + i * slot, y: SU, width: slot, height: alto, class: 'area-colonna' });
      area.addEventListener('mousemove', ev => mostra(ev, [
        [k ? `Multe del ${dataLunga(k)}` : 'Multe senza data', null, true],
        ...SERIE.map(serie => [`${serie.nome}: ${d[serie.stato]}`, serie.colore]),
        [`Tasso di annullamento: ${perc(d.Annullata, d.tot)}`],
      ]));
      area.addEventListener('mouseleave', nascondi);
      s.append(area);
    });
    box.append(s);
  }

  // Ridisegno il grafico quando cambia lo spazio (finestra ridimensionata, menu ridotto…).
  let attesaRidisegno = null;
  new ResizeObserver(() => {
    clearTimeout(attesaRidisegno);
    attesaRidisegno = setTimeout(() => { if (ultimoGiorni) giorni(ultimoGiorni); }, 80);
  }).observe(document.getElementById('giorni'));

  window.Statistiche = {
    disegna({ multe, bonifici, periodo, vai }) {
      const scelte = nelPeriodo(multe, periodo);
      const conteggi = { 'Da pagare': 0, Pagata: 0, Annullata: 0 };
      for (const m of scelte) conteggi[m.stato] = (conteggi[m.stato] || 0) + 1;
      const inAttesa = bonifici.filter(b => !b.voci.length || b.voci.some(v => !v.multaId)).length;
      // Il riquadro "Incassato" (mese in corso, tutte le fonti) lo disegna incassi.js.
      conta($('heroTotale'), scelte.length, intero);
      indicatori(conteggi, scelte.length, inAttesa, vai);
      quota(conteggi, scelte.length);
      giorni(scelte);
    },
    nelPeriodo,
  };
})();
