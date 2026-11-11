(function () {
  'use strict';
  var CHAVE_ASSINATURA = 'calcpenal:assinatura';
  var campos = Array.prototype.slice.call(document.querySelectorAll('[data-assinatura]'));
  var aviso = document.getElementById('avisoAssinatura');

  try {
    var salvos = JSON.parse(localStorage.getItem(CHAVE_ASSINATURA) || '{}');
    campos.forEach(function (campo) {
      if (typeof salvos[campo.name] === 'string') campo.value = salvos[campo.name];
    });
  } catch (_) {}

  function guardarAssinatura() {
    var valores = {};
    campos.forEach(function (campo) { valores[campo.name] = campo.value; });
    try {
      localStorage.setItem(CHAVE_ASSINATURA, JSON.stringify(valores));
      aviso.textContent = 'Esses dados ficam salvos somente neste navegador.';
    } catch (_) {
      aviso.textContent = 'Não foi possível salvar neste navegador. Confira as permissões de armazenamento.';
    }
  }
  campos.forEach(function (campo) {
    campo.addEventListener('input', guardarAssinatura);
  });

  document.querySelectorAll('.nav-calc a[aria-disabled="true"]').forEach(function (link) {
    link.addEventListener('click', function (evento) { evento.preventDefault(); });
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {
        var mensagem = document.getElementById('avisoPwa');
        mensagem.textContent = 'Não foi possível preparar o uso offline neste navegador.';
      });
    });
  }
})();
