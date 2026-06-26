(function () {
  'use strict';

  var AUTO_SYNC_MS = 5 * 60 * 1000;
  var MIN_SYNC_GAP_MS = 60 * 1000;
  var lastSyncAt = 0;
  var isSyncing = false;

  function $(id) { return document.getElementById(id); }

  function clearDateBounds() {
    ['fStart', 'fEnd'].forEach(function (id) {
      var node = $(id);
      if (!node) return;
      node.removeAttribute('min');
      node.removeAttribute('max');
      node.title = 'Filtro livre: selecione qualquer data inicial/final. Se nao houver dados nesse periodo, o painel retorna vazio.';
    });
  }

  function setDynamicSourceHint() {
    var source = $('sourceLabel');
    if (!source || source.dataset.dynamicHint === '1') return;
    source.dataset.dynamicHint = '1';
    source.title = 'O painel consulta /api/growthpack em tempo real. O botao Atualizar força nova leitura da planilha.';
  }

  function syncFromSheet(reason) {
    var now = Date.now();
    if (isSyncing || now - lastSyncAt < MIN_SYNC_GAP_MS) return;
    if (document.hidden && reason !== 'manual') return;
    var btn = $('syncBtn');
    if (!btn) return;
    isSyncing = true;
    lastSyncAt = now;
    try {
      btn.click();
    } finally {
      setTimeout(function () {
        isSyncing = false;
        clearDateBounds();
        setDynamicSourceHint();
      }, 2500);
    }
  }

  function installDateFilterUnlock() {
    clearDateBounds();
    setInterval(clearDateBounds, 1500);
    var filters = $('filtersPanel');
    if (filters && typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(clearDateBounds);
      observer.observe(filters, { childList: true, subtree: true, attributes: true, attributeFilter: ['min', 'max', 'value'] });
    }
  }

  function installAutoSync() {
    setTimeout(function () { syncFromSheet('boot'); }, 12000);
    setInterval(function () { syncFromSheet('interval'); }, AUTO_SYNC_MS);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) setTimeout(function () { syncFromSheet('focus'); }, 1000);
    });
    window.addEventListener('focus', function () { setTimeout(function () { syncFromSheet('focus'); }, 1000); });
  }

  function boot() {
    installDateFilterUnlock();
    installAutoSync();
    setDynamicSourceHint();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
