# Portal de Produção Comercial

Portal web que substitui a planilha alimentada por Google Apps Script. Em vez de
depender de um e-mail com o extrato da RPE sendo lido por um script e jogado numa
planilha a cada 30 minutos, o próprio portal busca o arquivo direto no SFTP no
mesmo intervalo, processa e apresenta os indicadores em um painel único.

## Como funciona

1. **Ingestão** (`src/ingest`): a cada `SYNC_INTERVAL_MINUTES` (padrão 30), o portal
   conecta no SFTP configurado, pega o `.xlsx` mais recente e lê a aba `LOJAS`
   (a granularidade mais fina do relatório — uma linha por loja, já com toda a
   cadeia de liderança). O parser identifica os blocos de colunas (Meta/Realizado/%)
   pelo cabeçalho, então continua funcionando mesmo se a RPE reordenar colunas.
2. **Armazenamento** (`src/store.js`): o snapshot processado é salvo em
   `DATA_DIR/snapshot.json`, junto com o snapshot anterior (para calcular variação)
   e um histórico das últimas sincronizações.
3. **API + painel** (`src/routes/api.js`, `public/`): o front-end busca
   `/api/dashboard` e renderiza cards de indicadores, ranking de lojas e uma
   tabela filtrável/ordenável — sem expor dados pessoais de clientes, já que o
   portal trabalha só com os números agregados por loja que já vêm prontos da RPE.

Upload manual (`Carregar planilha`) e um botão `Atualizar agora` cobrem o caso de
o SFTP estar fora do ar ou de precisar recarregar um arquivo pontualmente.

## Rodando localmente

```bash
npm install
cp .env.example .env   # ajuste as credenciais do SFTP
npm start
```

Sem `SFTP_HOST` configurado, a sincronização automática fica desativada e o portal
funciona só com upload manual — útil para testar. Para ver o painel com dados de
exemplo (fictícios, sem qualquer informação real):

```bash
npm run seed
npm start
```

## Rodando com Docker

```bash
docker compose up --build
```

As variáveis de ambiente podem ser definidas num `.env` na raiz (mesmo formato do
`.env.example`); o `docker-compose.yml` já as repassa para o container. Os dados
processados ficam no volume `portal-data`, então sobrevivem a reinícios do
container.

## Variáveis de ambiente

Veja `.env.example`. As principais:

- `SFTP_HOST`, `SFTP_PORT`, `SFTP_USER`, `SFTP_PASSWORD` ou `SFTP_PRIVATE_KEY_PATH`,
  `SFTP_REMOTE_PATH`, `SFTP_FILE_MATCH` — acesso ao SFTP da RPE.
- `SYNC_INTERVAL_MINUTES` — intervalo de sincronização automática (padrão 30).
- `PORTAL_TITLE` — nome exibido no topo do portal.
- `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` — autenticação básica opcional.

## Limitações conhecidas

- O parser lê a aba `LOJAS`, que já contém os indicadores agregados por loja tal
  como a RPE os produz hoje (Aprovação, Ativação, Serviços e os 5 produtos Vuon).
  Se um dia a RPE passar a enviar só os dados brutos (adesões individuais), será
  necessário reimplementar as regras de agregação em `src/ingest`.
- Não há autenticação por usuário/perfil — apenas o basic auth opcional acima. Se
  o portal for exposto fora da rede interna, recomenda-se colocá-lo atrás de um
  proxy com SSO.
