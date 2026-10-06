// Pagina di accesso: primo avvio (founder), accesso, richiesta di accesso, attesa di approvazione.
// Realizzato da Angelo Lacatena® (lacatenaangelo.it).
const $ = id => document.getElementById(id);
const FORM = ['formConfigura', 'formAccedi', 'formCodice', 'formRegistra', 'dimenticata', 'attesa'];
let sfida = null;

function mostra(id) {
  for (const f of FORM) $(f).hidden = f !== id;
  const primo = $(id).querySelector('input, button');
  if (primo) primo.focus();
}

async function chiama(metodo, url, dati) {
  const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: dati ? JSON.stringify(dati) : undefined });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(corpo.errore || 'Errore ' + r.status); e.corpo = corpo; e.stato = r.status; throw e; }
  return corpo;
}

// Dopo l'accesso ognuno va alla sua pagina.
function entra(utente) {
  const az = utente.azienda || {};
  if (utente.ruolo === 'utente' || az.stato !== 'attiva') {
    $('attesaNome').textContent = utente.nome;
    if (az.stato === 'in-attesa') {
      $('attesaTitolo').textContent = 'Azienda registrata';
      $('attesaTesto').textContent = `l'azienda "${az.nome}" è stata registrata.`;
      $('attesaNota').textContent = 'PARQO deve attivarla: riceverai conferma. Poi ricarica questa pagina ed entra.';
    } else if (az.stato === 'bloccata') {
      $('attesaTitolo').textContent = 'Azienda sospesa';
      $('attesaTesto').textContent = `l'accesso per "${az.nome}" è sospeso.`;
      $('attesaNota').textContent = 'Contatta PARQO per riattivarlo.';
    } else {
      $('attesaTitolo').textContent = 'Richiesta inviata';
      $('attesaTesto').textContent = `la tua richiesta di accesso a "${az.nome}" è arrivata.`;
      $('attesaNota').textContent = 'Un amministratore deve assegnarti un ruolo. Quando sarà fatto, ricarica questa pagina.';
    }
    mostra('attesa');
    return;
  }
  location.href = utente.ruolo === 'visualizzatore' ? 'consulta.html' : 'index.html';
}

async function controlla() {
  try {
    const { utente } = await chiama('GET', '/api/sessione');
    entra(utente);
  } catch (e) {
    mostra(e.corpo && e.corpo.configurazione ? 'formConfigura' : 'formAccedi');
  }
}

function invia(form, fn) {
  const errore = form.querySelector('.accesso-errore');
  const bottone = form.querySelector('button[type=submit]');
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    errore.textContent = '';
    const dati = Object.fromEntries(new FormData(form));
    if ('conferma' in dati && dati.conferma !== dati.password) { errore.textContent = 'Le due password non coincidono'; return; }
    bottone.disabled = true;
    try { await fn(dati); } catch (e) { errore.textContent = e.message; } finally { bottone.disabled = false; }
  });
}

invia($('formAccedi'), async d => {
  const r = await chiama('POST', '/api/accesso', { username: d.username, password: d.password });
  // Password giusta ma serve il codice del telefono.
  if (r.serveCodice) { sfida = r.sfida; $('formCodice').reset(); mostra('formCodice'); return; }
  entra(r.utente);
});
invia($('formCodice'), async d => {
  const r = await chiama('POST', '/api/accesso/codice', { sfida, codice: d.codice });
  if (r.codiciRestanti != null) alert(`Hai usato un codice di recupero: te ne restano ${r.codiciRestanti}. Appena puoi riattiva il telefono o crea nuovi codici (pulsante con lo scudo).`);
  entra(r.utente);
});
$('usaRecupero').onclick = () => {
  $('etichettaCodice').textContent = 'Codice di recupero (es. K7PQ-M2XR)';
  $('campoCodice').setAttribute('inputmode', 'text');
  $('campoCodice').focus();
};
invia($('formRegistra'), async d => entra((await chiama('POST', '/api/registrazione', d)).utente));
invia($('formConfigura'), async d => entra((await chiama('POST', '/api/registrazione', d)).utente));
document.querySelectorAll('[data-vai]').forEach(b => b.addEventListener('click', () => mostra(b.dataset.vai)));
$('ricontrolla').onclick = () => controlla();
$('esci').onclick = async () => { await chiama('POST', '/api/uscita').catch(() => {}); mostra('formAccedi'); };

if (new URLSearchParams(location.search).has('chiusa')) $('notaChiusa').hidden = false;
controlla();
