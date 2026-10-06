// Profilo (nome, ruolo, cambio password, esci) e sezione Utenti per founder e admin.
// Usa le funzioni comuni di app.js (api, apiJson, el, formatoData). Realizzato da Angelo Lacatena® (lacatenaangelo.it).
window.Utenti = (() => {
  const NOMI = { founder: 'Founder', titolare: 'Titolare', admin: 'Admin', visualizzatore: 'Visualizzatore', utente: 'Utente (in attesa)' };
  let dati = { utenti: [], ruoliAssegnabili: [], io: null };
  let sonoFounder = false;
  let sonoPlatformFounder = false;
  let gestore = false;
  const dataOra = iso => (iso ? new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—');

  // ---- Profilo in alto a destra ----
  async function profilo() {
    const { utente } = await api('GET', '/api/sessione');
    $('profiloNome').textContent = utente.nome;
    // Iniziali di chi è entrato (es. "AL"), al posto della foto.
    $('profiloIniziali').textContent = utente.nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
    $('profiloRuolo').textContent = utente.nomeRuolo + (utente.azienda && utente.azienda.nome ? ' · ' + utente.azienda.nome : '');
    DueFattori.prepara($('bottoneDueFattori'), utente, () => { profilo(); aggiorna(); });
    // Founder e admin gestiscono gli utenti; solo il founder vede chi entra e blocca le persone.
    // "sonoFounder" = chi comanda nella propria azienda (founder o titolare).
    sonoFounder = utente.ruolo === 'founder' || utente.ruolo === 'titolare';
    sonoPlatformFounder = utente.ruolo === 'founder';
    gestore = sonoFounder || utente.ruolo === 'admin';
    $('cardAziende').hidden = !sonoPlatformFounder;
    document.querySelector('.voce[data-vista="utenti"]').classList.toggle('solo-founder', !gestore);
    document.querySelectorAll('.solo-del-founder').forEach(e => { e.hidden = !sonoFounder; });
    $('vista-utenti').classList.toggle('senza-registro', !sonoFounder);
    if (!gestore && location.hash === '#utenti') location.hash = '#dashboard';
    if (gestore) aggiorna();
  }
  $('bottoneEsci').onclick = async () => {
    await apiJson('POST', '/api/uscita', {}).catch(() => {});
    location.href = 'login.html';
  };
  $('bottonePassword').onclick = () => Finestra.cambiaPassword((vecchia, nuova) => apiJson('POST', '/api/profilo/password', { vecchia, nuova }));

  // ---- Tabella degli account ----
  function cellaRuolo(u) {
    const gestibile = u.id !== dati.io && u.ruolo !== 'founder' && u.ruolo !== 'titolare' && dati.ruoliAssegnabili.includes(u.ruolo);
    if (!gestibile) return el('td', {}, el('span', { class: 'pill-ruolo ' + u.ruolo }, NOMI[u.ruolo]));
    const scelta = el('select', { class: 'filtro', 'aria-label': 'Ruolo di ' + u.nome },
      ...dati.ruoliAssegnabili.map(r => { const o = el('option', { value: r }, NOMI[r]); o.selected = r === u.ruolo; return o; }));
    scelta.addEventListener('change', async () => {
      try { await apiJson('PUT', '/api/utenti/' + u.id, { ruolo: scelta.value }); await aggiorna(); } catch (e) { alert(e.message); scelta.value = u.ruolo; }
    });
    return el('td', {}, scelta);
  }

  function disegna() {
    const ordine = { utente: 0, founder: 1, titolare: 1, admin: 2, visualizzatore: 3 };
    const lista = [...dati.utenti].sort((a, b) => ordine[a.ruolo] - ordine[b.ruolo] || a.nome.localeCompare(b.nome));
    $('righeUtenti').replaceChildren(...lista.map(u => {
      const gestibile = u.id !== dati.io && u.ruolo !== 'founder' && u.ruolo !== 'titolare' && dati.ruoliAssegnabili.includes(u.ruolo);
      const azioni = !gestibile ? [] : [
        el('button', { type: 'button', class: 'link', onclick: () => Finestra.modulo({
          titolo: 'Reimposta password',
          testo: `Scegli una nuova password per ${u.nome} e comunicagliela. Potrà cambiarla dopo l'accesso.`,
          campi: [{ nome: 'password', etichetta: 'Nuova password (almeno 8 caratteri)', tipo: 'text', minimo: 8 }],
          bottone: 'Reimposta',
          invia: async v => { await apiJson('POST', `/api/utenti/${u.id}/password`, { password: v.password }); Finestra.avviso('Password reimpostata.'); },
        }) }, 'Reimposta password'),
        !sonoFounder ? null : u.attivo
          ? el('button', { type: 'button', class: 'link pericolo', onclick: () => Finestra.modulo({
            titolo: `Blocca ${u.nome}`,
            testo: 'Viene scollegato subito e non potrà più entrare finché non lo sblocchi. Il nome utente resta occupato, quindi non può registrarsi di nuovo.',
            campi: [{ nome: 'motivoBlocco', etichetta: 'Motivo (lo vedi solo tu)', tipo: 'text', facoltativo: true }],
            bottone: 'Blocca',
            invia: async v => { await apiJson('PUT', '/api/utenti/' + u.id, { attivo: false, motivoBlocco: v.motivoBlocco }); Finestra.avviso(`${u.nome} è bloccato.`); await aggiorna(); },
          }) }, 'Blocca')
          : el('button', { type: 'button', class: 'link', onclick: async () => {
            try { await apiJson('PUT', '/api/utenti/' + u.id, { attivo: true }); Finestra.avviso(`${u.nome} è sbloccato.`); await aggiorna(); } catch (e) { alert(e.message); }
          } }, 'Sblocca'),
        el('button', { type: 'button', class: 'link pericolo', onclick: async () => {
          if (!confirm(`Eliminare l'account di ${u.nome}?`)) return;
          try { await api('DELETE', '/api/utenti/' + u.id); await aggiorna(); } catch (e) { alert(e.message); }
        } }, 'Elimina'),
      ];
      const riga = el('tr', { class: u.ruolo === 'utente' ? 'richiesta' : '' },
        el('td', {}, el('strong', {}, u.nome), u.id === dati.io ? el('span', { class: 'piccolo' }, ' (tu)') : null,
          u.ruolo === 'utente' ? el('div', { class: 'segnalazione-gialla' }, 'Richiesta di accesso: assegna un ruolo') : null),
        el('td', {}, u.username),
        cellaRuolo(u),
        el('td', {}, el('span', { class: 'etichetta-stato ' + (u.attivo ? 'pagata' : 'bloccato') }, u.attivo ? 'Attivo' : 'Bloccato'),
          !u.attivo && u.motivoBlocco ? el('div', { class: 'piccolo' }, u.motivoBlocco) : null,
          !u.attivo && u.bloccatoIl ? el('div', { class: 'piccolo' }, 'dal ' + dataOra(u.bloccatoIl)) : null),
        el('td', {}, el('span', { class: 'etichetta-stato ' + (u.dueFattori ? 'pagata' : 'neutra') }, u.dueFattori ? 'Attiva' : 'No'),
          u.dueFattori && gestibile ? el('div', {}, el('button', { type: 'button', class: 'link', title: 'Per chi ha perso il telefono: poi la riattiva dal suo profilo', onclick: async () => {
            if (!confirm(`Azzerare la verifica in due passaggi di ${u.nome}? Verrà scollegato e potrà entrare con la sola password, poi la riattiva.`)) return;
            try { await api('DELETE', `/api/utenti/${u.id}/2fa`); Finestra.avviso('Verifica azzerata.'); await aggiorna(); } catch (e) { alert(e.message); }
          } }, 'Azzera')) : null),
        sonoFounder ? el('td', {}, dataOra(u.ultimoAccesso)) : null,
        el('td', { class: 'stretta' }, el('div', { class: 'azioni-riga' }, ...azioni)));
      return riga;
    }));
    const richieste = dati.utenti.filter(u => u.ruolo === 'utente').length;
    $('navUtenti').hidden = !richieste;
    $('navUtenti').textContent = richieste;
  }

  async function registro() {
    const voci = await api('GET', '/api/accessi');
    $('registroAccessi').replaceChildren(...(voci.length ? voci : [null]).map(v => (v
      ? el('li', {}, el('span', { class: 'testo' }, el('strong', {}, v.username), el('span', {}, `${v.esito} · ${dataOra(v.il)}`)))
      : el('li', { class: 'attesa-vuota' }, 'Nessun accesso registrato.'))));
  }

  // ---- Aziende della piattaforma (solo il founder): nome, titolare, stato. Mai i loro dati. ----
  const STATI_AZIENDA = { attiva: ['Attiva', 'pagata'], 'in-attesa': ['Da attivare', 'da-pagare'], bloccata: ['Bloccata', 'bloccato'] };
  async function aziende() {
    const lista = await api('GET', '/api/aziende');
    const attesa = lista.filter(a => a.stato === 'in-attesa').length;
    $('righeAziende').replaceChildren(...lista.sort((a, b) => (a.stato === 'in-attesa' ? -1 : 0) - (b.stato === 'in-attesa' ? -1 : 0) || (b.creataIl || '').localeCompare(a.creataIl || '')).map(a => {
      const [etichetta, classe] = STATI_AZIENDA[a.stato] || [a.stato, 'neutra'];
      const cambia = nuovo => async () => {
        if (nuovo === 'bloccata' && !confirm(`Bloccare "${a.nome}"? I suoi utenti vengono scollegati e non possono più entrare.`)) return;
        try { await apiJson('PUT', '/api/aziende/' + a.id, { stato: nuovo }); await aziende(); } catch (e) { alert(e.message); }
      };
      return el('tr', { class: a.stato === 'in-attesa' ? 'richiesta' : '' },
        el('td', {}, el('strong', {}, a.nome), a.principale ? el('span', { class: 'piccolo' }, ' (la tua)') : null),
        el('td', {}, a.titolare ? a.titolare.nome : '—', a.titolare ? el('div', { class: 'piccolo' }, a.titolare.email) : null),
        el('td', {}, String(a.account)),
        el('td', {}, dataOra(a.creataIl)),
        el('td', {}, el('span', { class: 'etichetta-stato ' + classe }, etichetta)),
        el('td', { class: 'stretta' }, a.principale ? '' : el('div', { class: 'azioni-riga' },
          a.stato !== 'attiva' ? el('button', { type: 'button', class: 'link', onclick: cambia('attiva') }, 'Attiva') : null,
          a.stato !== 'bloccata' ? el('button', { type: 'button', class: 'link pericolo', onclick: cambia('bloccata') }, 'Blocca') : null,
          el('button', { type: 'button', class: 'link pericolo', onclick: async () => {
            if (!confirm(`Eliminare l'azienda "${a.nome}" e i suoi ${a.account} account?\n\nLe persone vengono scollegate e le loro email tornano libere: potranno registrarsi di nuovo da capo. I dati dell'azienda vanno nel cestino (cartella data\\cestino).`)) return;
            try { await api('DELETE', '/api/aziende/' + a.id); Finestra.avviso(`"${a.nome}" eliminata.`); await aziende(); } catch (e) { alert(e.message); }
          } }, 'Elimina'))));
    }));
    const n = (dati.utenti || []).filter(u => u.ruolo === 'utente').length + attesa;
    $('navUtenti').hidden = !n;
    $('navUtenti').textContent = n;
  }

  async function aggiorna() {
    if (!gestore) return;
    try {
      dati = await api('GET', '/api/utenti');
      disegna();
      if (sonoFounder && location.hash === '#utenti') await registro();
      if (sonoPlatformFounder) await aziende();
    } catch { /* il server potrebbe essere in riavvio */ }
  }

  // ---- Nuovo utente ----
  $('nuovoUtente').onclick = () => {
    $('formUtente').reset();
    $('erroreUtente').textContent = '';
    $('ruoloNuovo').replaceChildren(...dati.ruoliAssegnabili.map(r => el('option', { value: r }, NOMI[r])));
    $('ruoloNuovo').value = dati.ruoliAssegnabili.includes('visualizzatore') ? 'visualizzatore' : dati.ruoliAssegnabili[0];
    $('finestraUtente').showModal();
  };
  $('annullaUtente').onclick = () => $('finestraUtente').close();
  $('formUtente').addEventListener('submit', async ev => {
    ev.preventDefault();
    try {
      await apiJson('POST', '/api/utenti', Object.fromEntries(new FormData($('formUtente'))));
      $('finestraUtente').close();
      await aggiorna();
    } catch (e) { $('erroreUtente').textContent = e.message; }
  });

  profilo().catch(() => {});
  // Le nuove richieste di accesso compaiono da sole nel menu.
  setInterval(aggiorna, 60000);
  return { aggiorna };
})();
