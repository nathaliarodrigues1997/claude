const fs = require('fs');
const path = require('path');
const config = require('./config');

const FILE = path.join(config.dataDir, 'snapshot.json');
const MAX_HISTORY = 30;

function ensureDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

function load() {
  ensureDataDir();
  if (!fs.existsSync(FILE)) {
    return { current: null, previous: null, history: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (err) {
    return { current: null, previous: null, history: [] };
  }
}

function saveState(state) {
  ensureDataDir();
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

function getState() {
  return load();
}

// Salva um novo snapshot bem-sucedido, guardando o anterior para comparação (equivalente
// ao par LOJAS / LOJAS D-1 que existia na planilha) e registrando o evento no histórico.
function saveSnapshot({ stores, reportGeneratedAt, source }) {
  const state = load();
  const snapshot = {
    stores,
    reportGeneratedAt: reportGeneratedAt || null,
    syncedAt: new Date().toISOString(),
    source,
  };
  const next = {
    current: snapshot,
    previous: state.current || null,
    history: [
      { at: snapshot.syncedAt, ok: true, source, storeCount: stores.length },
      ...state.history,
    ].slice(0, MAX_HISTORY),
  };
  saveState(next);
  return snapshot;
}

function recordFailure({ source, message }) {
  const state = load();
  state.history = [{ at: new Date().toISOString(), ok: false, source, message }, ...state.history].slice(
    0,
    MAX_HISTORY
  );
  saveState(state);
}

module.exports = { getState, saveSnapshot, recordFailure };
