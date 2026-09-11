(() => {
  const PRIMARY_KEYS = ['aprovacao', 'ativacao', 'servicos', 'fatura_garantida'];
  const PRODUCT_KEYS = ['odonto', 'auto_moto', 'casa_protegida', 'vida_premiada', 'pet'];

  const ICONS = {
    aprovacao: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    ativacao: '<polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2" fill="currentColor" stroke="none"/>',
    servicos: '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
    fatura_garantida: '<path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3z"/>',
    odonto: '<circle cx="12" cy="12" r="9"/><path d="M8 13.5c0.8 1.2 2.1 2 4 2s3.2-.8 4-2"/><line x1="9" y1="9.5" x2="9.01" y2="9.5"/><line x1="15" y1="9.5" x2="15.01" y2="9.5"/>',
    auto_moto: '<path d="M5 11l1.3-3.8A2 2 0 0 1 8.2 6h7.6a2 2 0 0 1 1.9 1.2L19 11"/><rect x="3" y="11" width="18" height="5" rx="1.5"/><circle cx="7.5" cy="18.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="16.5" cy="18.5" r="1.5" fill="currentColor" stroke="none"/>',
    casa_protegida: '<path d="M4 11.5L12 4l8 7.5"/><path d="M6.5 10v9.5h11V10"/>',
    vida_premiada: '<path d="M12 20s-7.2-4.4-9.6-9C.7 7.7 2 4.2 5.3 3.7c2-.3 3.7.8 4.7 2.3 1-1.5 2.7-2.6 4.7-2.3 3.3.5 4.6 4 2.9 7.3C19.2 15.6 12 20 12 20z"/>',
    pet: '<circle cx="7" cy="9" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="6.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="17" cy="9" r="1.6" fill="currentColor" stroke="none"/><path d="M8 16.5c0-2.3 1.8-4 4-4s4 1.7 4 4-1.8 3-4 3-4-.7-4-3z"/>',
  };

  function iconSvg(key) {
    const inner = ICONS[key] || ICONS.servicos;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  }

  const state = {
    title: 'Portal de Produção Comercial',
    metricDefs: [],
    current: null,
    previous: null,
    dailySeries: [],
    filters: { search: '', regional: '', gerente: '', coordenador: '', encarregado: '' },
    sort: { key: 'pct', dir: 'desc' },
    view: 'inicio',
    painelSubview: 'regional',
    rankGroup: 'loja',
  };

  const $ = (sel) => document.querySelector(sel);
  const fmt = (n) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(n || 0);
  const fmtPct = (n) => `${((n || 0) * 100).toFixed(1)}%`;

  function pctClass(pct) {
    if (pct >= 0.9) return 'good';
    if (pct >= 0.5) return 'warn';
    return 'bad';
  }

  function labelFor(key) {
    const def = state.metricDefs.find((d) => d.key === key);
    return def ? def.label : key;
  }

  function showToast(message, isError) {
    const el = $('#toast');
    el.textContent = message;
    el.hidden = false;
    el.className = 'toast' + (isError ? ' error' : '');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { el.hidden = true; }, 4000);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // --- filtragem -----------------------------------------------------------

  function filteredStores(snapshot) {
    if (!snapshot) return [];
    const f = state.filters;
    const search = f.search.trim().toLowerCase();
    return snapshot.stores.filter((s) => {
      if (search && !s.loja.toLowerCase().includes(search)) return false;
      if (f.regional && s.regional !== f.regional) return false;
      if (f.gerente && s.gerenteRegional !== f.gerente) return false;
      if (f.coordenador && s.coordenador !== f.coordenador) return false;
      if (f.encarregado && s.encarregado !== f.encarregado) return false;
      return true;
    });
  }

  function sumMetric(stores, key) {
    let meta = 0;
    let realizado = 0;
    for (const s of stores) {
      const m = s.metrics[key];
      if (!m) continue;
      meta += m.meta;
      realizado += m.realizado;
    }
    const pct = meta > 0 ? realizado / meta : 0;
    return { meta, realizado, pct };
  }

  // --- navegação entre views -------------------------------------------------

  function switchView(view) {
    state.view = view;
    document.querySelectorAll('.navtab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === view));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('is-active', v.id === `view-${view}`));
    if (view === 'painel') renderPainelSubview();
  }

  function switchPainelSubview(subview) {
    state.painelSubview = subview;
    document.querySelectorAll('.subtab').forEach((t) => t.classList.toggle('is-active', t.dataset.subview === subview));
    document.querySelectorAll('.subview').forEach((v) => v.classList.toggle('is-active', v.id === `painel-${subview}`));
    renderPainelSubview();
  }

  function renderPainelSubview() {
    if (state.painelSubview === 'regional') renderPainel();
    else if (state.painelSubview === 'coordenadoras') renderCoordenadoras();
    else if (state.painelSubview === 'lojas') renderStoreTable();
  }

  // --- populate filter dropdowns -------------------------------------------

  function populateFilters() {
    if (!state.current) return;
    const stores = state.current.stores;
    const fill = (id, field) => {
      const select = $(id);
      const current = select.value;
      const values = [...new Set(stores.map((s) => s[field]).filter(Boolean))].sort();
      select.innerHTML = select.options[0].outerHTML + values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
      if (values.includes(current)) select.value = current;
    };
    fill('#f-regional', 'regional');
    fill('#f-gerente', 'gerenteRegional');
    fill('#f-coordenador', 'coordenador');
    fill('#f-encarregado', 'encarregado');
  }

  // --- KPI cards -------------------------------------------------------------

  function renderKpis() {
    const stores = filteredStores(state.current);
    const prevStores = state.previous ? filteredStores(state.previous) : [];
    const prevByCode = new Map(prevStores.map((s) => [s.codigoLoja, s]));

    const matchedCurrent = stores.filter((s) => prevByCode.has(s.codigoLoja));
    const matchedPrevious = matchedCurrent.map((s) => prevByCode.get(s.codigoLoja));
    const coverage = stores.length > 0 ? matchedCurrent.length / stores.length : 0;
    const canCompare = state.previous && coverage >= 0.9;

    const renderGrid = (containerId, keys) => {
      const el = $(containerId);
      el.innerHTML = keys
        .map((key) => {
          const agg = sumMetric(stores, key);
          const currentMatchedAgg = sumMetric(matchedCurrent, key);
          const prevAgg = sumMetric(matchedPrevious, key);
          const deltaPts = canCompare ? (currentMatchedAgg.pct - prevAgg.pct) * 100 : null;
          const deltaHtml =
            deltaPts === null
              ? ''
              : `<span class="pct-chip ${deltaPts >= 0 ? 'good' : 'bad'}">${deltaPts >= 0 ? '▲' : '▼'} ${Math.abs(deltaPts).toFixed(1)}p vs. anterior</span>`;
          const cls = pctClass(agg.pct);
          return `
          <div class="kpi-card">
            <div class="kpi-card__top">
              <span class="kpi-card__label">${labelFor(key)}</span>
              <span class="kpi-card__badge">${iconSvg(key)}</span>
            </div>
            <span class="kpi-card__pct">${fmtPct(agg.pct)}</span>
            <div class="bar"><div class="bar__fill ${cls}" style="width:${Math.min(100, agg.pct * 100)}%"></div></div>
            <div class="kpi-card__foot">
              <span class="kpi-card__sub">${fmt(agg.realizado)} de ${fmt(agg.meta)}</span>
              ${deltaHtml}
            </div>
          </div>`;
        })
        .join('');
    };

    renderGrid('#kpi-primary', PRIMARY_KEYS);
    renderGrid('#kpi-products', PRODUCT_KEYS);
    $('#f-count').textContent = `${stores.length} loja(s)`;
  }

  // --- gráfico de tendência ----------------------------------------------------

  function renderChartOptions() {
    const select = $('#chart-metric');
    if (select.options.length) return;
    select.innerHTML = state.metricDefs.map((d) => `<option value="${d.key}">${d.label}</option>`).join('');
    select.value = 'servicos';
  }

  function renderChart() {
    const key = $('#chart-metric').value || 'servicos';
    const container = $('#chart-container');
    const series = state.dailySeries.filter((p) => p.totals[key]);

    if (series.length < 2) {
      container.innerHTML = `<div class="chart-empty">Ainda não há histórico suficiente para o gráfico — ele se preenche a cada sincronização (a cada ${$('#footer-interval').textContent || 30} min).</div>`;
      return;
    }

    const cumulative = series.map((p) => p.totals[key].realizado);
    const deltas = cumulative.map((v, i) => Math.max(0, i === 0 ? v : v - cumulative[i - 1]));

    const W = 960, H = 300;
    const margin = { top: 14, right: 44, bottom: 30, left: 40 };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;
    const n = series.length;
    const step = plotW / n;
    const barW = Math.min(28, step * 0.5);

    const maxBar = Math.max(...deltas, 1) * 1.2;
    const maxLine = Math.max(...cumulative, 1) * 1.15;

    const xAt = (i) => margin.left + step * i + step / 2;
    const yBar = (v) => margin.top + plotH * (1 - v / maxBar);
    const yLine = (v) => margin.top + plotH * (1 - v / maxLine);

    const showEvery = Math.max(1, Math.ceil(n / 10));

    const bars = deltas
      .map((v, i) => `<rect x="${(xAt(i) - barW / 2).toFixed(1)}" y="${yBar(v).toFixed(1)}" width="${barW.toFixed(1)}" height="${(margin.top + plotH - yBar(v)).toFixed(1)}" rx="3" fill="var(--violet-500)" opacity="0.85"/>`)
      .join('');

    const linePoints = cumulative.map((v, i) => `${xAt(i).toFixed(1)},${yLine(v).toFixed(1)}`).join(' ');
    const dots = cumulative
      .map((v, i) => `<circle cx="${xAt(i).toFixed(1)}" cy="${yLine(v).toFixed(1)}" r="3.5" fill="var(--accent-line)"/>`)
      .join('');

    const xLabels = series
      .map((p, i) => (i % showEvery === 0 ? `<text x="${xAt(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${p.date.slice(8, 10)}/${p.date.slice(5, 7)}</text>` : ''))
      .join('');

    const gridY = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const y = margin.top + plotH * (1 - t);
      return `<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${W - margin.right}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-dasharray="3 4"/>
        <text x="${margin.left - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--text-muted)">${fmt(maxBar * t)}</text>
        <text x="${W - margin.right + 8}" y="${(y + 3).toFixed(1)}" text-anchor="start" font-size="10" fill="var(--text-muted)">${fmt(maxLine * t)}</text>`;
    }).join('');

    container.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de vendas por dia e acumulado no mês">
        ${gridY}
        ${bars}
        <polyline points="${linePoints}" fill="none" stroke="var(--accent-line)" stroke-width="2.5"/>
        ${dots}
        ${xLabels}
      </svg>
      <div class="chart-legend" style="display:flex;gap:16px;margin-top:6px;font-size:0.76rem;color:var(--text-muted)">
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--violet-500);margin-right:5px"></span>Realizado no dia</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--accent-line);margin-right:5px"></span>Acumulado no mês</span>
      </div>`;
  }

  // --- agrupamento (loja / encarregado / coordenador) --------------------------

  function groupByLevel(stores, level) {
    if (level === 'loja') {
      return stores.map((s) => ({ key: s.loja, encarregado: s.encarregado, coordenador: s.coordenador, regional: s.regional, stores: [s] }));
    }
    const field = level === 'coordenador' ? 'coordenador' : 'encarregado';
    const groups = new Map();
    for (const s of stores) {
      const key = s[field] || '(sem informação)';
      if (!groups.has(key)) {
        groups.set(key, { key, encarregado: s.encarregado, coordenador: s.coordenador, regional: s.regional, stores: [] });
      }
      groups.get(key).stores.push(s);
    }
    return [...groups.values()];
  }

  // --- painel comercial (rollup por encarregado) --------------------------------

  function renderPainel() {
    const stores = filteredStores(state.current);
    const groups = new Map();
    for (const s of stores) {
      const key = s.encarregado || '(sem encarregado)';
      if (!groups.has(key)) {
        groups.set(key, { encarregado: key, coordenador: s.coordenador, regional: s.regional, stores: [] });
      }
      groups.get(key).stores.push(s);
    }

    const rows = [...groups.values()].map((g) => {
      const metrics = {};
      for (const def of state.metricDefs) metrics[def.key] = sumMetric(g.stores, def.key);
      return { ...g, metrics };
    });
    rows.sort((a, b) => (b.metrics.servicos?.pct || 0) - (a.metrics.servicos?.pct || 0));

    const totalMetrics = {};
    for (const def of state.metricDefs) totalMetrics[def.key] = sumMetric(stores, def.key);

    const head = $('#painel-head');
    head.innerHTML = `
      <tr class="painel-head-metrics">
        <th rowspan="2" style="background:var(--surface-2);color:var(--text)">Encarregado</th>
        <th rowspan="2" style="background:var(--surface-2);color:var(--text)">Coordenador</th>
        <th rowspan="2" style="background:var(--surface-2);color:var(--text)">Regional</th>
        ${state.metricDefs.map((d) => `<th colspan="3">${d.label}</th>`).join('')}
      </tr>
      <tr class="painel-head-sub">
        ${state.metricDefs.map(() => `<th>Meta</th><th>Atual</th><th>%</th>`).join('')}
      </tr>`;

    const renderRow = (label, metrics, isTotal) => `
      <tr${isTotal ? ' style="font-weight:700;background:var(--surface-2)"' : ''}>
        <td class="group-col">${escapeHtml(label.encarregado || label)}</td>
        <td>${label.coordenador ? escapeHtml(label.coordenador) : ''}</td>
        <td>${label.regional ? escapeHtml(label.regional) : ''}</td>
        ${state.metricDefs
          .map((d) => {
            const m = metrics[d.key] || { meta: 0, realizado: 0, pct: 0 };
            return `<td class="num">${fmt(m.meta)}</td><td class="num">${fmt(m.realizado)}</td><td class="num"><span class="pct-chip ${pctClass(m.pct)}">${fmtPct(m.pct)}</span></td>`;
          })
          .join('')}
      </tr>`;

    const body = $('#painel-body');
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="${3 + state.metricDefs.length * 3}" class="empty-state">Nenhuma loja encontrada para os filtros atuais.</td></tr>`;
      return;
    }
    body.innerHTML =
      renderRow({ encarregado: 'TOTAL (filtro atual)' }, totalMetrics, true) +
      rows.map((r) => renderRow(r, r.metrics, false)).join('');
  }

  function renderCoordenadoras() {
    const stores = filteredStores(state.current);
    const groups = groupByLevel(stores, 'coordenador').map((g) => ({ ...g, m: sumMetric(g.stores, 'aprovacao') }));
    groups.sort((a, b) => b.m.pct - a.m.pct);

    const body = $('#coord-body');
    if (!groups.length) {
      body.innerHTML = `<tr><td colspan="6" class="empty-state">Nenhum coordenador encontrado para os filtros atuais.</td></tr>`;
      return;
    }
    body.innerHTML = groups
      .map(
        (g) => `
        <tr>
          <td>${escapeHtml(g.key)}</td>
          <td>${escapeHtml(g.regional)}</td>
          <td class="num">${fmt(g.m.meta)}</td>
          <td class="num">${fmt(g.m.realizado)}</td>
          <td><span class="pct-chip ${pctClass(g.m.pct)}">${fmtPct(g.m.pct)}</span></td>
          <td class="num">${fmt(g.m.realizado - g.m.meta)}</td>
        </tr>`
      )
      .join('');
  }

  // --- ranking -------------------------------------------------------------

  function renderRankingOptions() {
    const select = $('#rank-metric');
    if (!select.options.length) {
      select.innerHTML = state.metricDefs.map((d) => `<option value="${d.key}">${d.label}</option>`).join('');
      select.value = 'servicos';
    }
    const groupLabels = { loja: 'Loja', encarregado: 'Encarregado', coordenador: 'Coordenador' };
    $('#rank-col-group').textContent = groupLabels[state.rankGroup];
  }

  function renderRanking() {
    const key = $('#rank-metric').value || 'servicos';
    const level = $('#rank-group').value || 'loja';
    state.rankGroup = level;
    $('#rank-col-group').textContent = { loja: 'Loja', encarregado: 'Encarregado', coordenador: 'Coordenador' }[level];

    const stores = filteredStores(state.current);
    const rows = groupByLevel(stores, level)
      .map((g) => ({ ...g, m: sumMetric(g.stores, key) }))
      .filter((g) => g.m.meta > 0 || g.m.realizado > 0)
      .sort((a, b) => b.m.pct - a.m.pct);

    const body = $('#rank-body');
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="7" class="empty-state">Nada encontrado para os filtros atuais.</td></tr>`;
      return;
    }
    body.innerHTML = rows
      .map(
        (r, i) => `
        <tr>
          <td><span class="rank-badge">${i + 1}</span></td>
          <td>${escapeHtml(r.key)}</td>
          <td>${escapeHtml(r.regional)}</td>
          <td class="num">${fmt(r.m.meta)}</td>
          <td class="num">${fmt(r.m.realizado)}</td>
          <td><span class="pct-chip ${pctClass(r.m.pct)}">${fmtPct(r.m.pct)}</span></td>
          <td class="num">${fmt(r.m.realizado - r.m.meta)}</td>
        </tr>`
      )
      .join('');
  }

  // --- lojas -------------------------------------------------------------

  function renderStoreMetricOptions() {
    const select = $('#store-metric');
    if (select.options.length) return;
    select.innerHTML = state.metricDefs.map((d) => `<option value="${d.key}">${d.label}</option>`).join('');
    select.value = 'aprovacao';
  }

  function renderStoreTable() {
    const key = $('#store-metric').value || 'aprovacao';
    let stores = filteredStores(state.current).map((s) => ({ ...s, m: s.metrics[key] }));

    const { key: sortKey, dir } = state.sort;
    stores.sort((a, b) => {
      let av, bv;
      if (['meta', 'realizado', 'pct'].includes(sortKey)) {
        av = a.m ? a.m[sortKey] : 0;
        bv = b.m ? b.m[sortKey] : 0;
      } else {
        av = (a[sortKey] || '').toLowerCase();
        bv = (b[sortKey] || '').toLowerCase();
      }
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });

    const body = $('#store-body');
    if (!stores.length) {
      body.innerHTML = `<tr><td colspan="7" class="empty-state">Nenhuma loja encontrada para os filtros atuais.</td></tr>`;
      return;
    }
    body.innerHTML = stores
      .map(
        (s) => `
        <tr>
          <td>${escapeHtml(s.loja)}</td>
          <td>${escapeHtml(s.encarregado)}</td>
          <td>${escapeHtml(s.coordenador)}</td>
          <td>${escapeHtml(s.regional)}</td>
          <td class="num">${s.m ? fmt(s.m.meta) : '—'}</td>
          <td class="num">${s.m ? fmt(s.m.realizado) : '—'}</td>
          <td>${s.m ? `<span class="pct-chip ${pctClass(s.m.pct)}">${fmtPct(s.m.pct)}</span>` : '—'}</td>
        </tr>`
      )
      .join('');
  }

  function renderAll() {
    populateFilters();
    renderKpis();
    renderChartOptions();
    renderChart();
    renderRankingOptions();
    renderRanking();
    renderStoreMetricOptions();
    renderStoreTable();
    renderPainel();
    renderCoordenadoras();
  }

  // --- data loading -------------------------------------------------------------

  async function loadDashboard() {
    const res = await fetch('/api/dashboard');
    const data = await res.json();
    state.title = data.title;
    state.metricDefs = data.metricDefs;
    state.current = data.current;
    state.previous = data.previous;
    state.dailySeries = data.dailySeries || [];

    document.title = state.title;
    $('#portal-title').textContent = state.title;

    if (!state.current) {
      $('#report-meta').textContent = 'Nenhum dado carregado ainda — envie a planilha manualmente ou aguarde a sincronização.';
    } else {
      const synced = new Date(state.current.syncedAt).toLocaleString('pt-BR');
      $('#report-meta').textContent = `${state.current.stores.length} lojas · atualizado em ${synced}`;
    }
    renderAll();
  }

  async function loadSyncStatus() {
    const res = await fetch('/api/sync-status');
    const data = await res.json();
    $('#footer-interval').textContent = data.syncIntervalMinutes;
    const dot = $('#sync-dot');
    const label = $('#sync-label');
    const lastFail = data.history.find((h) => !h.ok);
    const lastOk = data.history.find((h) => h.ok);
    if (!data.sftpEnabled) {
      dot.className = 'sync-dot';
      label.textContent = 'SFTP desativado — modo manual';
      $('#btn-sync').disabled = true;
    } else if (lastFail && (!lastOk || new Date(lastFail.at) > new Date(lastOk.at))) {
      dot.className = 'sync-dot bad';
      label.textContent = `Falha na última sincronização: ${lastFail.message || ''}`;
    } else if (data.lastSync) {
      dot.className = 'sync-dot ok';
      label.textContent = `Sincronizado às ${new Date(data.lastSync).toLocaleTimeString('pt-BR')}`;
    } else {
      dot.className = 'sync-dot';
      label.textContent = 'Aguardando primeira sincronização';
    }
  }

  // --- events -------------------------------------------------------------

  function bindEvents() {
    document.querySelectorAll('.navtab').forEach((tab) => {
      tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    document.querySelectorAll('.subtab').forEach((tab) => {
      tab.addEventListener('click', () => switchPainelSubview(tab.dataset.subview));
    });

    const rerenderFiltered = () => {
      renderKpis();
      renderChart();
      renderRanking();
      renderStoreTable();
      renderPainel();
      renderCoordenadoras();
    };

    ['#f-search', '#f-regional', '#f-gerente', '#f-coordenador', '#f-encarregado'].forEach((id) => {
      $(id).addEventListener('input', () => {
        state.filters.search = $('#f-search').value;
        state.filters.regional = $('#f-regional').value;
        state.filters.gerente = $('#f-gerente').value;
        state.filters.coordenador = $('#f-coordenador').value;
        state.filters.encarregado = $('#f-encarregado').value;
        rerenderFiltered();
      });
    });

    $('#f-clear').addEventListener('click', () => {
      state.filters = { search: '', regional: '', gerente: '', coordenador: '', encarregado: '' };
      ['#f-search', '#f-regional', '#f-gerente', '#f-coordenador', '#f-encarregado'].forEach((id) => ($(id).value = ''));
      rerenderFiltered();
    });

    $('#chart-metric').addEventListener('change', renderChart);
    $('#rank-metric').addEventListener('change', renderRanking);
    $('#rank-group').addEventListener('change', renderRanking);
    $('#store-metric').addEventListener('change', renderStoreTable);

    document.querySelectorAll('#store-table th[data-sort]').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (state.sort.key === key) {
          state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sort = { key, dir: 'asc' };
        }
        renderStoreTable();
      });
    });

    $('#btn-sync').addEventListener('click', async () => {
      const btn = $('#btn-sync');
      btn.disabled = true;
      btn.textContent = 'Sincronizando…';
      try {
        const res = await fetch('/api/sync', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          showToast('Dados atualizados com sucesso.');
          await loadDashboard();
        } else {
          showToast(data.error || 'Falha ao sincronizar.', true);
        }
      } catch (err) {
        showToast('Falha ao sincronizar.', true);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Atualizar agora';
        loadSyncStatus();
      }
    });

    $('#btn-upload').addEventListener('click', () => $('#file-input').click());
    $('#file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('arquivo', file);
      showToast('Enviando planilha…');
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.ok) {
          showToast('Planilha carregada com sucesso.');
          await loadDashboard();
        } else {
          showToast(data.error || 'Falha ao processar planilha.', true);
        }
      } catch (err) {
        showToast('Falha ao processar planilha.', true);
      } finally {
        e.target.value = '';
        loadSyncStatus();
      }
    });
  }

  async function init() {
    bindEvents();
    await loadDashboard();
    await loadSyncStatus();
    setInterval(loadSyncStatus, 30000);
    setInterval(loadDashboard, 60000);
  }

  init();
})();
