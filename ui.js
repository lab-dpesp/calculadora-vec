(function (root) {
  'use strict';

  var piloto = root.Piloto;
  var textos = root.TextosInterface;
  var modulos = root.DadosModulosProvisorios;
  var integracaoAtiva = false;
  var integracaoEntrada = null;
  var integracaoEstado = null;
  var integracaoLinhas = new WeakMap();
  var integracaoNovosIds = new WeakMap();
  var proximoIdIntegracao = 1;
  var linhasColetadas = new WeakMap();
  var comutacaoAlteraBaseBeneficios;
  if (!piloto && typeof module !== 'undefined' && module.exports) piloto = require('./piloto.js');
  if (!textos && typeof module !== 'undefined' && module.exports) textos = require('./ui/textos.js');
  if (!modulos && typeof module !== 'undefined' && module.exports) modulos = require('./dados/modulos-provisorios.js');

  function normalizarData(valor) {
    var texto = String(valor || '').trim();
    var partes;
    if (/^\d{8}$/.test(texto)) {
      partes = [texto.slice(0, 2), texto.slice(2, 4), texto.slice(4)];
    } else {
      var correspondencia = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!correspondencia) throw new Error('Use DD/MM/AAAA ou DDMMAAAA.');
      partes = correspondencia.slice(1);
    }

    var dia = Number(partes[0]);
    var mes = Number(partes[1]);
    var ano = Number(partes[2]);
    var data = new Date(0);
    data.setUTCHours(0, 0, 0, 0);
    data.setUTCFullYear(ano, mes - 1, dia);
    if (ano < 1 || data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
      throw new Error('Data inválida. Confira o dia, o mês e o ano.');
    }
    return String(ano).padStart(4, '0') + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
  }

  function dataExibida(valor) {
    var partes = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return partes ? partes[3] + '/' + partes[2] + '/' + partes[1] : 'Não calculada';
  }

  function progressaoExibida(progressao) {
    if (progressao && progressao.data) return dataExibida(progressao.data);
    if (progressao && progressao.estimativa && progressao.estimativa.data) {
      return 'Estimativa: ' + dataExibida(progressao.estimativa.data) + ' (não conclusiva)';
    }
    return progressao && progressao.motivoNaoCabe || 'Não calculada';
  }

  function beneficioExibido(beneficio) {
    return beneficio && beneficio.data
      ? dataExibida(beneficio.data)
      : beneficio && beneficio.motivoNaoCabe || 'Não calculada';
  }

  function textoPena(valor) {
    if (!valor || typeof valor !== 'object') return 'Não informado';
    var partes = [];
    [['anos', 'ano', 'anos'], ['meses', 'mês', 'meses'], ['dias', 'dia', 'dias']].forEach(function (item) {
      var quantidade = Number(valor[item[0]]);
      if (Number.isFinite(quantidade) && quantidade !== 0) partes.push(quantidade + ' ' + (quantidade === 1 ? item[1] : item[2]));
    });
    var total = valor.emDias != null && Number.isFinite(Number(valor.emDias))
      ? ' (' + Number(valor.emDias) + (Number(valor.emDias) === 1 ? ' dia)' : ' dias)') : '';
    var texto = partes.length > 1 ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1] : partes[0];
    return (texto || (total ? '0 dias' : 'Não informado')) + total;
  }

  function regraId(valor) {
    var id = String(valor || '');
    return /^[ED]\d+(?:-[A-Z0-9-]+)?$/i.test(id) || /^E-[A-Z0-9-]+$/i.test(id) ? id.toUpperCase() : '';
  }

  function criarElemento(tag, classe, texto) {
    var elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto != null) elemento.textContent = String(texto);
    return elemento;
  }

  function linkRegra(id) {
    var regra = regraId(id);
    if (!regra) return null;
    regra = (regra.match(/^[ED]\d+/) || [regra])[0];
    var link = criarElemento('a', 'sub', regra);
    link.href = 'regras/';
    link.title = 'Consultar ' + regra + ' nas regras de negócio';
    return link;
  }

  function exibirMemoria(conteudo, destino) {
    if (!Array.isArray(conteudo) || !conteudo.length) return;
    var lista = criarElemento('ul');
    conteudo.forEach(function (item) {
      var li = criarElemento('li');
      var descricao = typeof item === 'string' ? item :
        item && (item.descricao || item.texto || item.etapa || item.mensagem) || '';
      if (descricao) li.appendChild(document.createTextNode(textoAviso(descricao) + ' '));
      var regras = item && typeof item === 'object' ? item.regra : '';
      (Array.isArray(regras) ? regras : [regras]).forEach(function (id) {
        var link = linkRegra(id);
        if (link) {
          li.appendChild(link);
          li.appendChild(document.createTextNode(' '));
        }
      });
      if (!li.textContent.trim()) li.textContent = 'Etapa de cálculo sem descrição.';
      lista.appendChild(li);
    });
    destino.appendChild(lista);
  }

  function textoAviso(aviso) {
    var texto = String(typeof aviso === 'string' ? aviso : aviso && (aviso.texto || aviso.mensagem) || '');
    if (textos) texto = textos.pendencias([texto])[0] || '';
    return texto
      .replace(/Requisito temporal em não calculado\./g, 'Requisito temporal não calculado.')
      .replace(/Finalidade admitida: nenhuma calculada\./g, 'Nenhuma finalidade indicada; confira o motivo no cartão de saída temporária.')
      .replace(/\b[ED]\d+(?:-[A-Z0-9]+)+(?:[:.]\s*)?/g, '')
      .replace(/(?:Fonte:\s*)?docs\/[\w/.-]+/g, 'Consulte a fonte na página de regras')
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, dataExibida);
  }

  function exibirAvisos(avisos, destino, recolherPendentes) {
    destino.replaceChildren();
    var grupo = criarElemento('details', 'avisos-pendentes');
    var resumo = criarElemento('summary');
    grupo.appendChild(resumo);
    var quantidade = 0;
    (Array.isArray(avisos) ? avisos : []).filter(function (aviso) {
      return !piloto || piloto.moduloVisivel(aviso && typeof aviso === 'object' ? aviso.regra : '');
    }).forEach(function (aviso) {
      var penaCumprida = aviso && typeof aviso === 'object' && aviso.regra === 'E102';
      var caixa = criarElemento('p', 'aviso-resultado' + (penaCumprida ? ' pena-cumprida' : ''));
      if (penaCumprida) caixa.setAttribute('role', 'alert');
      caixa.appendChild(document.createTextNode(textoAviso(aviso)));
      var link = linkRegra(aviso && typeof aviso === 'object' ? aviso.regra : '');
      var fontesAConferir = aviso && aviso.status === 'Decidida pelo Núcleo; fontes a conferir';
      var pendente = aviso && (aviso.status === 'Pendente de validação' || fontesAConferir ||
        ['D7', 'E04', 'E05', 'E23', 'E31', 'E33', 'E42', 'E45'].indexOf(link && link.textContent) !== -1);
      if (link) {
        caixa.appendChild(document.createTextNode(' '));
        caixa.appendChild(link);
        if (pendente) {
          caixa.appendChild(document.createTextNode(fontesAConferir ? ' · Fontes a conferir' : ' · Pendente de validação'));
        }
      }
      if (recolherPendentes && pendente && !penaCumprida) {
        grupo.appendChild(caixa);
        quantidade++;
      } else {
        destino.appendChild(caixa);
      }
    });
    if (quantidade) {
      resumo.textContent = 'Regras a conferir (' + quantidade + ' ' + (quantidade === 1 ? 'aviso' : 'avisos') + ')';
      destino.appendChild(grupo);
    }
  }

  function mostrarDados(destino, dados) {
    var cartao = criarElemento('div', 'dado-resultado');
    var rotulo = criarElemento('span', '', dados[0]);
    var valor = criarElemento('strong', '', dados[1] == null || dados[1] === '' ? 'Não calculada' : dados[1]);
    cartao.appendChild(rotulo);
    cartao.appendChild(valor);
    destino.appendChild(cartao);
  }

  function idsDasRegras(itens) {
    var ids = [];
    (itens || []).forEach(function (item) {
      var regras = item && item.regra;
      (Array.isArray(regras) ? regras : [regras]).forEach(function (id) {
        var valido = regraId(id);
        if (valido && ids.indexOf(valido) === -1) ids.push(valido);
      });
    });
    return ids;
  }

  function exibirCartoesBeneficio(resultado, destino) {
    destino.replaceChildren();
    [
      ['Progressão de regime', resultado.progressao, 'progressao'],
      ['Livramento condicional', resultado.livramento, 'livramento'],
      ['Saída temporária', resultado.saidaTemporaria, 'saidaTemporaria'],
      ['Término da pena', { data: resultado.termino, memoria: resultado.memoriaTermino && [resultado.memoriaTermino] }, 'termino']
    ].forEach(function (item) {
      var beneficio = item[1] || {};
      var card = criarElemento('article', 'beneficio-cartao');
      card.appendChild(criarElemento('h4', '', item[0]));
      var selo = beneficio.estimativa ? 'Estimativa'
        : beneficio.data ? 'Previsto' : 'Condicionado';
      card.appendChild(criarElemento('span', 'selo-beneficio selo-' + selo.toLowerCase(), selo));
      var fracao = item[2] === 'progressao'
        ? (resultado.condenacoes || []).map(function (condenacao) {
          return condenacao.id + ': ' + (condenacao.fracaoPR || 'fração não informada');
        }).join('; ') || 'Não informada'
        : item[2] === 'livramento'
          ? (resultado.condenacoes || []).map(function (condenacao) {
            return condenacao.fracaoLC || '';
          }).filter(Boolean).join('; ') || 'Não informada'
          : beneficio.fracao != null ? Math.round(beneficio.fracao * 100) + '%' : 'Não se aplica';
      var lapso = Number.isInteger(beneficio.requisitoDias)
        ? beneficio.requisitoDias + ' dias' : null;
      var creditos = [
        'Detração: ' + (Number.isInteger(resultado.detracaoDias) ? resultado.detracaoDias : 0) + ' dias',
        'Remição: ' + (Number.isInteger(resultado.remicaoDias) ? resultado.remicaoDias : 0) + ' dias',
        'Perda de remição: ' + (Number.isInteger(resultado.diasPerdidosRemicao) ? resultado.diasPerdidosRemicao : 0) + ' dias'
      ].join('; ');
      [
        ['Fração aplicada', fracao],
        ['Tempo exigido antes dos abatimentos', lapso],
        ['Abatimentos e perdas considerados no cálculo', creditos],
        ['Tempo exigido após os abatimentos', Number.isInteger(beneficio.lapsoLiquidoDias)
          ? beneficio.lapsoLiquidoDias + ' dias' : null],
        ['Data', beneficio.estimativa && beneficio.estimativa.data
          ? 'Estimativa: ' + dataExibida(beneficio.estimativa.data)
          : dataExibida(beneficio.data)]
      ].concat(item[2] === 'saidaTemporaria' ? dadosSaidaTemporaria(resultado) : []).forEach(function (dado) {
        if (dado[1] == null) return;
        var linha = criarElemento('p', 'beneficio-dado');
        linha.appendChild(criarElemento('strong', '', dado[0] + ': '));
        linha.appendChild(document.createTextNode(dado[1]));
        card.appendChild(linha);
      });
      (beneficio.memoria || []).filter(function (memoria) {
        return memoria && memoria.condenacaoId;
      }).forEach(function (memoria) {
        var proporcao = Math.round(memoria.fracaoPonderada * 10000) / 100;
        var texto = 'Condenação ' + memoria.condenacaoId + ': ' + memoria.saldoDias +
          ' dias de saldo × ' + proporcao + '% = ' + memoria.requisitoDias +
          ' dias de requisito; ' + memoria.cumpridoDias + ' dias cumpridos antes da data-base (' +
          dataExibida(memoria.dataBase) + ').';
        card.appendChild(criarElemento('p', 'sub', texto));
      });
      if (beneficio.motivoNaoCabe) card.appendChild(criarElemento('p', 'nota', beneficio.motivoNaoCabe));
      var regras = idsDasRegras(beneficio.memoria || []);
      if (item[2] === 'termino') regras = idsDasRegras([beneficio.memoria]);
      if (regras.length) {
        var fundamento = criarElemento('p', 'sub');
        fundamento.appendChild(document.createTextNode('Regras: '));
        regras.forEach(function (id, indice) {
          if (indice) fundamento.appendChild(document.createTextNode(', '));
          var link = criarElemento('a', '', id);
          link.href = 'regras/';
          link.title = 'Consultar as regras de negócio';
          fundamento.appendChild(link);
        });
        card.appendChild(fundamento);
      }
      destino.appendChild(card);
    });
  }

  function exibirLeisCondenacoes(resultado, secao, destino) {
    destino.replaceChildren();
    var condenacoes = Array.isArray(resultado.condenacoes) ? resultado.condenacoes : [];
    secao.hidden = !condenacoes.some(function (item) { return item.leiNaDataDoFato; });
    condenacoes.forEach(function (item) {
      if (!item.leiNaDataDoFato) return;
      var cartao = criarElemento('article', 'lei-cartao');
      cartao.appendChild(criarElemento('h4', '', 'Condenação ' + (item.id || 'sem identificação')));
      [
        ['Lei na data do fato', item.leiNaDataDoFato],
        ['Lei posterior mais favorável', item.leiPosteriorMaisFavoravel]
      ].forEach(function (linha) {
        var lei = linha[1];
        cartao.appendChild(criarElemento('p', '', linha[0] + ': ' +
          (lei ? textoAviso(lei.fonte || 'Fonte não informada') : 'Não identificada')));
        if (lei) {
          var link = linkRegra(String(lei.id || '').split('-')[0]);
          if (link) cartao.appendChild(link);
        }
      });
      cartao.appendChild(criarElemento('p', '', 'Aplicação escolhida: ' + (item.fracaoPR || 'não informada') +
        ' · ' + textoAviso(item.fundamentoEscolha || 'Fundamento não informado.')));
      destino.appendChild(cartao);
    });
  }

  function valorDataBeneficio(resultado, chave) {
    if (chave === 'termino') return resultado.termino;
    var beneficio = resultado[chave] || {};
    return beneficio.data || beneficio.estimativa && beneficio.estimativa.data || null;
  }

  function diferencaDiasDatas(principal, alternativa) {
    if (!principal || !alternativa) return null;
    var diaPrincipal = Date.parse(principal + 'T00:00:00Z');
    var diaAlternativo = Date.parse(alternativa + 'T00:00:00Z');
    return Number.isFinite(diaPrincipal) && Number.isFinite(diaAlternativo)
      ? Math.round((diaAlternativo - diaPrincipal) / 86400000) : null;
  }

  function textoDiferencaConvencao(diferenca) {
    if (!Number.isInteger(diferenca)) return 'não calculada';
    if (diferenca === 0) return 'sem mudança';
    return Math.abs(diferenca) + (Math.abs(diferenca) === 1 ? ' dia' : ' dias') +
      (diferenca > 0 ? ' depois' : ' antes');
  }

  function exibirComparacaoConvencoes(entrada, dataCalculo, resultado, opcoes, motor, destino) {
    destino.replaceChildren();
    var tabela = criarElemento('table', 'q-tabela');
    var cabecalho = criarElemento('tr');
    ['Data do benefício', 'Convenção testada', 'Data principal', 'Data comparada', 'Variação'].forEach(function (texto) {
      cabecalho.appendChild(criarElemento('th', '', texto));
    });
    var thead = criarElemento('thead');
    thead.appendChild(cabecalho);
    tabela.appendChild(thead);
    var corpo = criarElemento('tbody');
    var variantes = [
      ['D1 · dias de calendário', { convencaoDias: 'calendario' }],
      ['D1 · 365 dias por ano', { convencaoDias: '365' }],
      ['D1 · 360 dias por ano', { convencaoDias: '360' }],
      ['D2 · sem retirar um dia', { menos1Beneficio: false }],
      ['D2 · com um dia a menos', { menos1Beneficio: true }],
      ['D3 · arredondar para cima', { arredondamento: 'cima' }],
      ['D3 · arredondar para baixo', { arredondamento: 'baixo' }]
    ];
    var convencoes = resultado && resultado.erros ? [] : variantes;
    convencoes.forEach(function (variante) {
      var alternativas = Object.assign({}, opcoes, variante[1]);
      var calculado = motor.calcular.call(motor, entrada, dataCalculo, alternativas);
      [
        ['Progressão', 'progressao'],
        ['Livramento condicional', 'livramento'],
        ['Saída temporária', 'saidaTemporaria'],
        ['Término da pena', 'termino']
      ].forEach(function (beneficio) {
        var principal = valorDataBeneficio(resultado, beneficio[1]);
        var comparada = valorDataBeneficio(calculado, beneficio[1]);
        var linha = criarElemento('tr');
        [
          beneficio[0],
          variante[0],
          dataExibida(principal),
          dataExibida(comparada),
          textoDiferencaConvencao(diferencaDiasDatas(principal, comparada))
        ].forEach(function (valor) { linha.appendChild(criarElemento('td', '', valor)); });
        corpo.appendChild(linha);
      });
    });
    tabela.appendChild(corpo);
    destino.appendChild(tabela);
  }

  function exibirResumoGrafico(resultado, dataCalculo) {
    var total = resultado.penaTotal && resultado.penaTotal.emDias;
    var cumprido = resultado.cumprido && resultado.cumprido.emDias;
    var percentual = Number.isInteger(total) && total > 0 && Number.isInteger(cumprido)
      ? Math.max(0, Math.min(100, Math.round(cumprido / total * 100))) : 0;
    var grafico = document.getElementById('grafico-progresso');
    document.getElementById('barra-progresso').style.width = percentual + '%';
    grafico.setAttribute('aria-valuenow', String(percentual));
    document.getElementById('rotulo-progresso').textContent =
      percentual + '% computado até ' + dataExibida(dataCalculo) + '.';
    document.getElementById('data-corte-resultado').textContent =
      'Pena total: ' + textoPena(resultado.penaTotal) + '. Computado até ' +
      dataExibida(dataCalculo) + ': ' + textoPena(resultado.cumprido) +
      '. Saldo: ' + textoPena(resultado.restante) + '.';
  }

  function exibirExtratoCreditos(resultado, destino) {
    destino.replaceChildren();
    [
      ['Detração reconhecida', resultado.detracaoDias, 'crédito'],
      ['Detração cautelar em dias', resultado.detracaoCautelarDias, 'crédito'],
      ['Remição homologada', resultado.remicaoDias, 'crédito'],
      ['Remição ainda não homologada', resultado.remicaoNaoHomologadaDias, 'crédito condicionado'],
      ['Comutação já concedida (E100 · CONFERIR)', resultado.comutacaoDias, 'abatimento'],
      ['Perda de remição', resultado.diasPerdidosRemicao, 'débito'],
      ['Dias de interrupção', resultado.interrupcaoDias, 'débito']
    ].forEach(function (item) {
      if (!Number.isInteger(item[1]) || item[1] === 0) return;
      mostrarDados(destino, [item[0], item[1] + ' dias · ' + item[2]]);
    });
    if (!destino.children.length) destino.appendChild(criarElemento('p', 'sem-dados', 'Não há abatimentos ou perdas registrados neste cálculo.'));
  }

  function memoriaDoResultado(resultado) {
    var memoria = [];
    if (Array.isArray(resultado.memoria)) memoria = memoria.concat(resultado.memoria);
    dadosComutacao(resultado).forEach(function (item) {
      memoria.push({ descricao: item[0] + ': ' + item[1] + '.', regra: 'E100' });
    });
    var comutacoes = resultado.comutacoesAplicadas;
    (Array.isArray(comutacoes) ? comutacoes : []).forEach(function (item) {
      memoria.push({
        descricao: 'Comutação já concedida · CONFERIR: ' + item.diasAplicados + ' dias aplicados; decreto ' +
          item.decreto + '; decisão de ' + dataExibida(item.dataDecisao) + '; ' +
          (item.condenacaoId ? 'condenação ' + item.condenacaoId : 'abatimento global') +
          (item.origem ? '; origem: ' + item.origem : '') + '.',
        regra: 'E100'
      });
    });
    if (resultado.memoriaTermino) {
      memoria.push({
        descricao: 'Término da pena.',
        regra: resultado.memoriaTermino.regra
      });
    }
    ['progressao', 'livramento', 'saidaTemporaria', 'termino'].forEach(function (chave) {
      var beneficio = resultado[chave];
      if (beneficio && Array.isArray(beneficio.memoria)) memoria = memoria.concat(beneficio.memoria);
    });
    return memoria.filter(function (item) {
      var regras = item && item.regra;
      regras = Array.isArray(regras) ? regras : [regras];
      return !regras.some(function (id) { return id === 'E60' || id === 'E61'; });
    });
  }

  function finalidadesSaida(beneficio) {
    var nomes = {
      visita_familia: 'visita à família',
      estudo: 'estudo',
      atividades_reintegracao: 'atividades de reintegração social'
    };
    return beneficio && Array.isArray(beneficio.finalidadesPermitidas)
      ? beneficio.finalidadesPermitidas.map(function (item) { return nomes[item] || item; }).join(', ') || 'Nenhuma finalidade indicada.'
      : 'Não informada.';
  }

  function condenacaoImpeditiva(beneficio) {
    var condenacao = beneficio && beneficio.condenacaoImpeditiva;
    if (!condenacao) return 'Nenhuma identificada pelo critério provisório.';
    var dados = [condenacao.id, condenacao.natureza, condenacao.dataFato && dataExibida(condenacao.dataFato),
      condenacao.emCumprimento ? 'pena ainda em cumprimento' : '', condenacao.fundamento]
      .filter(Boolean);
    return dados.join(' · ');
  }

  function dadosSaidaTemporaria(resultado) {
    if (!resultado.saidaTemporaria) return [];
    return [
      ['Finalidade admitida', finalidadesSaida(resultado.saidaTemporaria)],
      ['Condenação impeditiva', condenacaoImpeditiva(resultado.saidaTemporaria)]
    ];
  }

  function dadosVersoes(resultado) {
    return [
      ['Versão do núcleo', resultado.nucleoVersao || 'Não informada'],
      ['Versão da base de regras', resultado.regrasVersao || 'Não informada']
    ];
  }

  function dadosComutacao(resultado) {
    return Number.isInteger(resultado.comutacaoDias) && resultado.comutacaoDias > 0
      ? [['Comutação já concedida (E100 · CONFERIR)', resultado.comutacaoDias + ' dias']]
      : [];
  }

  function exibirCortesHistoricos(resultado, destino) {
    var secao = document.getElementById('cortes-historicos');
    var painelIndulto = document.getElementById('resultado-indulto');
    var visivel = !piloto || piloto.moduloVisivel('E70');
    if (!secao || !destino) return;
    secao.hidden = !visivel;
    destino.replaceChildren();
    if (painelIndulto) painelIndulto.hidden = true;
    if (!visivel) return;
    var tabela = criarElemento('table', 'q-tabela');
    var cabecalho = criarElemento('tr');
    ['Data de corte', 'Tempo cumprido', 'Restante', 'Ação'].forEach(function (titulo) {
      cabecalho.appendChild(criarElemento('th', '', titulo));
    });
    var thead = criarElemento('thead');
    thead.appendChild(cabecalho);
    tabela.appendChild(thead);
    var corpo = criarElemento('tbody');
    (Array.isArray(resultado.cortesHistoricos) ? resultado.cortesHistoricos : []).forEach(function (corte) {
      var linha = criarElemento('tr');
      linha.appendChild(criarElemento('td', '', dataExibida(corte.data)));
      linha.appendChild(criarElemento('td', '', corte.status === 'calculado'
        ? corte.diasCumpridos + ' dias' : corte.motivoNaoCalculado || 'Não calculado'));
      linha.appendChild(criarElemento('td', '', corte.status === 'calculado'
        ? corte.restanteDias + ' dias' : '—'));
      var acao = criarElemento('td');
      if (corte.status === 'calculado' && corte.usavelNoIndulto) {
        var botao = criarElemento('button', 'q-btn q-btn-outline', 'Usar no indulto');
        botao.type = 'button';
        botao.setAttribute('data-usar-indulto', corte.data);
        acao.appendChild(botao);
      } else if (corte.status === 'calculado') {
        acao.textContent = 'Sem decreto catalogado';
      } else {
        acao.textContent = '—';
      }
      linha.appendChild(acao);
      corpo.appendChild(linha);
    });
    tabela.appendChild(corpo);
    destino.appendChild(tabela);
    if (!corpo.children.length) destino.appendChild(criarElemento('p', 'sem-dados', 'Não há cortes históricos calculáveis.'));
  }

  function statusIndulto(status) {
    return status === 'candidato_a_conferir' ? 'Candidato indicado · a conferir'
      : status === 'sem_candidato_automatico' ? 'Sem candidato automático; isso não significa que não cabe.'
        : 'A conferir';
  }

  function exibirHipotesesIndulto(resultado, destino) {
    destino.replaceChildren();
    destino.appendChild(criarElemento('p', 'sub', statusIndulto(resultado && resultado.status)));
    var lista = criarElemento('ul');
    (resultado && Array.isArray(resultado.hipoteses) ? resultado.hipoteses : []).forEach(function (hipotese) {
      lista.appendChild(criarElemento('li', '', hipotese.artigo + ' · ' +
        statusIndulto(hipotese.status) + ' · ' + hipotese.criterio));
    });
    destino.appendChild(lista);
  }

  function exibirResultadoIndulto(resultado) {
    var painel = document.getElementById('resultado-indulto');
    if (!painel || !resultado) return;
    painel.hidden = false;
    var requisitos = resultado.requisitos || {};
    var resumo = document.getElementById('resumo-requisitos-indulto');
    resumo.replaceChildren();
    [
      ['Tempo cumprido no corte', Number.isInteger(requisitos.tempoCumpridoDias)
        ? requisitos.tempoCumpridoDias + ' dias · ' + (requisitos.origemTempo || 'a conferir') : 'A conferir'],
      ['Pena total', Number.isInteger(requisitos.penaTotalDias) ? requisitos.penaTotalDias + ' dias' : 'A conferir'],
      ['Parte impeditiva', Number.isInteger(requisitos.penaImpeditivaDias) ? requisitos.penaImpeditivaDias + ' dias' : 'A conferir'],
      ['Parte não impeditiva', Number.isInteger(requisitos.penaNaoImpeditivaDias) ? requisitos.penaNaoImpeditivaDias + ' dias' : 'A conferir'],
      ['Reincidência em 25/12', requisitos.reincidenteNaDataReferencia == null ? 'A conferir'
        : requisitos.reincidenteNaDataReferencia ? 'Sim' : 'Não'],
      ['Violência na data de referência', requisitos.violenciaNaDataReferencia == null ? 'A conferir'
        : requisitos.violenciaNaDataReferencia ? 'Sim' : 'Não'],
      ['Comutação anterior', requisitos.comutacaoAnterior == null ? 'A conferir'
        : requisitos.comutacaoAnterior ? 'Sim' : 'Não'],
      ['Pena alternativa', requisitos.penaAlternativa == null ? 'A conferir'
        : requisitos.penaAlternativa ? 'Sim' : 'Não'],
      ['Regime inicial aberto', requisitos.regimeInicialAberto == null ? 'A conferir'
        : requisitos.regimeInicialAberto ? 'Sim' : 'Não'],
      ['Regime atual', requisitos.regimeAtual || 'A conferir'],
      ['Saldo em livramento', Number.isInteger(requisitos.saldoLivramentoDias)
        ? requisitos.saldoLivramentoDias + ' dias' : 'A conferir']
    ].forEach(function (dado) { mostrarDados(resumo, dado); });
    exibirHipotesesIndulto(resultado.indulto, document.getElementById('hipoteses-indulto'));
    exibirHipotesesIndulto(resultado.comutacao, document.getElementById('hipoteses-comutacao'));
    var impedimentos = document.getElementById('impedimentos-indulto');
    impedimentos.replaceChildren();
    if (resultado.impedimentosEncontrados && resultado.impedimentosEncontrados.length) {
      resultado.impedimentosEncontrados.forEach(function (item) {
        impedimentos.appendChild(criarElemento('p', 'aviso-resultado',
          item.artigo + ' · impedimento identificado (' + (item.regra || 'E70') + ').'));
      });
    } else {
      impedimentos.appendChild(criarElemento('p', 'sub', 'Nenhum impedimento automático identificado; confira os itens pendentes.'));
    }
    var datasFalta = document.getElementById('datas-falta-indulto');
    datasFalta.replaceChildren();
    (resultado.faltaGrave && resultado.faltaGrave.datas || []).forEach(function (datas) {
      datasFalta.appendChild(criarElemento('p', 'sub',
        'Fato: ' + dataExibida(datas.fato) + ' · Instauração: ' + dataExibida(datas.instauracao) +
        ' · Reconhecimento judicial: ' + dataExibida(datas.reconhecimentoJudicial) +
        ' · Publicação do decreto: ' + dataExibida(datas.publicacaoDecreto)));
    });
    if (!datasFalta.children.length) datasFalta.appendChild(criarElemento('p', 'sub', 'Nenhuma falta grave informada.'));
    var conferir = document.getElementById('itens-conferir-indulto');
    conferir.replaceChildren();
    (Array.isArray(resultado.itensAConferir) ? resultado.itensAConferir : []).forEach(function (texto) {
      conferir.appendChild(criarElemento('li', '', texto));
    });
    if (!conferir.children.length) conferir.appendChild(criarElemento('li', '', 'Nenhum item pendente informado; revise o decreto e os autos.'));
  }

  function exibirResultado(resultado, elementos) {
    elementos.quadroDatas.replaceChildren();
    elementos.quadroSaldos.replaceChildren();
    elementos.linhaTempo.replaceChildren();
    elementos.memoria.replaceChildren();
    elementos.painel.hidden = false;
    elementos.status.textContent = resultado.status === 'a_conferir' || !resultado.status
      ? 'Resultado a conferir. Confira os dados e as regras antes de tomar qualquer decisão.'
      : 'Confira os dados e as regras antes de tomar qualquer decisão.';

    exibirAvisos(resultado.avisos, elementos.avisos, true);
    [
      ['Progressão', progressaoExibida(resultado.progressao)],
      ['Livramento condicional', beneficioExibido(resultado.livramento)],
      ['Saída temporária (requisito objetivo)', beneficioExibido(resultado.saidaTemporaria)],
      ['Término da pena', dataExibida(resultado.termino)]
    ].forEach(function (dado) {
      mostrarDados(elementos.quadroDatas, dado);
    });
    if (elementos.versoes) {
      elementos.versoes.replaceChildren();
      dadosVersoes(resultado).forEach(function (dado) {
        var linha = criarElemento('p', 'sub', dado[0]);
        linha.appendChild(criarElemento('span', 'versao-valor', dado[1]));
        elementos.versoes.appendChild(linha);
      });
    }
    var saldos = [
      ['Cumprido', textoPena(resultado.cumprido)],
      ['Restante', textoPena(resultado.restante)]
    ];
    if (Number.isInteger(resultado.detracaoDias)) {
      saldos.push(['Detração total', resultado.detracaoDias + ' dias']);
    }
    if (Number.isInteger(resultado.detracaoCautelarDias) && resultado.detracaoCautelarDias > 0) {
      saldos.push(['Detração cautelar (E27-A)', resultado.detracaoCautelarDias + ' dias']);
    }
    saldos.concat(dadosComutacao(resultado)).forEach(function (dado) { mostrarDados(elementos.quadroSaldos, dado); });

    if (Array.isArray(resultado.linhaDoTempo)) {
      resultado.linhaDoTempo.forEach(function (evento) {
        var item = criarElemento('li');
        item.appendChild(criarElemento('time', '', dataExibida(evento.data)));
        item.appendChild(document.createTextNode(String(evento.descricao || evento.tipo || 'Evento')));
        var link = linkRegra(evento.regra);
        if (link) {
          item.appendChild(document.createTextNode(' '));
          item.appendChild(link);
        }
        elementos.linhaTempo.appendChild(item);
      });
    }
    if (!elementos.linhaTempo.children.length) {
      elementos.linhaTempo.appendChild(criarElemento('li', 'sem-dados', 'O motor não informou eventos.'));
    }
    exibirMemoria(memoriaDoResultado(resultado), elementos.memoria);
    if (!elementos.memoria.children.length) {
      elementos.memoria.appendChild(criarElemento('p', 'sem-dados', 'O motor não informou a memória de cálculo.'));
    }
  }

  function exibirPrescricao(resultado, entrada) {
    var secao = document.getElementById('resultado-prescricao');
    var executoria = document.getElementById('prescricao-executoria');
    var interrupcoes = document.getElementById('prescricao-interrupcoes');
    var faltas = document.getElementById('prescricao-faltas');
    var visivel = !piloto || piloto.moduloVisivel('E80');
    var statusTexto = {
      dados_insuficientes: 'Faltam dados ou certidão',
      execucao_iniciada: 'Execução iniciada',
      pena_extinta: 'Pena extinta',
      extincao_declarada: 'Extinção já declarada',
      em_curso: 'Em curso',
      prescrita: 'Prazo encerrado'
    };
    secao.hidden = !visivel;
    if (!visivel) return;
    [executoria, interrupcoes, faltas].forEach(function (destino) {
      destino.replaceChildren();
    });
    (resultado.prescricaoExecutoria || []).forEach(function (item, indice) {
      var cartao = criarElemento('article', 'item-card');
      cartao.appendChild(criarElemento('h5', '', 'Crime ' + (item.condenacaoId || indice + 1)));
      cartao.appendChild(criarElemento('p', '', 'Marco inicial: ' +
        (item.termoInicial ? dataExibida(item.termoInicial) : 'não calculado')));
      if (item.marcoInicial) {
        cartao.appendChild(criarElemento('p', 'ajuda', item.marcoInicial.pergunta + ' ' + item.marcoInicial.explicacao));
      }
      cartao.appendChild(criarElemento('p', '', 'Prazo: ' +
        (Number.isInteger(item.prazoMeses) ? item.prazoMeses + ' meses' : 'não calculado')));
      cartao.appendChild(criarElemento('p', '', 'Reincidência: ' +
        (item.reincidente ? 'aumento provisório de 1/3 aplicado' : 'sem aumento por reincidência')));
      cartao.appendChild(criarElemento('p', '', 'Data: ' +
        (item.dataPrescricao ? dataExibida(item.dataPrescricao) : 'não calculada') +
        ' · Situação: ' + (statusTexto[item.status] || 'a conferir')));
      if (item.extincaoDeclarada) {
        cartao.appendChild(criarElemento('p', 'nota', 'Decisão que declarou a extinção preservada; não foi calculada nova data.'));
      }
      if (item.reducaoVedadaPorViolenciaSexual) {
        cartao.appendChild(criarElemento('p', 'nota', 'Redução pela idade não aplicada: violência sexual contra a mulher em fato desde 04/07/2025 (E80).'));
      }
      if (!item.causasConferidas) {
        cartao.appendChild(criarElemento('p', 'nota', 'Sem data até conferir as certidões, o início/continuação do cumprimento e as causas de interrupção ou suspensão.'));
      }
      executoria.appendChild(cartao);
    });
    if (!executoria.children.length) {
      executoria.appendChild(criarElemento('p', 'sem-dados', 'Nenhuma prescrição executória calculada.'));
    }
    var eventos = (resultado.linhaDoTempoPrescricao || []).filter(function (evento) {
      return ['inicio_execucao', 'evasao', 'recaptura'].includes(evento.tipo);
    });
    eventos.forEach(function (evento) {
      interrupcoes.appendChild(criarElemento('p', '', dataExibida(evento.data) + ' · ' + evento.descricao));
    });
    (entrada && Array.isArray(entrada.interrupcoes) ? entrada.interrupcoes : []).forEach(function (evento) {
      interrupcoes.appendChild(criarElemento('p', '',
        dataExibida(evento.inicio) + ' a ' + dataExibida(evento.fim) + ' · ' +
        (evento.motivo === 'fuga' ? 'fuga' : 'outra interrupção; exige análise documental')));
    });
    if (entrada && entrada.eventoE13 && entrada.eventoE13.situacao === 'suspenso') {
      interrupcoes.appendChild(criarElemento('p', '',
        'Livramento suspenso · causa não modelada; a prescrição não recebe data.'));
    }
    if ((resultado.prescricaoExecutoria || []).some(function (item) { return item.causasConferidas; })) {
      interrupcoes.appendChild(criarElemento('p', 'ajuda',
        'As certidões e as causas informadas foram conferidas para as condenações identificadas.'));
    }
    if (!interrupcoes.children.length) {
      interrupcoes.appendChild(criarElemento('p', 'sem-dados', 'Nenhum marco de interrupção informado; confira também suspensões e certidões nos autos.'));
    }
    (resultado.prescricaoFaltaGrave || []).forEach(function (item) {
      var cartao = criarElemento('article', 'item-card');
      cartao.appendChild(criarElemento('h5', '', 'Falta de ' + dataExibida(item.dataFalta)));
      cartao.appendChild(criarElemento('p', '', 'Marco inicial: ' +
        (item.termoInicial ? dataExibida(item.termoInicial) : 'não calculado') +
        (item.marcoInicial === 'recaptura' ? ' (recaptura)' : ' (data da falta)')));
      cartao.appendChild(criarElemento('p', '', 'Prazo: ' +
        (item.prazoAnos ? item.prazoAnos + ' anos' : 'não calculado') + ' · Data: ' +
        (item.dataPrescricao ? dataExibida(item.dataPrescricao) : 'não calculada') +
        ' · Situação: ' + (statusTexto[item.status] || 'a conferir')));
      if (item.status === 'dados_insuficientes') {
        cartao.appendChild(criarElemento('p', 'nota', 'Confira a certidão da data da falta e, se foi fuga, a data da recaptura.'));
      }
      faltas.appendChild(cartao);
    });
    if (!faltas.children.length) {
      faltas.appendChild(criarElemento('p', 'sem-dados', 'Nenhuma falta grave informada.'));
    }
  }

  function montarCenario(cenario) {
    var cartao = criarElemento('article', 'cenario-cartao');
    cartao.appendChild(criarElemento('h4', '', cenario.regra + ' · ' + cenario.titulo));
    var colunas = criarElemento('div', 'cenario-colunas');
    var lados = [
      ['defensiva', cenario.defensiva, 'Tese defensiva'],
      ['alternativa', cenario.alternativa, 'Tese alternativa']
    ];
    var vinculante = ladoVinculanteCenario(cenario);
    if (vinculante) {
      lados = lados.map(function (item) {
        return [item[0], item[1], item[0] === vinculante ? 'Resultado vinculante' : 'Tese vencida (nota)'];
      });
    }
    lados.forEach(function (item) {
      var coluna = criarElemento('section', 'cenario-coluna cenario-' + item[0]);
      coluna.appendChild(criarElemento('h5', '', item[2]));
      coluna.appendChild(criarElemento('strong', 'cenario-tese', item[1].tese));
      var resultado = item[1].resultado || {};
      var datas = criarElemento('div', 'cenario-datas');
      if (vinculante && item[0] !== vinculante) {
        datas.appendChild(criarElemento('p', 'nota', item[1].tese + '. ' + (item[1].precedente || '')));
        coluna.appendChild(datas);
        colunas.appendChild(coluna);
        return;
      }
      [
        ['Progressão', resultado.progressao && resultado.progressao.data],
        ['Livramento', resultado.livramento && resultado.livramento.data],
        ['Término', resultado.termino]
      ].forEach(function (dado) {
        mostrarDados(datas, [dado[0], dataExibida(dado[1])]);
      });
      coluna.appendChild(datas);
      var precedente = criarElemento('p', 'cenario-precedente');
      precedente.appendChild(criarElemento('strong', '', 'Fundamento: '));
      precedente.appendChild(document.createTextNode(item[1].precedente || 'Não informado.'));
      coluna.appendChild(precedente);
      colunas.appendChild(coluna);
    });
    cartao.appendChild(colunas);
    if (!vinculante) {
      var datasComparadas = [
        ['progressao', cenario.defensiva.resultado.progressao && cenario.defensiva.resultado.progressao.data,
          cenario.alternativa.resultado.progressao && cenario.alternativa.resultado.progressao.data],
        ['livramento', cenario.defensiva.resultado.livramento && cenario.defensiva.resultado.livramento.data,
          cenario.alternativa.resultado.livramento && cenario.alternativa.resultado.livramento.data],
        ['termino', cenario.defensiva.resultado.termino, cenario.alternativa.resultado.termino]
      ].find(function (item) { return item[1] && item[2] && item[1] !== item[2]; });
      if (datasComparadas) {
        cartao.appendChild(criarElemento('p', 'nota', 'Critério provisório: ' + cenario.defensiva.tese +
          '. A outra interpretação altera a data de ' + dataExibida(datasComparadas[1]) +
          ' para ' + dataExibida(datasComparadas[2]) + '.'));
      }
    }
    return cartao;
  }

  function ladoVinculanteCenario(cenario) {
    if (cenario.precedenteVinculante === 'defensiva' || cenario.precedenteVinculante === 'alternativa') {
      return cenario.precedenteVinculante;
    }
    return cenario.defensiva.precedenteVinculante === true ? 'defensiva'
      : cenario.alternativa.precedenteVinculante === true ? 'alternativa' : null;
  }

  function resultadoComPrecedenteVinculante(resultado, cenarios) {
    var cenario = (cenarios || []).find(ladoVinculanteCenario);
    if (!cenario) return resultado;
    var lado = ladoVinculanteCenario(cenario);
    return cenario[lado].resultado || resultado;
  }

  function cenarioProgressaoEspecial(entrada, resultado, calcular, dataCalculo, opcoes) {
    if (!Array.isArray(resultado.condenacoes) ||
        !resultado.condenacoes.some(function (item) { return item.regraPR === 'E37'; })) return null;
    var comum = JSON.parse(JSON.stringify(entrada));
    delete comum.progressaoEspecial;
    var alternativa = calcular(comum, dataCalculo, opcoes);
    if (!alternativa || alternativa.erros || !alternativa.progressao) return null;
    return {
      regra: 'E37',
      titulo: 'Progressão especial de 1/8',
      defensiva: {
        tese: 'Progressão especial de 1/8',
        precedente: 'LEP art. 112, § 3º',
        resultado: resultado
      },
      alternativa: {
        tese: 'Frações comuns',
        precedente: 'Critério comum de progressão',
        resultado: alternativa
      }
    };
  }

  function exibirCenarios(cenarios, destino, secao) {
    destino.replaceChildren();
    secao.hidden = !Array.isArray(cenarios) || !cenarios.length;
    if (secao.hidden) return;
    cenarios.forEach(function (cenario) {
      destino.appendChild(montarCenario(cenario));
    });
  }

  function complementarAvisosCenarios(resultado, cenarios) {
    if (!resultado || !Array.isArray(resultado.avisos)) return;
    (cenarios || []).forEach(function (cenario) {
      if (cenario.regra === 'E31' && /Violência na condenação anterior/.test(cenario.titulo)) {
        var data30 = cenario.alternativa.resultado.progressao &&
          cenario.alternativa.resultado.progressao.data || 'não calculada';
        resultado.avisos = resultado.avisos.map(function (aviso) {
          return aviso && aviso.regra === 'E31' &&
            /^25% como simulação defensiva condicionada se o antecedente/.test(aviso.texto)
            ? Object.assign({}, aviso, {
              texto: '25% como simulação defensiva condicionada se o antecedente gerador da reincidência foi sem violência ou grave ameaça. Com antecedente violento, a data a 30% é ' + data30 + '.'
            })
            : aviso;
        });
      }
      if (cenario.regra === 'E45') {
        var defensiva = cenario.defensiva.resultado.livramento &&
          cenario.defensiva.resultado.livramento.data || 'não calculada';
        var adversa = cenario.alternativa.resultado.livramento &&
          cenario.alternativa.resultado.livramento.data || 'não calculada';
        resultado.avisos = resultado.avisos.map(function (aviso) {
          return aviso && aviso.regra === 'E45'
            ? Object.assign({}, aviso, {
              texto: 'Primário com maus antecedentes. Mais de 1/3 pela posição defensiva: ' +
                defensiva + '. Mais de 1/2 pelo entendimento adverso: ' + adversa + '.'
            })
            : aviso;
        });
      }
    });
  }

  function atualizarImpressao(resultado, dataCalculo, cenarios, linhasConferencia, fonteOficial) {
    var impressao = document.getElementById('impressao');
    var resumo = document.getElementById('impressao-resumo');
    var destinoCenarios = document.getElementById('impressao-cenarios');
    var destinoConferencia = document.getElementById('impressao-conferencia');
    var tituloConferencia = document.getElementById('impressao-titulo-conferencia');
    resumo.replaceChildren();
    destinoCenarios.replaceChildren();
    destinoConferencia.replaceChildren();
    document.getElementById('impressao-data').textContent =
      'Data do cálculo: ' + dataExibida(dataCalculo);
    [
      ['Progressão', progressaoExibida(resultado.progressao)],
      ['Livramento condicional', beneficioExibido(resultado.livramento)],
      ['Saída temporária (requisito objetivo)', beneficioExibido(resultado.saidaTemporaria)],
      ['Término da pena', dataExibida(resultado.termino)]
    ].concat(dadosVersoes(resultado), dadosSaidaTemporaria(resultado), dadosComutacao(resultado)).forEach(function (dado) {
      var linha = criarElemento('tr');
      linha.appendChild(criarElemento('th', '', dado[0]));
      linha.appendChild(criarElemento('td', '', dado[1]));
      resumo.appendChild(linha);
    });
    exibirAvisos(resultado.avisos, document.getElementById('impressao-avisos'));
    var memoria = document.getElementById('impressao-memoria');
    memoria.replaceChildren();
    exibirMemoria(memoriaDoResultado(resultado), memoria);
    if (linhasConferencia && linhasConferencia.length) {
      destinoConferencia.appendChild(montarTabelaConferencia(linhasConferencia, fonteOficial));
    }
    tituloConferencia.hidden = !linhasConferencia || !linhasConferencia.length;
    if (cenarios.length) {
      destinoCenarios.appendChild(criarElemento('h2', '', 'Teses controvertidas'));
      destinoCenarios.appendChild(criarElemento('p', 'miudo', 'Cenários lado a lado; a tese defensiva vem primeiro.'));
      cenarios.forEach(function (cenario) {
        destinoCenarios.appendChild(montarCenario(cenario));
      });
    }
    impressao.hidden = false;
  }

  function lerCampoData(campo, obrigatorio) {
    var rotuloErro = campo.closest('.q-campo').querySelector('.erro-campo');
    var valor = campo.value.trim();
    campo.removeAttribute('aria-invalid');
    if (rotuloErro) rotuloErro.textContent = '';
    if (!valor && !obrigatorio) return null;
    try {
      return normalizarData(valor);
    } catch (erro) {
      campo.setAttribute('aria-invalid', 'true');
      if (rotuloErro) rotuloErro.textContent = erro.message;
      return undefined;
    }
  }

  function numero(campo) {
    var valor = Number(campo.value);
    if (!Number.isInteger(valor) || valor < 0) {
      campo.setAttribute('aria-invalid', 'true');
      var mensagemErro = campo.closest('.q-campo').querySelector('.erro-campo');
      if (mensagemErro) mensagemErro.textContent = 'Informe um número inteiro igual ou maior que zero.';
      throw new Error('Informe um número inteiro igual ou maior que zero.');
    }
    campo.removeAttribute('aria-invalid');
    var mensagem = campo.closest('.q-campo').querySelector('.erro-campo');
    if (mensagem) mensagem.textContent = '';
    return valor;
  }

  function valorCampo(linha, nome) {
    return linha.querySelector('[data-campo="' + nome + '"]');
  }

  function booleanoTexto(valor) {
    return valor === 'true' ? true : valor === 'false' ? false : null;
  }

  function converterBooleanos(registro, campos) {
    campos.forEach(function (nome) {
      var valor = booleanoTexto(registro[nome]);
      if (valor === null) delete registro[nome];
      else registro[nome] = valor;
    });
  }

  function lerLinhas(formulario, nome, configuracao, erros) {
    var linhas = Array.prototype.slice.call(formulario.querySelectorAll('#' + nome + ' .item-card'));
    var saida = [];
    linhas.forEach(function (linha, indice) {
      var resultado = {};
      var preenchido = false;
      configuracao.datas.forEach(function (campo) {
        var entrada = valorCampo(linha, campo.nome);
        var valor = lerCampoData(entrada, campo.obrigatorio);
        if (valor === undefined) erros.push(entrada);
        if (valor) {
          resultado[campo.nome] = valor;
          preenchido = true;
        }
      });
      configuracao.numeros.forEach(function (nomeCampo) {
        var entrada = valorCampo(linha, nomeCampo);
        try {
          resultado[nomeCampo] = numero(entrada);
          if (Number(entrada.value) > 0) preenchido = true;
        } catch (_) {
          erros.push(entrada);
        }
      });
      configuracao.textos.forEach(function (nomeCampo) {
        resultado[nomeCampo] = valorCampo(linha, nomeCampo).value;
      });
      configuracao.caixas.forEach(function (nomeCampo) {
        var caixa = valorCampo(linha, nomeCampo);
        resultado[nomeCampo] = caixa.indeterminate ? null : caixa.checked;
        if (resultado[nomeCampo]) preenchido = true;
      });
      if (preenchido || nome === 'condenacoes') {
        if (nome === 'condenacoes') {
          var registro = integracaoLinhas.get(linha);
          resultado.id = registro && registro.original.id || linha.getAttribute('data-condenacao-id') || 'c' + (indice + 1);
          if (integracaoEntrada && !registro) {
            if (!integracaoNovosIds.has(linha)) {
              var novoId;
              do { novoId = 'integracao-' + proximoIdIntegracao++; }
              while (integracaoEntrada.condenacoes.some(function (item) { return item.id === novoId; }));
              integracaoNovosIds.set(linha, novoId);
            }
            resultado.id = integracaoNovosIds.get(linha);
          }
        }
        linhasColetadas.set(linha, resultado);
        saida.push(resultado);
      }
    });
    return saida;
  }

  function formatarProcesso(valor) {
    var digitos = String(valor || '').replace(/\D/g, '').slice(0, 20);
    var grupos = [7, 2, 4, 1, 2, 4];
    var separadores = ['-', '.', '.', '.', '.'];
    var resultado = '';
    var posicao = 0;
    grupos.forEach(function (tamanho, indice) {
      if (posicao >= digitos.length) return;
      if (indice && resultado.length) resultado += separadores[indice - 1];
      resultado += digitos.slice(posicao, posicao + tamanho);
      posicao += tamanho;
    });
    return resultado;
  }

  function coletarComutacoes(formulario, erros) {
    var saida = [];
    formulario.querySelectorAll('#comutacoes .item-card').forEach(function (linha) {
      var campos = ['dias', 'decreto', 'dataDecisao', 'condenacaoId', 'origem'];
      var preenchido = campos.some(function (nome) { return valorCampo(linha, nome).value.trim() !== ''; });
      campos.forEach(function (nome) {
        var campo = valorCampo(linha, nome);
        campo.removeAttribute('aria-invalid');
        campo.closest('.q-campo').querySelector('.erro-campo').textContent = '';
      });
      if (!preenchido) return;
      var item = {};
      function erroCampo(nome, mensagem) {
        var campo = valorCampo(linha, nome);
        campo.setAttribute('aria-invalid', 'true');
        campo.closest('.q-campo').querySelector('.erro-campo').textContent = mensagem;
        erros.push(campo);
      }
      item.dias = Number(valorCampo(linha, 'dias').value);
      if (!Number.isSafeInteger(item.dias) || item.dias <= 0) {
        erroCampo('dias', 'Dias abatidos: informe um número inteiro maior que zero.');
      }
      ['decreto', 'origem'].forEach(function (nome) {
        item[nome] = valorCampo(linha, nome).value.trim();
        if (!item[nome]) erroCampo(nome, nome === 'decreto'
          ? 'Decreto: informe o decreto citado na decisão.'
          : 'Origem: informe onde está a decisão de comutação.');
      });
      var campoData = valorCampo(linha, 'dataDecisao');
      item.dataDecisao = lerCampoData(campoData, true);
      if (item.dataDecisao === undefined) erros.push(campoData);
      var condenacaoId = valorCampo(linha, 'condenacaoId').value.trim();
      if (condenacaoId) item.condenacaoId = condenacaoId;
      linhasColetadas.set(linha, item);
      saida.push(item);
    });
    return saida;
  }

  function carregarCasoLocal() {
    try {
      var caso = JSON.parse(localStorage.getItem('calcpenal:caso') || '{}');
      document.getElementById('pessoa-executada').value = caso.pessoa || '';
      document.getElementById('processo-execucao').value = formatarProcesso(caso.processo);
      document.getElementById('juizo-execucao').value = caso.juizo || '';
      document.getElementById('dados-conferidos').checked = caso.conferido === true;
    } catch (_) {}
  }

  function salvarCasoLocal() {
    if (integracaoAtiva) return; // I04: dados recebidos ficam apenas na memória.
    var campos = {
      pessoa: document.getElementById('pessoa-executada').value,
      processo: document.getElementById('processo-execucao').value,
      juizo: document.getElementById('juizo-execucao').value,
      conferido: document.getElementById('dados-conferidos').checked
    };
    try {
      DadosCasos.salvarIdentificacao(localStorage, campos, new Date());
      document.getElementById('status-caso').textContent = 'Identificação salva somente neste navegador.';
    } catch (_) {
      document.getElementById('status-caso').textContent = 'Não foi possível salvar neste navegador.';
    }
  }

  function coletarEntrada(formulario, semFoco) {
    linhasColetadas = new WeakMap();
    var erros = [];
    var campoProcesso = document.getElementById('processo-execucao');
    var processo = campoProcesso.value.trim();
    var erroProcesso = campoProcesso.closest('.q-campo').querySelector('.erro-campo');
    campoProcesso.removeAttribute('aria-invalid');
    erroProcesso.textContent = '';
    if (processo && !/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(processo)) {
      campoProcesso.setAttribute('aria-invalid', 'true');
      erroProcesso.textContent = 'Informe o número CNJ completo ou deixe o campo vazio.';
      erros.push(campoProcesso);
    }
    var condenacoes = lerLinhas(formulario, 'condenacoes', {
      datas: [{ nome: 'dataFato', obrigatorio: true },
        { nome: 'dataTransitoAcusacao' }, { nome: 'dataTransito' }],
      numeros: ['pena.anos', 'pena.meses', 'pena.dias'],
      textos: ['natureza', 'reincidencia', 'antecedenteViolento', 'regimeInicial', 'lei15358LC',
        'hediondoNaDataDoFato', 'impeditivoDecreto'],
      caixas: ['bonsAntecedentes', 'equiparado', 'tituloXII', 'emCumprimento']
    }, erros);
    Array.prototype.forEach.call(formulario.querySelectorAll('#condenacoes .item-card'), function (linha, indice) {
      var item = condenacoes[indice];
      if (!item) return;
      converterBooleanos(item, ['hediondoNaDataDoFato', 'impeditivoDecreto']);
      item.pena = {
        anos: item['pena.anos'],
        meses: item['pena.meses'],
        dias: item['pena.dias']
      };
      delete item['pena.anos'];
      delete item['pena.meses'];
      delete item['pena.dias'];
      ['idadeNaDataFato', 'idadeNaSentenca'].forEach(function (nome) {
        var campo = linha.querySelector('[data-prescricao-idade="' + nome + '"]');
        if (!campo || !campo.value.trim()) return;
        var idade = Number(campo.value);
        if (!Number.isInteger(idade) || idade < 0) {
          campo.setAttribute('aria-invalid', 'true');
          campo.closest('.q-campo').querySelector('.erro-campo').textContent =
            'Informe uma idade inteira e não negativa.';
          erros.push(campo);
          return;
        }
        campo.removeAttribute('aria-invalid');
        campo.closest('.q-campo').querySelector('.erro-campo').textContent = '';
        item[nome] = idade;
      });
      var camposRestante = ['anos', 'meses', 'dias'].map(function (parte) {
        return linha.querySelector('[data-prescricao-restante="' + parte + '"]');
      });
      if (camposRestante.some(function (campo) { return campo && campo.value.trim(); })) {
        var restante = {};
        camposRestante.forEach(function (campo, posicao) {
          var valor = Number(campo && campo.value);
          if (!Number.isInteger(valor) || valor < 0) {
            campo.setAttribute('aria-invalid', 'true');
            campo.closest('.q-campo').querySelector('.erro-campo').textContent =
              'Informe um número inteiro igual ou maior que zero.';
            erros.push(campo);
            return;
          }
          campo.removeAttribute('aria-invalid');
          campo.closest('.q-campo').querySelector('.erro-campo').textContent = '';
          restante[['anos', 'meses', 'dias'][posicao]] = valor;
        });
        if (Object.keys(restante).length === 3) item.penaRestante = restante;
      }
    });

    var prisoes = lerLinhas(formulario, 'prisoes', {
      datas: [{ nome: 'inicio' }, { nome: 'fim' }],
      numeros: [],
      textos: ['tipo', 'saldosCondenacoesTexto'],
      caixas: []
    }, erros);
    var indicePrisaoPreenchida = 0;
    Array.prototype.forEach.call(formulario.querySelectorAll('#prisoes .item-card'), function (linha) {
      if (!valorCampo(linha, 'inicio').value.trim() && !valorCampo(linha, 'fim').value.trim()) return;
      var campoSaldo = valorCampo(linha, 'saldosCondenacoesTexto');
      var textoSaldo = campoSaldo.value.trim();
      var indice = indicePrisaoPreenchida++;
      if (!prisoes[indice]) return;
      delete prisoes[indice].saldosCondenacoesTexto;
      if (!textoSaldo) return;
      var saldos = textoSaldo.split(';').map(function (item) {
        var partes = item.trim().match(/^([^=;\s]+)\s*=\s*(\d+)$/);
        return partes ? { condenacaoId: partes[1], dias: Number(partes[2]) } : null;
      });
      if (saldos.some(function (item) { return !item || !Number.isSafeInteger(item.dias); })) {
        campoSaldo.setAttribute('aria-invalid', 'true');
        campoSaldo.closest('.q-campo').querySelector('.erro-campo').textContent =
          'Informe cada saldo como código=dias, separado por ponto e vírgula.';
        erros.push(campoSaldo);
        return;
      }
      campoSaldo.removeAttribute('aria-invalid');
      campoSaldo.closest('.q-campo').querySelector('.erro-campo').textContent = '';
      prisoes[indice].saldosCondenacoes = saldos;
    });
    var interrupcoes = lerLinhas(formulario, 'interrupcoes', {
      datas: [{ nome: 'inicio' }, { nome: 'fim' }],
      numeros: [],
      textos: ['motivo'],
      caixas: []
    }, erros);
    var detracoes = lerLinhas(formulario, 'detracoes', {
      datas: [{ nome: 'inicio' }, { nome: 'fim' }],
      numeros: [],
      textos: [],
      caixas: []
    }, erros);
    var remicoes = lerLinhas(formulario, 'remicoes', {
      datas: [{ nome: 'dataHomologacao' }],
      numeros: ['dias'],
      textos: [],
      caixas: ['homologada']
    }, erros);
    var comutacoes = coletarComutacoes(formulario, erros);
    var faltasGraves = lerLinhas(formulario, 'faltasGraves', {
      datas: [
        { nome: 'data' }, { nome: 'dataRecaptura' },
        { nome: 'dataInstauracao' }, { nome: 'dataReconhecimentoJudicial' }
      ],
      numeros: ['diasPerdidosRemicao'],
      textos: ['tipo', 'saldosCondenacoesTexto', 'sancaoReconhecida', 'semMoraEstatal'],
      caixas: ['homologada']
    }, erros);
    faltasGraves.forEach(function (item) {
      converterBooleanos(item, ['sancaoReconhecida', 'semMoraEstatal']);
    });
    var indiceFaltaPreenchida = 0;
    Array.prototype.forEach.call(
      formulario.querySelectorAll('#faltasGraves .item-card'),
      function (linha) {
        var temDados = ['data', 'dataRecaptura'].some(function (nome) {
          return valorCampo(linha, nome).value.trim() !== '';
        }) || Number(valorCampo(linha, 'diasPerdidosRemicao').value) > 0 ||
          valorCampo(linha, 'homologada').checked;
        if (!temDados) return;
        var indice = indiceFaltaPreenchida++;
        var campoSaldo = valorCampo(linha, 'saldosCondenacoesTexto');
        var textoSaldo = campoSaldo.value.trim();
        if (!faltasGraves[indice]) return;
        delete faltasGraves[indice].saldosCondenacoesTexto;
        if (!textoSaldo) return;
        var saldos = textoSaldo.split(';').map(function (item) {
          var partes = item.trim().match(/^([^=;\s]+)\s*=\s*(\d+)$/);
          return partes ? { condenacaoId: partes[1], dias: Number(partes[2]) } : null;
        });
        if (saldos.some(function (item) { return !item || !Number.isSafeInteger(item.dias); })) {
          campoSaldo.setAttribute('aria-invalid', 'true');
          campoSaldo.closest('.q-campo').querySelector('.erro-campo').textContent =
            'Informe cada saldo como código=dias, separado por ponto e vírgula.';
          erros.push(campoSaldo);
          return;
        }
        campoSaldo.removeAttribute('aria-invalid');
        campoSaldo.closest('.q-campo').querySelector('.erro-campo').textContent = '';
        faltasGraves[indice].saldosCondenacoes = saldos;
      }
    );
    var progressoes = lerLinhas(formulario, 'progressoes', {
      datas: [{ nome: 'data' }, { nome: 'dataRequisitoSubjetivo' }, { nome: 'dataBaseReconhecida' }],
      numeros: [],
      textos: ['para'],
      caixas: []
    }, erros);
    var regressoes = lerLinhas(formulario, 'regressoes', {
      datas: [{ nome: 'data' }],
      numeros: [],
      textos: ['de', 'para', 'saldosCondenacoesTexto'],
      caixas: []
    }, erros);
    var indiceRegressaoPreenchida = 0;
    Array.prototype.forEach.call(formulario.querySelectorAll('#regressoes .item-card'), function (linha) {
      if (!valorCampo(linha, 'data').value.trim()) return;
      var campoSaldo = valorCampo(linha, 'saldosCondenacoesTexto');
      var textoSaldo = campoSaldo.value.trim();
      var indice = indiceRegressaoPreenchida++;
      if (!regressoes[indice]) return;
      delete regressoes[indice].saldosCondenacoesTexto;
      if (!textoSaldo) return;
      var saldos = textoSaldo.split(';').map(function (item) {
        var partes = item.trim().match(/^([^=;\s]+)\s*=\s*(\d+)$/);
        return partes ? { condenacaoId: partes[1], dias: Number(partes[2]) } : null;
      });
      if (saldos.some(function (item) { return !item || !Number.isSafeInteger(item.dias); })) {
        campoSaldo.setAttribute('aria-invalid', 'true');
        campoSaldo.closest('.q-campo').querySelector('.erro-campo').textContent =
          'Informe cada saldo como código=dias, separado por ponto e vírgula.';
        erros.push(campoSaldo);
        return;
      }
      campoSaldo.removeAttribute('aria-invalid');
      campoSaldo.closest('.q-campo').querySelector('.erro-campo').textContent = '';
      regressoes[indice].saldosCondenacoes = saldos;
    });
    var atestadoSEEU = coletarAtestado(erros);
    var cautelarTexto = document.getElementById('detracao-cautelar-json').value;
    var detracoesCautelares = [];
    if (cautelarTexto) {
      try {
        detracoesCautelares = JSON.parse(cautelarTexto);
        if (!Array.isArray(detracoesCautelares)) throw new Error('Formato inválido.');
      } catch (_) {
        document.getElementById('status-detracao-cautelar').textContent =
          'A transferência está inválida. Refaça o envio pela calculadora cautelar.';
      }
    }
    var dataCalculoCampo = document.getElementById('data-calculo');
    var dataCalculo = lerCampoData(dataCalculoCampo, true);
    if (dataCalculo === undefined) erros.push(dataCalculoCampo);
    var progressaoEspecial;
    if (document.getElementById('e37-solicitada').checked) {
      progressaoEspecial = { solicitada: true };
      formulario.querySelectorAll('[data-e37]').forEach(function (campo) {
        progressaoEspecial[campo.getAttribute('data-e37')] = campo.value === ''
          ? null : campo.value === 'true';
      });
      progressaoEspecial.eventosRevogadores = [];
      ['novo_crime_doloso', 'falta_grave'].forEach(function (tipo) {
        var campoData = formulario.querySelector('[data-e37-evento-data="' + tipo + '"]');
        var campoSituacao = formulario.querySelector('[data-e37-evento-situacao="' + tipo + '"]');
        var data = lerCampoData(campoData, false);
        if (data === undefined) erros.push(campoData);
        if (data || campoSituacao.value) {
          progressaoEspecial.eventosRevogadores.push({
            tipo: tipo,
            data: data || null,
            situacao: campoSituacao.value || null
          });
        }
      });
    }
    var eventoE13;
    if (document.getElementById('e13-ativo').checked) {
      var situacaoE13 = document.getElementById('e13-situacao').value;
      var unificadasE13 = document.getElementById('e13-unificadas').value;
      var dataCrimeE13 = lerCampoData(document.getElementById('e13-data-crime'), true);
      var inicioPeriodoE13 = lerCampoData(document.getElementById('e13-inicio-periodo'), true);
      var fimPeriodoE13 = lerCampoData(document.getElementById('e13-fim-periodo'), true);
      var dataPrisaoE13 = lerCampoData(document.getElementById('e13-data-prisao'), false);
      var dataDecisaoE13 = lerCampoData(document.getElementById('e13-data-decisao'),
        situacaoE13 === 'suspenso' || situacaoE13 === 'revogado' || unificadasE13 === 'true');
      [[dataCrimeE13, 'e13-data-crime'], [inicioPeriodoE13, 'e13-inicio-periodo'],
        [fimPeriodoE13, 'e13-fim-periodo'], [dataPrisaoE13, 'e13-data-prisao'],
        [dataDecisaoE13, 'e13-data-decisao']].forEach(function (item) {
        if (item[0] === undefined) erros.push(document.getElementById(item[1]));
      });
      eventoE13 = {
        crimeDurante: true,
        dataCrime: dataCrimeE13,
        inicioPeriodoProva: inicioPeriodoE13,
        fimPeriodoProva: fimPeriodoE13,
        dataPrisao: dataPrisaoE13 || null,
        condenacaoId: document.getElementById('e13-condenacao-id').value.trim() || null,
        situacao: situacaoE13,
        penasUnificadas: unificadasE13 === '' ? null : unificadasE13 === 'true',
        dataDecisao: dataDecisaoE13 || null
      };
    }
    if (erros.length && !semFoco) {
      erros[0].focus();
    }
    var indulto = {};
    [
      ['reincidenteNaDataReferencia', 'indulto-reincidente'],
      ['violenciaNaDataReferencia', 'indulto-violencia'],
      ['comutacaoAnterior', 'indulto-comutacao-anterior'],
      ['penaAlternativa', 'indulto-pena-alternativa'],
      ['emLivramento', 'indulto-em-livramento'],
      ['suspensaoCondicional', 'indulto-suspensao-condicional']
    ].forEach(function (item) {
      var campo = document.getElementById(item[1]);
      if (campo && campo.value !== '') indulto[item[0]] = campo.value === 'true';
    });
    [
      ['tempoCumpridoDias', 'indulto-tempo-cumprido'],
      ['saldoLivramentoDias', 'indulto-saldo-livramento'],
      ['tempoIninterruptoDias', 'indulto-tempo-ininterrupto'],
      ['tempoSemiabertoIninterruptoDias', 'indulto-tempo-semiaberto'],
      ['diasEmLiberdade', 'indulto-dias-liberdade']
    ].forEach(function (item) {
      var campo = document.getElementById(item[1]);
      var valor = campo && campo.value.trim();
      if (!valor) return;
      var quantidade = Number(valor);
      if (!Number.isSafeInteger(quantidade) || quantidade < 0) {
        campo.setAttribute('aria-invalid', 'true');
        var mensagem = campo.closest('.q-campo').querySelector('.erro-campo');
        if (mensagem) mensagem.textContent = 'Informe um número inteiro igual ou maior que zero.';
        erros.push(campo);
      } else {
        campo.removeAttribute('aria-invalid');
        indulto[item[0]] = quantidade;
      }
    });
    [
      ['requisitosPorArtigo', 'data-indulto-requisito'],
      ['impedimentosPorArtigo', 'data-indulto-impedimento']
    ].forEach(function (item) {
      var valores = {};
      Array.prototype.forEach.call(document.querySelectorAll('[' + item[1] + ']'), function (campo) {
        if (campo.value !== '') valores[campo.getAttribute(item[1])] = campo.value === 'true';
      });
      if (Object.keys(valores).length) indulto[item[0]] = valores;
    });
    var entrada = {
      formato: 'calcpen',
      versao: 1,
      condenacoes: condenacoes,
      prisoes: prisoes,
      interrupcoes: interrupcoes,
      detracoes: detracoes,
      detracoesCautelares: detracoesCautelares,
      remicoes: remicoes,
      faltasGraves: faltasGraves,
      progressoes: progressoes,
      regressoes: regressoes,
      eventoE13: eventoE13,
      progressaoEspecial: progressaoEspecial,
      regimeAtual: document.getElementById('regime-atual').value
    };
    if (comutacoes.length) entrada.comutacoes = comutacoes;
    entrada.faltasGravesVerificadas =
      document.getElementById('faltas-graves-verificadas').checked;
    if (Object.keys(indulto).length) entrada.indulto = indulto;
    if (processo) entrada.processo = processo;
    if (atestadoSEEU) entrada.atestadoSEEU = atestadoSEEU;
    return { entrada: entrada, dataCalculo: dataCalculo, erros: erros.length ? erros : undefined };
  }

  function coletarAtestado(erros) {
    var atestado = {};
    ['progressao', 'livramento', 'saidaTemporaria', 'termino'].forEach(function (nome) {
      var campo = document.getElementById('atestado-' + nome);
      var valor = lerCampoData(campo, false);
      if (valor === undefined) erros.push(campo);
      else if (valor) atestado[nome] = valor;
    });
    ['penaTotalDias', 'penaCumpridaDias', 'detracaoDias', 'remicaoDias'].forEach(function (nome) {
      var campo = document.getElementById('atestado-' + nome);
      var valor = campo.value.trim();
      campo.removeAttribute('aria-invalid');
      var mensagem = campo.closest('.q-campo').querySelector('.erro-campo');
      if (mensagem) mensagem.textContent = '';
      if (!valor) return;
      var quantidade = Number(valor);
      if (!Number.isInteger(quantidade) || quantidade < 0) {
        campo.setAttribute('aria-invalid', 'true');
        if (mensagem) mensagem.textContent = 'Informe um número inteiro igual ou maior que zero.';
        erros.push(campo);
        return;
      }
      atestado[nome] = quantidade;
    });
    var origem = document.getElementById('atestado-origem').value.trim();
    if (!Object.keys(atestado).length) return null;
    if (origem) atestado.origem = origem;
    return atestado;
  }

  function opcoesAtuais() {
    var porCondenacao = Object.create(null);
    Array.prototype.forEach.call(document.querySelectorAll('#condenacoes .item-card'), function (linha, indice) {
      var registro = linhasColetadas.get(linha);
      var id = registro && registro.id || 'c' + (indice + 1);
      var revogacao = linha.querySelector('[data-prescricao-revogacao]').value;
      var dadosRevogacao = { ocorreu: revogacao === 'sim' };
      if (revogacao === 'sim' && document.getElementById('e13-situacao').value === 'revogado') {
        var dataDecisao = lerCampoData(document.getElementById('e13-data-decisao'), false);
        if (dataDecisao) dadosRevogacao.data = dataDecisao;
      }
      porCondenacao[id] = {
        violenciaSexualContraMulher: linha.querySelector('[data-prescricao-violencia-sexual]').value,
        certidoesConferidas: linha.querySelector('[data-prescricao-certidoes]').value === 'true',
        outrasCausas: linha.querySelector('[data-prescricao-outras-causas]').value,
        extincaoDeclarada: linha.querySelector('[data-prescricao-extincao]').value,
        revogacaoLivramento: dadosRevogacao
      };
    });
    var faltas = [];
    Array.prototype.forEach.call(document.querySelectorAll('#faltasGraves .item-card'), function (linha) {
      if (!linhasColetadas.has(linha)) return;
      faltas.push({
        certidaoConferida: linha.querySelector('[data-prescricao-falta-certidao]').value === 'true'
      });
    });
    var opcoes = {
      modulosProvisorios: modulos.ids.filter(function (id) { return piloto.moduloVisivel(id); }),
      convencaoDias: document.getElementById('convencao-dias').value,
      menos1Beneficio: document.getElementById('menos-um').checked,
      arredondamento: document.getElementById('arredondamento').value,
      metodoProgressao: document.getElementById('metodo-progressao').value,
      prescricao: { porCondenacao: porCondenacao, faltas: faltas }
    };
    if (typeof comutacaoAlteraBaseBeneficios === 'boolean') {
      opcoes.comutacaoAlteraBaseBeneficios = comutacaoAlteraBaseBeneficios;
    }
    return opcoes;
  }

  function valoresAtestadoCopilot(atestado) {
    var valores = {};
    ['progressao', 'livramento', 'termino'].forEach(function (nome) {
      valores[nome] = dataExibida(atestado[nome]) === 'Não calculada' ? '' : dataExibida(atestado[nome]);
    });
    ['penaTotalDias', 'penaCumpridaDias', 'detracaoDias', 'remicaoDias'].forEach(function (nome) {
      valores[nome] = atestado[nome] == null ? '' : String(atestado[nome]);
    });
    valores.origem = atestado.origem || '';
    return valores;
  }

  function temDadosAtestadoCopilot(atestado) {
    return ['progressao', 'livramento', 'termino'].some(function (nome) {
      return typeof atestado[nome] === 'string';
    }) || ['penaTotalDias', 'penaCumpridaDias', 'detracaoDias', 'remicaoDias'].some(function (nome) {
      return Number.isInteger(atestado[nome]);
    });
  }

  function classificarDiferenca(diferenca) {
    if (!Number.isInteger(diferenca)) return 'nao_comparavel';
    if (diferenca === 0) return 'igual';
    return Math.abs(diferenca) <= 3 ? 'pequena' : 'relevante';
  }

  function rotuloFonteOficial() {
    return document.getElementById('fonte-calculo-oficial').value === 'tjsp' ? 'TJSP/SAJ' : 'SEEU';
  }

  function atualizarTituloConferencia() {
    document.getElementById('titulo-resultado-atestado').textContent =
      rotuloFonteOficial() + ' × calculadora';
  }

  function montarLinhasConferencia(resultado, atestado, conferenciaDatas) {
    var linhas = [];
    [
      ['progressao', 'Progressão prevista'],
      ['livramento', 'Livramento previsto'],
      ['saidaTemporaria', 'Saída temporária prevista'],
      ['termino', 'Término previsto']
    ].forEach(function (item) {
      var nome = item[0];
      if (!atestado || !atestado[nome]) return;
      var explicacao = (conferenciaDatas || []).find(function (linha) { return linha.item === nome; });
      var nossa = nome === 'termino' ? resultado.termino : resultado[nome] && resultado[nome].data;
      var diferenca = explicacao ? explicacao.diferencaDias : null;
      var divergenciaCabimento = explicacao && explicacao.classe === 'divergencia_cabimento';
      linhas.push({
        item: nome,
        rotulo: item[1],
        seeu: dataExibida(atestado[nome]),
        nossa: divergenciaCabimento ? 'Não cabe: ' + explicacao.causaProvavel : dataExibida(nossa),
        diferencaDias: diferenca,
        classe: explicacao && explicacao.classe || classificarDiferenca(diferenca),
        classificacao: explicacao && explicacao.classificacao ||
          (diferenca === 0 ? 'igual' : Number.isInteger(diferenca) ? 'sem_explicacao' : 'nao_comparavel'),
        explicacao: explicacao && explicacao.explicacao || null,
        possibilidades: explicacao && explicacao.possibilidades || [],
        dadoPendente: explicacao && explicacao.dadoPendente || null,
        causaProvavel: explicacao && explicacao.causaProvavel || null,
        regra: explicacao && explicacao.regra || null,
        hipoteses: explicacao ? explicacao.hipoteses : []
      });
    });
    [
      ['penaTotalDias', 'Pena total (dias)', resultado.penaTotal && resultado.penaTotal.emDias],
      ['penaCumpridaDias', 'Pena cumprida (dias)', resultado.cumprido && resultado.cumprido.emDias],
      ['detracaoDias', 'Detração (dias)', resultado.detracaoDias],
      ['remicaoDias', 'Remição (dias)', resultado.remicaoDias]
    ].forEach(function (item) {
      var nome = item[0];
      if (!atestado || !Number.isInteger(atestado[nome])) return;
      var calculado = Number.isInteger(item[2]) ? item[2] : null;
      var diferenca = calculado === null ? null : calculado - atestado[nome];
      linhas.push({
        item: nome,
        rotulo: item[1],
        seeu: String(atestado[nome]),
        nossa: calculado === null ? 'Não calculado' : String(calculado),
        diferencaDias: diferenca,
        classe: classificarDiferenca(diferenca),
        classificacao: diferenca === 0 ? 'igual' : Number.isInteger(diferenca) ? 'sem_explicacao' : 'nao_comparavel',
        explicacao: null,
        hipoteses: []
      });
    });
    return linhas;
  }

  function textoDiferenca(diferenca) {
    if (!Number.isInteger(diferenca)) return '—';
    if (diferenca === 0) return '0 dias';
    return (diferenca > 0 ? '+' : '−') + Math.abs(diferenca) + (Math.abs(diferenca) === 1 ? ' dia' : ' dias');
  }

  function rotuloClasse(classe) {
    return {
      igual: 'Igual',
      pequena: 'Pequena (1–3 dias)',
      relevante: 'Relevante (mais de 3 dias)',
      divergencia_cabimento: 'Divergência de cabimento',
      nao_comparavel: 'Não comparável'
    }[classe] || 'Não comparável';
  }

  function rotuloClassificacao(classificacao) {
    return {
      igual: 'Igual',
      diferenca_convencao: 'Diferença de convenção de contagem',
      divergencia_juridica: 'Divergência jurídica',
      falta_confirmar_dado: 'Falta confirmar dado',
      sem_explicacao: 'Sem explicação',
      nao_comparavel: 'Não comparável'
    }[classificacao] || 'Não comparável';
  }

  function textoExplicacao(linha) {
    if (linha.explicacao && linha.classificacao !== 'falta_confirmar_dado') return linha.explicacao;
    if (linha.classificacao === 'falta_confirmar_dado') {
      var possibilidades = (linha.possibilidades || []).map(function (item) {
        return item.descricao.replace(/\d{4}-\d{2}-\d{2}/g, dataExibida);
      });
      return 'Falta confirmar ' + (linha.dadoPendente || 'o dado indicado') +
        (possibilidades.length ? '; datas possíveis: ' + possibilidades.join('; ') + '.' : '.');
    }
    if (linha.classificacao === 'igual') return 'Os valores coincidem.';
    if (linha.classificacao === 'sem_explicacao') return 'Nenhuma hipótese testada reproduz o valor oficial.';
    return 'Confira o valor informado no documento.';
  }

  function montarTabelaConferencia(linhas, fonteOficial) {
    var tabela = criarElemento('table', 'q-tabela');
    var cabecalho = criarElemento('tr');
    ['Item', fonteOficial || rotuloFonteOficial(), 'Calculadora', 'Diferença em dias', 'Classificação', 'Explicação']
      .forEach(function (rotulo) {
        cabecalho.appendChild(criarElemento('th', '', rotulo));
      });
    var cabecalhoTabela = criarElemento('thead');
    cabecalhoTabela.appendChild(cabecalho);
    tabela.appendChild(cabecalhoTabela);
    var corpo = criarElemento('tbody');
    linhas.forEach(function (linha) {
      var tr = criarElemento('tr');
      [
        linha.rotulo,
        linha.seeu,
        linha.nossa,
        textoDiferenca(linha.diferencaDias),
        rotuloClassificacao(linha.classificacao),
        textoExplicacao(linha)
      ].forEach(function (valor) { tr.appendChild(criarElemento('td', '', valor)); });
      tr.className = 'divergencia-' + linha.classe + ' divergencia-' + linha.classificacao;
      corpo.appendChild(tr);
    });
    tabela.appendChild(corpo);
    return tabela;
  }

  var ROTULOS_COMPARACAO = {
    progressao: 'Progressão',
    livramento: 'Livramento',
    saidaTemporaria: 'Saída temporária',
    termino: 'Término',
    penaTotal: 'Pena total',
    penaCumprida: 'Pena cumprida',
    penaRemanescente: 'Pena remanescente',
    interrupcoes: 'Interrupções',
    remicaoDias: 'Remição',
    dataBase: 'Data-base'
  };

  function statusComparacao(linha) {
    if (linha.classificacao === 'igual') return { classe: 'linha-igual', texto: 'Igual', gravidade: null };
    if (linha.classificacao === 'diferenca_convencao') {
      return { classe: 'linha-explicada', texto: 'Diferença explicada', gravidade: 2 };
    }
    if (linha.classificacao === 'falta_confirmar_dado') {
      return { classe: 'linha-falta', texto: 'Falta dado', gravidade: 1 };
    }
    if (linha.classificacao === 'sem_explicacao' || linha.classificacao === 'divergencia_juridica' ||
        linha.classificacao === 'divergencia_cabimento') {
      return { classe: 'linha-divergente', texto: 'Divergência a conferir', gravidade: 0 };
    }
    return { classe: '', texto: 'Não comparável', gravidade: null };
  }

  function itensLembrete(entrada) {
    var lembretes = [
      'Confira início, fim e tipo de cada período de prisão nos documentos.',
      'Confira interrupções, solturas, recapturas e certidões; não presuma que uma lista vazia significa ausência de eventos.'
    ];
    var listas = [
      ['prisoes', 'períodos de prisão'],
      ['interrupcoes', 'interrupções'],
      ['detracoes', 'períodos de detração'],
      ['remicoes', 'remições'],
      ['comutacoes', 'comutações concedidas'],
      ['faltasGraves', 'faltas graves'],
      ['progressoes', 'progressões concedidas'],
      ['regressoes', 'regressões']
    ];
    listas.forEach(function (item) {
      var lista = entrada && entrada[item[0]];
      if ((!Array.isArray(lista) || !lista.length) &&
          !(item[0] === 'detracoes' && entrada && Array.isArray(entrada.detracoesCautelares) && entrada.detracoesCautelares.length)) {
        lembretes.push('Nenhum registro de ' + item[1] + ' informado; confira se há algo a lançar.');
      }
    });
    return lembretes;
  }

  function itensAtencao(resultado, linhas, entrada, conferencias, leituraDocumento) {
    var itens = [];
    var sequencia = 0;
    (linhas || []).forEach(function (linha) {
      var status = statusComparacao(linha);
      if (status.gravidade == null) return;
      var rotulo = linha.rotulo || ROTULOS_COMPARACAO[linha.item] || 'Valor do documento';
      var frase;
      if (status.gravidade === 0) {
        frase = 'Confira o valor no documento e os dados que alimentam este cálculo.';
      } else if (status.gravidade === 1) {
        frase = 'Confirme ' + (linha.dadoPendente || rotulo.toLowerCase()) + ' antes de usar as datas.';
        var possibilidades = Array.isArray(linha.possibilidades) ? linha.possibilidades.map(function (item) {
          return item.descricao || item.data || item;
        }) : [];
        if (possibilidades.length) frase += ' Opções sugeridas: ' + possibilidades.join(', ') + '.';
      } else {
        frase = linha.explicacao || 'Confira a convenção indicada no documento.';
        if ((linha.hipoteses || []).some(function (hipotese) { return hipotese.regra === 'E101'; })) {
          frase += ' A diferença pode decorrer da convenção E101; confirme a data de emissão e os saldos.';
        }
      }
      itens.push({
        gravidade: status.gravidade,
        sequencia: sequencia++,
        classe: status.gravidade === 0 ? 'atencao-divergencia' :
          status.gravidade === 1 ? 'atencao-falta' : 'atencao-explicada',
        titulo: rotulo,
        frase: frase
      });
    });
    (resultado && Array.isArray(resultado.erros) ? resultado.erros : []).forEach(function (erro) {
      itens.push({
        gravidade: 1, sequencia: sequencia++, classe: 'atencao-falta',
        titulo: erro.campo || 'Dado necessário',
        frase: textoAviso(erro.mensagem || 'Confira este campo para concluir o cálculo.')
      });
    });
    (entrada && Array.isArray(entrada.condenacoes) ? entrada.condenacoes : []).forEach(function (condenacao, indice) {
      if (condenacao && condenacao.natureza) return;
      var sugestao = root.CalcPenCore && root.CalcPenCore.sugerirNatureza
        ? root.CalcPenCore.sugerirNatureza(condenacao) : null;
      var valores = sugestao && (sugestao.possibilidades ||
        (sugestao.sugestao ? [sugestao.sugestao] : [])) || [];
      var nomes = {
        comum: 'comum, sem violência',
        violencia: 'com violência ou grave ameaça',
        hediondo: 'hediondo ou equiparado',
        hediondo_morte: 'hediondo com resultado morte',
        trafico_privilegiado: 'tráfico privilegiado',
        feminicidio: 'feminicídio',
        comando_orcrim: 'comando de organização criminosa',
        milicia: 'milícia'
      };
      itens.push({
        gravidade: 1, sequencia: sequencia++, classe: 'atencao-falta',
        titulo: 'Confirme a natureza da condenação ' + (indice + 1),
        frase: 'Informe a natureza antes de usar as datas.' +
          (valores.length ? ' Opções sugeridas pelo leitor: ' +
            valores.map(function (valor) { return nomes[valor] || valor; }).join(', ') + '.' : '')
      });
    });
    (conferencias || []).forEach(function (conferencia) {
      var situacao = conferencia.situacao;
      var gravidade = situacao === 'não bateu' ? 0 : situacao === 'não deu para conferir' ? 1 : 3;
      itens.push({
        gravidade: gravidade, sequencia: sequencia++,
        classe: gravidade === 0 ? 'atencao-divergencia' :
          gravidade === 1 ? 'atencao-falta' : 'atencao-explicada',
        titulo: String(conferencia.id || 'Conferência') + ' · ' + String(situacao || 'não deu para conferir'),
        frase: String(conferencia.conta || 'Confira os dados do relatório.')
      });
    });
    var avisosDocumento = leituraDocumento && leituraDocumento.avisos || {};
    [
      ['possivelProvidencia', 'possível providência', 'Possível providência — a conferir'],
      ['dadoAConferir', 'dado a conferir', 'Dado a conferir — a conferir']
    ].forEach(function (grupo) {
      (avisosDocumento[grupo[0]] || []).forEach(function (aviso) {
        itens.push({
          gravidade: 1, sequencia: sequencia++, tipoAlerta: grupo[1],
          classe: 'atencao-falta',
          titulo: aviso.regra + ' — ' + aviso.status,
          frase: aviso.texto
        });
      });
    });
    return itens.sort(function (a, b) { return a.gravidade - b.gravidade || a.sequencia - b.sequencia; });
  }

  function montarTabelaResumo(linhas, nomes) {
    var tabela = criarElemento('table', 'q-tabela quadro-integracao');
    var cabecalho = criarElemento('tr');
    ['Item', 'Oficial', 'Calculadora', 'Situação'].forEach(function (rotulo) {
      cabecalho.appendChild(criarElemento('th', '', rotulo));
    });
    var thead = criarElemento('thead');
    thead.appendChild(cabecalho);
    tabela.appendChild(thead);
    var corpo = criarElemento('tbody');
    linhas.forEach(function (linha) {
      var status = statusComparacao(linha);
      var tr = criarElemento('tr', status.classe);
      var oficial = linha.oficial;
      var calculadora = linha.calculadora;
      if (['progressao', 'livramento', 'saidaTemporaria', 'termino', 'dataBase'].indexOf(linha.item) !== -1) {
        oficial = dataExibida(oficial);
        calculadora = dataExibida(calculadora);
      }
      [
        linha.rotulo || ROTULOS_COMPARACAO[linha.item] || linha.item,
        oficial == null ? 'Não informado' : oficial,
        calculadora == null ? 'Não calculada' : calculadora,
        status.texto
      ].forEach(function (valor) { tr.appendChild(criarElemento('td', '', valor)); });
      corpo.appendChild(tr);
    });
    tabela.appendChild(corpo);
    var rolagem = criarElemento('div', 'tabela-rolagem');
    rolagem.appendChild(tabela);
    return rolagem;
  }

  function exibirResumoIntegracao(resultado, linhas, entrada, dataReferencia, emissao, conferencias, leituraDocumento) {
    if (!document.documentElement.classList.contains('modo-embutido')) return;
    var painel = document.getElementById('resumo-integracao');
    painel.hidden = false;
    var contadores = [
      ['divergencia', 'Divergências a conferir', 0],
      ['falta', 'Dados para preencher', 0],
      ['explicada', 'Diferenças explicadas', 0],
      ['igual', 'Valores iguais', 0]
    ];
    (linhas || []).forEach(function (linha) {
      var status = statusComparacao(linha);
      if (linha.classificacao === 'igual') contadores[3][2]++;
      else if (linha.classificacao === 'falta_confirmar_dado') contadores[1][2]++;
      else if (linha.classificacao === 'diferenca_convencao') contadores[2][2]++;
      else if (status.gravidade === 0) contadores[0][2]++;
    });
    var destinoContadores = document.getElementById('contadores-integracao');
    destinoContadores.replaceChildren();
    contadores.forEach(function (item) {
      var cartao = criarElemento('div', 'contador-integracao contador-' + item[0]);
      cartao.appendChild(criarElemento('strong', '', item[2]));
      cartao.appendChild(criarElemento('span', '', item[1]));
      destinoContadores.appendChild(cartao);
    });

    var destinoAtencao = document.getElementById('atencao-integracao');
    destinoAtencao.replaceChildren();
    var atencoes = itensAtencao(resultado, linhas, entrada, conferencias, leituraDocumento);
    if (!atencoes.length) {
      destinoAtencao.appendChild(criarElemento('p', 'sem-dados', 'Nenhuma divergência ou dado pendente foi identificado nos valores comparados.'));
    } else {
      function exibirCartao(item) {
        var cartao = criarElemento('article', 'cartao-atencao-integracao ' + item.classe);
        cartao.appendChild(criarElemento('strong', '', item.titulo));
        cartao.appendChild(criarElemento('p', '', item.frase));
        destinoAtencao.appendChild(cartao);
      }
      atencoes.filter(function (item) { return !item.tipoAlerta; }).forEach(exibirCartao);
      [
        ['possível providência', 'Possível providência — a conferir'],
        ['dado a conferir', 'Dado a conferir — a conferir']
      ].forEach(function (grupo) {
        var grupoAtencao = atencoes.filter(function (item) { return item.tipoAlerta === grupo[0]; });
        if (!grupoAtencao.length) return;
        destinoAtencao.appendChild(criarElemento('h4', '', grupo[1]));
        grupoAtencao.forEach(exibirCartao);
      });
    }

    var grupos = [
      ['Pena', ['penaTotal', 'penaCumprida', 'penaRemanescente', 'interrupcoes', 'remicaoDias']],
      ['Datas', ['dataBase', 'termino']],
      ['Benefícios', ['progressao', 'livramento', 'saidaTemporaria']]
    ];
    var quadro = document.getElementById('quadro-integracao');
    quadro.replaceChildren();
    grupos.forEach(function (grupo) {
      var secao = criarElemento('section', 'quadro-grupo-integracao');
      secao.appendChild(criarElemento('h4', '', grupo[0]));
      var itens = (linhas || []).filter(function (linha) { return grupo[1].indexOf(linha.item) !== -1; });
      if (itens.length) secao.appendChild(montarTabelaResumo(itens));
      else secao.appendChild(criarElemento('p', 'sem-dados', 'Nenhum valor oficial deste grupo foi informado.'));
      quadro.appendChild(secao);
    });
    document.getElementById('data-referencia-integracao').textContent = emissao
      ? 'Saldos comparados na data de emissão do documento: ' + dataExibida(dataReferencia) + '.'
      : 'Saldos comparados na data de corte do cálculo: ' + dataExibida(dataReferencia) + '.';

    var lembretes = itensLembrete(entrada);
    var listaLembretes = document.getElementById('lista-lembretes-integracao');
    listaLembretes.replaceChildren();
    lembretes.forEach(function (lembrete) {
      listaLembretes.appendChild(criarElemento('li', '', lembrete));
    });
    document.getElementById('titulo-lembretes-integracao').textContent =
      'Lembretes de conferência (' + lembretes.length + ')';
  }

  function exibirConferencia(resultado, atestado, conferenciaDatas, fonteOficial) {
    var status = document.getElementById('status-conferencia-atestado');
    var tabelaDestino = document.getElementById('tabela-conferencia-atestado');
    var textos = document.getElementById('textos-impugnacao-atestado');
    var fonte = fonteOficial || rotuloFonteOficial();
    atualizarTituloConferencia();
    tabelaDestino.replaceChildren();
    textos.replaceChildren();
    var linhas = montarLinhasConferencia(resultado, atestado, conferenciaDatas);
    if (!linhas.length) {
      status.textContent = 'Preencha os dados do atestado para comparar datas e totais.';
      tabelaDestino.hidden = true;
      return linhas;
    }

    status.textContent = atestado.origem
      ? 'Comparação a conferir · Origem informada: ' + atestado.origem
      : 'Comparação a conferir · Confira as diferenças com o documento.';
    tabelaDestino.appendChild(montarTabelaConferencia(linhas, fonte));
    tabelaDestino.hidden = false;

    (conferenciaDatas || []).forEach(function (linha) {
      if (!linha.paragrafo) return;
      textos.appendChild(criarElemento('p', 'nota', linha.paragrafo));
    });
    return linhas;
  }

  function importarAtestadoCopilot() {
    var status = document.getElementById('status-importacao-atestado');
    var copilot = root.CalculadoraExecucaoCopilot;
    if (!copilot || typeof copilot.analisar !== 'function') {
      status.textContent = 'A validação do Copilot não está disponível. Recarregue a página e tente novamente.';
      return;
    }
    var resposta = document.getElementById('resposta-copilot-atestado').value;
    var importacao = copilot.analisar(resposta);
    if (!importacao.valido) {
      status.textContent = 'Não foi possível importar. ' + importacao.erros.map(function (erro) {
        return erro.campo + ': ' + erro.mensagem;
      }).join(' ');
      return;
    }
    if (importacao.dados.versao === 2) {
      status.textContent = 'Para conferir trechos e páginas e concluir a revisão, use Importar documentos > Importar do Copilot.';
      return;
    }
    if (!importacao.dados.atestadoSEEU) {
      status.textContent = 'A resposta válida não contém dados do atestado SEEU.';
      return;
    }
    if (!temDadosAtestadoCopilot(importacao.dados.atestadoSEEU)) {
      status.textContent = 'A resposta não contém datas previstas nem totais em dias do atestado.';
      return;
    }
    var valores = valoresAtestadoCopilot(importacao.dados.atestadoSEEU);
    Object.keys(valores).forEach(function (nome) {
      document.getElementById('atestado-' + nome).value = valores[nome];
    });
    status.textContent = 'Dados do atestado preenchidos. Confira os campos e a origem antes de calcular.';
  }

  function atualizarSelo() {
    var opcoes = opcoesAtuais();
    document.getElementById('selo-uso').hidden =
      opcoes.convencaoDias === 'calendario' && !opcoes.menos1Beneficio &&
      opcoes.arredondamento === 'cima' && opcoes.metodoProgressao === 'padrao';
  }

  function carregarDetracaoCautelar() {
    var chave = 'calcpenal:detracao-cautelar-pendente';
    var status = document.getElementById('status-detracao-cautelar');
    try {
      var transferencia = JSON.parse(localStorage.getItem(chave) || 'null');
      if (!transferencia) return;
      if (transferencia.versao !== 1 || !Array.isArray(transferencia.diasHoras) ||
          !Number.isSafeInteger(transferencia.dias) || transferencia.dias < 0) {
        throw new Error('Transferência inválida.');
      }
      document.getElementById('detracao-cautelar-json').value = JSON.stringify(transferencia.diasHoras);
      status.textContent = transferencia.dias + ' dia(s), ' + transferencia.horasTotais +
        ' hora(s), período de ' + transferencia.inicio + ' a ' + transferencia.fim +
        '. Confira eventual sobreposição com outras detrações.';
      localStorage.removeItem(chave);
    } catch (_) {
      status.textContent = 'Não foi possível carregar a transferência. Refaça o envio pela calculadora cautelar.';
    }
  }

  function atualizarContadores() {
    function contar(nome) {
      var container = document.getElementById(nome);
      return Array.prototype.filter.call(container.querySelectorAll('.item-card'), function (linha) {
        return Array.prototype.some.call(linha.querySelectorAll('input, select, textarea'), function (campo) {
          if (campo.tagName === 'SELECT') return false;
          if (campo.type === 'checkbox') return campo.checked && !campo.defaultChecked;
          if (campo.type === 'number') return Number(campo.value) > 0;
          return campo.value.trim() !== '';
        });
      }).length;
    }
    [
      ['condenacoes', 'condenacoes'],
      ['prisoes', 'prisoes'],
      ['detracoes', 'detracoes'],
      ['remicoes', 'remicoes'],
      ['comutacoes', 'comutacoes'],
      ['faltasGraves', 'faltasGraves'],
      ['progressoes', 'progressoes'],
      ['regressoes', 'regressoes']
    ].forEach(function (item) {
      var destino = document.querySelector('[data-contador="' + item[1] + '"]');
      if (destino) destino.textContent = String(contar(item[0]));
    });
    var prisao = document.querySelector('[data-contador="prisoes"]');
    if (prisao) {
      prisao.textContent = String(contar('prisoes') + contar('interrupcoes'));
    }
    var dataBase = document.getElementById('data-calculo');
    var contadorBase = document.querySelector('[data-contador="base"]');
    var contadorAtestado = document.querySelector('[data-contador="atestado"]');
    var contadorResultado = document.querySelector('[data-contador="resultado"]');
    if (contadorBase) contadorBase.textContent = dataBase && dataBase.value.trim() ? '1' : '0';
    if (contadorAtestado) {
      contadorAtestado.textContent = String(Array.prototype.filter.call(
        document.querySelectorAll('#secao-dados-atestado input'),
        function (campo) { return campo.value.trim() !== ''; }
      ).length);
    }
    if (contadorResultado && document.getElementById('resultado').hidden) contadorResultado.textContent = '—';
  }

  function obterCampoObjeto(dados, caminho) {
    return caminho.split('.').reduce(function (valor, nome) {
      return valor && valor[nome];
    }, dados);
  }

  function preencherCampo(campo, valor) {
    if (valor == null) return;
    if (campo.type === 'checkbox') {
      campo.checked = valor === true;
      return;
    }
    if (typeof valor === 'boolean') {
      if (campo.tagName === 'SELECT') campo.value = String(valor);
      return;
    }
    if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      campo.value = dataExibida(valor);
    } else {
      campo.value = String(valor);
    }
  }

  function preencherFormulario(calculo) {
    exibirProcesso(null, document.getElementById('processo-integracao'));
    integracaoEntrada = null;
    integracaoEstado = null;
    integracaoLinhas = new WeakMap();
    var entrada = calculo.entrada;
    var opcoesSalvas = calculo.opcoes || {};
    var nomes = ['condenacoes', 'prisoes', 'interrupcoes', 'detracoes', 'remicoes', 'comutacoes', 'faltasGraves', 'progressoes', 'regressoes'];
    nomes.forEach(function (nome) {
      var dados = Array.isArray(entrada[nome]) && entrada[nome].length ? entrada[nome]
        : nome === 'condenacoes' || nome === 'prisoes' ? [{}] : [];
      var container = document.getElementById(nome);
      container.replaceChildren();
      dados.forEach(function (item, indiceItem) {
        var linha = prepararLinha(nome);
        if (nome === 'condenacoes' && item.id) {
          linha.setAttribute('data-condenacao-id', item.id);
          linha.querySelector('legend').textContent = 'Condenação · ' + item.id;
        }
        Array.prototype.forEach.call(linha.querySelectorAll('[data-campo]'), function (campo) {
          var chave = campo.getAttribute('data-campo');
          var valor = chave === 'saldosCondenacoesTexto' && Array.isArray(item.saldosCondenacoes)
            ? item.saldosCondenacoes.map(function (saldo) { return saldo.condenacaoId + '=' + saldo.dias; }).join('; ')
            : obterCampoObjeto(item, chave);
          preencherCampo(campo, valor);
        });
        if (nome === 'condenacoes') {
          var dadosPrescricao = opcoesSalvas.prescricao &&
            opcoesSalvas.prescricao.porCondenacao &&
            opcoesSalvas.prescricao.porCondenacao[item.id || 'c' + (indiceItem + 1)] || {};
          var idadeFato = linha.querySelector('[data-prescricao-idade="idadeNaDataFato"]');
          var idadeSentenca = linha.querySelector('[data-prescricao-idade="idadeNaSentenca"]');
          var penaRestante = dadosPrescricao.penaRestante || item.penaRestante || {};
          if (idadeFato && item.idadeNaDataFato != null) idadeFato.value = String(item.idadeNaDataFato);
          if (idadeSentenca && item.idadeNaSentenca != null) idadeSentenca.value = String(item.idadeNaSentenca);
          linha.querySelector('[data-prescricao-violencia-sexual]').value =
            dadosPrescricao.violenciaSexualContraMulher || '';
          linha.querySelector('[data-prescricao-certidoes]').value =
            dadosPrescricao.certidoesConferidas === true ? 'true' :
              dadosPrescricao.certidoesConferidas === false ? 'false' : '';
          linha.querySelector('[data-prescricao-outras-causas]').value = dadosPrescricao.outrasCausas || '';
          linha.querySelector('[data-prescricao-extincao]').value =
            dadosPrescricao.extincaoDeclarada || '';
          linha.querySelector('[data-prescricao-revogacao]').value =
            dadosPrescricao.revogacaoLivramento && dadosPrescricao.revogacaoLivramento.ocorreu
              ? 'sim' : dadosPrescricao.revogacaoLivramento ? 'nao' : '';
          ['anos', 'meses', 'dias'].forEach(function (parte) {
            var campoRestante = linha.querySelector('[data-prescricao-restante="' + parte + '"]');
            if (campoRestante && penaRestante[parte] != null) campoRestante.value = String(penaRestante[parte]);
          });
        } else if (nome === 'faltasGraves') {
          var dadosFalta = opcoesSalvas.prescricao && opcoesSalvas.prescricao.faltas &&
            opcoesSalvas.prescricao.faltas[dados.length ? dados.indexOf(item) : 0];
          linha.querySelector('[data-prescricao-falta-certidao]').value =
            dadosFalta && dadosFalta.certidaoConferida === true ? 'true' :
              dadosFalta && dadosFalta.certidaoConferida === false ? 'false' : '';
        }
      });
      atualizarRemocao(nome);
    });
    document.getElementById('processo-execucao').value = formatarProcesso(entrada.processo);
    document.getElementById('regime-atual').value = entrada.regimeAtual || 'fechado';
    document.getElementById('detracao-cautelar-json').value =
      JSON.stringify(Array.isArray(entrada.detracoesCautelares) ? entrada.detracoesCautelares : []);
    document.getElementById('data-calculo').value = calculo.dataCalculo ? dataExibida(calculo.dataCalculo) : '';
    var atestado = entrada.atestadoSEEU || {};
    ['progressao', 'livramento', 'saidaTemporaria', 'termino', 'penaTotalDias',
      'penaCumpridaDias', 'detracaoDias', 'remicaoDias', 'origem'].forEach(function (nome) {
      var campo = document.getElementById('atestado-' + nome);
      if (campo) preencherCampo(campo, atestado[nome]);
    });
    comutacaoAlteraBaseBeneficios = typeof opcoesSalvas.comutacaoAlteraBaseBeneficios === 'boolean'
      ? opcoesSalvas.comutacaoAlteraBaseBeneficios : undefined;
    document.getElementById('convencao-dias').value = opcoesSalvas.convencaoDias || 'calendario';
    document.getElementById('menos-um').checked = opcoesSalvas.menos1Beneficio === true;
    document.getElementById('arredondamento').value = opcoesSalvas.arredondamento || 'cima';
    document.getElementById('metodo-progressao').value = opcoesSalvas.metodoProgressao || 'padrao';
    var progressaoEspecial = entrada.progressaoEspecial;
    document.getElementById('e37-solicitada').checked = !!(progressaoEspecial && progressaoEspecial.solicitada);
    if (progressaoEspecial) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-e37]'), function (campo) {
        var valor = progressaoEspecial[campo.getAttribute('data-e37')];
        campo.value = valor == null ? '' : String(valor);
      });
      (progressaoEspecial.eventosRevogadores || []).forEach(function (evento) {
        var data = document.querySelector('[data-e37-evento-data="' + evento.tipo + '"]');
        var situacao = document.querySelector('[data-e37-evento-situacao="' + evento.tipo + '"]');
        if (data) preencherCampo(data, evento.data);
        if (situacao) situacao.value = evento.situacao || '';
      });
    }
    var eventoE13 = entrada.eventoE13;
    document.getElementById('e13-ativo').checked = !!(eventoE13 && eventoE13.crimeDurante);
    if (eventoE13) {
      ['inicioPeriodoProva', 'fimPeriodoProva', 'dataCrime', 'dataPrisao', 'dataDecisao']
        .forEach(function (nome) {
          var id = {
            inicioPeriodoProva: 'e13-inicio-periodo',
            fimPeriodoProva: 'e13-fim-periodo',
            dataCrime: 'e13-data-crime',
            dataPrisao: 'e13-data-prisao',
            dataDecisao: 'e13-data-decisao'
          }[nome];
          preencherCampo(document.getElementById(id), eventoE13[nome]);
        });
      document.getElementById('e13-situacao').value = eventoE13.situacao || '';
      document.getElementById('e13-unificadas').value = eventoE13.penasUnificadas == null
        ? '' : String(eventoE13.penasUnificadas);
      document.getElementById('e13-condenacao-id').value = eventoE13.condenacaoId || '';
    }
    var caso = calculo.caso || {};
    document.getElementById('pessoa-executada').value = caso.pessoa || '';
    document.getElementById('juizo-execucao').value = caso.juizo || '';
    document.getElementById('dados-conferidos').checked = caso.conferido === true;
    document.getElementById('status-detracao-cautelar').textContent =
      entrada.detracoesCautelares && entrada.detracoesCautelares.length
        ? 'Períodos horários carregados. Confira os registros antes de calcular.'
        : 'Nenhum período transferido.';
    preencherIndulto(entrada);
    atualizarSelo();
    atualizarContadores();
    salvarCasoLocal();
  }

  function limparCalculo(formulario, nomes, limparCaso) {
    exibirProcesso(null, document.getElementById('processo-integracao'));
    integracaoEntrada = null;
    integracaoEstado = null;
    integracaoLinhas = new WeakMap();
    comutacaoAlteraBaseBeneficios = undefined;
    formulario.reset();
    document.getElementById('status-detracao-cautelar').textContent = 'Nenhum período transferido.';
    atualizarTituloConferencia();
    nomes.forEach(function (nome) {
      var container = document.getElementById(nome);
      container.replaceChildren();
      if (nome === 'condenacoes' || nome === 'prisoes') prepararLinha(nome);
      atualizarRemocao(nome);
    });
    if (limparCaso) {
      document.getElementById('pessoa-executada').value = '';
      document.getElementById('processo-execucao').value = '';
      document.getElementById('juizo-execucao').value = '';
      document.getElementById('dados-conferidos').checked = false;
      try { localStorage.removeItem('calcpenal:caso'); } catch (_) {}
      document.getElementById('status-caso').textContent = 'Dados do caso removidos deste navegador.';
    }
    document.getElementById('resultado').hidden = true;
    document.getElementById('resumo-integracao').hidden = true;
    document.getElementById('cenarios-teses').hidden = true;
    document.getElementById('conteudo-cenarios').replaceChildren();
    document.getElementById('impressao').hidden = true;
    document.getElementById('selo-uso').hidden = true;
    document.getElementById('status-conferencia-atestado').textContent =
      'Preencha os dados do atestado para comparar datas e totais.';
    document.getElementById('status-importacao-atestado').textContent = '';
    document.getElementById('salvar-calculo').disabled = true;
    atualizarContadores();
  }

  function carregarExemplo() {
    var exemplo = {
      formato: 'calcpen',
      versao: 1,
      dataCalculo: '2026-11-06',
      opcoes: { convencaoDias: 'calendario', menos1Beneficio: false, arredondamento: 'cima' },
      caso: { pessoa: 'Pessoa de exemplo', juizo: 'Juízo de exemplo', conferido: false },
      entrada: {
        formato: 'calcpen', versao: 1,
        condenacoes: [{
          dataFato: '2021-01-10', pena: { anos: 8, meses: 4, dias: 0 },
          natureza: 'violencia', reincidencia: 'primario', antecedenteViolento: 'desconhecido',
          bonsAntecedentes: true, equiparado: false, tituloXII: false, emCumprimento: true,
          regimeInicial: 'fechado'
        }],
        prisoes: [{ inicio: '2026-01-10', fim: null, tipo: 'definitiva' }],
        interrupcoes: [], detracoes: [], remicoes: [], faltasGraves: [], progressoes: [],
        regimeAtual: 'fechado'
      }
    };
    preencherFormulario(exemplo);
    return exemplo;
  }

  function exibirProcesso(processo, destino) {
    if (!destino) return;
    destino.replaceChildren();
    destino.hidden = !processo;
    if (!processo) return;
    var usado = processo.documentoUsado;
    destino.appendChild(criarElemento('h2', '', 'Pacote do processo — a conferir'));
    destino.appendChild(criarElemento('p', 'sub', usado
      ? 'Documento usado: ' + (usado.nome || usado.tipo || usado.id) + ' · ' + dataExibida(usado.data.slice(0, 10))
      : 'Nenhum documento aproveitável.'));
    destino.appendChild(criarElemento('h3', '', 'Documentos ignorados'));
    var ignorados = criarElemento('ul', 'revisao-lista');
    processo.documentosIgnorados.forEach(function (item) {
      ignorados.appendChild(criarElemento('li', '', (item.id || 'Sem identificador') + ': ' + item.motivo));
    });
    destino.appendChild(ignorados);
    if (!processo.documentosIgnorados.length) destino.appendChild(criarElemento('p', 'sub', 'Nenhum documento ignorado.'));
    destino.appendChild(criarElemento('h3', '', 'Movimentações posteriores ao documento'));
    var movimentos = criarElemento('ul', 'revisao-lista');
    processo.movimentosPosteriores.forEach(function (item) {
      movimentos.appendChild(criarElemento('li', '', dataExibida(item.data.slice(0, 10)) + ' · ' + item.descricao));
    });
    destino.appendChild(movimentos);
    destino.appendChild(criarElemento('p', processo.movimentosPosteriores.length ? 'nota' : 'sub',
      processo.movimentosPosteriores.length
        ? 'O cálculo pode estar desatualizado. Confira cada movimento; eles não alteram os dados automaticamente.'
        : 'Nenhuma movimentação posterior sinalizada pelo leitor.'));
  }

  function salvarArquivoCalculo(calculo) {
    var conteudo = JSON.stringify(calculo, null, 2);
    var url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }));
    var link = criarElemento('a');
    link.href = url;
    link.download = 'calculo-execucao.calcpen';
    link.click();
    URL.revokeObjectURL(url);
  }

  function prepararLinha(nome) {
    var modelo = document.getElementById('modelo-' + nome);
    var linha = modelo.content.firstElementChild.cloneNode(true);
    var container = document.getElementById(nome);
    container.appendChild(linha);
    if (nome === 'condenacoes') {
      var numeroId = 1;
      while (container.querySelector('[data-condenacao-id="c' + numeroId + '"]')) numeroId++;
      var id = 'c' + numeroId;
      if (integracaoEntrada) {
        do { id = 'integracao-' + proximoIdIntegracao++; }
        while (integracaoEntrada.condenacoes.some(function (item) { return item.id === id; }));
        integracaoNovosIds.set(linha, id);
      }
      linha.setAttribute('data-condenacao-id', id);
      linha.querySelector('legend').textContent = 'Condenação · ' + id;
    }
    if (piloto && piloto.aplicarOcultacoes) piloto.aplicarOcultacoes(linha);
    return linha;
  }

  function adicionarStatusIndulto(destino, artigo, texto, atributo) {
    var item = criarElemento('div', 'item-card');
    item.appendChild(criarElemento('p', '', artigo + ': ' + texto));
    var rotulo = criarElemento('label', 'q-campo');
    rotulo.appendChild(criarElemento('span', 'q-rotulo',
      atributo === 'data-indulto-requisito'
        ? 'Todos os requisitos desta hipótese foram conferidos?'
        : 'Este impedimento está presente?'));
    var seletor = criarElemento('select');
    seletor.setAttribute(atributo, artigo);
    [
      ['', 'Falta confirmar'],
      ['true', atributo === 'data-indulto-requisito' ? 'Sim' : 'Sim'],
      ['false', atributo === 'data-indulto-requisito' ? 'Não' : 'Não']
    ].forEach(function (opcao) {
      var elemento = criarElemento('option', '', opcao[1]);
      elemento.value = opcao[0];
      seletor.appendChild(elemento);
    });
    rotulo.appendChild(seletor);
    item.appendChild(rotulo);
    destino.appendChild(item);
  }

  function popularRequisitosIndulto() {
    var decretos = root.DadosExecucaoPenal && root.DadosExecucaoPenal.decretos;
    if (!Array.isArray(decretos) || !decretos.length) return;
    var decreto = decretos.slice().sort(function (a, b) {
      return String(b.dataReferencia).localeCompare(String(a.dataReferencia));
    })[0];
    var hipoteses = document.getElementById('indulto-hipoteses');
    var impedimentos = document.getElementById('indulto-impedimentos');
    if (!hipoteses || !impedimentos) return;
    Object.values(decreto.indulto || {}).flat().forEach(function (requisito) {
      adicionarStatusIndulto(hipoteses, requisito.artigo, requisito.criterio, 'data-indulto-requisito');
    });
    (decreto.impedimentos || []).forEach(function (requisito) {
      adicionarStatusIndulto(impedimentos, requisito.artigo, requisito.criterio, 'data-indulto-impedimento');
    });
  }

  function preencherIndulto(entrada) {
    var dados = entrada.indulto || {};
    [
      ['reincidenteNaDataReferencia', 'indulto-reincidente'],
      ['violenciaNaDataReferencia', 'indulto-violencia'],
      ['comutacaoAnterior', 'indulto-comutacao-anterior'],
      ['penaAlternativa', 'indulto-pena-alternativa'],
      ['emLivramento', 'indulto-em-livramento'],
      ['suspensaoCondicional', 'indulto-suspensao-condicional']
    ].forEach(function (item) {
      var campo = document.getElementById(item[1]);
      if (campo) campo.value = typeof dados[item[0]] === 'boolean' ? String(dados[item[0]]) : '';
    });
    [
      ['tempoCumpridoDias', 'indulto-tempo-cumprido'],
      ['saldoLivramentoDias', 'indulto-saldo-livramento'],
      ['tempoIninterruptoDias', 'indulto-tempo-ininterrupto'],
      ['tempoSemiabertoIninterruptoDias', 'indulto-tempo-semiaberto'],
      ['diasEmLiberdade', 'indulto-dias-liberdade']
    ].forEach(function (item) {
      var campo = document.getElementById(item[1]);
      if (campo) campo.value = Number.isInteger(dados[item[0]]) ? String(dados[item[0]]) : '';
    });
    document.getElementById('faltas-graves-verificadas').checked =
      entrada.faltasGravesVerificadas === true;
    [
      ['data-indulto-requisito', dados.requisitosPorArtigo || {}],
      ['data-indulto-impedimento', dados.impedimentosPorArtigo || {}]
    ].forEach(function (item) {
      Array.prototype.forEach.call(document.querySelectorAll('[' + item[0] + ']'), function (campo) {
        var resposta = item[1][campo.getAttribute(item[0])];
        campo.value = typeof resposta === 'boolean' ? String(resposta) : '';
      });
    });
  }

  function atualizarRemocao(nome) {
    var linhas = document.querySelectorAll('#' + nome + ' .item-card');
    Array.prototype.forEach.call(linhas, function (linha) {
      var botao = linha.querySelector('.remover-item');
      botao.hidden = linhas.length === 1 && (nome === 'condenacoes' || nome === 'prisoes');
    });
  }

  function inicializar() {
    if (root.parent && root.parent !== root) document.documentElement.classList.add('modo-embutido');
    var formulario = document.getElementById('form-calculo');
    var calculoAtual = null;
    var calculoRecebido = null;
    function mostrarDocumentoImportado(item, nome) {
      if (!item || !item.entrada || !Array.isArray(item.entrada.condenacoes)) {
        throw new Error('Documento: não foi possível preparar os dados para conferência.');
      }
      var entrada = Object.assign({}, item.entrada, { formato: 'calcpen', versao: 1 });
      var oficial = item.oficial || entrada.atestadoSEEU;
      if (oficial && Object.keys(oficial).length) entrada.atestadoSEEU = oficial;
      var integracaoAnterior = integracaoAtiva;
      integracaoEntrada = null;
      integracaoEstado = null;
      integracaoAtiva = true;
      try {
        preencherFormulario({ entrada: entrada });
      } finally {
        integracaoAtiva = integracaoAnterior;
      }
      var tipoDocumento = item.versaoDocumento && item.versaoDocumento.tipo || '';
      document.getElementById('fonte-calculo-oficial').value =
        tipoDocumento.indexOf('tjsp-saj') === 0 ? 'tjsp' : 'seeu';
      document.getElementById('dados-conferidos').checked = false;
      document.getElementById('resultado').hidden = true;
      document.getElementById('impressao').hidden = true;
      document.getElementById('resultado-indulto').hidden = true;
      document.getElementById('salvar-calculo').disabled = true;
      calculoAtual = null;
      var versao = item.versaoDocumento && item.versaoDocumento.versao || 'modelo não reconhecido';
      document.getElementById('origemDocumento').textContent =
        (nome ? 'Arquivo: ' + nome + ' · ' : '') + 'Modelo: ' + versao + ' · Dados a conferir.';
      var pendencias = textos.pendencias([].concat(item.alertas || [], entrada.pendencias || []), entrada);
      var listaPendencias = document.getElementById('pendenciasDocumento');
      listaPendencias.replaceChildren();
      (pendencias.length ? pendencias : ['O leitor não registrou pendências. Confira os campos e o documento.'])
        .forEach(function (texto) {
          var itemLista = document.createElement('li');
          itemLista.textContent = String(texto);
          listaPendencias.appendChild(itemLista);
        });
      var listaOrigens = document.getElementById('origensDocumento');
      listaOrigens.replaceChildren();
      Object.entries(item.origens || {}).forEach(function (par) {
        var itemLista = document.createElement('li');
        itemLista.textContent = textos.campo(par[0]) + ': ' +
          (typeof par[1] === 'string' ? par[1] : par[1] && (par[1].origem || par[1].secao) || 'origem não informada');
        listaOrigens.appendChild(itemLista);
      });
      if (!listaOrigens.childElementCount) {
        var semOrigem = document.createElement('li');
        semOrigem.textContent = 'O leitor não identificou origens por campo. Confira cada dado no documento.';
        listaOrigens.appendChild(semOrigem);
      }
      document.getElementById('conferenciaDocumento').hidden = false;
      document.getElementById('estadoDocumento').textContent =
        'Documento lido neste navegador. Confira os dados e as pendências; o cálculo só começa quando você acionar Calcular.';
      document.getElementById('status-motor').textContent = 'Documento importado — dados a conferir. Revise as pendências e acione Calcular quando estiver pronto.';
    }

    async function lerDocumento(arquivo) {
      if (!arquivo) return;
      document.getElementById('estadoDocumento').textContent = 'Lendo o documento neste navegador…';
      try {
        var item = await root.ImportacaoLocal.lerPDF(arquivo);
        mostrarDocumentoImportado(item, arquivo.name);
      } catch (erro) {
        document.getElementById('estadoDocumento').textContent = erro.message ||
          'Não foi possível ler o documento. Confira o arquivo e tente novamente.';
      }
    }

    carregarDetracaoCautelar();
    carregarCasoLocal();
    var nomes = ['condenacoes', 'prisoes', 'interrupcoes', 'detracoes', 'remicoes', 'comutacoes', 'faltasGraves', 'progressoes', 'regressoes'];
    nomes.forEach(function (nome) {
      if (nome === 'condenacoes' || nome === 'prisoes') prepararLinha(nome);
      atualizarRemocao(nome);
    });
    popularRequisitosIndulto();
    try {
      var importada = sessionStorage.getItem('calcpenal:ferramenta-rapida');
      if (importada) {
        sessionStorage.removeItem('calcpenal:ferramenta-rapida');
        var dadosFerramenta = JSON.parse(importada);
        var primeiraCondenacao = document.querySelector('#condenacoes .item-card');
        var camposPermitidos = [
          'dataFato', 'natureza', 'reincidencia', 'antecedenteViolento',
          'bonsAntecedentes', 'equiparado', 'tituloXII', 'lei15358LC'
        ];
        if (dadosFerramenta && primeiraCondenacao) {
          camposPermitidos.forEach(function (campo) {
            if (!Object.prototype.hasOwnProperty.call(dadosFerramenta, campo)) return;
            var elemento = primeiraCondenacao.querySelector('[data-campo="' + campo + '"]');
            if (!elemento) return;
            if (elemento.type === 'checkbox') elemento.checked = dadosFerramenta[campo] === true;
            else if (typeof dadosFerramenta[campo] === 'string') {
              elemento.value = campo === 'dataFato' && /^\d{4}-\d{2}-\d{2}$/.test(dadosFerramenta[campo])
                ? dadosFerramenta[campo].split('-').reverse().join('/')
                : dadosFerramenta[campo];
            }
          });
          document.getElementById('status-motor').textContent =
            'Dados da consulta de frações preenchidos. Confira a pena e os demais campos.';
        }
      }
    } catch (_) {}
    document.querySelectorAll('[data-adicionar]').forEach(function (botao) {
      botao.addEventListener('click', function () {
        var linha = prepararLinha(botao.getAttribute('data-adicionar'));
        atualizarRemocao(botao.getAttribute('data-adicionar'));
        atualizarContadores();
        var foco = linha.querySelector('input:not([type="checkbox"]), select');
        if (foco) foco.focus();
      });
    });
    document.addEventListener('click', function (evento) {
      var botao = evento.target.closest('.remover-item');
      if (!botao) return;
      var lista = botao.closest('.lista-itens');
      var nome = lista.id;
      botao.closest('.item-card').remove();
      atualizarRemocao(nome);
      atualizarContadores();
    });
    document.addEventListener('input', function (evento) {
      if (evento.target.matches('[data-caso="processo"]')) {
        var inicio = evento.target.selectionStart;
        evento.target.value = formatarProcesso(evento.target.value);
        if (inicio != null) evento.target.setSelectionRange(evento.target.value.length, evento.target.value.length);
      }
      if (evento.target.closest('#form-calculo')) atualizarContadores();
      if (evento.target.matches('[data-caso]')) {
        salvarCasoLocal();
        calculoAtual = null;
        document.getElementById('salvar-calculo').disabled = true;
      }
      var contadorResultado = document.querySelector('[data-contador="resultado"]');
      if (evento.target.closest('#form-calculo') && contadorResultado) {
        calculoAtual = null;
        document.getElementById('salvar-calculo').disabled = true;
        contadorResultado.textContent = '—';
      }
    });
    document.addEventListener('change', function (evento) {
      if (evento.target.closest('#form-calculo')) atualizarContadores();
      if (evento.target.matches('[data-caso]')) {
        salvarCasoLocal();
        calculoAtual = null;
        document.getElementById('salvar-calculo').disabled = true;
      }
      var contadorResultado = document.querySelector('[data-contador="resultado"]');
      if (evento.target.closest('#form-calculo') && contadorResultado) {
        calculoAtual = null;
        document.getElementById('salvar-calculo').disabled = true;
        contadorResultado.textContent = '—';
      }
    });
    ['convencao-dias', 'menos-um', 'arredondamento', 'metodo-progressao'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', atualizarSelo);
    });
    document.getElementById('fonte-calculo-oficial').addEventListener('change', atualizarTituloConferencia);
    atualizarTituloConferencia();
    document.getElementById('importar-atestado-copilot').addEventListener('click', importarAtestadoCopilot);
    atualizarSelo();
    atualizarContadores();

    formulario.addEventListener('submit', function (evento) {
      evento.preventDefault();
      calculoAtual = null;
      document.getElementById('resumo-integracao').hidden = true;
      document.getElementById('salvar-calculo').disabled = true;
      var dados = calculoRecebido || coletarEntrada(formulario);
      calculoRecebido = null;
      if (integracaoEntrada && dados.entrada !== integracaoEntrada) {
        var mesclar = root.CalcPenIntegracao.mesclarEdicoes;
        var entradaMesclada = Object.assign({}, mesclar(integracaoEntrada, integracaoEstado.entrada, dados.entrada));
        nomes.forEach(function (nome) {
          entradaMesclada[nome] = [];
          document.querySelectorAll('#' + nome + ' .item-card').forEach(function (linha) {
            var atual = linhasColetadas.get(linha);
            if (!atual) return;
            var registro = integracaoLinhas.get(linha);
            if (!registro) atual.origem = 'Informado manualmente na conferência da integração';
            entradaMesclada[nome].push(registro
              ? mesclar(registro.original, registro.inicial, atual) : atual);
          });
        });
        dados.entrada = entradaMesclada;
      }
      var painel = document.getElementById('resultado');
      var secaoCenarios = document.getElementById('cenarios-teses');
      var containerCenarios = document.getElementById('conteudo-cenarios');
      document.getElementById('impressao').hidden = true;
      document.getElementById('resultado-indulto').hidden = true;
      document.getElementById('tabela-cortes-historicos').replaceChildren();
      secaoCenarios.hidden = true;
      containerCenarios.replaceChildren();
      painel.hidden = false;
      document.getElementById('avisos-resultado').replaceChildren();
      document.getElementById('quadro-datas').replaceChildren();
      document.getElementById('quadro-saldos').replaceChildren();
      document.getElementById('linha-tempo').replaceChildren();
      document.getElementById('memoria-calculo').replaceChildren();
      ['cartoes-beneficio', 'extrato-creditos', 'comparacao-convencoes', 'quadro-leis-condenacoes']
        .forEach(function (id) { document.getElementById(id).replaceChildren(); });
      exibirPrescricao({});
      document.getElementById('comparacao-condenacoes').hidden = true;
      exibirResumoGrafico({}, dados.dataCalculo);
      document.getElementById('tabela-conferencia-atestado').replaceChildren();
      document.getElementById('tabela-conferencia-atestado').hidden = true;
      document.getElementById('textos-impugnacao-atestado').replaceChildren();
      document.getElementById('status-conferencia-atestado').textContent = 'Preencha os dados do atestado para comparar datas e totais.';
      if (dados.erros) {
        document.getElementById('status-motor').textContent = 'Confira os campos marcados antes de calcular.';
        return;
      }
      var motor = root.CalcPenCore || root.CalculadoraExecucaoPenal || root.CalcEngine || root.CalculadoraExecucao || root;
      var calcular = motor && motor.calcular;
      var elementos = {
        painel: painel,
        status: document.getElementById('status-motor'),
        avisos: document.getElementById('avisos-resultado'),
        quadroDatas: document.getElementById('quadro-datas'),
        quadroSaldos: document.getElementById('quadro-saldos'),
        versoes: document.getElementById('versoes-resultado'),
        linhaTempo: document.getElementById('linha-tempo'),
        memoria: document.getElementById('memoria-calculo')
      };
      if (typeof calcular !== 'function') {
        elementos.status.textContent = 'O motor de cálculo ainda não está disponível. Os dados não foram calculados.';
        painel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      try {
        var resultado = calcular.call(motor, dados.entrada, dados.dataCalculo, opcoesAtuais());
        if (resultado && Array.isArray(resultado.erros) && resultado.erros.length) {
          elementos.status.textContent = 'Não foi possível calcular. Revise os dados informados.';
          exibirAvisos(resultado.erros.map(function (erro) { return erro.campo + ': ' + erro.mensagem; }), elementos.avisos);
          return;
        }
        var cenarios = typeof motor.gerarCenarios === 'function'
          ? motor.gerarCenarios(dados.entrada, dados.dataCalculo, opcoesAtuais())
          : [];
        var cenarioE37 = cenarioProgressaoEspecial(dados.entrada, resultado || {}, function (entrada, dataCalculo, opcoes) {
          return calcular.call(motor, entrada, dataCalculo, opcoes);
        }, dados.dataCalculo, opcoesAtuais());
        if (cenarioE37) cenarios.push(cenarioE37);
        resultado = resultadoComPrecedenteVinculante(resultado || {}, cenarios);
        complementarAvisosCenarios(resultado, cenarios);
        if (integracaoEntrada) {
          resultado.avisos = (resultado.avisos || []).concat({
            texto: 'Triagem · Todos os dados recebidos estão a conferir. Confira o documento antes de tomar qualquer decisão.',
            regra: 'I04'
          }, textos.pendencias(dados.entrada.pendencias, dados.entrada));
        }
        exibirResultado(resultado, elementos);
        exibirPrescricao(resultado, dados.entrada);
        exibirResumoGrafico(resultado, dados.dataCalculo);
        exibirCortesHistoricos(resultado, document.getElementById('tabela-cortes-historicos'));
        exibirCartoesBeneficio(resultado, document.getElementById('cartoes-beneficio'));
        exibirExtratoCreditos(resultado, document.getElementById('extrato-creditos'));
        exibirLeisCondenacoes(
          resultado,
          document.getElementById('comparacao-condenacoes'),
          document.getElementById('quadro-leis-condenacoes')
        );
        exibirComparacaoConvencoes(
          dados.entrada, dados.dataCalculo, resultado, opcoesAtuais(), motor,
          document.getElementById('comparacao-convencoes')
        );
        var dataEmissao = dados.entrada.atestadoSEEU && dados.entrada.atestadoSEEU.dataEmissao;
        var referenciaConferencia = dados.dataCalculo;
        var resultadoConferencia = resultado || {};
        if (typeof dataEmissao === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataEmissao) &&
            Number.isFinite(Date.parse(dataEmissao + 'T00:00:00Z'))) {
          var resultadoEmissao = calcular.call(motor, dados.entrada, dataEmissao, opcoesAtuais());
          if (resultadoEmissao && !resultadoEmissao.erros) {
            referenciaConferencia = dataEmissao;
            resultadoConferencia = resultadoEmissao;
          }
        }
        var cenariosConferencia = cenarios;
        if (referenciaConferencia !== dados.dataCalculo) {
          cenariosConferencia = typeof motor.gerarCenarios === 'function'
            ? motor.gerarCenarios(dados.entrada, referenciaConferencia, opcoesAtuais())
            : [];
          var cenarioE37Conferencia = cenarioProgressaoEspecial(
            dados.entrada, resultadoConferencia, function (entrada, dataCalculo, opcoes) {
              return calcular.call(motor, entrada, dataCalculo, opcoes);
            }, referenciaConferencia, opcoesAtuais()
          );
          if (cenarioE37Conferencia) cenariosConferencia.push(cenarioE37Conferencia);
          resultadoConferencia = resultadoComPrecedenteVinculante(resultadoConferencia, cenariosConferencia);
        }
        var conferenciaDatas = motor.comparar
          ? motor.comparar({
            entrada: dados.entrada, dataCalculo: referenciaConferencia, resultado: resultadoConferencia,
            oficial: dados.entrada.atestadoSEEU, fonteOficial: rotuloFonteOficial(),
            opcoes: opcoesAtuais(), cenarios: cenariosConferencia
          })
          : root.Explicador && typeof resultado === 'object'
          ? root.Explicador.explicarDivergencias({
            entrada: dados.entrada,
            dataCalculo: referenciaConferencia,
            resultado: resultadoConferencia,
            atestadoSEEU: dados.entrada.atestadoSEEU,
            fonteOficial: rotuloFonteOficial(),
            opcoes: opcoesAtuais(),
            cenarios: cenariosConferencia,
            calcular: function (entrada, dataCalculo, opcoes) {
              return calcular.call(motor, entrada, dataCalculo, opcoes);
            }
          })
          : [];
        var linhasConferencia = exibirConferencia(
          resultadoConferencia, dados.entrada.atestadoSEEU || {}, conferenciaDatas, rotuloFonteOficial()
        );
        exibirResumoIntegracao(
          resultadoConferencia, conferenciaDatas, dados.entrada, referenciaConferencia,
          referenciaConferencia === dataEmissao,
          calculoRecebido && calculoRecebido.leituraDocumento?.versaoDocumento?.tipo === 'seeu-relatorio'
            ? calculoRecebido.leituraDocumento.conferencias : [],
          calculoRecebido && calculoRecebido.leituraDocumento?.versaoDocumento?.tipo === 'seeu-relatorio'
            ? calculoRecebido.leituraDocumento : null
        );
        exibirCenarios(cenarios, containerCenarios, secaoCenarios);
        atualizarImpressao(resultado, dados.dataCalculo, cenarios, linhasConferencia, rotuloFonteOficial());
        calculoAtual = {
          formato: 'calcpen',
          versao: 1,
          entrada: dados.entrada,
          dataCalculo: dados.dataCalculo,
          opcoes: opcoesAtuais(),
          resultado: resultado,
          regrasVersao: resultado.regrasVersao || null,
          fonteOficial: document.getElementById('fonte-calculo-oficial').value,
          caso: {
            pessoa: document.getElementById('pessoa-executada').value,
            processo: dados.entrada.processo || '',
            juizo: document.getElementById('juizo-execucao').value,
            conferido: document.getElementById('dados-conferidos').checked
          }
        };
        document.getElementById('salvar-calculo').disabled = false;
        var contadorResultado = document.querySelector('[data-contador="resultado"]');
        if (contadorResultado) contadorResultado.textContent = '✓';
        salvarCasoLocal();
      } catch (_) {
        elementos.status.textContent = 'Não foi possível calcular. Confira os dados e tente novamente.';
      }
      var alvoResultado = document.documentElement.classList.contains('modo-embutido')
        ? document.getElementById('resumo-integracao') : painel;
      alvoResultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('novo-calculo').addEventListener('click', function () {
      calculoAtual = null;
      limparCalculo(formulario, nomes, false);
      document.getElementById('data-calculo').focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('limpar-calculo').addEventListener('click', function () {
      calculoAtual = null;
      limparCalculo(formulario, nomes, true);
      document.getElementById('pessoa-executada').focus();
    });
    document.getElementById('exemplo-calculo').addEventListener('click', function () {
      calculoAtual = null;
      carregarExemplo();
      formulario.requestSubmit();
    });
    document.getElementById('salvar-calculo').addEventListener('click', function () {
      if (calculoAtual) salvarArquivoCalculo(calculoAtual);
    });
    document.getElementById('tabela-cortes-historicos').addEventListener('click', function (evento) {
      var botao = evento.target.closest('[data-usar-indulto]');
      if (!botao || !calculoAtual) return;
      var motor = root.CalcPenCore;
      if (!motor || typeof motor.simularIndulto !== 'function') {
        document.getElementById('status-motor').textContent = 'O módulo de indulto não está disponível.';
        return;
      }
      var opcoesIndulto = Object.assign({}, calculoAtual.opcoes, {
        dataReferencia: botao.getAttribute('data-usar-indulto')
      });
      var resultados = motor.simularIndulto(calculoAtual.entrada, calculoAtual.dataCalculo, opcoesIndulto);
      if (!Array.isArray(resultados)) {
        document.getElementById('status-motor').textContent =
          'Não foi possível simular o decreto. Confira os dados e tente novamente.';
        return;
      }
      var resultado = resultados.find(function (item) { return item.dataReferencia === botao.getAttribute('data-usar-indulto'); });
      if (!resultado) {
        document.getElementById('status-motor').textContent = 'Não há decreto catalogado para este corte.';
        return;
      }
      calculoAtual.resultado.indulto = resultado;
      exibirResultadoIndulto(resultado);
      document.getElementById('status-motor').textContent =
        'Triagem do Decreto ' + resultado.decreto + ' a conferir. Nenhum resultado substitui a decisão judicial.';
    });
    document.getElementById('gerar-minuta-indulto').addEventListener('click', function (evento) {
      evento.preventDefault();
      if (!calculoAtual || !calculoAtual.resultado || !calculoAtual.resultado.indulto) {
        document.getElementById('status-motor').textContent = 'Use um corte histórico antes de gerar a minuta.';
        return;
      }
      try {
        sessionStorage.setItem('calcpenal:minuta-indulto', JSON.stringify(calculoAtual));
        window.location.href = this.href;
      } catch (_) {
        document.getElementById('status-motor').textContent =
          'Não foi possível preparar a minuta neste navegador. Salve o cálculo e abra-o na página Minutas.';
      }
    });
    document.getElementById('gerar-minuta-prescricao').addEventListener('click', function (evento) {
      evento.preventDefault();
      if (!calculoAtual || !calculoAtual.resultado ||
          !Array.isArray(calculoAtual.resultado.prescricaoExecutoria)) {
        document.getElementById('status-motor').textContent =
          'Calcule a prescrição e confira os dados antes de gerar o pedido.';
        return;
      }
      try {
        sessionStorage.setItem('calcpenal:minuta-prescricao', JSON.stringify(calculoAtual));
        window.location.href = this.href;
      } catch (_) {
        document.getElementById('status-motor').textContent =
          'Não foi possível preparar o pedido neste navegador. Salve o cálculo e abra-o na página Minutas.';
      }
    });
    document.getElementById('abrir-calculo').addEventListener('click', function () {
      document.getElementById('arquivo-calculo').click();
    });
    document.getElementById('arquivo-calculo').addEventListener('change', function (evento) {
      var arquivo = evento.target.files && evento.target.files[0];
      if (!arquivo) return;
      calculoAtual = null;
      document.getElementById('salvar-calculo').disabled = true;
      arquivo.text().then(function (texto) {
        var calculo = JSON.parse(texto);
        if (calculo.formato !== 'calcpen' || calculo.versao !== 1 || !calculo.entrada ||
            (calculo.dataCalculo !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(calculo.dataCalculo))) {
          throw new Error('Arquivo .calcpen versão 1 inválido.');
        }
        preencherFormulario(calculo);
        if (calculo.fonteOficial) {
          document.getElementById('fonte-calculo-oficial').value = calculo.fonteOficial;
        }
        document.getElementById('status-motor').textContent =
          'Cálculo aberto. Os dados foram preenchidos; confira e recalcule.';
        if (!calculo.dataCalculo) {
          document.getElementById('resultado').hidden = true;
          document.getElementById('impressao').hidden = true;
          document.getElementById('status-motor').textContent =
            'Cálculo aberto. Informe a data do cálculo e confira os dados antes de calcular.';
          document.getElementById('data-calculo').focus();
          return;
        }
        formulario.requestSubmit();
      }).catch(function () {
        document.getElementById('status-motor').textContent =
          'Não foi possível abrir o arquivo. Selecione um .calcpen versão 1 válido.';
      }).finally(function () {
        evento.target.value = '';
      });
    });
    document.getElementById('selecionarDocumento').addEventListener('click', function () {
      document.getElementById('arquivoDocumento').click();
    });
    document.getElementById('arquivoDocumento').addEventListener('change', function (evento) {
      lerDocumento(evento.target.files && evento.target.files[0]);
      evento.target.value = '';
    });
    document.addEventListener('dragover', function (evento) {
      if (Array.from(evento.dataTransfer.types).includes('Files')) evento.preventDefault();
    });
    document.addEventListener('drop', function (evento) {
      if (!evento.dataTransfer.files.length) return;
      evento.preventDefault();
      if (evento.dataTransfer.files.length !== 1) {
        document.getElementById('estadoDocumento').textContent =
          'Escolha um documento por vez para conferir cada importação separadamente.';
        return;
      }
      lerDocumento(evento.dataTransfer.files[0]);
    });
    try {
      var chaveDocumento = 'calcpenal:documento-importado';
      var textoDocumento = sessionStorage.getItem(chaveDocumento);
      if (textoDocumento) {
        sessionStorage.removeItem(chaveDocumento);
        if (textoDocumento.length > 2000000) throw new Error();
        var documentoRecebido = JSON.parse(textoDocumento);
        if (documentoRecebido.formato !== 'calcpen-documento' || documentoRecebido.versao !== 1) {
          throw new Error();
        }
        mostrarDocumentoImportado(documentoRecebido, 'Importado da página Conferir atestado');
      }
    } catch (_) {
      document.getElementById('estadoDocumento').textContent =
        'Não foi possível abrir os dados importados. Volte à página de importação e tente novamente.';
    }
    document.getElementById('imprimir-resultado').addEventListener('click', function () {
      window.print();
    });
    if (root.CalcPenIntegracao && root.CalcPenCore) {
      var avisoIntegracao = criarElemento('p', 'nota');
      avisoIntegracao.id = 'status-integracao';
      avisoIntegracao.setAttribute('role', 'status');
      avisoIntegracao.hidden = true;
      formulario.before(avisoIntegracao);
      var processoIntegracao = criarElemento('section', 'painel');
      processoIntegracao.id = 'processo-integracao';
      processoIntegracao.hidden = true;
      formulario.before(processoIntegracao);
      root.CalcPenIntegracao.iniciar(root, root.CalcPenCore, function (calculo) {
        integracaoAtiva = true;
        calculoAtual = null;
        limparCalculo(formulario, nomes, false);
        preencherFormulario(calculo);
        document.getElementById('fonte-calculo-oficial').value = calculo.fonteOficial.toLowerCase();
        integracaoEntrada = calculo.entrada;
        function indicarAusencia(campo) {
          var opcao = criarElemento('option', '', 'Não informado — a conferir');
          opcao.value = '';
          campo.appendChild(opcao);
          campo.value = '';
        }
        nomes.forEach(function (nome) {
          document.querySelectorAll('#' + nome + ' .item-card').forEach(function (linha, indice) {
            var original = calculo.entrada[nome] && calculo.entrada[nome][indice];
            if (!original) return;
            linha.querySelectorAll('select[data-campo]').forEach(function (campo) {
              if (obterCampoObjeto(original, campo.getAttribute('data-campo')) == null) indicarAusencia(campo);
            });
            linha.querySelectorAll('input[type="checkbox"][data-campo]').forEach(function (campo) {
              if (obterCampoObjeto(original, campo.getAttribute('data-campo')) == null) {
                campo.checked = false;
                campo.indeterminate = true;
                campo.title = 'Não informado — a conferir';
              }
            });
          });
        });
        if (!calculo.entrada.regimeAtual) indicarAusencia(document.getElementById('regime-atual'));
        integracaoEstado = coletarEntrada(formulario, true);
        nomes.forEach(function (nome) {
          document.querySelectorAll('#' + nome + ' .item-card').forEach(function (linha, indice) {
            var original = calculo.entrada[nome] && calculo.entrada[nome][indice];
            var inicial = linhasColetadas.get(linha);
            if (original && inicial) integracaoLinhas.set(linha, {
              original: original, inicial: JSON.parse(JSON.stringify(inicial))
            });
          });
        });
        document.getElementById('dados-conferidos').checked = false;
        document.getElementById('status-caso').textContent = 'Dados recebidos apenas na memória, sem gravação automática.';
        avisoIntegracao.hidden = false;
        avisoIntegracao.textContent = 'Triagem · Todos os dados recebidos estão a conferir. Confira os campos, as pendências e o documento antes de tomar qualquer decisão.';
        exibirProcesso(calculo.leituraDocumento && calculo.leituraDocumento.processo, processoIntegracao);
        calculoRecebido = calculo;
        formulario.requestSubmit();
        if (!calculoAtual) {
          var pendencias = criarElemento('div');
          exibirAvisos(textos.pendencias(calculo.entrada.pendencias, calculo.entrada), pendencias);
          document.getElementById('avisos-resultado').appendChild(pendencias);
        }
        if (document.getElementById('tabela-conferencia-atestado').hidden) {
          exibirConferencia({}, calculo.entrada.atestadoSEEU || {}, [], rotuloFonteOficial());
        }
        var destino = document.documentElement.classList.contains('modo-embutido')
          ? document.getElementById('resumo-integracao') : document.getElementById('conferir-atestado');
        destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, function (mensagem) {
        avisoIntegracao.hidden = false;
        avisoIntegracao.textContent = mensagem;
      }, root.CalcPenIntegracaoConfig);
    }
  }

  var api = {
    normalizarData: normalizarData,
    dataExibida: dataExibida,
    formatarProcesso: formatarProcesso,
    diferencaDiasDatas: diferencaDiasDatas,
    textoDiferencaConvencao: textoDiferencaConvencao,
    classificarDiferenca: classificarDiferenca,
    rotuloFonteOficial: rotuloFonteOficial,
    montarLinhasConferencia: montarLinhasConferencia,
    exibirConferencia: exibirConferencia,
    exibirProcesso: exibirProcesso,
    valoresAtestadoCopilot: valoresAtestadoCopilot,
    temDadosAtestadoCopilot: temDadosAtestadoCopilot,
    exibirResultado: exibirResultado,
    atualizarImpressao: atualizarImpressao,
    exibirCartoesBeneficio: exibirCartoesBeneficio,
    exibirLeisCondenacoes: exibirLeisCondenacoes,
    exibirComparacaoConvencoes: exibirComparacaoConvencoes,
    exibirResumoGrafico: exibirResumoGrafico,
    exibirExtratoCreditos: exibirExtratoCreditos,
    montarCenario: montarCenario,
    cenarioProgressaoEspecial: cenarioProgressaoEspecial,
    resultadoComPrecedenteVinculante: resultadoComPrecedenteVinculante,
    complementarAvisosCenarios: complementarAvisosCenarios,
    itensAtencao: itensAtencao,
    coletarComutacoes: coletarComutacoes
  };
  root.VecUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializar);
    else inicializar();
  }
})(typeof window !== 'undefined' ? window : globalThis);
