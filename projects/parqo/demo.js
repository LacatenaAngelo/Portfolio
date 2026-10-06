// PARQO · DEMO per il portfolio. Nessun server: le richieste /api/* sono servite qui, con dati inventati.
// Le modifiche restano solo nella pagina aperta; ogni nuova visita riparte dall'accesso.
// Realizzato da Angelo Lacatena® (lacatenaangelo.it).
(function () {
  const EMAIL = 'demo@parqo.it';
  const PASSWORD = 'demo2026';
  const CHIAVE = 'parqoDemoSessione';
  const D = window.PARQO_DATI;
  const pagina = location.pathname.split('/').pop() || 'index.html';
  // Foto della demo: sono dentro demo-ritagli.js e demo-foto.js (vedi costruisci.js).
  window.fotoDemo = nome => (window.FOTO_DEMO && window.FOTO_DEMO[nome]) || 'foto/' + nome;

  // Orologio della demo: i dati finiscono il 24/09/2026, quindi "oggi" è il 25/09/2026 (l'ora scorre normalmente).
  const DateVera = Date;
  const scarto = new DateVera(2026, 8, 25, 9, 30).getTime() - DateVera.now();
  class DataDemo extends DateVera {
    constructor(...a) { if (a.length) super(...a); else super(DateVera.now() + scarto); }
    static now() { return DateVera.now() + scarto; }
  }
  window.Date = DataDemo;

  // Ogni volta che si apre la pagina di accesso, la sessione precedente viene chiusa.
  const sessione = {
    attiva() { try { return sessionStorage.getItem(CHIAVE) === '1'; } catch { return false; } },
    apri() { try { sessionStorage.setItem(CHIAVE, '1'); } catch { /* niente */ } },
    chiudi() { try { sessionStorage.removeItem(CHIAVE); } catch { /* niente */ } },
  };
  if (pagina === 'login.html') sessione.chiudi();
  else if (!sessione.attiva()) { location.replace('login.html'); return; }

  // I dati "uguali" (=) puntano a quelli di tutti i parcheggi.
  const datiDi = (p, e) => { const v = D.parcheggi[p] && D.parcheggi[p][e]; return v === '=' ? D.parcheggi[''][e] : v; };
  const copia = v => (v == null ? v : JSON.parse(JSON.stringify(v)));

  function avviso(testo) {
    let t = document.getElementById('demoToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'demoToast';
      t.className = 'demo-toast';
      t.setAttribute('role', 'status');
      document.body.append(t);
    }
    t.textContent = testo;
    t.classList.add('visibile');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('visibile'), 3600);
  }
  window.DemoParqo = { avviso };
  const SOLO_DEMO = 'Questa è una demo: qui l\'operazione è simulata e non viene salvato nulla.';

  const risposta = (corpo, stato = 200) => new Response(JSON.stringify(corpo), { status: stato, headers: { 'Content-Type': 'application/json' } });
  const errore = (testo, stato = 400) => risposta({ errore: testo }, stato);

  // Correzioni a mano di una multa, come fa il server vero (vale per tutte le viste dei parcheggi).
  const CAMPI = ['targa', 'dataMulta', 'stato', 'operatore', 'motivoAnnullamento'];
  function modificaMulta(id, campi) {
    let trovata = null;
    for (const p of Object.keys(D.parcheggi)) {
      const lista = D.parcheggi[p].multe;
      if (!Array.isArray(lista)) continue;
      const m = lista.find(x => x.id === id);
      if (!m) continue;
      for (const k of CAMPI) {
        if (!(k in campi)) continue;
        let v = String(campi[k] ?? '').trim();
        if (k === 'targa') { v = v.toUpperCase().replace(/[^A-Z0-9]/g, ''); m.targaDaVerificare = !v; }
        if (k === 'dataMulta') { m.dataDaVerificare = !v; m.dataConfermata = !!v; m.notaData = ''; }
        if (k === 'operatore') m.operatoreDaVerificare = !v;
        if (k === 'motivoAnnullamento') { v = v.toUpperCase().replace(/\s+/g, ' '); m.motivoDaVerificare = false; }
        m[k] = v;
      }
      if ('numero' in campi) {
        const n = parseInt(campi.numero, 10);
        m.numero = n > 0 ? n : null;
        m.avviso = m.numero ? 'Avviso ' + m.numero + (m.bis ? ' bis' : '') : m.avviso;
        m.numeroDaVerificare = !m.numero;
      }
      if (campi.confermaPagamento) { m.pagamentoDaVerificare = false; m.motivoVerifica = ''; }
      m.modificataIl = new Date().toISOString();
      trovata = m;
    }
    return trovata;
  }

  async function corpoJson(init) {
    if (!init || typeof init.body !== 'string') return {};
    try { return JSON.parse(init.body); } catch { return {}; }
  }

  async function servi(url, init) {
    const metodo = ((init && init.method) || 'GET').toUpperCase();
    const intestazioni = (init && init.headers) || {};
    const p = intestazioni['X-Parcheggio'] || '';
    const percorso = url.replace(/^\/api\//, '').split('?')[0];
    await new Promise(r => setTimeout(r, 60 + Math.random() * 120));

    if (percorso === 'accesso' && metodo === 'POST') {
      const d = await corpoJson(init);
      if (String(d.username || '').trim().toLowerCase() !== EMAIL || d.password !== PASSWORD) return errore(`Credenziali della demo: ${EMAIL} · ${PASSWORD}`, 401);
      sessione.apri();
      return risposta({ utente: D.comuni.sessione.utente });
    }
    if (percorso === 'uscita') { sessione.chiudi(); return risposta({ ok: true }); }
    if (percorso === 'registrazione') return errore('Nella demo non si possono creare account: entra con le credenziali già inserite.');
    // Dentro PARQO nessun ricontrollo: chi ha premuto "Accedi" resta nella dashboard finché non esce.
    // Solo la pagina di accesso chiede di entrare (così ogni nuova visita rifà l'accesso).
    if (percorso === 'sessione') return pagina === 'login.html' ? errore('Accesso richiesto', 401) : risposta(copia(D.comuni.sessione));

    if (metodo === 'GET') {
      if (percorso in D.comuni) return risposta(copia(D.comuni[percorso]));
      const v = datiDi(p, percorso);
      if (v !== undefined) return risposta(copia(v));
      return errore('Non disponibile nella demo', 404);
    }
    // Caricamento di foto, PDF, Excel: nella demo non si leggono file.
    if (metodo === 'POST' && /^(multe|bonifici|parcometri|pos|easypark)$/.test(percorso)) {
      return errore('Demo: il caricamento è disattivato. Nella versione vera PARQO legge la foto e compila tutto da solo.', 403);
    }
    if (metodo === 'PUT' && /^multe\/[^/]+$/.test(percorso)) {
      const m = modificaMulta(percorso.split('/')[1], await corpoJson(init));
      return m ? risposta(copia(m)) : errore('Multa non trovata', 404);
    }
    if (/^2fa\//.test(percorso)) return errore('La verifica in due passaggi non si attiva nella demo.', 403);
    if (/^profilo\/password/.test(percorso)) return errore('Nella demo la password non si cambia.', 403);
    // Tutto il resto (eliminare, abbinare, creare utenti...) è simulato.
    setTimeout(() => avviso(SOLO_DEMO), 50);
    return risposta({ ok: true, demo: true });
  }

  const fetchVero = window.fetch.bind(window);
  window.fetch = (risorsa, init) => {
    const url = typeof risorsa === 'string' ? risorsa : risorsa.url;
    if (url.startsWith('/api/')) return servi(url, init);
    return fetchVero(risorsa, init);
  };

  // Download dei report Excel: nella demo non ci sono file da scaricare.
  document.addEventListener('click', ev => {
    const a = ev.target.closest && ev.target.closest('a[href]');
    if (!a) return;
    const h = a.getAttribute('href');
    if (/^\/?report/.test(h) || /\.pdf$/i.test(h)) { ev.preventDefault(); avviso('Demo: qui PARQO scarica il report Excel (o il PDF) sempre aggiornato.'); }
  }, true);

  // Fascia "DEMO" in basso, con il ritorno al portfolio; sulla pagina di accesso le credenziali sono già pronte.
  document.addEventListener('DOMContentLoaded', () => {
    const fascia = document.createElement('div');
    fascia.className = 'demo-fascia';
    fascia.innerHTML = '<span><strong>DEMO</strong> · dati inventati, nulla viene salvato</span><a href="../../">← Torna al portfolio</a>';
    document.body.append(fascia);
    if (pagina === 'login.html') {
      const f = document.getElementById('formAccedi');
      if (f) {
        f.username.value = EMAIL;
        f.password.value = PASSWORD;
        const nota = document.createElement('p');
        nota.className = 'nota demo-credenziali';
        nota.innerHTML = `Credenziali della demo già inserite: <strong>${EMAIL}</strong> · <strong>${PASSWORD}</strong>. Premi <em>Accedi</em>.`;
        f.querySelector('h1').after(nota);
      }
    }
  });
})();
