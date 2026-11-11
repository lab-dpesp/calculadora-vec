(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CatalogoTipos = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function textoNormalizado(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function dataValida(valor) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    var partes = valor.split('-').map(Number);
    var data = new Date(0);
    data.setUTCHours(0, 0, 0, 0);
    data.setUTCFullYear(partes[0], partes[1] - 1, partes[2]);
    return data.getUTCFullYear() === partes[0] &&
      data.getUTCMonth() === partes[1] - 1 &&
      data.getUTCDate() === partes[2];
  }

  function carregar(dados) {
    if (!dados || !Array.isArray(dados.tipos)) throw new TypeError('Catálogo: dados de tipos penais inválidos.');
    var conferidoEm = dados.meta && dados.meta.conferidoEm || null;

    function vigencias(versoes) {
      return (Array.isArray(versoes) ? versoes : []).map(function (versao) {
        return {
          desde: versao.desde,
          ate: versao.ate === undefined ? null : versao.ate,
          pena: {
            min: versao.min,
            max: versao.max,
            unidade: versao.unidade
          },
          fracao: versao.fracao,
          fonte: versao.fonte,
          nota: versao.nota,
          conferidoEm: conferidoEm,
          status: 'a conferir'
        };
      });
    }

    function variantes(itens) {
      return (itens || []).map(function (item) {
        var copia = Object.assign({}, item, {
          fonte: item.fonte || null,
          conferidoEm: conferidoEm,
          status: 'a conferir',
          vigencias: vigencias(item.versoes)
        });
        delete copia.versoes;
        return copia;
      });
    }

    return dados.tipos.filter(function (tipo) {
      return Array.isArray(tipo.versoes) && tipo.versoes.length > 0;
    }).map(function (tipo) {
      var versoes = vigencias(tipo.versoes);
      var maisRecente = versoes[versoes.length - 1];
      var copia = Object.assign({}, tipo, {
        sinonimos: Array.isArray(tipo.sinonimos) ? tipo.sinonimos.slice() : [],
        status: 'a conferir',
        conferidoEm: conferidoEm,
        pena: maisRecente && maisRecente.pena,
        fonte: maisRecente && maisRecente.fonte,
        vigencias: versoes,
        majorantes: variantes(tipo.majorantes),
        minorantes: variantes(tipo.minorantes),
        qualificadoras: variantes(tipo.qualificadoras)
      });
      delete copia.versoes;
      return copia;
    });
  }

  function selecionarVersao(tipo, dataFato) {
    if (!dataValida(dataFato)) {
      return { versao: null, status: 'a conferir', aviso: 'Informe uma data do fato válida para escolher a vigência (P10).' };
    }
    var compativeis = (tipo.vigencias || []).filter(function (versao) {
      return dataValida(versao.desde) &&
        (versao.ate === null || versao.ate === undefined || dataValida(versao.ate)) &&
        versao.desde <= dataFato &&
        (versao.ate === null || versao.ate === undefined || dataFato <= versao.ate);
    });
    if (compativeis.length !== 1) {
      return {
        versao: null,
        status: 'a conferir',
        aviso: compativeis.length
          ? 'Há mais de uma vigência possível para esta data; confira a fonte antes de usar.'
          : 'A vigência para esta data não está identificada; confira a fonte antes de usar.'
      };
    }
    return { versao: compativeis[0], status: 'a conferir', aviso: null };
  }

  function buscar(tipos, termo) {
    var consulta = textoNormalizado(termo).trim();
    if (!consulta) return (tipos || []).slice();
    return (tipos || []).filter(function (tipo) {
      var campos = [tipo.id, tipo.nome, tipo.artigo].concat(tipo.sinonimos || []);
      (tipo.majorantes || []).concat(tipo.minorantes || [], tipo.qualificadoras || []).forEach(function (item) {
        campos.push(item.id, item.texto);
      });
      return campos.some(function (campo) {
        return textoNormalizado(campo).indexOf(consulta) !== -1;
      });
    });
  }

  function fracaoValida(valor) {
    if (typeof valor !== 'string') return false;
    var partes = valor.match(/^(\d+)\/(\d+)$/);
    return !!partes && Number(partes[1]) > 0 &&
      Number(partes[2]) > 0 && Number(partes[1]) <= Number(partes[2]);
  }

  return {
    carregar: carregar,
    buscar: buscar,
    selecionarVersao: selecionarVersao,
    fracaoValida: fracaoValida,
    dataValida: dataValida
  };
});
