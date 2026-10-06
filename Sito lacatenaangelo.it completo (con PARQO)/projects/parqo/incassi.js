// Sezione Incassi: incassato mese per mese (multe pagate, monete dei parcometri, POS, EasyPark) e
// confronto tra i mesi.
// Usa le funzioni comuni di app.js (api, el, icona). Realizzato da Angelo Lacatena® (lacatenaangelo.it).
window.Incassi = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  // Il colore segue la fonte, in ordine fisso (palette verificata per i daltonici).
  const FONTI = {
    multe: { nome: 'Multe pagate', colore: 'var(--fonte-multe)' },
    monete: { nome: 'Monete parcometri', colore: 'var(--fonte-monete)' },
    pos: { nome: 'POS parcometri', colore: 'var(--fonte-pos)' },
    easypark: { nome: 'EasyPark', colore: 'var(--fonte-easypark)' },
  };
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const nomeMese = (m, anno = true) => MESI[+m.slice(5, 7) - 1] + (anno ? ' ' + m.slice(0, 4) : '');
  const meseBreve = m => MESI[+m.slice(5, 7) - 1].slice(0, 3) + ' ' + m.slice(2, 4);
  const soldi = v => (v == null ? '—' : v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
  const percento = v => (v == null ? '—' : (v > 0 ? '+' : '') + v.toLocaleString('it-IT', { maximumFractionDigits: 1 }) + '%');
  let dati = null;

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

  function variazione(v, testo) {
    if (v == null) return el('span', { class: 'variazione neutra' }, testo || 'nessun confronto');
    return el('span', { class: 'variazione ' + (v > 0 ? 'su' : v < 0 ? 'giu' : 'neutra') }, (v > 0 ? '▲ ' : v < 0 ? '▼ ' : '') + percento(v));
  }

  // ---- Numeri principali ----
  function riquadri() {
    const c = dati.confronto;
    const attuale = dati.mesi[dati.mesi.length - 1];
    const precedente = dati.mesi.find(m => m.mese === c.mesePrecedente);
    $('incMeseEtichetta').textContent = `Incassato di ${nomeMese(c.mese, false)}`;
    $('incMeseValore').textContent = soldi(attuale.totale);
    $('incMeseSotto').replaceChildren(
      variazione(c.variazione, `nessun incasso a ${nomeMese(c.mesePrecedente, false)} per confrontare`),
      c.variazione == null ? '' : ` rispetto all'1-${c.finoAlGiorno} ${nomeMese(c.mesePrecedente, false)} (${soldi(c.precedenteStessiGiorni)})`);
    $('incPrecEtichetta').textContent = `${nomeMese(c.mesePrecedente, false)[0].toUpperCase() + nomeMese(c.mesePrecedente, false).slice(1)} (mese intero)`;
    $('incPrecValore').textContent = soldi(precedente ? precedente.totale : 0);
    $('incPrecSotto').textContent = precedente ? `multe ${soldi(precedente.multe)} · monete ${soldi(precedente.monete)} · POS ${soldi(precedente.pos)} · EasyPark ${soldi(precedente.easypark)}` : 'nessun incasso registrato';
    const tile = (id, etichetta, valore, sotto) => el('div', { class: 'tile' },
      el('div', { class: 'tile-etichetta' }, icona(id), etichetta), el('div', { class: 'tile-valore' }, valore), el('div', { class: 'tile-sotto' }, sotto));
    $('incKpi').replaceChildren(
      tile('i-bonifici', 'Multe pagate', soldi(attuale.multe), `${attuale.pagamentiMulte} bonifici a ${nomeMese(c.mese, false)}`),
      tile('i-cassa', 'Monete parcometri', soldi(attuale.monete), 'dagli scontrini dei parcometri'),
      tile('i-monete', 'POS parcometri', soldi(attuale.pos), `${attuale.pagamentiPos} pagamenti con carta`),
      tile('i-auto', 'EasyPark', soldi(attuale.easypark), `a ${nomeMese(c.mese, false)}`),
    );
  }

  // ---- Grafico: una colonna per mese, divisa per fonte ----
  function grafico() {
    const box = $('incGrafico');
    const fonti = dati.fonti;
    $('incLegenda').replaceChildren(...fonti.map(f => {
      const v = el('span', { class: 'voce-legenda' });
      const q = el('span', { class: 'quadratino' }); q.style.background = FONTI[f].colore;
      v.append(q, FONTI[f].nome);
      return v;
    }));
    const W = Math.floor(box.clientWidth), H = Math.floor(box.clientHeight);
    box.replaceChildren();
    if (W < 50 || H < 50) return;
    const SX = 56, DX = 4, SU = 22, GIU = 24;
    const quanti = Math.max(1, Math.min(24, Math.floor((W - SX - DX) / 44)));
    const mesi = dati.mesi.slice(-quanti);
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'giorni-svg', role: 'img', 'aria-label': 'Incassato per mese, diviso per fonte' });
    const max = Math.max(1, ...mesi.map(m => m.totale));
    const passo = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000].find(p => max / p <= 5) || Math.ceil(max / 5);
    const cima = Math.ceil(max / passo) * passo;
    const alto = H - SU - GIU;
    const y = v => SU + alto - (v / cima) * alto;
    const slot = (W - SX - DX) / Math.max(mesi.length, 3);
    const colonna = Math.min(64, slot * 0.56);
    for (let v = 0; v <= cima + 1e-9; v += passo) {
      s.append(svg('line', { x1: SX, x2: W - DX, y1: y(v), y2: y(v), class: v === 0 ? 'asse' : 'griglia' }));
      const t = svg('text', { x: SX - 8, y: y(v) + 4, class: 'tacca', 'text-anchor': 'end' });
      t.textContent = v.toLocaleString('it-IT') + ' €';
      s.append(t);
    }
    mesi.forEach((m, i) => {
      const x0 = SX + i * slot + (slot - colonna) / 2;
      const g = svg('g', { class: 'colonna' + (m.inCorso ? ' in-corso' : ''), style: `animation-delay:${Math.min(i * 40, 400)}ms` });
      let base = 0;
      const presenti = fonti.filter(f => m[f] > 0);
      presenti.forEach((f, j) => {
        const y1 = y(base), y2 = y(base + m[f]);
        const altezza = Math.max(1, y1 - y2 - (j > 0 ? 2 : 0));
        const ultimo = j === presenti.length - 1;
        g.append(svg('rect', { x: x0, y: y2, width: colonna, height: altezza, fill: FONTI[f].colore, rx: ultimo ? 4 : 0 }));
        if (ultimo && altezza > 4) g.append(svg('rect', { x: x0, y: y2 + altezza - 4, width: colonna, height: 4, fill: FONTI[f].colore }));
        base += m[f];
      });
      s.append(g);
      const et = svg('text', { x: x0 + colonna / 2, y: H - 6, class: 'tacca', 'text-anchor': 'middle' });
      et.textContent = meseBreve(m.mese) + (m.inCorso ? ' *' : '');
      s.append(et);
      const tot = svg('text', { x: x0 + colonna / 2, y: y(m.totale) - 7, class: 'valore-colonna', 'text-anchor': 'middle' });
      tot.textContent = Math.round(m.totale).toLocaleString('it-IT') + ' €';
      s.append(tot);
      const area = svg('rect', { x: SX + i * slot, y: SU, width: slot, height: alto, class: 'area-colonna' });
      area.addEventListener('mousemove', ev => tip(ev, [
        [nomeMese(m.mese) + (m.inCorso ? ' (in corso)' : ''), null, true],
        ...fonti.map(f => [`${FONTI[f].nome}: ${soldi(m[f])}`, FONTI[f].colore]),
        [`Totale: ${soldi(m.totale)}`, null, true],
        ...(m.variazione != null ? [[`Rispetto al mese prima: ${percento(m.variazione)}`]] : []),
      ]));
      area.addEventListener('mouseleave', nascondi);
      s.append(area);
    });
    box.append(s);
  }

  // ---- Tabella mese per mese (anche come alternativa accessibile al grafico) ----
  function tabella() {
    const righe = [...dati.mesi].reverse();
    $('incRighe').replaceChildren(...righe.map(m => el('tr', {},
      el('td', {}, el('strong', {}, nomeMese(m.mese)), m.inCorso ? el('div', { class: 'piccolo' }, `in corso, fino al ${dati.confronto.giorno}`) : null),
      el('td', {}, soldi(m.multe), el('div', { class: 'piccolo' }, `${m.pagamentiMulte} pagamenti`)),
      el('td', {}, soldi(m.monete)),
      el('td', {}, soldi(m.pos), el('div', { class: 'piccolo' }, `${m.pagamentiPos} pagamenti`)),
      el('td', {}, soldi(m.easypark)),
      el('td', {}, el('strong', {}, soldi(m.totale))),
      el('td', {}, m.inCorso
        ? variazione(dati.confronto.variazione, '—')
        : variazione(m.variazione, '—')),
    )));
  }

  // Riquadro "Incassato" della dashboard: il mese in corso, tutte le fonti.
  function dashboard() {
    const c = dati.confronto;
    const attuale = dati.mesi[dati.mesi.length - 1];
    $('heroIncassatoEtichetta').textContent = `Incassato di ${nomeMese(c.mese, false)}`;
    $('heroIncassato').textContent = soldi(attuale.totale);
    $('heroIncassatoSotto').textContent = `multe ${soldi(attuale.multe)} · monete ${soldi(attuale.monete)} · POS ${soldi(attuale.pos)} · EasyPark ${soldi(attuale.easypark)}`;
    // Totale di tutti i mesi registrati (si aggiorna con ogni bonifico, scontrino, POS, EasyPark).
    const somma = k => dati.mesi.reduce((s, m) => s + (m[k] || 0), 0);
    $('heroTotaleIncassato').textContent = soldi(somma('totale'));
    $('heroTotaleIncassatoSotto').textContent = dati.mesi.length
      ? `da ${nomeMese(dati.mesi[0].mese)} · ${dati.mesi.length} ${dati.mesi.length === 1 ? 'mese' : 'mesi'}`
      : 'nessun incasso registrato';
  }

  function disegna() {
    if (!dati) return;
    dashboard();
    riquadri();
    grafico();
    tabella();
  }

  let attesa = null;
  new ResizeObserver(() => { clearTimeout(attesa); attesa = setTimeout(() => dati && grafico(), 80); }).observe($('incGrafico'));

  async function aggiorna() {
    try { dati = await api('GET', '/api/incassi'); disegna(); } catch { /* il server potrebbe essere in riavvio */ }
  }
  aggiorna();
  return { aggiorna };
})();
