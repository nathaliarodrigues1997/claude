const config = require('./config');
const { runSftpSync } = require('./ingest/sync');

let timer = null;
let nextRunAt = null;

function scheduleNext() {
  const ms = config.syncIntervalMinutes * 60 * 1000;
  nextRunAt = new Date(Date.now() + ms).toISOString();
  timer = setTimeout(async () => {
    await runSftpSync();
    scheduleNext();
  }, ms);
}

function start() {
  if (!config.sftp.enabled) {
    console.log('[scheduler] SFTP não configurado — sincronização automática desativada. Use o upload manual.');
    return;
  }
  console.log(`[scheduler] Sincronizando via SFTP a cada ${config.syncIntervalMinutes} min.`);
  runSftpSync().then(() => scheduleNext());
}

function stop() {
  if (timer) clearTimeout(timer);
}

function getNextRunAt() {
  return nextRunAt;
}

module.exports = { start, stop, getNextRunAt };
