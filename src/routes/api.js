const express = require('express');
const multer = require('multer');
const config = require('../config');
const store = require('../store');
const scheduler = require('../scheduler');
const { runSftpSync, ingestUploadedBuffer } = require('../ingest/sync');
const { METRIC_DEFS } = require('../ingest/workbookParser');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
const router = express.Router();

// Protege os endpoints que alimentam dados (chamados pelo n8n) com uma chave própria,
// independente do basic auth da interface — assim a automação não precisa guardar
// login/senha de usuário, só um token que pode ser rotacionado sem afetar o portal.
function requireIngestKey(req, res, next) {
  if (!config.ingestApiKey) return next();
  if (req.viaBasicAuth) return next(); // usuário já autenticado pela interface
  const provided = req.get('x-api-key');
  if (provided && provided === config.ingestApiKey) return next();
  res.status(401).json({ ok: false, error: 'Chave de API inválida ou ausente (header X-API-Key).' });
}

router.get('/dashboard', (req, res) => {
  const state = store.getState();
  res.json({
    title: config.portalTitle,
    metricDefs: METRIC_DEFS.map(({ key, label }) => ({ key, label })),
    current: state.current,
    previous: state.previous,
    dailySeries: state.dailySeries,
  });
});

router.get('/sync-status', (req, res) => {
  const state = store.getState();
  res.json({
    sftpEnabled: config.sftp.enabled,
    syncIntervalMinutes: config.syncIntervalMinutes,
    nextRunAt: scheduler.getNextRunAt(),
    lastSync: state.current ? state.current.syncedAt : null,
    history: state.history,
  });
});

// Sem requireIngestKey aqui: este endpoint só dispara a busca no SFTP já configurado
// (sem receber dados de fora) e é usado pelo botão "Atualizar agora" da interface,
// protegido pelo basic auth do portal quando configurado.
router.post('/sync', async (req, res) => {
  if (!config.sftp.enabled) {
    return res.status(400).json({ ok: false, error: 'SFTP não configurado neste ambiente.' });
  }
  const result = await runSftpSync();
  const status = result.ok ? 200 : 502;
  res.status(status).json(result);
});

router.post('/upload', requireIngestKey, upload.single('arquivo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'Nenhum arquivo enviado.' });
  }
  try {
    const snapshot = ingestUploadedBuffer(req.file.buffer, req.file.originalname);
    res.json({ ok: true, snapshot });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
