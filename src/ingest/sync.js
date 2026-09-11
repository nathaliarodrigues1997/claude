const { parseWorkbookBuffer } = require('./workbookParser');
const { fetchLatestFile } = require('./sftp');
const store = require('../store');

let running = false;

async function runSftpSync() {
  if (running) return { skipped: true };
  running = true;
  try {
    const { buffer, fileName } = await fetchLatestFile();
    const { stores, reportGeneratedAt } = parseWorkbookBuffer(buffer);
    const snapshot = store.saveSnapshot({ stores, reportGeneratedAt, source: `sftp:${fileName}` });
    return { ok: true, snapshot };
  } catch (err) {
    store.recordFailure({ source: 'sftp', message: err.message });
    return { ok: false, error: err.message };
  } finally {
    running = false;
  }
}

function ingestUploadedBuffer(buffer, originalName) {
  const { stores, reportGeneratedAt } = parseWorkbookBuffer(buffer);
  return store.saveSnapshot({ stores, reportGeneratedAt, source: `upload:${originalName}` });
}

module.exports = { runSftpSync, ingestUploadedBuffer, isRunning: () => running };
