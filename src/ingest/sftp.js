const fs = require('fs');
const path = require('path');
const SftpClient = require('ssh2-sftp-client');
const config = require('../config');

// Busca, na pasta configurada do SFTP, o arquivo mais recente que bate com o padrão
// esperado (ex.: "Rob_Producao_Comercial") e retorna o conteúdo em memória — nada é
// gravado em disco além do snapshot final já processado.
async function fetchLatestFile() {
  if (!config.sftp.enabled) {
    throw new Error('SFTP não configurado (defina SFTP_HOST no ambiente).');
  }

  const client = new SftpClient();
  const connectOpts = {
    host: config.sftp.host,
    port: config.sftp.port,
    username: config.sftp.username,
    password: config.sftp.password,
  };
  if (config.sftp.privateKeyPath) {
    connectOpts.privateKey = fs.readFileSync(config.sftp.privateKeyPath);
    delete connectOpts.password;
  }

  try {
    await client.connect(connectOpts);
    const list = await client.list(config.sftp.remotePath);
    const candidates = list
      .filter((f) => f.type === '-')
      .filter((f) => /\.xlsx?$/i.test(f.name))
      .filter((f) => (config.sftp.fileNameMatch ? f.name.includes(config.sftp.fileNameMatch) : true))
      .sort((a, b) => b.modifyTime - a.modifyTime);

    if (!candidates.length) {
      throw new Error(`Nenhum arquivo .xlsx encontrado em ${config.sftp.remotePath}`);
    }

    const latest = candidates[0];
    const remoteFile = path.posix.join(config.sftp.remotePath, latest.name);
    const buffer = await client.get(remoteFile);
    return { buffer, fileName: latest.name, modifiedAt: new Date(latest.modifyTime).toISOString() };
  } finally {
    await client.end().catch(() => {});
  }
}

module.exports = { fetchLatestFile };
