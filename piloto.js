(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports
    ? require('./dados/modulos-provisorios.js') : root.DadosModulosProvisorios);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Piloto = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (modulos) {
  'use strict';

  var configuracao = Object.freeze({
    indultoComutacao: false,
    modulosAtivos: Object.freeze(['E37', 'E52', 'E60', 'E61']),
    modulosOcultos: modulos.ids
  });
  var ocultos = new Set(configuracao.modulosOcultos);

  var api = Object.freeze({
    configuracao: configuracao,
    moduloVisivel: function (id) {
      if (modulos.inclui({ modulosProvisorios: [id] }, 'E70')) return configuracao.indultoComutacao;
      return !ocultos.has(id);
    },
    aplicarOcultacoes: function (documento) {
      if (!documento || typeof documento.querySelectorAll !== 'function') return;
      Array.prototype.forEach.call(documento.querySelectorAll('[data-piloto-modulo]'), function (elemento) {
        if (!api.moduloVisivel(elemento.getAttribute('data-piloto-modulo'))) elemento.hidden = true;
      });
    }
  });

  if (typeof document !== 'undefined') api.aplicarOcultacoes(document);
  return api;
});
