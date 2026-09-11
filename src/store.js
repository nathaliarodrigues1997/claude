const fs = require('fs');
const path = require('path');
const config = require('./config');
const { METRIC_DEFS } = require('./ingest/workbookParser');

const FILE = path.join(config.dataDir, 'snapshot.json');
const MAX_SYNC_HISTORY = 30;
const MAX_DAILY_POINTS = 40;

function ensureDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

function load() {
  ensureDataDir();
  if (!fs.existsSync(FILE)) {
    return { current: null, previous: null, history: [], dailySeries: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { current: null, previous: null, history: [], dailySeries: [], ...parsed };
  } catch (err) {
    return { current: null, previous: null, history: [], dailySeries: [] };
  }
}

function saveState(state) {
  ensureDataDir();
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

function getState() {
  return load();
}

function totalsByMetric(stores) {
  const totals = {};
  for (const def of METRIC_DEFS) {
    let meta = 0;
    let realizado = 0;
    for (const s of stores) {
      const m = s.metrics[def.key];
      if (!m) continue;
      meta += m.meta;
      realizado += m.realizado;
    }
    totals[def.key] = { meta: round2(meta), realizado: round2(realizado) };
  }
  return totals;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Guarda um ponto por dia (chave = data em UTC) com o total realizado/meta de cada
// indicador naquele momento. Como os valores são acumulados dentro do mês, sincronizações
// seguintes no mesmo dia apenas atualizam o ponto do dia (o mais recente prevalece);
// isso alimenta o gráfico "vendas por dia e acumulado no mês" no front.
function upsertDailyPoint(series, syncedAt, totals) {
  const date = syncedAt.slice(0, 10);
  const next = series.filter((p) => p.date !== date);
  next.push({ date, totals });
  next.sort((a, b) => (a.date < b.date ? -1 : 1));
  return next.slice(-MAX_DAILY_POINTS);
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
    ].slice(0, MAX_SYNC_HISTORY),
    dailySeries: upsertDailyPoint(state.dailySeries, snapshot.syncedAt, totalsByMetric(stores)),
  };
  saveState(next);
  return snapshot;
}

function recordFailure({ source, message }) {
  const state = load();
  state.history = [{ at: new Date().toISOString(), ok: false, source, message }, ...state.history].slice(
    0,
    MAX_SYNC_HISTORY
  );
  saveState(state);
}

module.exports = { getState, saveSnapshot, recordFailure };
