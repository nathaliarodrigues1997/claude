require('dotenv').config();

function int(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  port: int(process.env.PORT, 3000),
  portalTitle: process.env.PORTAL_TITLE || 'Portal de Produção Comercial',
  dataDir: process.env.DATA_DIR || require('path').join(__dirname, '..', 'data'),

  syncIntervalMinutes: int(process.env.SYNC_INTERVAL_MINUTES, 30),

  sftp: {
    enabled: process.env.SFTP_HOST ? true : false,
    host: process.env.SFTP_HOST,
    port: int(process.env.SFTP_PORT, 22),
    username: process.env.SFTP_USER,
    password: process.env.SFTP_PASSWORD,
    privateKeyPath: process.env.SFTP_PRIVATE_KEY_PATH,
    remotePath: process.env.SFTP_REMOTE_PATH || '/',
    // Só considera arquivos cujo nome bate com este prefixo/trecho (ex.: "Rob_Producao_Comercial")
    fileNameMatch: process.env.SFTP_FILE_MATCH || '',
  },

  auth: {
    // Autenticação básica opcional para proteger o portal. Deixe em branco para desativar.
    user: process.env.BASIC_AUTH_USER || '',
    pass: process.env.BASIC_AUTH_PASS || '',
  },
};
