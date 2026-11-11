(function (root, factory) {
  'use strict';
  var api = factory(root, root.Regras);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FerramentasRapidas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, Regras) {
  'use strict';

  if (typeof module === 'object' && module.exports) Regras = require('./regras.js');
  else Regras = Regras || root.Regras;

  var CONVENCOES = ['calendario', '365', '360'];
  var FRACOES = [
    { nome: '1/8', numerador: 1, denominador: 8 },
    { nome: '16%', numerador: 16, denominador: 100 },
    { nome: '1/6', numerador: 1, denominador: 6 },
    { nome: '1/5 (20%)', numerador: 20, denominador: 100 },
    { nome: '1/4 (25%)', numerador: 1, denominador: 4 },
    { nome: '3/10 (30%)', numerador: 30, denominador: 100 },
    { nome: '1/3', numerador: 1, denominador: 3 },
    { nome: '2/5 (40%)', numerador: 2, denominador: 5 },
    { nome: '1/2 (50%)', numerador: 1, denominador: 2 },
    { nome: '11/20 (55%)', numerador: 55, denominador: 100 },
    { nome: '3/5 (60%)', numerador: 3, denominador: 5 },
    { nome: '2/3', numerador: 2, denominador: 3 },
    { nome: '7/10 (70%)', numerador: 70, denominador: 100 },
    { nome: '3/4 (75%)', numerador: 75, denominador: 100 },
    { nome: '4/5 (80%)', numerador: 80, denominador: 100 },
    { nome: '17/20 (85%)', numerador: 85, denominador: 100 }
  ];

  function erro(mensagem) {
    throw new RangeError(mensagem);
  }

  function inteiroNaoNegativo(valor, campo) {
    if (!Number.isSafeInteger(valor) || valor < 0) erro(campo + ': informe um número inteiro igual ou maior que zero.');
    return valor;
  }

  function dataUTC(valor) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) erro('Data: informe uma data válida no formato AAAA-MM-DD.');
    var partes = valor.split('-').map(Number);
    var data = new Date(0);
    data.setUTCHours(0, 0, 0, 0);
    data.setUTCFullYear(partes[0], partes[1] - 1, partes[2]);
    if (data.getUTCFullYear() !== partes[0] || data.getUTCMonth() !== partes[1] - 1 || data.getUTCDate() !== partes[2]) {
      erro('Data: a data informada não existe. Confira o dia e o mês.');
    }
    return data;
  }

  function dataISO(data) {
    if (!Number.isFinite(data.getTime()) || data.getUTCFullYear() < 0 || data.getUTCFullYear() > 9999) {
      erro('Data: o resultado está fora do intervalo permitido.');
    }
    return String(data.getUTCFullYear()).padStart(4, '0') + '-' +
      String(data.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(data.getUTCDate()).padStart(2, '0');
  }

  function diferencaDias(inicio, fim) {
    return (dataUTC(fim).getTime() - dataUTC(inicio).getTime()) / 86400000;
  }

  function diasEntreDatas(inicio, fim, incluirUltimoDia) {
    if (incluirUltimoDia !== undefined && typeof incluirUltimoDia !== 'boolean') {
      erro('Último dia: informe se deve ser incluído.');
    }
    var diferenca = diferencaDias(inicio, fim);
    if (diferenca < 0) erro('Data final: deve ser igual ou posterior à data inicial.');
    return diferenca + (incluirUltimoDia === true ? 1 : 0);
  }

  function legendaContagemPeriodo(incluirUltimoDia) {
    return incluirUltimoDia
      ? 'Convenção E52: dias corridos, contando o primeiro e o último dia; use quando o intervalo inclui as duas datas.'
      : 'Convenção E52: dias corridos (data final − data inicial), sem contar o último dia; use para tempo transcorrido entre datas.';
  }

  function somarDias(data, dias) {
    if (!Number.isSafeInteger(dias)) erro('Dias: informe um número inteiro.');
    var resultado = dataUTC(data);
    resultado.setUTCDate(resultado.getUTCDate() + dias);
    return dataISO(resultado);
  }

  function somarMeses(data, anos, meses) {
    var origem = dataUTC(data);
    var totalMeses = origem.getUTCFullYear() * 12 + origem.getUTCMonth() + anos * 12 + meses;
    var ano = Math.floor(totalMeses / 12);
    var mes = ((totalMeses % 12) + 12) % 12;
    var ultimoDia = new Date(0);
    ultimoDia.setUTCHours(0, 0, 0, 0);
    ultimoDia.setUTCFullYear(ano, mes + 1, 0);
    var dia = Math.min(origem.getUTCDate(), ultimoDia.getUTCDate());
    var resultado = new Date(0);
    resultado.setUTCHours(0, 0, 0, 0);
    resultado.setUTCFullYear(ano, mes, dia);
    dataISO(resultado);
    return resultado;
  }

  function operarPeriodo(data, periodo, operacao) {
    if (operacao !== 'somar' && operacao !== 'subtrair') erro('Operação: escolha somar ou subtrair.');
    if (!periodo || typeof periodo !== 'object') erro('Período: informe anos, meses e dias.');
    var sinal = operacao === 'subtrair' ? -1 : 1;
    var anos = inteiroNaoNegativo(periodo.anos, 'Anos');
    var meses = inteiroNaoNegativo(periodo.meses, 'Meses');
    var dias = inteiroNaoNegativo(periodo.dias, 'Dias');
    var resultado = somarMeses(data, sinal * anos, sinal * meses);
    resultado.setUTCDate(resultado.getUTCDate() + sinal * dias);
    dataISO(resultado);
    return dataISO(resultado);
  }

  function convencaoValida(convencao) {
    if (CONVENCOES.indexOf(convencao) === -1) erro('Convenção: escolha calendário, 365/30 ou 360/30.');
  }

  function paraDias(pena, convencao, dataInicial) {
    convencaoValida(convencao);
    var anos = inteiroNaoNegativo(pena.anos, 'Anos');
    var meses = inteiroNaoNegativo(pena.meses, 'Meses');
    var dias = inteiroNaoNegativo(pena.dias, 'Dias');
    var total;
    if (convencao === 'calendario') {
      if (!dataInicial) erro('Data inicial: informe uma data para usar a convenção calendário.');
      var fim = somarMeses(dataInicial, anos, meses);
      total = diferencaDias(dataInicial, dataISO(new Date(fim.getTime() + dias * 86400000)));
    } else {
      total = anos * (convencao === '365' ? 365 : 360) + meses * 30 + dias;
    }
    if (!Number.isSafeInteger(total) || total < 0) erro('Pena: o total de dias está fora do intervalo permitido.');
    return total;
  }

  function deDias(dias, convencao, dataInicial) {
    convencaoValida(convencao);
    inteiroNaoNegativo(dias, 'Dias');
    if (convencao !== 'calendario') {
      var ano = convencao === '365' ? 365 : 360;
      var anos = Math.floor(dias / ano);
      var saldo = dias % ano;
      var meses = Math.floor(saldo / 30);
      return { anos: anos, meses: meses, dias: saldo % 30 };
    }
    if (!dataInicial) erro('Data inicial: informe uma data para usar a convenção calendário.');
    var fim = somarDias(dataInicial, dias);
    var inicioDate = dataUTC(dataInicial);
    var fimDate = dataUTC(fim);
    var anosCalendario = fimDate.getUTCFullYear() - inicioDate.getUTCFullYear();
    if (somarMeses(dataInicial, anosCalendario, 0) > fimDate) anosCalendario--;
    var mesesCalendario = (fimDate.getUTCFullYear() - inicioDate.getUTCFullYear()) * 12 +
      fimDate.getUTCMonth() - inicioDate.getUTCMonth() - anosCalendario * 12;
    if (somarMeses(dataInicial, anosCalendario, mesesCalendario) > fimDate) mesesCalendario--;
    var depoisDosMeses = dataISO(somarMeses(dataInicial, anosCalendario, mesesCalendario));
    return {
      anos: anosCalendario,
      meses: mesesCalendario,
      dias: diferencaDias(depoisDosMeses, fim)
    };
  }

  function calcularFracoes(pena, convencao, dataInicial) {
    var total = paraDias(pena, convencao, dataInicial);
    return FRACOES.map(function (fracao) {
      var diasInteiros = Math.floor(total / fracao.denominador) * fracao.numerador;
      var resto = total % fracao.denominador;
      return {
        nome: fracao.nome,
        dias: diasInteiros + Math.ceil(resto * fracao.numerador / fracao.denominador)
      };
    });
  }

  function calcularLapso(pena, numerador, denominador, criterio, convencao, dataInicial) {
    var total = paraDias(pena, convencao, dataInicial);
    inteiroNaoNegativo(numerador, 'Numerador');
    inteiroNaoNegativo(denominador, 'Denominador');
    if (numerador === 0 || denominador === 0 || numerador > denominador) {
      erro('Fração: informe numerador maior que zero e menor ou igual ao denominador.');
    }
    if (criterio !== 'ao-menos' && criterio !== 'mais-de') erro('Critério: escolha ao menos ou mais de.');
    var produto = total * numerador;
    if (!Number.isSafeInteger(produto)) erro('Fração: o cálculo excede o intervalo permitido.');
    var requisito = produto / denominador;
    return {
      penaDias: total,
      requisitoExato: requisito,
      dias: criterio === 'mais-de' ? Math.floor(requisito) + 1 : Math.ceil(requisito),
      criterio: criterio,
      regra: criterio === 'mais-de' ? 'E41' : 'D3'
    };
  }

  function consultarFracoes(condenacao, dataConsulta, opcoes) {
    if (!Regras || typeof Regras.menorFracao !== 'function') erro('Regras: a base de frações não está disponível.');
    var dados = Object.assign({
      antecedenteViolento: 'desconhecido',
      bonsAntecedentes: true
    }, condenacao || {});
    var progressao = Regras.menorFracao(dados, dataConsulta, opcoes);
    var regrasLC = Regras.regrasVedacaoLC(dados, dataConsulta);
    var fracaoLC = Regras.fracaoLC(dados, dataConsulta, opcoes);
    var regrasLCIds = regrasLC.map(function (item) { return item.id; });
    if (fracaoLC !== null && dados.reincidencia === 'primario' &&
        dados.bonsAntecedentes === false && regrasLCIds.indexOf('E45') === -1) {
      regrasLCIds.push('E45');
    }
    return {
      eraDoFato: Regras.eraDoFato(dados.dataFato),
      progressao: {
        fracao: progressao.fracao,
        regra: progressao.id,
        fonte: progressao.fonte,
        status: progressao.status,
        leiNaDataDoFato: progressao.leiNaDataDoFato,
        leiPosteriorMaisFavoravel: progressao.leiPosteriorMaisFavoravel,
        fundamentoEscolha: progressao.fundamentoEscolha,
        avisos: progressao.avisos
      },
      livramento: {
        fracao: fracaoLC,
        regra: regrasLCIds.length ? regrasLCIds : ['E41'],
        fonte: fracaoLC === null
          ? regrasLC.map(function (item) { return item.fundamento; }).join('; ')
          : regrasLCIds.indexOf('E45') !== -1
            ? 'CP art. 83, I e II (E41); posição defensiva e cenário adverso por maus antecedentes (E45)'
            : 'CP art. 83, I, II e V (E41)',
        vedado: fracaoLC === null,
        alternativa: regrasLCIds.indexOf('E45') !== -1
          ? { fracao: 1 / 2, regra: 'E45', descricao: 'Mais de 1/2, cenário adverso' }
          : null
      }
    };
  }

  return {
    convencoes: CONVENCOES.slice(),
    fracoes: FRACOES.map(function (fracao) { return Object.assign({}, fracao); }),
    paraDias: paraDias,
    deDias: deDias,
    calcularFracoes: calcularFracoes,
    calcularLapso: calcularLapso,
    consultarFracoes: consultarFracoes,
    somarDias: somarDias,
    operarPeriodo: operarPeriodo,
    diferencaDias: diferencaDias,
    diasEntreDatas: diasEntreDatas,
    legendaContagemPeriodo: legendaContagemPeriodo
  };
});
