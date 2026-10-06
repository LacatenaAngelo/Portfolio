// Piccola finestra con un modulo (es. cambio password), al posto delle finestrelle del browser
// che mostrerebbero la password in chiaro. Realizzato da Angelo Lacatena® (lacatenaangelo.it).
window.Finestra = (() => {
  function crea(tag, attributi = {}, ...figli) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attributi)) if (v != null) e.setAttribute(k, v);
    for (const f of figli) if (f != null) e.append(f);
    return e;
  }

  // campi: [{ nome, etichetta, tipo }]; invia(valori) può lanciare un errore da mostrare.
  function modulo({ titolo, testo, campi, bottone = 'Salva', invia }) {
    const errore = crea('p', { class: 'accesso-errore', role: 'alert' });
    // Tipi di campo: password (predefinito), text, textarea, checkbox, select (con "opzioni": [[valore, testo]]).
    const input = campi.map(c => {
      let e;
      if (c.tipo === 'textarea') e = crea('textarea', { name: c.nome, rows: c.righe || 3, placeholder: c.segnaposto || null });
      else if (c.tipo === 'select') e = crea('select', { name: c.nome }, ...(c.opzioni || []).map(([v, t]) => crea('option', { value: v }, t)));
      else if (c.tipo === 'checkbox') e = crea('input', { name: c.nome, type: 'checkbox' });
      else e = crea('input', { name: c.nome, type: c.tipo || 'password', required: c.facoltativo ? null : '', minlength: c.minimo || null, placeholder: c.segnaposto || null, autocomplete: c.tipo === 'text' ? 'off' : 'new-password' });
      if (c.tipo === 'checkbox') e.checked = !!c.valore;
      else if (c.valore != null) e.value = c.valore;
      return e;
    });
    const form = crea('form', {},
      crea('div', { class: 'finestra-testa' }, crea('strong', {}, titolo)),
      crea('div', { class: 'form-corpo' },
        testo ? crea('p', { class: 'nota' }, testo) : null,
        ...campi.map((c, i) => (c.tipo === 'checkbox'
          ? crea('label', { class: 'spunta' }, input[i], c.etichetta)
          : crea('label', {}, c.etichetta, input[i]))),
        errore),
      crea('div', { class: 'finestra-piede' },
        crea('button', { type: 'button', class: 'btn contorno', 'data-chiudi': '' }, 'Annulla'),
        crea('button', { type: 'submit', class: 'btn primario' }, bottone)));
    const finestra = crea('dialog', { class: 'finestra finestra-piccola' }, form);
    document.body.append(finestra);
    const chiudi = () => { finestra.close(); finestra.remove(); };
    form.querySelector('[data-chiudi]').onclick = chiudi;
    finestra.addEventListener('cancel', () => setTimeout(() => finestra.remove(), 0));
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      errore.textContent = '';
      const valori = Object.fromEntries(campi.map((c, i) => [c.nome, c.tipo === 'checkbox' ? input[i].checked : input[i].value]));
      try { await invia(valori); chiudi(); } catch (e) { errore.textContent = e.message; }
    });
    finestra.showModal();
    input[0].focus();
  }

  // Cambio della propria password (tutti i ruoli).
  function cambiaPassword(chiama) {
    modulo({
      titolo: 'Cambia la tua password',
      campi: [
        { nome: 'vecchia', etichetta: 'Password attuale' },
        { nome: 'nuova', etichetta: 'Nuova password (almeno 8 caratteri)', minimo: 8 },
        { nome: 'conferma', etichetta: 'Ripeti la nuova password', minimo: 8 },
      ],
      bottone: 'Cambia password',
      invia: async v => {
        if (v.nuova !== v.conferma) throw new Error('Le due password nuove non coincidono');
        await chiama(v.vecchia, v.nuova);
        avviso('Password cambiata.');
      },
    });
  }

  // Messaggio breve in basso che sparisce da solo.
  function avviso(testo) {
    const a = crea('div', { class: 'avviso-breve', role: 'status' }, testo);
    document.body.append(a);
    setTimeout(() => a.remove(), 3500);
  }

  return { modulo, cambiaPassword, avviso };
})();
