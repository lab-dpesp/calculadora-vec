(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Indulto = factory();
  }
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  function dataValida(valor) {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const [ano, mes, dia] = valor.split("-").map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    return data.getUTCFullYear() === ano &&
      data.getUTCMonth() === mes - 1 &&
      data.getUTCDate() === dia;
  }

  function umAnoAntes(valor) {
    const [ano, mes, dia] = valor.split("-").map(Number);
    return [String(ano - 1).padStart(4, "0"), String(mes).padStart(2, "0"), String(dia).padStart(2, "0")].join("-");
  }

  // D5: o padrão do projeto é a data do fato; a data do decreto aparece ao lado.
  function statusHediondez(condenacoes, decreto, campo) {
    if (!Array.isArray(condenacoes) || condenacoes.length === 0) {
      return { status: "inconclusivo", artigo: "art. 1º, I" };
    }

    let incompleto = false;
    let impeditivo = false;
    condenacoes.forEach((condenacao) => {
      let valor;
      if (campo === "hediondoNaDataDoFato") {
        valor = condenacao[campo];
      } else {
        const classificacao = Array.isArray(condenacao.classificacoesHediondez)
          ? condenacao.classificacoesHediondez.find((item) => item.data === decreto.dataDecreto)
          : null;
        valor = classificacao && classificacao.hediondo;
      }

      if (typeof valor !== "boolean") {
        incompleto = true;
      } else if (valor) {
        impeditivo = true;
      }
    });

    return {
      status: impeditivo ? "impedimento" : incompleto ? "inconclusivo" : "sem_impedimento",
      artigo: "art. 1º, I",
    };
  }

  // E71: considerar ocorrência, sanção reconhecida e ausência de mora estatal.
  function avaliarFaltaGrave(entrada, decreto) {
    const janela = {
      de: umAnoAntes(decreto.dataReferencia),
      ate: decreto.dataReferencia,
    };
    const avisos = [];
    const faltas = Array.isArray(entrada.faltasGraves) ? entrada.faltasGraves : [];
    const datas = faltas.map((falta) => ({
      fato: falta && falta.data || null,
      instauracao: falta && falta.dataInstauracao || null,
      reconhecimentoJudicial: falta &&
        (falta.dataReconhecimentoJudicial || falta.reconhecidaEm) || null,
      publicacaoDecreto: decreto.dataPublicacao,
    }));
    if (entrada.faltasGravesVerificadas !== true || !Array.isArray(entrada.faltasGraves)) {
      return {
        status: "inconclusivo",
        artigo: "art. 6º",
        janela,
        datas,
        avisos: ["Informe se o registro de faltas graves está completo para este cálculo."],
      };
    }

    let inconclusivo = false;
    let impedimento = false;
    entrada.faltasGraves.forEach((falta) => {
      if (!falta || !dataValida(falta.data)) {
        inconclusivo = true;
        avisos.push("Há falta grave sem data válida; confira o registro.");
        return;
      }
      const dataInstauracao = falta.dataInstauracao;
      const dataReconhecimento = falta.dataReconhecimentoJudicial || falta.reconhecidaEm;
      if ((dataInstauracao != null && !dataValida(dataInstauracao)) ||
          (dataReconhecimento != null && !dataValida(dataReconhecimento)) ||
          (dataInstauracao && dataInstauracao < falta.data) ||
          (dataInstauracao && dataReconhecimento && dataReconhecimento < dataInstauracao)) {
        inconclusivo = true;
        avisos.push("Há datas da apuração da falta inválidas ou fora de ordem; confira o fato, a instauração e o reconhecimento judicial.");
        return;
      }
      if (falta.data < janela.de || falta.data > janela.ate || falta.data > decreto.dataPublicacao) return;
      if (falta.data === decreto.dataPublicacao) {
        inconclusivo = true;
        avisos.push("Há falta na data da publicação; sem o horário, não é possível saber se ocorreu antes ou depois do decreto.");
        return;
      }
      if (falta.sancaoReconhecida === false) return;
      if (falta.sancaoReconhecida !== true || !dataInstauracao || !dataReconhecimento ||
          typeof falta.semMoraEstatal !== "boolean") {
        inconclusivo = true;
        avisos.push("Confirme as datas de instauração e de reconhecimento judicial, a sanção e se houve mora estatal no procedimento.");
        return;
      }
      if (falta.semMoraEstatal) impedimento = true;
    });

    return {
      status: impedimento ? "impedimento" : inconclusivo ? "inconclusivo" : "sem_impedimento",
      artigo: "art. 6º",
      janela,
      datas,
      avisos,
    };
  }

  function diasPena(pena, dataBase) {
    if (!pena || !["anos", "meses", "dias"].every((campo) =>
      Number.isInteger(pena[campo] || 0) && (pena[campo] || 0) >= 0)) return null;
    const [ano, mes, dia] = dataBase.split("-").map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    const mesesTotais = (pena.anos || 0) * 12 + (pena.meses || 0);
    const mesAlvo = mes - 1 + mesesTotais;
    const primeiroDia = new Date(Date.UTC(ano, mesAlvo, 1));
    const ultimoDia = new Date(Date.UTC(primeiroDia.getUTCFullYear(), primeiroDia.getUTCMonth() + 1, 0)).getUTCDate();
    data.setUTCFullYear(primeiroDia.getUTCFullYear(), primeiroDia.getUTCMonth(),
      Math.min(dia, ultimoDia));
    data.setUTCDate(data.getUTCDate() + (pena.dias || 0));
    return Math.round((data.getTime() - Date.UTC(ano, mes - 1, dia)) / 86400000);
  }

  function avaliarCondicoes(avaliacao, dados, resumo, dataReferencia) {
    if (!avaliacao) return null;
    const pendencias = [];
    const exigir = (valor, nome) => {
      if (valor == null) pendencias.push(nome);
      return valor;
    };
    const fracao = resumo.reincidenteNaDataReferencia == null ? null
      : resumo.reincidenteNaDataReferencia ? avaliacao.fracaoReincidente : avaliacao.fracaoPrimario;
    const tempoNecessario = (dias) => Number.isInteger(dias) && Number.isFinite(fracao)
      ? Math.ceil(dias * fracao) : null;
    const anoDias = (anos) => diasPena({ anos }, dataReferencia);
    let elegivel = true;

    switch (avaliacao.tipo) {
      case "pena_e_tempo": {
        const total = exigir(resumo.penaTotalDias, "pena total");
        const cumprido = exigir(resumo.tempoCumpridoDias, "tempo cumprido no corte");
        const reincidente = exigir(resumo.reincidenteNaDataReferencia, "reincidência");
        const violencia = exigir(resumo.violenciaNaDataReferencia, "violência");
        const maximo = anoDias(avaliacao.penaMaximaAnos);
        if (Number.isInteger(total) && total > maximo) elegivel = false;
        if (typeof violencia === "boolean" && violencia !== avaliacao.violencia) elegivel = false;
        const lapso = tempoNecessario(total);
        if (Number.isInteger(cumprido) && Number.isInteger(lapso) && cumprido < lapso) elegivel = false;
        if (reincidente == null) pendencias.push("fração aplicável");
        break;
      }
      case "tempo_ininterrupto": {
        const reincidente = exigir(resumo.reincidenteNaDataReferencia, "reincidência");
        const tempo = exigir(resumo.tempoIninterruptoDias, "tempo ininterrupto");
        const anos = reincidente === true ? avaliacao.anosReincidente : avaliacao.anosPrimario;
        if (Number.isInteger(tempo) && reincidente != null && tempo < anoDias(anos)) elegivel = false;
        break;
      }
      case "tempo_com_liberdade": {
        const reincidente = exigir(resumo.reincidenteNaDataReferencia, "reincidência");
        const tempo = exigir(resumo.tempoCumpridoDias, "tempo cumprido no corte");
        const liberdade = exigir(resumo.diasEmLiberdade, "tempo em liberdade");
        const anos = reincidente === true ? avaliacao.anosReincidente : avaliacao.anosPrimario;
        if (Number.isInteger(tempo) && reincidente != null && tempo < anoDias(anos)) elegivel = false;
        if (Number.isInteger(liberdade) && liberdade > anoDias(avaliacao.maxAnosEmLiberdade)) elegivel = false;
        break;
      }
      case "tempo_semiaberto": {
        const reincidente = exigir(resumo.reincidenteNaDataReferencia, "reincidência");
        const tempo = exigir(resumo.tempoSemiabertoIninterruptoDias, "tempo ininterrupto em regime semiaberto");
        const anos = reincidente === true ? avaliacao.anosReincidente : avaliacao.anosPrimario;
        if (Number.isInteger(tempo) && reincidente != null && tempo < anoDias(anos)) elegivel = false;
        break;
      }
      case "regime_ou_alternativa": {
        const reincidente = exigir(resumo.reincidenteNaDataReferencia, "reincidência");
        const cumprido = exigir(resumo.tempoCumpridoDias, "tempo cumprido no corte");
        const total = exigir(resumo.penaTotalDias, "pena total");
        const regimeAberto = resumo.regimeAtual == null ? null : resumo.regimeAtual === "aberto";
        const regimes = [regimeAberto, resumo.penaAlternativa,
          resumo.suspensaoCondicional];
        if (!regimes.includes(true)) {
          if (regimes.includes(null)) pendencias.push("regime aberto, pena alternativa ou suspensão condicional");
          else elegivel = false;
        }
        const lapso = tempoNecessario(total);
        if (Number.isInteger(cumprido) && Number.isInteger(lapso) && cumprido < lapso) elegivel = false;
        if (reincidente == null) pendencias.push("fração aplicável");
        break;
      }
      case "regime_e_saldo": {
        const reincidente = exigir(resumo.reincidenteNaDataReferencia, "reincidência");
        const saldo = exigir(resumo.saldoLivramentoDias, "saldo em livramento");
        const regimeAberto = resumo.regimeAtual == null ? null : resumo.regimeAtual === "aberto";
        const regimes = [regimeAberto, resumo.emLivramento];
        if (!regimes.includes(true)) {
          if (regimes.includes(null)) pendencias.push("regime aberto ou livramento condicional");
          else elegivel = false;
        }
        const anos = reincidente === true ? avaliacao.anosSaldoReincidente : avaliacao.anosSaldoPrimario;
        if (Number.isInteger(saldo) && reincidente != null && saldo > anoDias(anos)) elegivel = false;
        if (reincidente == null) pendencias.push("limite de saldo aplicável");
        break;
      }
      case "comutacao_geral": {
        const anterior = exigir(resumo.comutacaoAnterior, "comutação anterior");
        if (anterior === true) {
          pendencias.push("regra específica para comutação anterior");
          return { status: "a_conferir", itensAConferir: pendencias };
        }
        const reincidente = exigir(resumo.reincidenteNaDataReferencia, "reincidência");
        const cumprido = exigir(resumo.tempoCumpridoDias, "tempo cumprido no corte");
        const total = exigir(resumo.penaTotalDias, "pena total");
        const lapso = tempoNecessario(total);
        if (Number.isInteger(cumprido) && Number.isInteger(lapso) && cumprido < lapso) elegivel = false;
        if (reincidente == null) pendencias.push("fração aplicável");
        break;
      }
      default:
        return null;
    }

    return {
      status: elegivel ? pendencias.length ? "a_conferir" : "candidato_a_conferir"
        : "sem_candidato_automatico",
      itensAConferir: [...new Set(pendencias)],
    };
  }

  function avaliarHipoteses(requisitos, dados, resumo, dataReferencia) {
    return requisitos.map((requisito) => {
      const resposta = dados.requisitosPorArtigo &&
        dados.requisitosPorArtigo[requisito.artigo];
      const avaliacao = resposta === true || resposta === false ? null
        : avaliarCondicoes(requisito.avaliacao, dados, resumo, dataReferencia);
      const status = resposta === true ? "candidato_a_conferir"
        : resposta === false ? "sem_candidato_automatico"
          : avaliacao ? avaliacao.status : "a_conferir";
      return {
        artigo: requisito.artigo,
        criterio: requisito.criterio,
        status,
        regra: requisito.id || "E70",
        itensAConferir: avaliacao ? avaliacao.itensAConferir
          : status === "a_conferir" ? ["Confirme os requisitos desta hipótese do decreto."] : []
      };
    });
  }

  function resumirRequisitos(entrada, decreto, opcoes) {
    const dados = entrada.indulto && typeof entrada.indulto === "object"
      ? entrada.indulto : {};
    const resultadoMotor = opcoes && opcoes.resultadoMotor || {};
    const cortes = Array.isArray(entrada.cortesHistoricos)
      ? entrada.cortesHistoricos
      : Array.isArray(resultadoMotor.cortesHistoricos) ? resultadoMotor.cortesHistoricos : [];
    const corteHistorico = cortes.find((item) =>
      item && item.data === decreto.dataReferencia && item.status === "calculado");
    const tempoInformado = Number.isInteger(dados.tempoCumpridoDias) && dados.tempoCumpridoDias >= 0
      ? dados.tempoCumpridoDias
      : Number.isInteger(entrada.tempoCumpridoDias) && entrada.tempoCumpridoDias >= 0
        ? entrada.tempoCumpridoDias : null;
    const tempoCumpridoDias = tempoInformado != null
      ? tempoInformado : corteHistorico && corteHistorico.diasCumpridos;
    const origemTempo = tempoInformado != null
      ? dados.origemTempo || entrada.origemTempo || "informado"
      : corteHistorico ? "corte_historico" : null;
    const condenacoes = Array.isArray(entrada.condenacoes) ? entrada.condenacoes : [];
    const penas = condenacoes.map((condenacao) =>
      diasPena(condenacao && condenacao.pena, decreto.dataReferencia));
    const penaTotalDias = Number.isInteger(dados.penaTotalDias) && dados.penaTotalDias >= 0
      ? dados.penaTotalDias
      : penas.every(Number.isInteger) ? penas.reduce((total, dias) => total + dias, 0) : null;
    const partesPena = condenacoes.map((condenacao, indice) => {
      if (!Number.isInteger(penas[indice])) return null;
      const impeditiva = condenacao.impeditivoDecreto != null
        ? condenacao.impeditivoDecreto
        : condenacao.hediondoNaDataDoFato;
      return typeof impeditiva === "boolean" ? { dias: penas[indice], impeditiva } : null;
    });
    const partesCompletas = partesPena.length > 0 && partesPena.every(Boolean);
    const reincidente = typeof dados.reincidenteNaDataReferencia === "boolean"
      ? dados.reincidenteNaDataReferencia : null;
    const violencia = typeof dados.violenciaNaDataReferencia === "boolean"
      ? dados.violenciaNaDataReferencia : null;
    const comutacaoAnterior = typeof dados.comutacaoAnterior === "boolean"
      ? dados.comutacaoAnterior : null;
    const regimeInicialAberto = typeof dados.regimeInicialAberto === "boolean"
      ? dados.regimeInicialAberto
      : condenacoes.length && condenacoes.every((item) => typeof item.regimeInicial === "string")
        ? condenacoes.every((item) => item.regimeInicial === "aberto") : null;
    const saldoLivramentoDias = Number.isInteger(dados.saldoLivramentoDias) &&
      dados.saldoLivramentoDias >= 0 ? dados.saldoLivramentoDias : null;
    const tempoIninterruptoDias = Number.isInteger(dados.tempoIninterruptoDias) &&
      dados.tempoIninterruptoDias >= 0 ? dados.tempoIninterruptoDias : null;
    const tempoSemiabertoIninterruptoDias = Number.isInteger(dados.tempoSemiabertoIninterruptoDias) &&
      dados.tempoSemiabertoIninterruptoDias >= 0 ? dados.tempoSemiabertoIninterruptoDias : null;
    const diasEmLiberdade = Number.isInteger(dados.diasEmLiberdade) &&
      dados.diasEmLiberdade >= 0 ? dados.diasEmLiberdade : null;
    const emLivramento = typeof dados.emLivramento === "boolean" ? dados.emLivramento : null;
    const suspensaoCondicional = typeof dados.suspensaoCondicional === "boolean"
      ? dados.suspensaoCondicional : null;
    const itensAConferir = [];
    if (!Number.isInteger(tempoCumpridoDias)) itensAConferir.push("Informe o tempo cumprido no corte do decreto.");
    if (!Number.isInteger(penaTotalDias)) itensAConferir.push("Confira a pena total no corte do decreto.");
    if (!partesCompletas) itensAConferir.push("Classifique as penas impeditivas e não impeditivas do decreto.");
    if (reincidente == null) itensAConferir.push("Confirme a reincidência em 25/12.");
    if (violencia == null) itensAConferir.push("Confirme a existência de violência na data de referência.");
    if (comutacaoAnterior == null) itensAConferir.push("Informe se houve comutação anterior.");
    if (regimeInicialAberto == null) itensAConferir.push("Confirme o regime inicial das penas.");
    if (saldoLivramentoDias == null) itensAConferir.push("Informe o saldo em livramento condicional, se houver.");
    return {
      tempoCumpridoDias: Number.isInteger(tempoCumpridoDias) ? tempoCumpridoDias : null,
      origemTempo,
      penaTotalDias,
      penaImpeditivaDias: partesCompletas
        ? partesPena.filter((item) => item.impeditiva).reduce((total, item) => total + item.dias, 0) : null,
      penaNaoImpeditivaDias: partesCompletas
        ? partesPena.filter((item) => !item.impeditiva).reduce((total, item) => total + item.dias, 0) : null,
      reincidenteNaDataReferencia: reincidente,
      violenciaNaDataReferencia: violencia,
      comutacaoAnterior,
      penaAlternativa: typeof dados.penaAlternativa === "boolean" ? dados.penaAlternativa : null,
      regimeInicialAberto,
      regimeAtual: dados.regimeAtual || entrada.regimeAtual || null,
      saldoLivramentoDias,
      tempoIninterruptoDias,
      tempoSemiabertoIninterruptoDias,
      diasEmLiberdade,
      emLivramento,
      suspensaoCondicional,
      itensAConferir,
    };
  }

  // E70: cada simulação usa as datas fixas do decreto informado.
  function simular(entrada, decretos, opcoes) {
    if (!Array.isArray(decretos)) return [];
    entrada = entrada && typeof entrada === "object" ? entrada : {};

    return decretos.map((decreto) => {
      if (!decreto || !dataValida(decreto.dataDecreto) ||
          !dataValida(decreto.dataPublicacao) || !dataValida(decreto.dataReferencia)) {
        return { decreto: decreto && decreto.identificacao || null, erros: ["Dados de data inválidos no decreto."] };
      }

      const cenarioDataDoDecreto = statusHediondez(
        entrada.condenacoes,
        decreto,
        "hediondoNaDataDoDecreto",
      );
      const cenarioDataDoFato = statusHediondez(
        entrada.condenacoes,
        decreto,
        "hediondoNaDataDoFato",
      );
      const dadosIndulto = entrada.indulto && typeof entrada.indulto === "object"
        ? entrada.indulto : {};
      const requisitos = resumirRequisitos(entrada, decreto, opcoes);
      const hipotesesIndulto = avaliarHipoteses(
        Object.values(decreto.indulto || {}).flat(), dadosIndulto, requisitos, decreto.dataReferencia,
      );
      const hipotesesComutacao = avaliarHipoteses(
        Object.values(decreto.comutacao || {}).flat(), dadosIndulto, requisitos, decreto.dataReferencia,
      );
      const impedimentosEncontrados = [];
      const impedimentosAConferir = [];
      const impedimentosPorArtigo = dadosIndulto.impedimentosPorArtigo || {};
      (decreto.impedimentos || []).filter((item) => item.artigo !== "1º, I").forEach((impedimento) => {
        const confirmado = impedimentosPorArtigo[impedimento.artigo];
        if (confirmado === true) {
          impedimentosEncontrados.push({
            artigo: impedimento.artigo,
            criterio: impedimento.criterio,
            status: "impedimento",
            regra: impedimento.id || "E70",
          });
        } else if (confirmado !== false && impedimento.artigo !== "1º, I") {
          impedimentosAConferir.push(`${impedimento.artigo}: ${impedimento.criterio}`);
        }
      });
      if (cenarioDataDoFato.status === "impedimento") {
        if (!impedimentosEncontrados.some((item) => item.artigo === cenarioDataDoFato.artigo)) {
          impedimentosEncontrados.push({
            artigo: cenarioDataDoFato.artigo,
            status: cenarioDataDoFato.status,
            regra: "D5",
          });
        }
      } else if (cenarioDataDoFato.status === "inconclusivo") {
        requisitos.itensAConferir.push("Confirme a classificação de hediondez na data do fato.");
      }
      const faltaGrave = avaliarFaltaGrave(entrada, decreto);
      if (faltaGrave.status === "impedimento") {
        impedimentosEncontrados.push({
          artigo: faltaGrave.artigo,
          status: faltaGrave.status,
          regra: "E71",
        });
      } else if (faltaGrave.status === "inconclusivo") {
        requisitos.itensAConferir.push("Confirme o registro de faltas graves e os dados da apuração.");
      }
      const resultadoHipoteses = (itens) => ({
        status: itens.some((item) => item.status === "candidato_a_conferir")
          ? "candidato_a_conferir"
          : itens.every((item) => item.status === "sem_candidato_automatico")
            ? "sem_candidato_automatico" : "a_conferir",
        hipoteses: itens,
      });

      return {
        decreto: decreto.identificacao,
        dataReferencia: decreto.dataReferencia,
        requisitos,
        indulto: resultadoHipoteses(hipotesesIndulto),
        comutacao: resultadoHipoteses(hipotesesComutacao),
        impedimentosEncontrados,
        itensAConferir: [
          ...requisitos.itensAConferir,
          ...hipotesesIndulto.flatMap((item) => item.itensAConferir.map((texto) => `${item.artigo}: ${texto}`)),
          ...hipotesesComutacao.flatMap((item) => item.itensAConferir.map((texto) => `${item.artigo}: ${texto}`)),
          ...impedimentosAConferir,
        ],
        hediondez: {
          criterioAplicado: "data do fato (PD-01)",
          cenarioAplicado: cenarioDataDoFato,
          cenarioDataDoDecreto,
          aviso: "A classificação na data do decreto aparece como cenário alternativo (STJ, AgRg no REsp 2.235.288/TO).",
        },
        faltaGrave,
        avisos: [
          "Candidato automático não significa concessão; confirme os requisitos e os documentos.",
          "Sem candidato automático não significa que o benefício não cabe.",
          "A análise de mora estatal depende dos fatos do procedimento disciplinar.",
        ],
      };
    });
  }

  return { simular };
});
