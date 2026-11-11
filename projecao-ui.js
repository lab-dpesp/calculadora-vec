(function () {
  'use strict';
  var busca = document.getElementById('busca-tipo-penal');
  var dataFato = document.getElementById('data-fato-catalogo');
  var aviso = document.getElementById('aviso-catalogo');
  var resultados = document.getElementById('resultados-catalogo');
  if (!busca || !dataFato || !aviso || !resultados || !window.CatalogoTipos) return;

  function elemento(tag, texto, classe) {
    var node = document.createElement(tag);
    if (texto) node.textContent = texto;
    if (classe) node.className = classe;
    return node;
  }

  function formatarPena(pena) {
    if (!pena || typeof pena !== 'object') return 'Pena não informada.';
    function unidade(valor, singular, plural) {
      return valor ? valor + ' ' + (Number(valor) === 1 ? singular : plural) : '';
    }
    return [unidade(pena.a, 'ano', 'anos'), unidade(pena.m, 'mês', 'meses'), unidade(pena.d, 'dia', 'dias')]
      .filter(Boolean).join(' ') || 'Pena não informada.';
  }

  function exibirVersao(container, tipo, titulo, data) {
    var selecao = window.CatalogoTipos.selecionarVersao(tipo, data);
    var bloco = elemento('p');
    bloco.appendChild(elemento('strong', titulo + ': '));
    if (!selecao.versao) {
      bloco.appendChild(document.createTextNode(selecao.aviso));
      container.appendChild(bloco);
      return;
    }
    var versao = selecao.versao;
    bloco.appendChild(document.createTextNode(
      formatarPena(versao.pena.min) + ' a ' + formatarPena(versao.pena.max) + ' (' + versao.pena.unidade + ').'
    ));
    container.appendChild(bloco);
    container.appendChild(elemento('p', 'Vigência: ' + versao.desde + (versao.ate ? ' a ' + versao.ate : ' em diante') + '.'));
    container.appendChild(elemento('p', 'Fonte: ' + (versao.fonte || 'não informada') + '.'));
    container.appendChild(elemento('p', 'Data registrada da fonte: ' + (versao.conferidoEm || 'não informada') + ' · status: ' + selecao.status + '.'));
    if (versao.nota) container.appendChild(elemento('p', versao.nota, 'nota'));
  }

  function exibirVariantes(container, tipo, itens, rotulo, data) {
    (itens || []).forEach(function (item) {
      var secao = elemento('div');
      var titulo = rotulo + ' — ' + item.texto;
      if (item.vigencias && item.vigencias.length) {
        var temPena = item.vigencias.some(function (versao) {
          return versao.pena && versao.pena.min && versao.pena.max;
        });
        if (temPena) {
          exibirVersao(secao, { vigencias: item.vigencias }, titulo, data);
        } else {
          var selecao = window.CatalogoTipos.selecionarVersao(item, data);
          if (!selecao.versao) {
            secao.appendChild(elemento('p', titulo + ': ' + selecao.aviso));
          } else {
            var fracao = selecao.versao.fracao || item.fracaoMin && item.fracaoMax &&
              item.fracaoMin + ' a ' + item.fracaoMax;
            secao.appendChild(elemento('p', titulo + (fracao ? ' (fração ' + fracao + ')' : '') +
              ' · status: ' + selecao.status + '.'));
            secao.appendChild(elemento('p', 'Vigência: ' + selecao.versao.desde +
              (selecao.versao.ate ? ' a ' + selecao.versao.ate : ' em diante') + '.'));
          }
        }
      } else {
        var partes = [item.fracao && 'fração ' + item.fracao,
          item.fracaoMin && item.fracaoMax && 'fração de ' + item.fracaoMin + ' a ' + item.fracaoMax,
          item.fracaoMin && !item.fracaoMax && 'fração ' + item.fracaoMin].filter(Boolean);
        secao.appendChild(elemento('p', titulo + (partes.length ? ' (' + partes.join('; ') + ')' : '') + ' · status: a conferir.'));
      }
      container.appendChild(secao);
    });
  }

  function desenhar() {
    resultados.replaceChildren();
    var tipos = window.CatalogoTipos.buscar(catalogo, busca.value);
    if (!tipos.length) {
      aviso.textContent = 'Nenhum tipo encontrado. Confira o nome, o artigo ou o sinônimo.';
      return;
    }
    if (!dataFato.value) {
      aviso.textContent = 'Informe a data do fato para escolher a vigência (P10).';
      return;
    }
    aviso.textContent = tipos.length + (tipos.length === 1 ? ' tipo encontrado.' : ' tipos encontrados.');
    tipos.forEach(function (tipo) {
      var artigo = elemento('p', tipo.artigo || '', 'rotulo-secao');
      var card = elemento('article', null, 'painel');
      card.appendChild(artigo);
      card.appendChild(elemento('h3', tipo.nome));
      card.appendChild(elemento('p', 'Status do tipo: a conferir · Data registrada da fonte: ' + (tipo.conferidoEm || 'não informada') + '.'));
      exibirVersao(card, tipo, 'Pena', dataFato.value);
      exibirVariantes(card, tipo, tipo.majorantes, 'Majorante', dataFato.value);
      exibirVariantes(card, tipo, tipo.minorantes, 'Minorante', dataFato.value);
      exibirVariantes(card, tipo, tipo.qualificadoras, 'Qualificadora', dataFato.value);
      resultados.appendChild(card);
    });
  }

  var catalogo = [];
  fetch('docs/legislacao/catalogo-tipos-conferido.json')
    .then(function (resposta) {
      if (!resposta.ok) throw new Error('Catálogo indisponível.');
      return resposta.json();
    })
    .then(function (dados) {
      catalogo = window.CatalogoTipos.carregar(dados);
      desenhar();
    })
    .catch(function () {
      aviso.textContent = 'Não foi possível abrir o catálogo local. Atualize a página e tente novamente.';
    });

  busca.addEventListener('input', desenhar);
  dataFato.addEventListener('change', desenhar);
})();
