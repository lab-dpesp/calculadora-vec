(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var ferramentas = window.FerramentasRapidas;
  var textosCopiar = {};
  function numero(id, nome) {
    var valor = $(id).value;
    if (valor === '') return 0;
    var n = Number(valor);
    if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(nome + ': informe um número inteiro igual ou maior que zero.');
    return n;
  }

  function pena(prefixo) {
    return {
      anos: numero(prefixo + 'anos', 'Anos'),
      meses: numero(prefixo + 'meses', 'Meses'),
      dias: numero(prefixo + 'dias', 'Dias')
    };
  }

  function falha(id, mensagem) {
    var elemento = $(id);
    elemento.textContent = mensagem;
    elemento.hidden = false;
  }

  function limparErro(id) {
    var elemento = $(id);
    elemento.textContent = '';
    elemento.hidden = true;
  }

  function resultado(id, mostrar) {
    $(id).hidden = !mostrar;
  }

  function formatarPena(p) {
    return p.anos + ' ano(s), ' + p.meses + ' mês(es) e ' + p.dias + ' dia(s)';
  }

  function formatarFracao(fracao) {
    return String(Math.round(fracao * 10000) / 100).replace('.', ',') + '%';
  }

  function nomeConvencao(convencao) {
    return convencao === 'calendario' ? 'calendário' :
      convencao === '365' ? '365 dias/ano e 30 dias/mês' : '360 dias/ano e 30 dias/mês';
  }

  function dataExibida(data) {
    return data.split('-').reverse().join('/');
  }

  function linhasFracao(p, dataInicial) {
    var porConvencao = ferramentas.convencoes.map(function (convencao) {
      return ferramentas.calcularFracoes(p, convencao, dataInicial);
    });
    return ferramentas.fracoes.map(function (fracao, indice) {
      return {
        nome: fracao.nome,
        dias: porConvencao.map(function (resultados) {
          return resultados[indice].dias;
        })
      };
    });
  }

  $('form-conversor').addEventListener('submit', function (evento) {
    evento.preventDefault();
    limparErro('erro-conversor');
    try {
      var p = pena('');
      var data = $('data-inicial').value;
      var valores = ferramentas.convencoes.map(function (convencao) {
        return ferramentas.paraDias(p, convencao, data);
      });
      $('dias-calendario').textContent = valores[0] + ' dias';
      $('dias-365').textContent = valores[1] + ' dias';
      $('dias-360').textContent = valores[2] + ' dias';
      resultado('resultado-conversor', true);
      textosCopiar.conversor = 'E52 · calendário: ' + valores[0] + ' dias\nE52 · 365/30: ' + valores[1] + ' dias\nE52 · 360/30: ' + valores[2] + ' dias';
    } catch (erro) {
      resultado('resultado-conversor', false);
      falha('erro-conversor', erro.message);
    }
  });

  $('form-inverso').addEventListener('submit', function (evento) {
    evento.preventDefault();
    limparErro('erro-inverso');
    try {
      var total = numero('total-dias', 'Dias');
      var convencao = $('convencao-inversa').value;
      var inicio = $('data-inicial-inversa').value;
      var p = ferramentas.deDias(total, convencao, inicio);
      $('pena-decomposta').textContent = formatarPena(p) + ' · Convenção: ' + nomeConvencao(convencao);
      resultado('resultado-inverso', true);
      textosCopiar.inverso = formatarPena(p) + '\nConvenção E52: ' + nomeConvencao(convencao);
    } catch (erro) {
      resultado('resultado-inverso', false);
      falha('erro-inverso', erro.message);
    }
  });

  $('form-fracoes').addEventListener('submit', function (evento) {
    evento.preventDefault();
    limparErro('erro-fracoes');
    try {
      var p = pena('fracao-');
      var data = $('data-inicial-fracoes').value;
      var linhas = linhasFracao(p, data);
      var corpo = $('tabela-fracoes');
      corpo.replaceChildren();
      linhas.forEach(function (linha) {
        var tr = document.createElement('tr');
        [linha.nome].concat(linha.dias.map(function (dias) { return dias + ' dias'; })).forEach(function (valor) {
          var td = document.createElement('td');
          td.textContent = valor;
          tr.appendChild(td);
        });
        corpo.appendChild(tr);
      });
      resultado('resultado-fracoes', true);
      textosCopiar.fracoes = ['E52/D3 · Fração\tCalendário\t365/30\t360/30'].concat(linhas.map(function (linha) {
        return linha.nome + '\t' + linha.dias.join('\t');
      })).join('\n');
    } catch (erro) {
      resultado('resultado-fracoes', false);
      falha('erro-fracoes', erro.message);
    }
  });

  $('form-soma-data').addEventListener('submit', function (evento) {
    evento.preventDefault();
    limparErro('erro-soma-data');
    try {
      var periodo = {
        anos: numero('anos-operacao', 'Anos'),
        meses: numero('meses-operacao', 'Meses'),
        dias: numero('dias-operacao', 'Dias')
      };
      var data = ferramentas.operarPeriodo($('data-operacao').value, periodo, $('tipo-operacao').value);
      $('data-calculada').textContent = data;
      resultado('resultado-soma-data', true);
      textosCopiar['soma-data'] = data + ' · Regra E52';
    } catch (erro) {
      resultado('resultado-soma-data', false);
      falha('erro-soma-data', erro.message);
    }
  });

  $('form-lapso').addEventListener('submit', function (evento) {
    evento.preventDefault();
    limparErro('erro-lapso');
    try {
      var lapso = ferramentas.calcularLapso({
        anos: numero('lapso-anos', 'Anos'),
        meses: numero('lapso-meses', 'Meses'),
        dias: numero('lapso-dias', 'Dias')
      }, numero('lapso-numerador', 'Numerador'), numero('lapso-denominador', 'Denominador'),
      $('criterio-lapso').value, $('lapso-convencao').value, $('lapso-data-inicial').value);
      var criterioTexto = lapso.criterio === 'mais-de' ? 'Mais de' : 'Ao menos';
      $('dias-lapso').textContent = lapso.dias + ' dias (' + criterioTexto + ')';
      $('regra-lapso').textContent = 'Pena convertida: ' + lapso.penaDias + ' dias. Convenção: ' +
        nomeConvencao($('lapso-convencao').value) + '. Regra usada: ' + lapso.regra + ' e E52.';
      resultado('resultado-lapso', true);
      textosCopiar.lapso = $('dias-lapso').textContent + '. ' + $('regra-lapso').textContent;
    } catch (erro) {
      resultado('resultado-lapso', false);
      falha('erro-lapso', erro.message);
    }
  });

  $('form-consulta-fracoes').addEventListener('submit', function (evento) {
    evento.preventDefault();
    limparErro('erro-consulta-fracoes');
    try {
      var condenacao = {
        dataFato: $('consulta-data-fato').value,
        natureza: $('consulta-natureza').value,
        reincidencia: $('consulta-reincidencia').value,
        antecedenteViolento: $('consulta-antecedente').value,
        bonsAntecedentes: $('consulta-bons-antecedentes').value === 'sim',
        equiparado: $('consulta-equiparado').checked,
        tituloXII: $('consulta-titulo-xii').checked
      };
      if ($('consulta-vedacao-lc').value) condenacao.lei15358LC = $('consulta-vedacao-lc').value;
      var consulta = ferramentas.consultarFracoes(condenacao, $('consulta-data-base').value);
      var progressao = consulta.progressao;
      var lc = consulta.livramento;
      $('consulta-progressao').textContent = formatarFracao(progressao.fracao) + ' · ' + progressao.regra +
        ' · ' + progressao.fonte + ' · ' + progressao.fundamentoEscolha +
        ' · Status: ' + progressao.status;
      $('consulta-data-resumo').textContent = 'Data do fato: ' + dataExibida(condenacao.dataFato) +
        ' · Regras consultadas até: ' + dataExibida($('consulta-data-base').value) +
        ' · Era: ' + consulta.eraDoFato + ' · Regras E31/E41/E42.';
      $('consulta-lei-fato').textContent = progressao.leiNaDataDoFato
        ? 'Na data do fato: ' + formatarFracao(progressao.leiNaDataDoFato.fracao) + ' · ' +
          progressao.leiNaDataDoFato.id + ' (' + progressao.leiNaDataDoFato.era + ').'
        : 'Regra da data do fato: não identificada separadamente.';
      $('consulta-lei-favoravel').textContent = progressao.leiPosteriorMaisFavoravel
        ? 'Lei posterior mais favorável: ' + formatarFracao(progressao.leiPosteriorMaisFavoravel.fracao) +
          ' · ' + progressao.leiPosteriorMaisFavoravel.id + ' (' + progressao.leiPosteriorMaisFavoravel.era + ').'
        : 'Lei posterior mais favorável: não identificada.';
      $('consulta-livramento').textContent = lc.vedado
        ? 'Vedado pelas regras informadas: ' + lc.regra.join(', ') + ' · ' + lc.fonte + '.'
        : 'Mais de ' + formatarFracao(lc.fracao) + ' · ' + lc.regra.join(', ') + ' · ' + lc.fonte +
          (lc.alternativa ? '. ' + lc.alternativa.descricao + ': mais de ' + formatarFracao(lc.alternativa.fracao) + ' (' + lc.alternativa.regra + ').' : '.');
      resultado('resultado-consulta-fracoes', true);
      textosCopiar['consulta-fracoes'] = [
        'Consulta em ' + dataExibida($('consulta-data-base').value) + ' · Data do fato ' + dataExibida(condenacao.dataFato),
        'Progressão: ' + $('consulta-progressao').textContent,
        $('consulta-lei-fato').textContent,
        $('consulta-lei-favoravel').textContent,
        'Livramento: ' + $('consulta-livramento').textContent
      ].join('\n');
      $('usar-na-calculadora').disabled = false;
    } catch (erro) {
      resultado('resultado-consulta-fracoes', false);
      $('usar-na-calculadora').disabled = true;
      falha('erro-consulta-fracoes', erro.message);
    }
  });

  $('consulta-data-base').value = $('consulta-data-base').value ||
    new Date().toISOString().slice(0, 10);

  $('usar-na-calculadora').addEventListener('click', function () {
    var condenacao = {
      dataFato: $('consulta-data-fato').value,
      natureza: $('consulta-natureza').value,
      reincidencia: $('consulta-reincidencia').value,
      antecedenteViolento: $('consulta-antecedente').value,
      bonsAntecedentes: $('consulta-bons-antecedentes').value === 'sim',
      equiparado: $('consulta-equiparado').checked,
      tituloXII: $('consulta-titulo-xii').checked
    };
    if ($('consulta-vedacao-lc').value) condenacao.lei15358LC = $('consulta-vedacao-lc').value;
    try {
      ferramentas.consultarFracoes(condenacao, $('consulta-data-base').value);
      sessionStorage.setItem('calcpenal:ferramenta-rapida', JSON.stringify(condenacao));
      window.location.href = 'index.html#condenacoes';
    } catch (_) {
      $('erro-consulta-fracoes').textContent = 'Não foi possível preparar os dados para a calculadora neste navegador.';
      $('erro-consulta-fracoes').hidden = false;
    }
  });

  function invalidarConsultaFracoes() {
    $('usar-na-calculadora').disabled = true;
    resultado('resultado-consulta-fracoes', false);
  }
  $('form-consulta-fracoes').addEventListener('input', invalidarConsultaFracoes);
  $('form-consulta-fracoes').addEventListener('change', invalidarConsultaFracoes);

  $('form-diferenca').addEventListener('submit', function (evento) {
    evento.preventDefault();
    limparErro('erro-diferenca');
    try {
      var inicio = $('data-inicio-diferenca').value;
      var fim = $('data-fim-diferenca').value;
      var incluirUltimoDia = $('incluir-ultimo-dia').checked;
      var dias = ferramentas.diasEntreDatas(inicio, fim, incluirUltimoDia);
      var texto = dias + ' dia(s). ' + ferramentas.legendaContagemPeriodo(incluirUltimoDia);
      $('dias-diferenca').textContent = texto;
      resultado('resultado-diferenca', true);
      textosCopiar.diferenca = texto;
    } catch (erro) {
      resultado('resultado-diferenca', false);
      falha('erro-diferenca', erro.message);
    }
  });

  document.addEventListener('click', function (evento) {
    var botao = evento.target.closest('.copiar');
    if (!botao) return;
    var texto = textosCopiar[botao.dataset.copiar];
    if (!texto) return;
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      $('status-copia').textContent = 'Cópia indisponível neste navegador. Selecione o resultado e copie.';
      return;
    }
    navigator.clipboard.writeText(texto).then(function () {
      $('status-copia').textContent = 'Resultado copiado.';
    }).catch(function () {
      $('status-copia').textContent = 'Não foi possível copiar. Selecione o resultado e copie.';
    });
  });

  document.querySelectorAll('form').forEach(function (form) {
    form.addEventListener('input', function () {
      var erro = form.querySelector('[role="alert"]');
      if (erro && !erro.hidden) erro.hidden = true;
    });
  });

})();
