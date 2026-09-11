const path = require('path');
const express = require('express');
const config = require('./config');
const apiRouter = require('./routes/api');
const scheduler = require('./scheduler');

const app = express();

if (config.auth.user && config.auth.pass) {
  app.use((req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const [user, pass] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
      if (user === config.auth.user && pass === config.auth.pass) {
        req.viaBasicAuth = true;
        return next();
      }
    }
    res.set('WWW-Authenticate', 'Basic realm="Portal de Produção Comercial"');
    res.status(401).send('Autenticação necessária.');
  });
}

app.use('/api', apiRouter);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(config.port, () => {
  console.log(`[server] ${config.portalTitle} disponível em http://localhost:${config.port}`);
  scheduler.start();
});
