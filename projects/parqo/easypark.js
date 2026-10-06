// Sezione EasyPark: incasso di ogni giorno dai report "Fatturato" (CSV) scaricati dal portale EasyPark.
// Il report non dice mese e parcheggio: si chiedono al caricamento. Usa le funzioni comuni di app.js.
// Realizzato da Angelo Lacatena® (lacatenaangelo.it).
window.EasyPark = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const soldi = v => (v == null ? '—' : v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
  const nomeGiorno = iso => GIORNI[new Date(iso + 'T12:00:00').getDay()];
  const nomeMese = m => `${MESI[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
  const COLORE = 'var(--fonte-easypark)';
  let dati = { giorni: [], caricamenti: [] };

  function svg(tag, attr = {}) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v);
    return e;
  }
  function tip(ev, righe) {
    const t = $('suggerimento');
    t.replaceChildren(...righe.map(([testo, forte]) => el('div', { class: 'tip-riga' }, el('span', { class: forte ? 'tip-forte' : '' }, testo))));
    t.hidden = false;
    t.style.left = Math.min(ev.clientX + 14, innerWidth - t.offsetWidth - 8) + 'px';
    t.style.top = Math.min(ev.clientY + 14, innerHeight - t.offsetHeight - 8) + 'px';
  }
  const nascondi = () => { $('suggerimento').hidden = true; };

  // Più parcheggi insieme ("Tutti"): sommo i giorni uguali.
  function perGiorno() {
    const g = {};
    for (const x of dati.giorni) g[x.data] = (g[x.data] || 0) + x.importo;
    return g;
  }

  function riquadri() {
    const g = perGiorno();
    const giorni = Object.keys(g).sort();
    const conIncasso = giorni.filter(d => g[d] > 0);
    const ultimo = conIncasso[conIncasso.length - 1];
    const mese = new Date().toISOString().slice(0, 7);
    const delMese = giorni.filter(d => d.startsWith(mese));
    const totMese = delMese.reduce((t, d) => t + g[d], 0);
    const pieni = delMese.filter(d => g[d] > 0);
    const migliore = conIncasso.reduce((m, d) => (!m || g[d] > g[m] ? d : m), null);
    const tile = (id, etichetta, valore, sotto) => el('div', { class: 'tile' },
      el('div', { class: 'tile-etichetta' }, icona(id), etichetta), el('div', { class: 'tile-valore' }, valore), el('div', { class: 'tile-sotto' }, sotto));
    $('epKpi').replaceChildren(
      tile('i-auto', 'Ultimo giorno con incasso', ultimo ? soldi(g[ultimo]) : '—', ultimo ? `${nomeGiorno(ultimo)} ${formatoData(ultimo)}` : 'carica un report'),
      tile('i-grafico', 'Incasso EasyPark del mese', soldi(totMese), nomeMese(mese)),
      tile('i-orologio', 'Media giornaliera', pieni.length ? soldi(totMese / pieni.length) : '—', pieni.length ? `su ${pieni.length} giorni con incasso` : '—'),
      tile('i-ok', 'Giorno migliore', migliore ? soldi(g[migliore]) : '—', migliore ? `${nomeGiorno(migliore)} ${formatoData(migliore)}` : '—'),
    );
  }

  function grafico() {
    const box = $('epGrafico');
    const W = Math.floor(box.clientWidth), H = Math.floor(box.clientHeight);
    box.replaceChildren();
    if (W < 50 || H < 50) return;
    const g = perGiorno();
    const SX = 48, DX = 4, SU = 18, GIU = 24;
    const quanti = Math.max(1, Math.min(31, Math.floor((W - SX - DX) / 20)));
    const giorni = Object.keys(g).sort().slice(-quanti);
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'giorni-svg', role: 'img', 'aria-label': 'Incasso EasyPark per giorno' });
    if (!giorni.length) {
      const t = svg('text', { x: W / 2, y: H / 2, class: 'tacca', 'text-anchor': 'middle' });
      t.textContent = 'Nessun dato: carica il report "Fatturato" di EasyPark';
      s.append(t);
      box.append(s);
      return;
    }
    const max = Math.max(1, ...giorni.map(d => g[d]));
    const passo = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(x => max / x <= 5) || Math.ceil(max / 5);
    const cima = Math.ceil(max / passo) * passo;
    const alto = H - SU - GIU;
    const y = v => SU + alto - (v / cima) * alto;
    const slot = (W - SX - DX) / giorni.length;
    const colonna = Math.min(40, slot * 0.6);
    const ogni = Math.ceil(40 / slot);
    for (let v = 0; v <= cima + 1e-9; v += passo) {
      s.append(svg('line', { x1: SX, x2: W - DX, y1: y(v), y2: y(v), class: v === 0 ? 'asse' : 'griglia' }));
      const t = svg('text', { x: SX - 8, y: y(v) + 4, class: 'tacca', 'text-anchor': 'end' });
      t.textContent = v + ' €';
      s.append(t);
    }
    giorni.forEach((d, i) => {
      const x0 = SX + i * slot + (slot - colonna) / 2;
      if (g[d] > 0) {
        const alt = Math.max(1, y(0) - y(g[d]));
        const gr = svg('g', { class: 'colonna', style: `animation-delay:${Math.min(i * 20, 400)}ms` });
        gr.append(svg('rect', { x: x0, y: y(g[d]), width: colonna, height: alt, fill: COLORE, rx: 4 }));
        if (alt > 4) gr.append(svg('rect', { x: x0, y: y(0) - 4, width: colonna, height: 4, fill: COLORE }));
        s.append(gr);
        if (colonna >= 22) {
          const t = svg('text', { x: x0 + colonna / 2, y: y(g[d]) - 6, class: 'valore-colonna', 'text-anchor': 'middle' });
          t.textContent = Math.round(g[d]);
          s.append(t);
        }
      }
      if (i % ogni === 0 || i === giorni.length - 1) {
        const et = svg('text', { x: x0 + colonna / 2, y: H - 6, class: 'tacca', 'text-anchor': 'middle' });
        et.textContent = d.slice(8, 10) + '/' + d.slice(5, 7);
        s.append(et);
      }
      const area = svg('rect', { x: SX + i * slot, y: SU, width: slot, height: alto, class: 'area-colonna' });
      area.addEventListener('mousemove', ev => tip(ev, [[`${nomeGiorno(d)} ${formatoData(d)}`, true], [`EasyPark: ${soldi(g[d])}`]]));
      area.addEventListener('mouseleave', nascondi);
      s.append(area);
    });
    box.append(s);
  }

  function tabella() {
    const g = perGiorno();
    const giorni = Object.keys(g).sort().reverse();
    $('epRighe').replaceChildren(...giorni.map(d => el('tr', {},
      el('td', {}, formatoData(d)),
      el('td', {}, nomeGiorno(d)),
      el('td', {}, el('span', { class: 'parc-importo' }, soldi(g[d]))))));
    $('epVuoto').hidden = giorni.length > 0;
  }

  function caricamenti() {
    const lista = [...dati.caricamenti].reverse();
    if (!lista.length) { $('epCaricamenti').replaceChildren(el('li', { class: 'attesa-vuota' }, 'Nessun report caricato.')); return; }
    const ultimoPer = {};
    for (const c of dati.caricamenti) ultimoPer[c.parcheggio] = c.id;
    $('epCaricamenti').replaceChildren(...lista.map(c => el('li', { title: c.nome || '' },
      el('span', { class: 'icona-auto' }, icona('i-report')),
      el('span', { class: 'testo' },
        el('strong', {}, `${nomeMese(c.mese)} · ${soldi(c.totale)}`),
        el('span', {}, `${(parcheggi.find(p => p.id === c.parcheggio) || {}).nome || ''} · caricato il ${new Date(c.il).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}`)),
      ultimoPer[c.parcheggio] === c.id ? el('button', { type: 'button', class: 'link pericolo', title: 'Rimette i valori di prima di questo report', onclick: async () => {
        if (!confirm(`Annullare il report di ${nomeMese(c.mese)}? Tornano i valori di prima.`)) return;
        try { await api('DELETE', '/api/easypark/caricamenti/' + c.id); await aggiorna(); if (window.Incassi) window.Incassi.aggiorna(); } catch (e) { alert(e.message); }
      } }, 'Annulla') : null)));
  }

  function disegna() {
    riquadri();
    grafico();
    tabella();
    caricamenti();
  }

  // Caricamento: scelto il file, si chiedono mese e parcheggio del report.
  function chiediECarica(file) {
    const conEasyPark = parcheggi.filter(p => p.servizi && p.servizi.easypark);
    if (!conEasyPark.length) { alert('Nessun parcheggio ha EasyPark: attivalo in Parcheggi → Modifica.'); return; }
    const oggi = new Date();
    const mesi = [];
    for (let i = 0; i < 13; i++) {
      const d = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      mesi.push([m, nomeMese(m)]);
    }
    const predefinito = conEasyPark.some(p => p.id === parcheggioScelto) ? parcheggioScelto : conEasyPark[0].id;
    Finestra.modulo({
      titolo: 'Report EasyPark',
      testo: `File: ${file.name}. Il report EasyPark non dice il mese: sceglilo qui. Ricaricare lo stesso mese aggiorna i giorni.`,
      campi: [
        { nome: 'mese', etichetta: 'Mese del report', tipo: 'select', opzioni: mesi, valore: mesi[0][0] },
        ...(conEasyPark.length > 1 ? [{ nome: 'parcheggio', etichetta: 'Parcheggio', tipo: 'select', opzioni: conEasyPark.map(p => [p.id, p.nome]), valore: predefinito }] : []),
      ],
      bottone: 'Carica',
      invia: async v => {
        const r = await api('POST', '/api/easypark', file, {
          'Content-Type': 'text/csv', 'X-Nome-File': encodeURIComponent(file.name),
          'X-Mese': v.mese, 'X-Parcheggio-Report': v.parcheggio || predefinito,
        });
        Finestra.avviso(`EasyPark ${nomeMese(r.mese)}: ${r.giorni} giorni registrati, totale ${soldi(r.totale)}`);
        await aggiorna();
        if (window.Incassi) window.Incassi.aggiorna();
      },
    });
  }

  $('caricaEasyPark').onclick = () => $('sceltaEasyPark').click();
  $('sceltaEasyPark').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) chiediECarica(f); };

  let attesa = null;
  new ResizeObserver(() => { clearTimeout(attesa); attesa = setTimeout(() => { if (!$('vista-easypark').hidden) grafico(); }, 80); }).observe($('epGrafico'));

  async function aggiorna() {
    try { dati = await api('GET', '/api/easypark'); disegna(); } catch { /* il server potrebbe essere in riavvio */ }
  }
  aggiorna();
  return { aggiorna, chiediECarica };
})();
