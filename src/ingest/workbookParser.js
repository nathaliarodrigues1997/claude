const XLSX = require('xlsx');

// A planilha recebida da RPE organiza cada grupo de indicador (meta, realizado, %...)
// em blocos de colunas separados por uma coluna literal "_". Em vez de fixar índices
// de coluna (que mudam de ordem entre as abas LOJAS/FORT/COMPER), lemos o cabeçalho e
// descobrimos os blocos dinamicamente — assim o parser não quebra se a RPE reordenar colunas.

const METRIC_DEFS = [
  { key: 'aprovacao', label: 'Aprovação', match: (l) => l.startsWith('META APROV') },
  { key: 'ativacao', label: 'Ativação', match: (l) => l.startsWith('META ATIVA') },
  { key: 'servicos', label: 'Serviços', match: (l) => l.startsWith('SERVIÇOS META') },
  { key: 'fatura_garantida', label: 'Fatura Garantida', match: (l) => l.startsWith('META FATURA') },
  { key: 'odonto', label: 'Vuon Odonto', match: (l) => l.startsWith('META VUON ODONTO') },
  { key: 'auto_moto', label: 'Vuon Auto e Moto', match: (l) => l.startsWith('META VUON AUTO') },
  { key: 'casa_protegida', label: 'Vuon Casa Protegida', match: (l) => l.startsWith('META VUON CASA') },
  { key: 'vida_premiada', label: 'Vuon Vida Premiada', match: (l) => l.startsWith('META VUON VIDA') },
  { key: 'pet', label: 'Vuon Pet', match: (l) => l.startsWith('META VUON PET') || l.startsWith('META VUON PROT') },
];

function splitHeaderIntoBlocks(headerRow) {
  const blocks = [];
  let current = { startIdx: 0, headers: [] };
  headerRow.forEach((cell, idx) => {
    if (cell === '_') {
      current.endIdx = idx;
      blocks.push(current);
      current = { startIdx: idx + 1, headers: [] };
    } else if (cell !== null && cell !== undefined && cell !== '') {
      current.headers.push({ idx, label: String(cell).trim() });
    }
  });
  current.endIdx = headerRow.length;
  blocks.push(current);
  return blocks;
}

function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toRatio(v) {
  // valores de % já vêm como fração (0.55 = 55%)
  return num(v);
}

function buildMetricExtractors(blocks) {
  const identity = blocks[0];
  const metricBlocks = [];
  for (const block of blocks.slice(1)) {
    if (!block.headers.length) continue;
    const firstLabel = block.headers[0].label.toUpperCase();
    const def = METRIC_DEFS.find((d) => d.match(firstLabel));
    if (!def) continue;
    metricBlocks.push({ def, headers: block.headers });
  }
  return { identity, metricBlocks };
}

function readIdentity(row, identityHeaders) {
  const get = (needle) => {
    const col = identityHeaders.find((h) => h.label.toUpperCase().includes(needle));
    return col ? row[col.idx] : null;
  };
  return {
    loja: get('LOJAS'),
    codigoLoja: get('CÓDIGO LOJA') ?? get('CODIGO LOJA'),
    encarregado: get('ENCARREGADO'),
    coordenador: get('COORDENADOR'),
    gerenteRegional: get('GER. REG. VAREJO') ?? get('GER REG VAREJO'),
    regional: get('REGIONAL'),
  };
}

function readMetric(row, headers) {
  // headers do bloco, na ordem em que aparecem na planilha: meta, realizado, [%], [saldo/taxa]
  const meta = num(row[headers[0].idx]);
  const realizado = headers[1] ? num(row[headers[1].idx]) : 0;
  const pctHeader = headers.find((h) => h.label.includes('%'));
  const pct = pctHeader ? toRatio(row[pctHeader.idx]) : meta > 0 ? realizado / meta : 0;
  const saldoHeader = headers.find((h) => h.label.toUpperCase() === 'SALDO');
  const taxaHeader = headers.find((h, i) => i > 2 && h.label.toUpperCase().includes('TAXA'));
  return {
    meta: round2(meta),
    realizado: round2(realizado),
    pct: round4(pct),
    saldo: saldoHeader ? round2(num(row[saldoHeader.idx])) : round2(realizado - meta),
    taxa: taxaHeader ? round4(toRatio(row[taxaHeader.idx])) : undefined,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
function round4(n) {
  return Math.round(n * 10000) / 10000;
}

// Lê a aba "LOJAS", que é a granularidade mais fina disponível (uma linha por loja,
// já com a cadeia de liderança completa). É a fonte usada pelo portal — os totais por
// regional/coordenador/encarregado são somados a partir dela, garantindo que o
// dashboard sempre bata com a soma das lojas exibidas.
function parseLojasSheet(workbook, sheetName = 'LOJAS') {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { rows: [], generatedAt: null };

  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  if (!raw.length) return { rows: [], generatedAt: null };

  const headerRow = raw[0];
  const generatedAt = headerRow.find((c) => c instanceof Date) || null;

  const blocks = splitHeaderIntoBlocks(headerRow);
  const { identity, metricBlocks } = buildMetricExtractors(blocks);

  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row.length) continue;
    const id = readIdentity(row, identity.headers);
    // ignora linhas de subtotal ("TOTAL <coordenador>") e linhas em branco
    if (!id.encarregado || id.codigoLoja === null || id.codigoLoja === undefined) continue;

    const metrics = {};
    for (const { def, headers } of metricBlocks) {
      metrics[def.key] = readMetric(row, headers);
    }

    rows.push({
      loja: String(id.loja || '').trim(),
      codigoLoja: id.codigoLoja,
      encarregado: String(id.encarregado || '').trim(),
      coordenador: String(id.coordenador || '').trim(),
      gerenteRegional: String(id.gerenteRegional || '').trim(),
      regional: String(id.regional || '').trim(),
      metrics,
    });
  }

  return { rows, generatedAt };
}

function parseWorkbookBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const { rows, generatedAt } = parseLojasSheet(workbook, 'LOJAS');
  if (!rows.length) {
    throw new Error('Não foi possível encontrar dados de lojas na planilha (aba "LOJAS" vazia ou ausente).');
  }
  return { stores: rows, reportGeneratedAt: generatedAt, metricDefs: METRIC_DEFS };
}

module.exports = { parseWorkbookBuffer, METRIC_DEFS };
