(() => {
  const PRIMARY_KEYS = ['aprovacao', 'ativacao', 'servicos', 'fatura_garantida'];
  const PRODUCT_KEYS = ['odonto', 'auto_moto', 'casa_protegida', 'vida_premiada', 'pet'];

  const state = {
    title: 'Portal de Produção Comercial',
    metricDefs: [],
    current: null,
    previous: null,
    filters: { search: '', regional: '', gerente: '', coordenador: '', encarregado: '' },
    sort: { key: 'pct', dir: 'desc' },
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

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // --- KPI cards -------------------------------------------------------------

  function renderKpis() {
    const stores = filteredStores(state.current);
    const prevStores = state.previous ? filteredStores(state.previous) : [];
    const prevByCode = new Map(prevStores.map((s) => [s.codigoLoja, s]));

    // O comparativo só faz sentido quando o snapshot anterior é (quase) o mesmo
    // conjunto de lojas — caso contrário (ex.: fonte de dados trocada) comparar
    // populações diferentes geraria uma variação sem sentido.
    const matchedCurrent = stores.filter((s) => prevByCode.has(s.codigoLoja));
    const matchedPrevious = matchedCurrent.map((s) => prevByCode.get(s.codigoLoja));
    const coverage = stores.length > 0 ? matchedCurrent.length / stores.length : 0;
    const canCompare = state.previous && coverage >= 0.9;

    const renderGrid = (containerId, keys, big) => {
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
              : `<span class="kpi-card__delta ${deltaPts >= 0 ? 'up' : 'down'}">${deltaPts >= 0 ? '▲' : '▼'} ${Math.abs(deltaPts).toFixed(1)}p</span>`;
          const cls = pctClass(agg.pct);
          return `
          <div class="kpi-card">
            <div class="kpi-card__label">${labelFor(key)}</div>
            <div class="kpi-card__numbers">
              <span class="kpi-card__pct">${fmtPct(agg.pct)}</span>
              ${deltaHtml}
            </div>
            <div class="bar"><div class="bar__fill ${cls}" style="width:${Math.min(100, agg.pct * 100)}%"></div></div>
            <div class="kpi-card__sub">${fmt(agg.realizado)} de ${fmt(agg.meta)} (meta)</div>
          </div>`;
        })
        .join('');
    };

    renderGrid('#kpi-primary', PRIMARY_KEYS, true);
    renderGrid('#kpi-products', PRODUCT_KEYS, false);
    $('#f-count').textContent = `${stores.length} loja(s)`;
  }

  // --- ranking tab -------------------------------------------------------------

  function renderRankingOptions() {
    const select = $('#rank-metric');
    if (select.options.length) return;
    select.innerHTML = state.metricDefs.map((d) => `<option value="${d.key}">${d.label}</option>`).join('');
    select.value = 'servicos';
  }

  function renderRanking() {
    const key = $('#rank-metric').value || 'servicos';
    const stores = filteredStores(state.current)
      .map((s) => ({ ...s, m: s.metrics[key] }))
      .filter((s) => s.m)
      .sort((a, b) => b.m.pct - a.m.pct);

    const body = $('#rank-body');
    if (!stores.length) {
      body.innerHTML = `<tr><td colspan="7" class="empty-state">Nenhuma loja encontrada para os filtros atuais.</td></tr>`;
      return;
    }
    body.innerHTML = stores
      .map(
        (s, i) => `
        <tr>
          <td><span class="rank-badge">${i + 1}</span></td>
          <td>${escapeHtml(s.loja)}</td>
          <td>${escapeHtml(s.encarregado)}</td>
          <td>${escapeHtml(s.regional)}</td>
          <td class="num">${fmt(s.m.meta)}</td>
          <td class="num">${fmt(s.m.realizado)}</td>
          <td><span class="pct-chip ${pctClass(s.m.pct)}">${fmtPct(s.m.pct)}</span></td>
        </tr>`
      )
      .join('');
  }

  // --- lojas tab -------------------------------------------------------------

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
    renderRankingOptions();
    renderRanking();
    renderStoreMetricOptions();
    renderStoreTable();
  }

  // --- data loading -------------------------------------------------------------

  async function loadDashboard() {
    const res = await fetch('/api/dashboard');
    const data = await res.json();
    state.title = data.title;
    state.metricDefs = data.metricDefs;
    state.current = data.current;
    state.previous = data.previous;

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
    ['#f-search', '#f-regional', '#f-gerente', '#f-coordenador', '#f-encarregado'].forEach((id) => {
      $(id).addEventListener('input', () => {
        state.filters.search = $('#f-search').value;
        state.filters.regional = $('#f-regional').value;
        state.filters.gerente = $('#f-gerente').value;
        state.filters.coordenador = $('#f-coordenador').value;
        state.filters.encarregado = $('#f-encarregado').value;
        renderKpis();
        renderRanking();
        renderStoreTable();
      });
    });

    $('#f-clear').addEventListener('click', () => {
      state.filters = { search: '', regional: '', gerente: '', coordenador: '', encarregado: '' };
      ['#f-search', '#f-regional', '#f-gerente', '#f-coordenador', '#f-encarregado'].forEach((id) => ($(id).value = ''));
      renderKpis();
      renderRanking();
      renderStoreTable();
    });

    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('is-active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('is-active'));
        tab.classList.add('is-active');
        $(`#tab-${tab.dataset.tab}`).classList.add('is-active');
      });
    });

    $('#rank-metric').addEventListener('change', renderRanking);
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
