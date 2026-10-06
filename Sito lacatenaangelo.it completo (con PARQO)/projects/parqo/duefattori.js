// Finestra "Verifica in due passaggi" del proprio account: attivazione con il QR, codici di recupero,
// disattivazione. Funziona sia nell'app sia nella pagina dell'avvocato.
// Realizzato da Angelo Lacatena® (lacatenaangelo.it).
window.DueFattori = (() => {
  function crea(tag, attributi = {}, ...figli) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attributi)) {
      if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v != null) e.setAttribute(k, v);
    }
    for (const f of figli) if (f != null) e.append(f);
    return e;
  }

  async function chiama(metodo, url, dati) {
    const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: dati ? JSON.stringify(dati) : undefined });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(corpo.errore || 'Errore ' + r.status);
    return corpo;
  }

  const campoCodice = () => crea('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '123456', class: 'campo-codice' });

  // Una finestra con contenuto che cambia a ogni passaggio.
  function finestra(titolo) {
    const corpo = crea('div', { class: 'form-corpo' });
    const piede = crea('div', { class: 'finestra-piede' });
    const d = crea('dialog', { class: 'finestra finestra-piccola' }, crea('div', { class: 'finestra-testa' }, crea('strong', {}, titolo)), corpo, piede);
    document.body.append(d);
    d.addEventListener('close', () => d.remove());
    d.showModal();
    return { d, corpo, piede, chiudi: () => d.close() };
  }
  const errore = () => crea('p', { class: 'accesso-errore', role: 'alert' });

  function mostraCodici(f, codici, aggiorna) {
    f.corpo.replaceChildren(
      crea('p', {}, crea('strong', {}, 'Codici di recupero'), ': ogni codice funziona una sola volta, al posto del codice del telefono, se lo perdi o si rompe.'),
      crea('pre', { class: 'codici-recupero' }, codici.join('\n')),
      crea('p', { class: 'nota' }, 'Conservali in un posto sicuro (stampati o in un gestore di password), NON sullo stesso telefono. Non verranno più mostrati.'));
    const copia = crea('button', { type: 'button', class: 'btn contorno', onclick: async () => {
      try { await navigator.clipboard.writeText(codici.join('\n')); copia.textContent = 'Copiati'; } catch { copia.textContent = 'Selezionali e copiali a mano'; }
    } }, 'Copia');
    f.piede.replaceChildren(copia, crea('button', { type: 'button', class: 'btn primario', onclick: () => { f.chiudi(); aggiorna(); } }, 'Li ho salvati'));
  }

  async function attiva(aggiorna) {
    const f = finestra('Attiva la verifica in due passaggi');
    let dati;
    try { dati = await chiama('POST', '/api/2fa/inizia'); } catch (e) { f.corpo.replaceChildren(crea('p', { class: 'accesso-errore' }, e.message)); return; }
    const codice = campoCodice();
    const err = errore();
    f.corpo.replaceChildren(
      crea('p', {}, '1. Installa sul telefono un\'app di autenticazione gratuita: ', crea('strong', {}, 'Google Authenticator'), ' o ', crea('strong', {}, 'Microsoft Authenticator'), '.'),
      crea('p', {}, '2. Nell\'app premi "+" e inquadra questo codice:'),
      crea('img', { src: dati.qr, alt: 'Codice QR da inquadrare con l\'app', class: 'qr-2fa', width: '220', height: '220' }),
      crea('p', { class: 'nota' }, 'Non riesci a inquadrarlo? Inserisci a mano questa chiave: ', crea('code', { class: 'chiave-2fa' }, dati.segreto.replace(/(.{4})/g, '$1 ').trim())),
      crea('label', {}, '3. Scrivi il codice di 6 cifre che compare nell\'app', codice),
      err);
    const conferma = crea('button', { type: 'submit', class: 'btn primario', onclick: async () => {
      err.textContent = '';
      try { const r = await chiama('POST', '/api/2fa/conferma', { codice: codice.value }); mostraCodici(f, r.codici, aggiorna); } catch (e) { err.textContent = e.message; }
    } }, 'Attiva');
    codice.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); conferma.click(); } });
    f.piede.replaceChildren(crea('button', { type: 'button', class: 'btn contorno', onclick: f.chiudi }, 'Annulla'), conferma);
    codice.focus();
  }

  function gestisci(aggiorna) {
    const f = finestra('Verifica in due passaggi: attiva');
    const password = crea('input', { type: 'password', autocomplete: 'current-password' });
    const codice = campoCodice();
    const err = errore();
    f.corpo.replaceChildren(
      crea('p', {}, 'Per entrare servono la password e il codice dell\'app sul telefono. Qui puoi creare nuovi codici di recupero oppure disattivarla.'),
      crea('label', {}, 'Codice attuale dell\'app (6 cifre)', codice),
      crea('label', {}, 'Password (solo per disattivare)', password),
      err);
    f.piede.replaceChildren(
      crea('button', { type: 'button', class: 'btn contorno', onclick: f.chiudi }, 'Chiudi'),
      crea('button', { type: 'button', class: 'btn contorno', onclick: async () => {
        err.textContent = '';
        try { const r = await chiama('POST', '/api/2fa/codici', { codice: codice.value }); mostraCodici(f, r.codici, aggiorna); } catch (e) { err.textContent = e.message; }
      } }, 'Nuovi codici di recupero'),
      crea('button', { type: 'button', class: 'btn contorno pericolo', onclick: async () => {
        err.textContent = '';
        if (!confirm('Disattivare la verifica in due passaggi? Il tuo account sarà protetto solo dalla password.')) return;
        try { await chiama('POST', '/api/2fa/disattiva', { password: password.value, codice: codice.value }); f.chiudi(); aggiorna(); } catch (e) { err.textContent = e.message; }
      } }, 'Disattiva'));
    codice.focus();
  }

  // Pulsante con lo scudo: verde se attiva, giallo se consigliata e spenta (founder e admin).
  function prepara(bottone, utente, aggiorna) {
    const attiva2fa = !!utente.dueFattori;
    bottone.classList.toggle('scudo-attivo', attiva2fa);
    bottone.classList.toggle('scudo-consigliato', !attiva2fa && ['founder', 'admin'].includes(utente.ruolo));
    bottone.title = attiva2fa ? 'Verifica in due passaggi: attiva' : 'Attiva la verifica in due passaggi';
    bottone.onclick = () => (attiva2fa ? gestisci(aggiorna) : attiva(aggiorna));
  }

  return { prepara };
})();
