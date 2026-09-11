// Gera um snapshot de demonstração com dados fictícios (nenhuma informação real de
// clientes ou lojas), útil para ver o portal funcionando sem depender do SFTP.
const store = require('../src/store');

const REGIONAIS = [
  { regional: 'SP CAPITAL', coordenador: 'MARINA ALVES', gerente: 'PAULO ROCHA' },
  { regional: 'RS CENTRAL', coordenador: 'DIEGO SOUZA', gerente: 'CARLA MENDES' },
  { regional: 'BA LITORAL', coordenador: 'MARINA ALVES', gerente: 'PAULO ROCHA' },
];

const ENCARREGADOS = ['ANA LIMA', 'BRUNO COSTA', 'CAMILA DIAS', 'DANIEL ROCHA', 'ELISA MOURA'];

function rand(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

function buildMetric(metaBase, realizadoFactor) {
  const meta = metaBase;
  const realizado = Math.max(0, Math.round(meta * realizadoFactor * (0.7 + Math.random() * 0.6)));
  return { meta, realizado, pct: meta > 0 ? Math.round((realizado / meta) * 10000) / 10000 : 0, saldo: realizado - meta };
}

function buildStore(i, realizadoFactor) {
  const regionalInfo = REGIONAIS[i % REGIONAIS.length];
  const encarregado = ENCARREGADOS[i % ENCARREGADOS.length];
  const metasBase = { odonto: rand(2, 6), auto_moto: rand(2, 6), casa_protegida: rand(2, 6), vida_premiada: rand(2, 6), pet: rand(2, 6), fatura_garantida: rand(8, 20) };
  const products = ['odonto', 'auto_moto', 'casa_protegida', 'vida_premiada', 'pet', 'fatura_garantida'];
  const metrics = {};
  let servicosMeta = 0;
  let servicosRealizado = 0;
  for (const key of products) {
    const m = buildMetric(metasBase[key], realizadoFactor);
    metrics[key] = m;
    servicosMeta += m.meta;
    servicosRealizado += m.realizado;
  }
  metrics.servicos = {
    meta: Math.round(servicosMeta * 10) / 10,
    realizado: servicosRealizado,
    pct: servicosMeta > 0 ? Math.round((servicosRealizado / servicosMeta) * 10000) / 10000 : 0,
    saldo: servicosRealizado - servicosMeta,
  };
  const aprovMeta = rand(10, 30);
  metrics.aprovacao = buildMetric(aprovMeta, realizadoFactor);
  const ativMeta = rand(8, 25);
  const ativ = buildMetric(ativMeta, realizadoFactor);
  ativ.taxa = metrics.aprovacao.realizado > 0 ? Math.round((ativ.realizado / metrics.aprovacao.realizado) * 10000) / 10000 : 0;
  metrics.ativacao = ativ;

  return {
    loja: `LOJA DEMO ${i + 1}`,
    codigoLoja: i + 1,
    encarregado,
    coordenador: regionalInfo.coordenador,
    gerenteRegional: regionalInfo.gerente,
    regional: regionalInfo.regional,
    metrics,
  };
}

function buildSnapshot(realizadoFactor) {
  return Array.from({ length: 24 }, (_, i) => buildStore(i, realizadoFactor));
}

store.saveSnapshot({ stores: buildSnapshot(0.35), reportGeneratedAt: new Date(Date.now() - 86400000).toISOString(), source: 'seed:ontem' });
store.saveSnapshot({ stores: buildSnapshot(0.55), reportGeneratedAt: new Date().toISOString(), source: 'seed:hoje' });

console.log('Dados de demonstração gerados em data/snapshot.json');
