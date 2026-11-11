(function (root, factory) {
  "use strict";

  const api = factory(root, root.Regras);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CalculadoraExecucaoPenal = api;
})(typeof globalThis === "object" ? globalThis : this, function (root, Regras) {
  "use strict";

  if (typeof module === "object" && module.exports) Regras = require("./regras.js");
  else Regras = Regras || root.Regras;

  const modulos = typeof module === "object" && module.exports
    ? require("../dados/modulos-provisorios.js") : root.DadosModulosProvisorios;
  const versao = typeof module === "object" && module.exports
    ? require("../package.json").version : "0.7.0";
  const DIA_MS = 86400000;
  const CORTE_LEI_13964 = "2020-01-23";
  const CORTE_FEMINICIDIO = "2024-10-09";
  const CORTE_ESCOPO = "1990-07-26";
  const CORTE_E39 = "2026-05-08";
  const REQUISITOS_E37 = [
    "gestanteMaeOuResponsavel", "semViolenciaOuGraveAmeaca", "naoContraFilhoOuDependente",
    "primaria", "bomComportamento", "naoIntegrouOrganizacaoCriminosa"
  ];

  // E39: períodos domiciliares anteriores à vigência ficam apenas no cenário defensivo.
  function remicaoDomiciliar(remicao) {
    return remicao && remicao.regime === "domiciliar";
  }

  function remicaoDomiciliarDefensiva(remicao) {
    return remicaoDomiciliar(remicao) && remicao.periodo && remicao.periodo.inicio < CORTE_E39;
  }

  // E37: os requisitos subjetivos e os fatos revogadores são informados, nunca presumidos.
  function avaliarProgressaoEspecial(entrada, dataCalculo, avisos) {
    const especial = entrada.progressaoEspecial;
    if (!especial || especial.solicitada !== true) return false;
    const eventosInformados = Array.isArray(especial.eventosRevogadores)
      ? especial.eventosRevogadores
      : [];
    const eventos = eventosInformados.filter((evento) =>
      evento && dataUTC(evento.data) && evento.data <= dataCalculo);
    const revogacaoReconhecida = eventos.some((evento) =>
      evento.situacao === "revogacao_reconhecida");
    const eventoPendente = eventosInformados.some((evento) =>
      evento && (!dataUTC(evento.data) ||
        !["revogacao_reconhecida", "sem_revogacao"].includes(evento.situacao)));
    let texto;
    let aplicavel = false;
    if (revogacaoReconhecida) {
      texto = "Progressão especial revogada por decisão reconhecida sobre novo crime doloso ou falta grave (art. 112, § 4º). Foram usadas as frações comuns.";
    } else if (dataCalculo < "2018-12-20") {
      texto = "Progressão especial indisponível antes da vigência da Lei 13.769/2018, em 20/12/2018.";
    } else if (REQUISITOS_E37.some((campo) => especial[campo] == null)) {
      const nomes = {
        gestanteMaeOuResponsavel: "condição de gestante, mãe ou responsável",
        semViolenciaOuGraveAmeaca: "ausência de violência ou grave ameaça",
        naoContraFilhoOuDependente: "ausência de crime contra filho ou dependente",
        primaria: "primariedade",
        bomComportamento: "bom comportamento comprovado pelo diretor",
        naoIntegrouOrganizacaoCriminosa: "não integração em organização criminosa"
      };
      const faltam = REQUISITOS_E37
        .filter((campo) => especial[campo] == null).map((campo) => nomes[campo]);
      texto = `Falta confirmar ${faltam.join(", ")}. Havendo notícia de novo crime doloso ou falta grave, indique a data e a decisão sobre a revogação.`;
    } else if (!REQUISITOS_E37.every((campo) => especial[campo] === true) ||
        entrada.condenacoes.some((item) => item.reincidencia !== "primario" ||
          ["violencia", "feminicidio", "comando_orcrim"].includes(item.natureza))) {
      texto = "Progressão especial não aplicada: confira todos os requisitos cumulativos e a ausência de fatos revogadores, inclusive nas condenações. Foram usadas as frações comuns.";
    } else {
      aplicavel = true;
      texto = eventoPendente || especial.novoCrimeDoloso === true || especial.faltaGrave === true
        ? "Falta confirmar a decisão sobre a revogação. Havendo notícia de novo crime doloso ou falta grave, indique a data e a decisão sobre a revogação. O fato histórico, por si só, não retira o 1/8."
        : "Progressão especial de 1/8. Confira os requisitos indicados abaixo.";
    }
    avisos.push({ regra: "E37", texto, status: "Pendente de validação" });
    avisos.push({
      regra: "E37",
      texto: "Organização criminosa: só a hipótese legal própria; associação para o tráfico ou associação criminosa não se equipara automaticamente (Tema 1.374/STJ — CONFERIR).",
      status: "Pendente de validação"
    });
    return aplicavel;
  }

  // E01/E03: datas são validadas e calculadas como dias UTC, sem horário.
  function dataUTC(valor) {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
    const data = new Date(`${valor}T00:00:00.000Z`);
    return Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor ? null : data;
  }

  function serializarData(data) {
    return data.toISOString().slice(0, 10);
  }

  function deslocarDias(data, dias) {
    return new Date(data.getTime() + dias * DIA_MS);
  }

  function avaliarEventoE13(evento, dataCalculo, condenacoes, avisos, erros) {
    if (evento == null) return null;
    if (!evento || typeof evento !== "object" || Array.isArray(evento)) {
      erros.push(erro("eventoE13", "Informe os dados do livramento em um objeto.", "E13"));
      return null;
    }
    if (evento.crimeDurante !== true) return null;
    ["dataCrime", "inicioPeriodoProva", "fimPeriodoProva"].forEach((campo) => {
      if (!dataUTC(evento[campo])) {
        erros.push(erro(`eventoE13.${campo}`, "Informe uma data válida no formato AAAA-MM-DD.", "E13"));
      }
    });
    if (typeof evento.penasUnificadas !== "boolean") {
      erros.push(erro("eventoE13.penasUnificadas", "Informe se as penas foram unificadas.", "E13"));
    }
    if (evento.condenacaoId != null && typeof evento.condenacaoId !== "string") {
      erros.push(erro("eventoE13.condenacaoId", "Informe o identificador da condenação nova.", "E13"));
    }
    if (evento.dataPrisao != null && !dataUTC(evento.dataPrisao)) {
      erros.push(erro("eventoE13.dataPrisao", "Informe uma data válida para a prisão pelo novo fato.", "E13"));
    }
    if (!["nao_revogado", "suspenso", "revogado"].includes(evento.situacao)) {
      erros.push(erro("eventoE13.situacao", "Informe se o livramento segue sem revogação, foi suspenso ou revogado.", "E13"));
    }
    const situacaoComplexa = evento.situacao === "suspenso" ||
      evento.situacao === "revogado" || evento.penasUnificadas === true;
    if (situacaoComplexa && !dataUTC(evento.dataDecisao)) {
      erros.push(erro("eventoE13.dataDecisao", "Informe a data da decisão de suspensão, revogação ou unificação.", "E13"));
    }
    if (evento.dataDecisao != null && !dataUTC(evento.dataDecisao)) {
      erros.push(erro("eventoE13.dataDecisao", "Informe uma data válida no formato AAAA-MM-DD.", "E13"));
    }
    if (erros.some((item) => item.regra === "E13") || !dataCalculo) return null;
    if (evento.dataCrime < evento.inicioPeriodoProva || evento.dataCrime > evento.fimPeriodoProva) {
      erros.push(erro("eventoE13.dataCrime", "A data do novo crime deve estar dentro do período de prova informado.", "E13"));
      return null;
    }
    if (evento.fimPeriodoProva > serializarData(dataCalculo)) {
      erros.push(erro("eventoE13.fimPeriodoProva", "O fim do período de prova não pode ser posterior à data do cálculo.", "E13"));
      return null;
    }
    if (evento.dataPrisao && evento.dataPrisao < evento.dataCrime) {
      erros.push(erro("eventoE13.dataPrisao", "A prisão pelo novo fato não pode anteceder a data do fato.", "E13"));
      return null;
    }
    if (evento.dataPrisao && evento.dataPrisao > serializarData(dataCalculo)) {
      erros.push(erro("eventoE13.dataPrisao", "A prisão pelo novo fato não pode ser posterior à data do cálculo.", "E13"));
      return null;
    }
    if (evento.dataDecisao && evento.dataDecisao > serializarData(dataCalculo)) {
      erros.push(erro("eventoE13.dataDecisao", "A data da decisão não pode ser posterior à data do cálculo.", "E13"));
      return null;
    }
    const dataInicioExecucao = evento.situacao === "nao_revogado" &&
      evento.penasUnificadas === false
      ? serializarData(deslocarDias(dataUTC(evento.fimPeriodoProva), 1))
      : null;
    const baseAplicavel = dataInicioExecucao && condenacoes.length === 1 &&
      condenacoes[0].id === evento.condenacaoId;
    if (dataInicioExecucao && !baseAplicavel) {
      avisos.push({
        regra: "E13",
        texto: "Tema 1.367/STJ. Confirme o fim do período de prova e a situação do livramento e das penas. Identifique a condenação nova; em execução conjunta, informe a decisão e reconstrua as datas."
      });
      return {
        dataCrime: evento.dataCrime,
        dataPrisao: evento.dataPrisao || null,
        condenacaoId: evento.condenacaoId || null,
        situacao: evento.situacao,
        dataDecisao: evento.dataDecisao || null,
        penasUnificadas: evento.penasUnificadas,
        dataInicioExecucao: null,
        dataInicioInformada: dataInicioExecucao
      };
    }
    avisos.push({
      regra: "E13",
      texto: situacaoComplexa
        ? "Tema 1.367/STJ. Confirme o fim do período de prova e a situação do livramento e das penas; reconstrua as datas a partir da decisão informada."
        : "Tema 1.367/STJ. Confirme o fim do período de prova e a situação do livramento e das penas."
    });
    return {
      dataCrime: evento.dataCrime,
      dataPrisao: evento.dataPrisao || null,
      condenacaoId: evento.condenacaoId || null,
      situacao: evento.situacao,
      dataDecisao: evento.dataDecisao || null,
      penasUnificadas: evento.penasUnificadas,
      dataInicioExecucao,
      dataInicioInformada: dataInicioExecucao
    };
  }

  function adicionarMeses(data, meses) {
    const ano = data.getUTCFullYear();
    const mes = data.getUTCMonth() + meses;
    const dia = data.getUTCDate();
    const primeiroDia = new Date(Date.UTC(ano, mes, 1));
    const ultimoDia = new Date(Date.UTC(primeiroDia.getUTCFullYear(), primeiroDia.getUTCMonth() + 1, 0)).getUTCDate();
    if (dia > ultimoDia) {
      primeiroDia.setUTCMonth(primeiroDia.getUTCMonth() + 1);
      return primeiroDia;
    }
    primeiroDia.setUTCDate(dia);
    return primeiroDia;
  }

  function adicionarDuracao(data, pena) {
    const comAnos = adicionarMeses(data, pena.anos * 12);
    return deslocarDias(adicionarMeses(comAnos, pena.meses), pena.dias);
  }

  function diasEntre(inicio, fim) {
    return Math.round((fim.getTime() - inicio.getTime()) / DIA_MS);
  }

  // E04: a conversão para dias segue D1, sem usar relógio local.
  function diasPena(pena, dataBase, convencao) {
    if (convencao === "360") return pena.anos * 360 + pena.meses * 30 + pena.dias;
    if (convencao === "365") return pena.anos * 365 + pena.meses * 30 + pena.dias;
    return diasEntre(dataBase, adicionarDuracao(dataBase, pena));
  }

  function validarInteiroNaoNegativo(valor) {
    return Number.isInteger(valor) && valor >= 0;
  }

  function validarSaldosCondenacoes(saldos, campo, condenacoes, regra, erros) {
    if (saldos == null) return;
    if (!Array.isArray(saldos)) {
      erros.push(erro(campo, "Informe os saldos por condenação em uma lista.", regra));
      return;
    }
    const ids = new Set();
    saldos.forEach((saldo, indice) => {
      const campoSaldo = `${campo}[${indice}]`;
      if (!saldo || typeof saldo.condenacaoId !== "string" || !saldo.condenacaoId.trim() ||
          !condenacoes.some((condenacao) => condenacao && condenacao.id === saldo.condenacaoId)) {
        erros.push(erro(`${campoSaldo}.condenacaoId`, "Informe o código de uma condenação existente.", regra));
      } else if (ids.has(saldo.condenacaoId)) {
        erros.push(erro(`${campoSaldo}.condenacaoId`, "Informe cada condenação uma única vez.", regra));
      } else {
        ids.add(saldo.condenacaoId);
      }
      if (!validarInteiroNaoNegativo(saldo && saldo.dias)) {
        erros.push(erro(`${campoSaldo}.dias`, "Informe o saldo em dias como inteiro não negativo.", regra));
      }
    });
  }

  function erro(campo, mensagem, regra) {
    return { campo, mensagem, regra };
  }

  // E27: detrações inclusivas são unidas; interrupções excluem o dia da retomada.
  function intervaloDias(intervalos, dataCalculo, erroCampo, erros, fimExclusivo) {
    const convertidos = [];
    intervalos.forEach((intervalo, indice) => {
      if (!intervalo || typeof intervalo !== "object") {
        erros.push(erro(`${erroCampo}[${indice}]`, "Informe um período válido.", "E90"));
        return;
      }
      const inicio = dataUTC(intervalo.inicio);
      let fim = intervalo.fim == null ? dataCalculo : dataUTC(intervalo.fim);
      if (!inicio || !fim) {
        erros.push(erro(`${erroCampo}[${indice}]`, "Informe início e fim válidos no formato AAAA-MM-DD.", "E90"));
        return;
      }
      if (fim > dataCalculo) fim = dataCalculo;
      if (inicio > fim) {
        erros.push(erro(`${erroCampo}[${indice}]`, "O início do período deve ser anterior ou igual ao fim.", "E90"));
        return;
      }
      convertidos.push({ inicio, fim });
    });

    convertidos.sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);
    let dias = 0;
    let sobreposto = false;
    let atual = null;
    convertidos.forEach((intervalo) => {
      if (!atual) {
        atual = { ...intervalo };
      } else if (intervalo.inicio <= (fimExclusivo ? atual.fim : deslocarDias(atual.fim, 1))) {
        if (intervalo.inicio < atual.fim || (!fimExclusivo && intervalo.inicio <= atual.fim)) sobreposto = true;
        if (intervalo.fim > atual.fim) atual.fim = intervalo.fim;
      } else {
        dias += diasEntre(atual.inicio, atual.fim) + (fimExclusivo ? 0 : 1);
        atual = { ...intervalo };
      }
    });
    if (atual) dias += diasEntre(atual.inicio, atual.fim) + (fimExclusivo ? 0 : 1);
    return { dias, sobreposto };
  }

  function prepararDetracoesCautelares(registros, intervalos, dataCalculo, erros, avisos) {
    const porData = new Map();
    let diasRepetidos = false;
    registros.forEach((registro, indice) => {
      const data = registro && dataUTC(registro.data);
      if (!data || !validarInteiroNaoNegativo(registro.horas) || registro.horas > 24) {
        erros.push(erro(
          `detracoesCautelares[${indice}]`,
          "Informe uma data válida e horas inteiras de 0 a 24.",
          "E27-A"
        ));
        return;
      }
      const chave = serializarData(data);
      if (porData.has(chave)) {
        diasRepetidos = true;
        porData.set(chave, Math.max(porData.get(chave), registro.horas));
      } else {
        porData.set(chave, registro.horas);
      }
    });

    const diasSobrepostos = new Set();
    const dataLimite = serializarData(dataCalculo || new Date(0));
    for (const [data, horas] of porData) {
      if (horas === 0 || data > dataLimite) continue;
      const sobrepoe = intervalos.some((intervalo) => {
        if (!intervalo || !dataUTC(intervalo.inicio)) return false;
        const inicio = intervalo.inicio;
        const fim = intervalo.fim == null || intervalo.fim > dataLimite
          ? dataLimite : intervalo.fim;
        return data >= inicio && data <= fim;
      });
      if (sobrepoe) {
        diasSobrepostos.add(data);
        porData.set(data, 0);
      }
    }

    if (diasRepetidos || diasSobrepostos.size) {
      avisos.push({
        texto: "Dias cautelares repetidos ou sobrepostos a outras detrações foram contados uma única vez.",
        regra: "E27-A"
      });
    }

    const dias = [...porData.entries()]
      .filter(([data, horas]) => data <= dataLimite && horas > 0)
      .sort(([dataA], [dataB]) => dataA.localeCompare(dataB));
    const prefixos = [];
    let acumulado = 0;
    dias.forEach(([data, horas]) => {
      acumulado += horas;
      prefixos.push({ data, horas: acumulado });
    });
    return {
      diasAte(data) {
        const limite = serializarData(data);
        let inicio = 0;
        let fim = prefixos.length;
        while (inicio < fim) {
          const meio = Math.floor((inicio + fim) / 2);
          if (prefixos[meio].data <= limite) inicio = meio + 1;
          else fim = meio;
        }
        return inicio ? Math.floor(prefixos[inicio - 1].horas / 24) : 0;
      },
      quantidade: dias.length
    };
  }

  // E96: dias sem custódia entre períodos de prisão são interrupções.
  function interrupcoesEntrePrisoes(prisoes, dataCalculo, base) {
    const periodos = prisoes
      .map((prisao) => {
        const inicio = prisao && dataUTC(prisao.inicio);
        const fimInformado = !prisao || prisao.fim == null ? dataCalculo : dataUTC(prisao.fim);
        if (!inicio || !fimInformado || fimInformado < base || inicio > dataCalculo) return null;
        return {
          inicio: inicio < base ? base : inicio,
          fim: fimInformado > dataCalculo ? dataCalculo : fimInformado
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);
    const unidos = [];
    periodos.forEach((periodo) => {
      const atual = unidos[unidos.length - 1];
      if (atual && periodo.inicio <= deslocarDias(atual.fim, 1)) {
        if (periodo.fim > atual.fim) atual.fim = periodo.fim;
      } else {
        unidos.push({ ...periodo });
      }
    });

    const interrupcoes = [];
    let inicioInterrupcao = base;
    unidos.forEach((periodo) => {
      if (periodo.inicio > inicioInterrupcao) {
        interrupcoes.push({
          inicio: serializarData(inicioInterrupcao),
          fim: serializarData(periodo.inicio),
          motivo: "soltura"
        });
      }
      const proximoDia = deslocarDias(periodo.fim, 1);
      if (proximoDia > inicioInterrupcao) inicioInterrupcao = proximoDia;
    });
    if (inicioInterrupcao <= dataCalculo) {
      interrupcoes.push({ inicio: serializarData(inicioInterrupcao), fim: null, motivo: "soltura" });
    }
    return interrupcoes;
  }

  function somarPenas(condenacoes) {
    return condenacoes.reduce((total, condenacao) => ({
      anos: total.anos + condenacao.pena.anos,
      meses: total.meses + condenacao.pena.meses,
      dias: total.dias + condenacao.pena.dias
    }), { anos: 0, meses: 0, dias: 0 });
  }

  function normalizarPena(pena) {
    const mesesTotais = pena.meses + Math.floor(pena.dias / 30);
    return {
      anos: pena.anos + Math.floor(mesesTotais / 12),
      meses: mesesTotais % 12,
      dias: pena.dias % 30
    };
  }

  function decomporDias(dias, convencao, dataBase) {
    if (convencao === "360" || convencao === "365") {
      const diasAno = convencao === "360" ? 360 : 365;
      const anos = Math.floor(dias / diasAno);
      const restante = dias - anos * diasAno;
      const meses = Math.floor(restante / 30);
      return { anos, meses, dias: restante - meses * 30, emDias: dias };
    }

    const fim = deslocarDias(dataBase, dias);
    let anos = Math.max(0, fim.getUTCFullYear() - dataBase.getUTCFullYear());
    while (anos > 0 && adicionarDuracao(dataBase, { anos, meses: 0, dias: 0 }) > fim) anos--;
    let cursor = adicionarDuracao(dataBase, { anos, meses: 0, dias: 0 });
    let meses = 0;
    while (meses < 11 && adicionarMeses(cursor, meses + 1) <= fim) meses++;
    cursor = adicionarMeses(cursor, meses);
    return { anos, meses, dias: diasEntre(cursor, fim), emDias: dias };
  }

  function origemCopilot(entrada) {
    return entrada.importado === true
      || entrada.importadoDoCopilot === true
      || (typeof entrada.origem === "string" && entrada.origem.toLowerCase() === "copilot")
      || entrada.formato === "calcpenal-copilot";
  }

  function validarOrigem(entrada, erros) {
    if (!origemCopilot(entrada)) return;
    ["condenacoes", "prisoes", "interrupcoes", "detracoes", "detracoesCautelares", "remicoes", "faltasGraves", "progressoes", "regressoes"].forEach((campo) => {
      (Array.isArray(entrada[campo]) ? entrada[campo] : []).forEach((item, indice) => {
        if (!item || typeof item.origem !== "string" || !item.origem.trim()) {
          erros.push(erro(`${campo}[${indice}].origem`, "Informe de onde veio este dado importado.", "E93"));
        }
        if (["faltasGraves", "prisoes", "regressoes"].includes(campo)) {
          (Array.isArray(item && item.saldosCondenacoes) ? item.saldosCondenacoes : [])
            .forEach((saldo, saldoIndice) => {
              if (!saldo || typeof saldo.origem !== "string" || !saldo.origem.trim()) {
                erros.push(erro(
                  `${campo}[${indice}].saldosCondenacoes[${saldoIndice}].origem`,
                  "Informe de onde veio este saldo importado.",
                  "E93"
                ));
              }
            });
        }
      });
    });
  }

  function diasIntervalosAte(intervalos, data, fimExclusivo) {
    const limite = serializarData(data);
    const truncados = intervalos.map((item) => ({
      inicio: item.inicio,
      fim: item.fim && item.fim < limite ? item.fim : limite
    })).filter((item) => item.inicio <= limite);
    return intervaloDias(truncados, data, "intervalos", [], fimExclusivo).dias;
  }

  // D7: reconhece prisão cautelar seguida de retorno à execução definitiva.
  function identificarCenarioD7(prisoes) {
    const definitivas = (Array.isArray(prisoes) ? prisoes : [])
      .filter((prisao) => prisao && prisao.tipo !== "provisoria" &&
        dataUTC(prisao.inicio) && (prisao.fim == null || dataUTC(prisao.fim)))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
    const cautelares = (Array.isArray(prisoes) ? prisoes : [])
      .filter((prisao) => prisao && prisao.tipo === "provisoria" &&
        dataUTC(prisao.inicio) && dataUTC(prisao.fim))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
    for (const cautelar of cautelares) {
      const houveDefinitivaEncerrada = definitivas.some((prisao) =>
        prisao.fim && prisao.inicio < cautelar.inicio && prisao.fim < cautelar.inicio);
      const primeiraPrisao = (Array.isArray(prisoes) ? prisoes : [])
        .filter((prisao) => prisao && dataUTC(prisao.inicio) && dataUTC(prisao.fim) &&
          prisao.inicio < cautelar.inicio && prisao.fim < cautelar.inicio)
        .sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
      const retorno = definitivas.find((prisao) =>
        prisao.inicio > cautelar.fim);
      if (houveDefinitivaEncerrada && primeiraPrisao && retorno) {
        return {
          primeiraPrisao: primeiraPrisao.inicio,
          prisaoCautelar: cautelar.inicio,
          fimCautelar: cautelar.fim,
          retornoDefinitiva: retorno.inicio
        };
      }
    }
    return null;
  }

  function requisitoPorSaldos(penas, saldos, opcoes) {
    const porId = new Map((saldos || []).map((item) => [item.condenacaoId, item.dias]));
    if (penas.some((item) => !porId.has(item.condenacao.id))) return null;
    return penas.reduce((soma, item) =>
      soma + arredondarRequisito(porId.get(item.condenacao.id) * item.fracaoPR, opcoes), 0);
  }

  function saldoRemanescente(saldoGlobal, penas, saldos, opcoes) {
    const fracaoComum = penas.every((item) => item.fracaoPR === penas[0].fracaoPR);
    if (saldos && saldos.length) {
      const requisitoInformado = requisitoPorSaldos(penas, saldos, opcoes);
      if (requisitoInformado !== null) {
        return { requisito: requisitoInformado, estimativa: false };
      }
    }
    if (fracaoComum) {
      return {
        requisito: arredondarRequisito(saldoGlobal * penas[0].fracaoPR, opcoes),
        estimativa: false
      };
    }
    return {
      requisito: requisitoDistribuido(saldoGlobal, penas, penas.reduce((soma, item) => soma + item.dias, 0), opcoes),
      estimativa: true
    };
  }

  // D8: o método TJSP exige saldo identificado por condenação após novo recolhimento ou regressão.
  function marcoProgressaoTJSP(entrada, dataCalculo) {
    const prisoes = (entrada.prisoes || [])
      .filter((item) => item && item.tipo !== "provisoria" &&
        dataUTC(item.inicio) && item.inicio <= dataCalculo)
      .map((item) => ({
        data: item.inicio,
        tipo: "prisao",
        saldosCondenacoes: item.saldosCondenacoes
      }));
    const faltas = (entrada.faltasGraves || []).filter((item) =>
      item && item.tipo === "fuga" && dataUTC(item.data) && item.data <= dataCalculo);
    const recapturas = faltas.map((item) => {
      const recaptura = item.dataRecaptura ||
        (entrada.interrupcoes || []).find((intervalo) =>
          intervalo && intervalo.inicio === item.data && dataUTC(intervalo.fim))?.fim;
      return recaptura && dataUTC(recaptura) && recaptura <= dataCalculo
        ? { data: recaptura, tipo: "recaptura", saldosCondenacoes: item.saldosCondenacoes }
        : null;
    }).filter(Boolean);
    (entrada.interrupcoes || []).forEach((item) => {
      if (item && item.motivo === "fuga" && dataUTC(item.fim) && item.fim <= dataCalculo &&
          !faltas.some((falta) => falta.data === item.inicio) &&
          !recapturas.some((recaptura) => recaptura.data === item.fim)) {
        recapturas.push({ data: item.fim, tipo: "recaptura" });
      }
    });
    const regressoes = (entrada.regressoes || [])
      .filter((item) => item && dataUTC(item.data) && item.data <= dataCalculo)
      .map((item) => ({
        data: item.data,
        tipo: "regressao",
        para: item.para,
        saldosCondenacoes: item.saldosCondenacoes
      }));
    const eventos = [...prisoes, ...recapturas, ...regressoes]
      .sort((a, b) => a.data.localeCompare(b.data) ||
        ({ prisao: 0, recaptura: 1, regressao: 2 }[a.tipo] -
          { prisao: 0, recaptura: 1, regressao: 2 }[b.tipo]));
    const marco = eventos[eventos.length - 1] || null;
    if (!marco) return null;
    return {
      ...marco,
      exigeSaldoInformado: marco.tipo !== "prisao" || prisoes.length > 1 ||
        recapturas.length > 0 || regressoes.length > 0
    };
  }

  // E100: rateio operacional provisório; cada dia cumprido ou comutado é abatido uma só vez.
  function abaterSaldos(saldos, dias, indices) {
    const alvos = indices || saldos.map((_, indice) => indice);
    const total = alvos.reduce((soma, indice) => soma + saldos[indice], 0);
    const abatimento = Math.min(Math.max(0, Math.floor(dias)), total);
    if (!total || !abatimento) return 0;
    const parcelas = alvos.map((indice) => {
      const exato = abatimento * saldos[indice] / total;
      return { indice, dias: Math.floor(exato), resto: exato - Math.floor(exato) };
    });
    let faltam = abatimento - parcelas.reduce((soma, item) => soma + item.dias, 0);
    parcelas.sort((a, b) => b.resto - a.resto || a.indice - b.indice);
    parcelas.forEach((item) => {
      if (faltam > 0) { item.dias += 1; faltam -= 1; }
      saldos[item.indice] -= item.dias;
    });
    return abatimento;
  }

  function prepararComutacoes(entrada, penas, penaTotalDias, cumpridosAte, dataCalculo) {
    const decisoes = (entrada.comutacoes || []).map((item, indice) => ({ ...item, indice }))
      .filter((item) => item.dataDecisao <= serializarData(dataCalculo))
      .sort((a, b) => a.dataDecisao.localeCompare(b.dataDecisao) || a.indice - b.indice);
    const estadoAte = (data, marco) => {
      const porId = new Map((marco && marco.saldosCondenacoes || [])
        .map((item) => [item.condenacaoId, item.dias]));
      const saldos = penas.map((item) => porId.has(item.condenacao.id)
        ? porId.get(item.condenacao.id) : item.dias);
      if (!marco) {
        const total = saldos.reduce((soma, dias) => soma + dias, 0);
        if (total > penaTotalDias) abaterSaldos(saldos, total - penaTotalDias);
        else if (total < penaTotalDias) saldos[0] += penaTotalDias - total;
      }
      let anterior = marco ? cumpridosAte(dataUTC(marco.data)) : 0;
      const cumpridosPorPena = penas.map((item, indice) => marco
        ? Math.max(0, item.dias - saldos[indice]) : 0);
      let excedente = 0;
      const atualizarCumprimento = (cumpridos) => {
        const diferenca = cumpridos - anterior;
        anterior = cumpridos;
        if (diferenca >= 0) {
          const antes = saldos.slice();
          const abatidos = abaterSaldos(saldos, diferenca);
          excedente += diferenca - abatidos;
          antes.forEach((saldo, indice) => { cumpridosPorPena[indice] += saldo - saldos[indice]; });
        } else {
          const devolver = Math.max(0, -diferenca - excedente);
          excedente = Math.max(0, excedente + diferenca);
          const antes = cumpridosPorPena.slice();
          abaterSaldos(cumpridosPorPena, devolver);
          antes.forEach((dias, indice) => { saldos[indice] += dias - cumpridosPorPena[indice]; });
        }
      };
      const aplicadas = [];
      decisoes.filter((item) => item.dataDecisao <= serializarData(data) &&
        (!marco || item.dataDecisao >= marco.data)).forEach((item) => {
        const cumpridos = cumpridosAte(dataUTC(item.dataDecisao));
        atualizarCumprimento(cumpridos);
        const indices = item.condenacaoId === undefined ? undefined
          : penas.map((pena, indice) => pena.condenacao.id === item.condenacaoId ? indice : -1)
            .filter((indice) => indice >= 0);
        const saldoIndividualConhecido = penas.length === 1 || marco && marco.data === item.dataDecisao;
        const saldoGlobal = saldos.reduce((soma, saldo) => soma + saldo, 0);
        const diasAplicados = Math.min(item.dias, saldoGlobal);
        const saldoVinculado = indices
          ? indices.reduce((soma, indice) => soma + saldos[indice], 0) : saldoGlobal;
        const ajusteRateio = Math.max(0, diasAplicados - saldoVinculado);
        if (indices && ajusteRateio > 0) {
          // E100: o rateio presumido não pode truncar uma redução judicialmente concedida.
          const outros = saldos.map((_, indice) => indice).filter((indice) => !indices.includes(indice));
          const antes = saldos.slice();
          abaterSaldos(saldos, ajusteRateio, outros);
          antes.forEach((saldo, indice) => {
            if (!indices.includes(indice)) cumpridosPorPena[indice] += saldo - saldos[indice];
          });
          saldos[indices[0]] += ajusteRateio;
          cumpridosPorPena[indices[0]] = Math.max(0, cumpridosPorPena[indices[0]] - ajusteRateio);
        }
        abaterSaldos(saldos, diasAplicados, indices);
        const { indice, ...registro } = item;
        aplicadas.push({
          ...registro, regra: "E100", diasAplicados,
          ajusteRateio: ajusteRateio > 0,
          rateioEstimativo: penas.length > 1 && !saldoIndividualConhecido,
          saldosCondenacoes: saldoIndividualConhecido ? penas.map((pena, i) => ({
            condenacaoId: pena.condenacao.id || null, dias: saldos[i]
          })) : []
        });
      });
      atualizarCumprimento(cumpridosAte(data));
      return { saldos, aplicadas, dias: aplicadas.reduce((soma, item) => soma + item.diasAplicados, 0) };
    };
    return { decisoes, estadoAte };
  }

  function calcularBeneficios(entrada, dataCalculo, base, penaTotalDias, convencao, intervalosDetracao, cautelarDetracao, intervalosInterrupcao, opcoes, prisaoAtiva, baseRegras) {
    const baseISO = serializarData(base);
    const calculoISO = serializarData(dataCalculo);
    const condenacoes = entrada.condenacoes.slice().sort((a, b) =>
      a.dataFato.localeCompare(b.dataFato) || String(a.id || "").localeCompare(String(b.id || "")));
    const prisoes = Array.isArray(entrada.prisoes) ? entrada.prisoes : [];
    const eventos = Array.isArray(entrada.faltasGraves) ? entrada.faltasGraves : [];
    const remicoes = Array.isArray(entrada.remicoes) ? entrada.remicoes : [];
    const interrupcoes = intervalosInterrupcao.slice();
    const faltas = [];
    const avisos = [];
    const especial = avaliarProgressaoEspecial(entrada, calculoISO, avisos);

    eventos.forEach((falta) => {
      if (!falta || !dataUTC(falta.data) || falta.data > calculoISO) return;
      const recaptura = falta.dataRecaptura ||
        (falta.tipo === "fuga" && interrupcoes.find((item) => item.inicio === falta.data)?.fim);
      if (falta.tipo === "fuga") {
        const existente = interrupcoes.find((item) => item.inicio === falta.data);
        if (existente) {
          if (recaptura) existente.fim = recaptura;
        } else {
          interrupcoes.push({ inicio: falta.data, fim: recaptura || null });
        }
      }
      faltas.push({
        ...falta,
        dataEfetiva: falta.tipo === "fuga" ? (recaptura || null) : falta.data
      });
    });

    const fugaAberta = interrupcoes.some((item) =>
      item.motivo !== "soltura" && !item.fim && item.inicio <= calculoISO);
    const penas = [];
    condenacoes.forEach((condenacao) => {
      const dias = diasPena(condenacao.pena, base, convencao);
      let regraPR = null;
      let fracaoLC = null;
      try {
        regraPR = Regras.menorFracao(condenacao, calculoISO, opcoes, baseRegras);
        avisos.push(...regraPR.avisos);
        if (especial) regraPR = { ...regraPR, id: "E37", fracao: Regras.fracaoPorId("E37", baseRegras) };
      } catch (falha) {
        avisos.push({
          regra: falha.regra || "E45",
          texto: `Não foi possível calcular a progressão para esta condenação: ${falha.message}`
        });
      }
      try {
        fracaoLC = Regras.fracaoLC(condenacao, calculoISO, opcoes, baseRegras);
      } catch (falha) {
        avisos.push({
          regra: falha.regra || "E45",
          texto: `Não foi possível calcular o livramento para esta condenação: ${falha.message}`
        });
      }
      let regrasLC = [];
      try {
        regrasLC = Regras.regrasVedacaoLC(condenacao, calculoISO, baseRegras);
      } catch (falha) {
        avisos.push({
          regra: falha.regra || "E42",
          texto: `Não foi possível avaliar a vedação ao livramento: ${falha.message}`
        });
      }
      penas.push({ condenacao, dias, fracaoPR: regraPR && regraPR.fracao, regraPR, fracaoLC, regrasLC });
      if (regrasLC.some((regra) => regra.id.startsWith("E42-"))) {
        avisos.push({
          regra: "E42",
          texto: `Livramento condicional vedado por regra independente da progressão: ${regrasLC.map((regra) => regra.fundamento).join("; ")}. Decisão do Núcleo; fontes a conferir.`
        });
      }
    });
    const beneficiosIncompletos = () => {
      return {
        dataBase: baseISO,
        fugaAberta,
        progressao: { proximoRegime: null, data: null, requisitoDias: null, memoria: [] },
        livramento: { cabe: false, data: null, motivoNaoCabe: "Informe os dados da condenação necessários para calcular o benefício.", memoria: [] },
        saidaTemporaria: { cabe: false, data: null, motivoNaoCabe: "Complete os dados das condenações para calcular a saída temporária.", memoria: [] },
        condenacoes: penas.map((item) => ({
          id: item.condenacao.id || null,
          era: item.regraPR && item.regraPR.era,
          fracaoPR: item.fracaoPR,
          regraPR: item.regraPR && item.regraPR.id,
          leiNaDataDoFato: item.regraPR && item.regraPR.leiNaDataDoFato,
          leiPosteriorMaisFavoravel: item.regraPR && item.regraPR.leiPosteriorMaisFavoravel,
          fundamentoEscolha: item.regraPR && item.regraPR.fundamentoEscolha,
          fracaoLC: item.fracaoLC === null ? null : item.fracaoLC,
          vedaLC: item.fracaoLC === null,
          regraLC: item.regrasLC.length ? item.regrasLC[0].id : "E41"
        })),
        avisos
      };
    };

    const inicioContagem = serializarData(deslocarDias(base, 1));
    const sobreposicoesDetracao = [];
    intervalosDetracao.forEach((detracao) => {
      const inicioDetracao = dataUTC(detracao.inicio);
      const fimDetracao = detracao.fim == null ? dataUTC(calculoISO) : dataUTC(detracao.fim);
      if (!inicioDetracao || !fimDetracao) return;
      prisoes.forEach((prisao) => {
        const inicioPrisao = dataUTC(prisao.inicio);
        const fimPrisao = prisao.fim == null ? dataUTC(calculoISO) : dataUTC(prisao.fim);
        if (!inicioPrisao || !fimPrisao) return;
        const inicio = [inicioDetracao, inicioPrisao, dataUTC(inicioContagem)].sort((a, b) => a - b).pop();
        const fim = fimDetracao < fimPrisao ? fimDetracao : fimPrisao;
        if (inicio <= fim) sobreposicoesDetracao.push({
          inicio: serializarData(inicio),
          fim: serializarData(fim)
        });
      });
    });
    const creditosAte = (data) => {
      const diasNaturais = Math.max(0, diasEntre(base, data));
      const afastamento = diasIntervalosAte(interrupcoes, data, true);
      const detraido = Math.max(0,
        diasIntervalosAte(intervalosDetracao, data, false) -
        diasIntervalosAte(sobreposicoesDetracao, data, false)) + cautelarDetracao.diasAte(data);
      const remido = remicoes
        .filter((item) => item && item.homologada === true &&
          !remicaoDomiciliarDefensiva(item) &&
          (!item.dataHomologacao || item.dataHomologacao <= serializarData(data)))
        .reduce((soma, item) => soma + item.dias, 0);
      const perdido = faltas.filter((item) => item.data <= serializarData(data))
        .reduce((soma, item) => soma + (Number.isInteger(item.diasPerdidosRemicao) ? Math.max(item.diasPerdidosRemicao, 0) : 0), 0);
      return diasNaturais - afastamento + detraido + Math.max(remido - perdido, 0);
    };
    const diasCumpridosAte = (data) => {
      const limite = serializarData(data);
      const decorridos = Math.max(0, diasEntre(base, data) + 1);
      const afastamento = diasIntervalosAte(interrupcoes, data, true);
      const detraido = diasIntervalosAte(intervalosDetracao, data, false) +
        cautelarDetracao.diasAte(data);
      const remido = remicoes
        .filter((item) => item && item.homologada === true &&
          !remicaoDomiciliarDefensiva(item) &&
          (!item.dataHomologacao || item.dataHomologacao <= limite))
        .reduce((soma, item) => soma + item.dias, 0);
      const perdido = faltas.filter((item) => item.data <= limite)
        .reduce((soma, item) => soma +
          (Number.isInteger(item.diasPerdidosRemicao) ? Math.max(item.diasPerdidosRemicao, 0) : 0), 0);
      return Math.max(0, decorridos + detraido + Math.max(remido - perdido, 0) - afastamento);
    };
    const comutacao = prepararComutacoes(entrada, penas, penaTotalDias, diasCumpridosAte, dataCalculo);
    const comutacoesAtuais = comutacao.estadoAte(dataCalculo);
    const ultimaDecisao = comutacao.decisoes[comutacao.decisoes.length - 1];
    const comutacoesProjetadas = ultimaDecisao
      ? comutacao.estadoAte(dataUTC(ultimaDecisao.dataDecisao)).aplicadas : [];
    if (comutacao.decisoes.length) {
      avisos.push({
        regra: "E100", status: "Pendente de validação",
        texto: "CONFERIR: comutação concedida reduz o saldo desde a decisão. Frações sobre o remanescente, sem nova data-base, são posição defensiva provisória. Rateio entre condenações a conferir; compare o cenário sem alteração da base dos benefícios."
      });
      comutacoesAtuais.aplicadas.filter((item) => item.diasAplicados < item.dias).forEach((item) => {
        avisos.push({
          regra: "E100", status: "Pendente de validação",
          texto: `CONFERIR: dos ${item.dias} dias informados em ${item.dataDecisao}, somente ${item.diasAplicados} foram abatidos, pois a redução foi limitada ao saldo global restante.`
        });
      });
      comutacoesAtuais.aplicadas.filter((item) => item.ajusteRateio).forEach((item) => {
        avisos.push({
          regra: "E100", status: "Pendente de validação",
          texto: `CONFERIR: a comutação de ${item.diasAplicados} dias em ${item.dataDecisao} foi aplicada ao saldo global sem truncamento pelo rateio presumido. A individualização do cumprimento e dos saldos das condenações é apenas estimativa.`
        });
      });
    }
    if (penas.some((item) => item.fracaoPR === null || !item.regraPR)) {
      return {
        ...beneficiosIncompletos(), comutacoes: comutacoesAtuais.aplicadas,
        comutacaoDias: comutacoesAtuais.dias, comutacoesProjetadas
      };
    }
    const cortesHistoricos = [];
    const decretosIndulto = baseRegras && baseRegras.decretos || Regras.dados.decretos || [];
    for (let ano = base.getUTCFullYear(); modulos.inclui(opcoes, "E70") && ano <= dataCalculo.getUTCFullYear(); ano += 1) {
      const dataCorte = new Date(Date.UTC(ano, 11, 25));
      const dataCorteISO = serializarData(dataCorte);
      if (dataCorte > dataCalculo) {
        cortesHistoricos.push({
          ano,
          data: dataCorteISO,
          status: "nao_alcancado",
          motivoNaoCalculado: `O cálculo foi feito em ${serializarData(dataCalculo)}, antes do corte de 25/12/${ano}.`
        });
      } else if (dataCorte < base) {
        cortesHistoricos.push({
          ano,
          data: dataCorteISO,
          status: "nao_alcancado",
          motivoNaoCalculado: `O início do cumprimento informado (${baseISO}) é posterior ao corte de 25/12/${ano}.`
        });
      } else {
        const diasCumpridos = diasCumpridosAte(dataCorte);
        cortesHistoricos.push({
          ano,
          data: dataCorteISO,
          status: "calculado",
          diasCumpridos,
          cumprido: decomporDias(diasCumpridos, convencao, base),
          restanteDias: Math.max(0, penaTotalDias - diasCumpridos - comutacao.estadoAte(dataCorte).dias),
          usavelNoIndulto: decretosIndulto.some((decreto) => decreto.dataReferencia === dataCorteISO),
          regra: ["E51", "E70"]
        });
      }
    }

    const progressoes = (Array.isArray(entrada.progressoes) ? entrada.progressoes : [])
      .filter((item) => item && dataUTC(item.data) && item.data <= calculoISO)
      .sort((a, b) => a.data.localeCompare(b.data));
    const ultimaProgressao = progressoes[progressoes.length - 1] || null;
    const ultimaFalta = faltas.filter((item) => item.dataEfetiva && item.dataEfetiva <= calculoISO)
      .sort((a, b) => a.dataEfetiva.localeCompare(b.dataEfetiva)).pop() || null;
    const dataSubjetivo = ultimaProgressao && dataUTC(ultimaProgressao.dataRequisitoSubjetivo);
    const dataBaseReconhecida = ultimaProgressao && dataUTC(ultimaProgressao.dataBaseReconhecida);
    let marco = ultimaProgressao ? {
      data: dataBaseReconhecida
        ? serializarData(dataBaseReconhecida)
        : dataSubjetivo && dataSubjetivo > dataUTC(ultimaProgressao.data)
          ? serializarData(dataSubjetivo) : ultimaProgressao.data,
      dataObjetivo: ultimaProgressao.data,
      dataSubjetivo: dataSubjetivo ? serializarData(dataSubjetivo) : null,
      dataBaseReconhecida: dataBaseReconhecida ? serializarData(dataBaseReconhecida) : null,
      tipo: "progressao"
    } : null;
    if (ultimaFalta && (!marco || ultimaFalta.dataEfetiva >= marco.data)) {
      marco = {
        data: ultimaFalta.dataEfetiva,
        saldosCondenacoes: ultimaFalta.saldosCondenacoes,
        tipo: "falta"
      };
    }

    let dataBasePR = baseISO;
    let creditoBasePR = 0;
    let requisitoPR;
    let saldoPR = penaTotalDias;
    let requisitoEstimadoPR = null;
    let regrasPR = ["D1", "D3", "E04", "E05", "E20", "E30", ...penas.map((item) => item.regraPR.id)];
    if (intervalosDetracao.length || entrada.detracoesCautelares && entrada.detracoesCautelares.length) regrasPR.push("E27");
    if (remicoes.some((item) => item && item.homologada)) regrasPR.push("E28");
    if (remicoes.some(remicaoDomiciliar)) regrasPR.push("E39");
    if (marco) {
      dataBasePR = marco.data;
      creditoBasePR = creditosAte(dataUTC(marco.data));
      saldoPR = Math.max(penaTotalDias - creditoBasePR, 0);
      if (marco.tipo === "falta") {
        const saldoCalculado = saldoRemanescente(saldoPR, penas, marco.saldosCondenacoes, opcoes);
        requisitoPR = saldoCalculado.estimativa ? null : saldoCalculado.requisito;
        requisitoEstimadoPR = saldoCalculado.estimativa ? saldoCalculado.requisito : null;
      } else {
        requisitoPR = requisitoDistribuido(saldoPR, penas, penaTotalDias, opcoes);
      }
      regrasPR.push(marco.tipo === "falta" ? "E22" : "E34");
      if (marco.tipo === "falta") regrasPR.push("E23");
      else regrasPR.push("D6");
    } else {
      requisitoPR = penas.reduce((soma, item) =>
        soma + arredondarRequisito(item.dias * item.fracaoPR, opcoes), 0);
    }
    const marcoTJSP = opcoes && opcoes.metodoProgressao === "tjsp"
      ? marcoProgressaoTJSP(entrada, calculoISO)
      : null;
    const ultimaRegressao = (entrada.regressoes || [])
      .filter((item) => item && dataUTC(item.data) && item.data <= calculoISO)
      .sort((a, b) => a.data.localeCompare(b.data)).pop() || null;
    const regressaoMaisRecente = opcoes && opcoes.metodoProgressao === "tjsp" &&
      ultimaRegressao &&
      (!ultimaProgressao || ultimaRegressao.data > ultimaProgressao.data);
    const regime = regressaoMaisRecente && ultimaRegressao.para
      ? ultimaRegressao.para
      : (ultimaProgressao && ultimaProgressao.para) || entrada.regimeAtual || "fechado";
    const proximoRegime = regime === "fechado" ? "semiaberto" : regime === "semiaberto" ? "aberto" : null;
    if (progressoes.length) regrasPR.push("E34");
    regrasPR.push("E35");
    if (interrupcoes.length) regrasPR.push("E21");
    if (faltas.some((item) => item.diasPerdidosRemicao > 0)) regrasPR.push("E26");
    let dataPR = proximoRegime && prisaoAtiva && requisitoPR !== null
      ? dataDoBeneficio(dataBasePR, requisitoPR, creditoBasePR, creditosAte, dataCalculo, fugaAberta, opcoes)
      : null;
    let dataPREstimada = proximoRegime && prisaoAtiva && requisitoEstimadoPR !== null
      ? dataDoBeneficio(dataBasePR, requisitoEstimadoPR, creditoBasePR, creditosAte, dataCalculo, fugaAberta, opcoes)
      : null;
    let motivoNaoCabePR = !prisaoAtiva ? "As datas dependem de novo recolhimento." : null;
    let memoriaTJSP = null;
    if (marcoTJSP && (!marco || marcoTJSP.data >= marco.data)) {
      const saldoPorId = new Map((marcoTJSP.saldosCondenacoes || [])
        .map((item) => [item.condenacaoId, item.dias]));
      const saldosCompletos = penas.every((item) =>
        item.condenacao.id && saldoPorId.has(item.condenacao.id));
      const usarPenaTotal = !marcoTJSP.exigeSaldoInformado;
      const saldosValidos = saldosCompletos || usarPenaTotal;
      if (saldosValidos) {
        dataBasePR = marcoTJSP.data;
        const memorias = penas.map((item) => {
          const saldoDias = usarPenaTotal ? item.dias : saldoPorId.get(item.condenacao.id);
          const requisitoDias = arredondarRequisito(saldoDias * item.fracaoPR, opcoes);
          return {
            regra: "D8",
            condenacaoId: item.condenacao.id || null,
            penaDias: item.dias,
            saldoDias,
            cumpridoDias: Math.max(item.dias - saldoDias, 0),
            fracaoPonderada: item.fracaoPR,
            requisitoDias,
            dataBase: marcoTJSP.data
          };
        });
        requisitoPR = memorias.reduce((soma, item) => soma + item.requisitoDias, 0);
        requisitoEstimadoPR = null;
        creditoBasePR = 0;
        saldoPR = memorias.reduce((soma, item) => soma + item.saldoDias, 0);
        const creditosBaseTJSP = creditosAte(dataUTC(marcoTJSP.data));
        const creditosAposBase = (data) =>
          Math.max(0, creditosAte(data) - creditosBaseTJSP);
        dataPR = proximoRegime && prisaoAtiva && !fugaAberta
          ? dataDoBeneficio(marcoTJSP.data, requisitoPR, 0, creditosAposBase, dataCalculo, fugaAberta, opcoes)
          : null;
        dataPREstimada = null;
        memoriaTJSP = memorias;
        motivoNaoCabePR = !prisaoAtiva ? "As datas dependem de novo recolhimento." : null;
      } else {
        dataPR = null;
        dataPREstimada = null;
        requisitoPR = null;
        requisitoEstimadoPR = null;
        dataBasePR = marcoTJSP.data;
        saldoPR = null;
        motivoNaoCabePR = "Informe o saldo de cada condenação na última prisão, recaptura ou regressão para calcular este método.";
        avisos.push({ texto: motivoNaoCabePR, regra: "D8" });
      }
      regrasPR.push("D8");
      avisos.push({
        texto: "Método provisório observado em cálculos TJSP/SAJ. Confira a data-base e os saldos informados por condenação.",
        regra: "D8",
        status: "Pendente de validação"
      });
    }

    const fracaoLCReal = penas.reduce((soma, item) => soma + item.dias * (item.fracaoLC || 0), 0);
    let requisitoLC = Math.floor(fracaoLCReal) + 1;
    const limiteLC = diasPena({ anos: 2, meses: 0, dias: 0 }, base, convencao);
    const lcVedada = penas.some((item) => item.fracaoLC === null || item.regrasLC.length > 0);
    const lcCabe = penaTotalDias >= limiteLC && !lcVedada;
    const lcVedadaPorReincidenciaEspecifica = penas.some((item) =>
      item.regrasLC.some((regra) => regra.id === "E41"));
    const motivoNaoCabeLC = penaTotalDias < limiteLC
      ? "A pena total é inferior a 2 anos (CP arts. 83 e 84; E40)."
      : lcVedadaPorReincidenciaEspecifica
        ? "Vedado para reincidente específico em crime hediondo/equiparado (CP art. 83, V; E41)."
        : "Há condenação com vedação ao livramento condicional (CP art. 83, V; E41/E42).";
    let dataLC = lcCabe && prisaoAtiva
      ? dataDoBeneficio(baseISO, requisitoLC, 0, creditosAte, dataCalculo, fugaAberta, opcoes)
      : null;
    const faltaLC = faltas.filter((item) => item.data >= CORTE_LEI_13964 && item.data <= calculoISO)
      .sort((a, b) => a.data.localeCompare(b.data)).pop();
    if (dataLC && faltaLC) {
      const limiteFalta = serializarData(adicionarMeses(dataUTC(faltaLC.data), 12));
      if (limiteFalta > dataLC) dataLC = limiteFalta;
    }
    if (fugaAberta) {
      avisos.push({ texto: "Informe a data da recaptura para projetar datas de benefícios e término.", regra: "E21" });
      if (dataLC && dataLC > calculoISO) dataLC = null;
    }
    if (marco && marco.tipo === "falta") {
      if (requisitoEstimadoPR !== null) {
        avisos.push({
          texto: `Há penas com frações diferentes. Informe o saldo de cada condenação em ${marco.data}. O rateio proporcional gera apenas uma estimativa.`,
          regra: "E23"
        });
      } else {
        avisos.push({
          texto: "Após a falta grave, a fração incide sobre a pena remanescente; aplique-a ao saldo de cada condenação na data da falta.",
          regra: "E23"
        });
      }
    }
    if (marco && marco.tipo === "progressao" && !marco.dataSubjetivo && !marco.dataBaseReconhecida) {
      avisos.push({
        texto: `Requisito objetivo atingido em ${marco.dataObjetivo}. Confirme quando o requisito subjetivo foi preenchido para fixar a próxima data-base.`,
        regra: "D6"
      });
    }
    if (faltas.some((item) => item.diasPerdidosRemicao > 0)) {
      avisos.push({ texto: "A perda de dias remidos informada foi abatida do total homologado.", regra: "E26" });
    }

    // E60: restrições gravosas seguem a data do fato, sem retroatividade.
    const temRestricaoSaida = (item) => {
      if (item.emCumprimento === false) return false;
      const hediondo = item.equiparado === true && item.natureza !== "trafico_privilegiado" ||
        ["hediondo", "hediondo_morte", "feminicidio", "comando_orcrim", "milicia"].includes(item.natureza);
      if (item.dataFato >= "2024-04-11") return hediondo || item.natureza === "violencia";
      return item.dataFato >= CORTE_LEI_13964 &&
        (item.natureza === "hediondo_morte" || hediondo && item.resultadoMorte === true);
    };
    const condenacaoImpeditiva = condenacoes.find(temRestricaoSaida) || null;
    const saidaVedada = Boolean(condenacaoImpeditiva);
    const execucaoMistaDuvidosa = Boolean(condenacaoImpeditiva &&
      condenacoes.some((item) => item !== condenacaoImpeditiva &&
        item.emCumprimento !== false && !temRestricaoSaida(item)));
    const soEstudo = condenacoes.some((item) =>
      item.emCumprimento !== false && item.dataFato >= "2024-06-13");
    const saidaCabe = regime === "semiaberto" && (!saidaVedada || execucaoMistaDuvidosa);
    const motivoSaida = regime !== "semiaberto"
      ? "A saída temporária exige cumprimento no regime semiaberto."
      : saidaVedada && !execucaoMistaDuvidosa
        ? "Há possível impedimento a conferir na condenação indicada."
        : null;
    const fatosAnterioresAtingidos = soEstudo && condenacoes.some((item) =>
      item.emCumprimento !== false && item.dataFato < "2024-06-13");
    const finalidadeTexto = saidaCabe
      ? (soEstudo ? "estudo" : "visita à família, estudo ou atividades de reintegração social")
      : "nenhuma calculada";
    // E61: reincidência em qualquer condenação exige 1/4 da pena total.
    const fracaoSaida = condenacoes.some((item) => item.reincidencia !== "primario") ? 1 / 4 : 1 / 6;
    const requisitoSaida = arredondarRequisito(penaTotalDias * fracaoSaida, opcoes);
    const saidaTemporaria = {
      cabe: saidaCabe,
      data: saidaCabe && prisaoAtiva
        ? dataDoBeneficio(baseISO, requisitoSaida, 0, creditosAte, dataCalculo, fugaAberta, opcoes)
        : null,
      motivoNaoCabe: motivoSaida,
      condenacaoImpeditiva: condenacaoImpeditiva ? {
        id: condenacaoImpeditiva.id || null,
        natureza: condenacaoImpeditiva.natureza || null,
        dataFato: condenacaoImpeditiva.dataFato || null,
        emCumprimento: true,
        fundamento: condenacaoImpeditiva.dataFato >= "2024-04-11"
          ? "LEP art. 122, § 2º: hediondo/equiparado ou violência/grave ameaça"
          : "LEP art. 122, § 2º: hediondo com resultado morte"
      } : null,
      conferenciaIndividual: execucaoMistaDuvidosa,
      possivelImpedimento: saidaVedada,
      requisitoDias: requisitoSaida,
      fracao: fracaoSaida,
      finalidadesPermitidas: saidaCabe
        ? soEstudo ? ["estudo"] : ["visita_familia", "estudo", "atividades_reintegracao"]
        : [],
      memoria: [{
        descricao: `Saída temporária: ${fracaoSaida === 1 / 4 ? "1/4" : "1/6"} da pena total (${penaTotalDias} dias), ` +
          `arredondada para cima: ${requisitoSaida} dias, contados do início do cumprimento, com detração e remição homologada. ` +
          (motivoSaida || (soEstudo
            ? "Somente para estudo: curso supletivo, ensino médio ou superior."
            : "Finalidades: visita à família, estudo ou atividades de reintegração social.")),
        regra: ["E60", "E61", "E04", "E05", "E21", "E26", "E27", "E28",
          ...(remicoes.some(remicaoDomiciliar) ? ["E39"] : [])],
        dataInicio: baseISO,
        penaDias: penaTotalDias,
        fracao: fracaoSaida,
        requisitoDias: requisitoSaida
      }]
    };
    avisos.push({
      regra: "E60",
      status: "Pendente de validação",
      texto: `Requisito temporal em ${saidaTemporaria.data || "não calculado"}. Finalidade admitida: ${finalidadeTexto}.` +
        (condenacaoImpeditiva
          ? ` Possível impedimento na condenação ${condenacaoImpeditiva.id || "sem identificação"}, fato de ${condenacaoImpeditiva.dataFato}.`
          : "") +
        (fatosAnterioresAtingidos ? " Tema 1.381/STF pendente." : "")
    });
    if (!prisaoAtiva) {
      const motivoSoltura = "As datas dependem de novo recolhimento.";
      avisos.push({
        regra: "E96",
        texto: `A pessoa está solta na data do cálculo. ${motivoSoltura}`
      });
      saidaTemporaria.motivoNaoCabe = motivoSoltura;
    }

    // E100: a decisão não reinicia a data-base nem retroage um benefício já alcançado.
    const memoriaComutacaoPR = [];
    const memoriaComutacaoLC = [];
    let estimativaLC = null;
    if (comutacao.decisoes.length) {
      const ajustar = (dataOriginal, requisitoOriginal, tipo, memoria) => {
        if (!dataOriginal || opcoes && opcoes.comutacaoAlteraBaseBeneficios === false) {
          return { data: dataOriginal, requisito: requisitoOriginal };
        }
        let data = dataOriginal;
        let requisito = requisitoOriginal;
        const baseBeneficio = tipo === "PR" ? dataBasePR : baseISO;
        const credito = tipo === "PR"
          ? memoriaTJSP ? creditosAte(dataUTC(dataBasePR)) : creditoBasePR : 0;
        const marcoSaldo = tipo === "PR"
          ? memoriaTJSP ? { data: dataBasePR, saldosCondenacoes: memoriaTJSP.map((item) => ({
            condenacaoId: item.condenacaoId, dias: item.saldoDias
          })) } : marco && marco.saldosCondenacoes &&
              penas.every((item) => marco.saldosCondenacoes.some((saldo) => saldo.condenacaoId === item.condenacao.id))
            ? marco : null
          : null;
        for (const decisao of comutacao.decisoes) {
          if (data < decisao.dataDecisao || marcoSaldo && decisao.dataDecisao < marcoSaldo.data) continue;
          const dataEfeito = decisao.dataDecisao < baseBeneficio ? baseBeneficio : decisao.dataDecisao;
          const estado = comutacao.estadoAte(dataUTC(dataEfeito), marcoSaldo);
          if (!estado.aplicadas.some((item) => item.dataDecisao === decisao.dataDecisao && item.diasAplicados > 0)) continue;
          const exato = estado.saldos.reduce((soma, saldo, indice) =>
            soma + saldo * (tipo === "PR" ? penas[indice].fracaoPR : penas[indice].fracaoLC || 0), 0);
          requisito = tipo === "PR"
            ? estado.saldos.reduce((soma, saldo, indice) =>
              soma + arredondarRequisito(saldo * penas[indice].fracaoPR, opcoes), 0)
            : Math.floor(exato) + 1;
          const dataProjetada = dataDoBeneficio(dataEfeito, requisito, credito,
            creditosAte, dataCalculo, fugaAberta, opcoes);
          data = dataProjetada && dataProjetada < dataEfeito ? dataEfeito : dataProjetada;
          memoria.push({
            regra: "E100", status: "Pendente de validação", dataDecisao: decisao.dataDecisao,
            dataBase: baseBeneficio, requisitoDias: requisito,
            saldoDias: estado.saldos.reduce((soma, saldo) => soma + saldo, 0),
            ...(estado.aplicadas.some((item) => item.ajusteRateio) ? { estimativa: true } : {}),
            saldosCondenacoes: penas.map((item, indice) => ({
              condenacaoId: item.condenacao.id || null, dias: estado.saldos[indice]
            })),
            descricao: "CONFERIR: fração sobre o remanescente após comutação; data-base preservada."
          });
          if (!data) break;
        }
        const fracoesDiferentes = penas.some((item) =>
          (tipo === "PR" ? item.fracaoPR : item.fracaoLC) !==
          (tipo === "PR" ? penas[0].fracaoPR : penas[0].fracaoLC));
        const estimativa = fracoesDiferentes && memoria.some((item) =>
          item.estimativa || !marcoSaldo || marcoSaldo.data !== item.dataDecisao);
        if (estimativa) memoria.forEach((item) => { item.estimativa = true; });
        return { data, requisito, estimativa };
      };
      const pr = ajustar(dataPR, requisitoPR, "PR", memoriaComutacaoPR);
      dataPR = pr.data;
      requisitoPR = pr.requisito;
      if (pr.estimativa) {
        dataPREstimada = dataPR;
        requisitoEstimadoPR = requisitoPR;
        dataPR = null;
        requisitoPR = null;
        motivoNaoCabePR = "CONFERIR: informe os saldos individuais das condenações; o rateio após comutação é apenas estimativo (E100/E23).";
      }
      if (requisitoEstimadoPR !== null && !pr.estimativa) {
        const estimativa = ajustar(dataPREstimada, requisitoEstimadoPR, "PR", memoriaComutacaoPR);
        dataPREstimada = estimativa.data;
        requisitoEstimadoPR = estimativa.requisito;
      }
      const lc = ajustar(dataLC, requisitoLC, "LC", memoriaComutacaoLC);
      dataLC = lc.data;
      requisitoLC = lc.requisito;
      if (dataLC && faltaLC) {
        const limiteFalta = serializarData(adicionarMeses(dataUTC(faltaLC.data), 12));
        if (limiteFalta > dataLC) dataLC = limiteFalta;
      }
      if (lc.estimativa) {
        estimativaLC = {
          data: dataLC, requisitoDias: requisitoLC, tipo: "rateio proporcional", conclusiva: false
        };
        dataLC = null;
      }
    }

    return {
      dataBase: marcoTJSP && (!marco || marcoTJSP.data >= marco.data)
        ? dataBasePR : marco ? marco.data : baseISO,
      fugaAberta,
      cortesHistoricos,
      comutacoes: comutacoesAtuais.aplicadas,
      comutacaoDias: comutacoesAtuais.dias,
      comutacoesProjetadas,
      saidaTemporaria,
      condenacoes: penas.map((item) => ({
        id: item.condenacao.id || null,
        era: item.regraPR.era,
        fracaoPR: `${Math.round(item.fracaoPR * 10000) / 100}%`,
        regraPR: item.regraPR.id,
        leiNaDataDoFato: item.regraPR.leiNaDataDoFato,
        leiPosteriorMaisFavoravel: item.regraPR.leiPosteriorMaisFavoravel,
        fundamentoEscolha: item.regraPR.fundamentoEscolha,
        fracaoLC: item.fracaoLC === null ? null : `${Math.round(item.fracaoLC * 10000) / 100}%`,
        vedaLC: item.regrasLC.length > 0,
        regraLC: item.regrasLC.length ? item.regrasLC[0].id : "E41",
        fundamentoLC: item.regrasLC.map((regra) => regra.fundamento)
      })),
      progressao: {
        proximoRegime,
        data: dataPR,
        estimativa: requisitoEstimadoPR === null ? null : {
          data: dataPREstimada,
          requisitoDias: requisitoEstimadoPR,
          tipo: "rateio proporcional",
          conclusiva: false
        },
        motivoNaoCabe: motivoNaoCabePR,
        requisitoDias: requisitoPR,
        memoria: [{
          regra: [...new Set(regrasPR)],
          requisitoDias: requisitoPR,
          requisitoEstimadoDias: requisitoEstimadoPR,
          fracaoPonderada: penaTotalDias
            ? penas.reduce((soma, item) => soma + item.dias * item.fracaoPR, 0) / penaTotalDias
            : 0,
          dataBase: dataBasePR,
          saldoDias: saldoPR
        }].concat(memoriaTJSP || [], memoriaComutacaoPR)
      },
      livramento: {
        cabe: lcCabe,
        data: lcCabe ? dataLC : null,
        ...(estimativaLC ? { estimativa: estimativaLC } : {}),
        motivoNaoCabe: estimativaLC ? "CONFERIR: saldos individuais não informados; rateio após comutação é apenas estimativo (E100)."
          : !prisaoAtiva ? "As datas dependem de novo recolhimento."
          : !lcCabe ? motivoNaoCabeLC : null,
        requisitoDias: requisitoLC,
        memoria: [{
          regra: [...new Set([
            "D1", "D3", "E05", "E24", "E40", "E41", "E43", "E44",
            ...(intervalosDetracao.length || entrada.detracoesCautelares && entrada.detracoesCautelares.length ? ["E27"] : []),
            ...(remicoes.some((item) => item && item.homologada) ? ["E28"] : []),
            ...(remicoes.some(remicaoDomiciliar) ? ["E39"] : []),
            ...(faltas.some((item) => item.diasPerdidosRemicao > 0) ? ["E26"] : []),
            ...(faltaLC ? ["E25"] : []),
            ...(interrupcoes.length ? ["E21"] : [])
          ])],
          requisitoDias: requisitoLC,
          exigencia: "mais de",
          dataInicio: baseISO
        }].concat(memoriaComutacaoLC)
      },
      avisos
    };
  }

  // E05: arredonda o requisito conforme D3 e aplica D2 à data do benefício.
  function arredondarRequisito(dias, opcoes) {
    const arredondamento = opcoes && opcoes.arredondamento !== undefined
      ? opcoes.arredondamento
      : "cima";
    if (arredondamento === "baixo") return Math.floor(dias + 1e-10);
    if (arredondamento === "manter") return dias;
    return Math.ceil(dias - 1e-10);
  }

  function requisitoDistribuido(saldo, penas, total, opcoes) {
    if (!total) return 0;
    return penas.reduce((soma, item) =>
      soma + arredondarRequisito((saldo * item.dias / total) * item.fracaoPR, opcoes), 0);
  }

  function dataDoRequisito(base, requisito, creditoBase, creditosAte, dataCalculo, fugaAberta) {
    if (!Number.isFinite(requisito) || requisito < 0) return null;
    const alvo = creditoBase + requisito;
    let dia = Math.floor(dataUTC(base).getTime() / DIA_MS);
    const limite = fugaAberta
      ? Math.floor(dataCalculo.getTime() / DIA_MS)
      : dia + Math.max(requisito + 36525, 36525);
    while (dia <= limite) {
      const data = new Date(dia * DIA_MS);
      if (creditosAte(data) >= alvo) return serializarData(data);
      dia += 1;
    }
    return null;
  }

  function dataDoBeneficio(base, requisito, creditoBase, creditosAte, dataCalculo, fugaAberta, opcoes) {
    const data = dataDoRequisito(base, requisito, creditoBase, creditosAte, dataCalculo, fugaAberta);
    return data && opcoes && opcoes.menos1Beneficio === true
      ? serializarData(deslocarDias(dataUTC(data), -1))
      : data;
  }

  function calcularInterno(entrada, dataCalculoTexto, opcoes, baseRegras) {
    const erros = [];
    const avisos = [];
    const dataCalculo = dataUTC(dataCalculoTexto);
    if (!dataCalculo) {
      erros.push(erro("dataCalculo", "Informe uma data válida no formato AAAA-MM-DD.", "E90"));
    }
    if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) {
      return { erros: [erro("entrada", "Informe os dados da execução em um objeto válido.", "E90")] };
    }
    const convencao = opcoes && opcoes.convencaoDias || "calendario";
    if (!modulos.validar(opcoes)) {
      erros.push(erro("opcoes.modulosProvisorios", "Informe uma lista sem repetições com IDs de dados/modulos-provisorios.js, ou uma lista vazia para omiti-los.", "E90"));
    }
    if (!["calendario", "360", "365"].includes(convencao)) {
      erros.push(erro("opcoes.convencaoDias", "Escolha calendário, 360 ou 365 dias por ano.", "E90"));
    }
    if (opcoes && opcoes.menos1Beneficio !== undefined && typeof opcoes.menos1Beneficio !== "boolean") {
      erros.push(erro("opcoes.menos1Beneficio", "Informe se deve aplicar um dia a menos na data do benefício.", "E90"));
    }
    if (opcoes && opcoes.arredondamento !== undefined &&
        !["cima", "baixo", "manter"].includes(opcoes.arredondamento)) {
      erros.push(erro("opcoes.arredondamento", "Escolha arredondamento para cima, para baixo ou mantenha a fração.", "E90"));
    }
    if (opcoes && opcoes.metodoProgressao !== undefined &&
        !["padrao", "tjsp"].includes(opcoes.metodoProgressao)) {
      erros.push(erro("opcoes.metodoProgressao", "Escolha o método padrão ou o método TJSP para a progressão.", "D8"));
    }
    if (opcoes && opcoes.comutacaoAlteraBaseBeneficios !== undefined &&
        typeof opcoes.comutacaoAlteraBaseBeneficios !== "boolean") {
      erros.push(erro("opcoes.comutacaoAlteraBaseBeneficios", "Informe verdadeiro ou falso para o efeito da comutação nos benefícios.", "E100"));
    }
    if (entrada.comutacoes !== undefined && !Array.isArray(entrada.comutacoes)) {
      erros.push(erro("comutacoes", "Informe as comutações concedidas em uma lista.", "E100"));
    }
    (Array.isArray(entrada.comutacoes) ? entrada.comutacoes : []).forEach((item, indice) => {
      const campo = `comutacoes[${indice}]`;
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        erros.push(erro(campo, "Informe os dados da comutação concedida.", "E100"));
        return;
      }
      if (!Number.isSafeInteger(item.dias) || item.dias <= 0) {
        erros.push(erro(`${campo}.dias`, "Informe os dias comutados como inteiro positivo.", "E100"));
      }
      ["decreto", "origem"].forEach((nome) => {
        if (typeof item[nome] !== "string" || !item[nome].trim()) {
          erros.push(erro(`${campo}.${nome}`, `Informe ${nome === "decreto" ? "o decreto" : "a origem"} da comutação.`, "E100"));
        }
      });
      if (!dataUTC(item.dataDecisao)) {
        erros.push(erro(`${campo}.dataDecisao`, "Informe a data da decisão no formato AAAA-MM-DD.", "E100"));
      }
      if (item.condenacaoId !== undefined &&
          (typeof item.condenacaoId !== "string" || !item.condenacaoId ||
            !(Array.isArray(entrada.condenacoes) ? entrada.condenacoes : [])
              .some((condenacao) => condenacao && condenacao.id === item.condenacaoId))) {
        erros.push(erro(`${campo}.condenacaoId`, "Informe o identificador de uma condenação existente ou remova o vínculo.", "E100"));
      }
    });
    if (entrada.progressaoEspecial != null) {
      const especial = entrada.progressaoEspecial;
      if (typeof especial !== "object" || Array.isArray(especial)) {
        erros.push(erro("progressaoEspecial", "Informe os requisitos da progressão especial em um objeto.", "E37"));
      } else {
        ["solicitada", ...REQUISITOS_E37, "novoCrimeDoloso", "faltaGrave"].forEach((campo) => {
          if (especial[campo] != null && typeof especial[campo] !== "boolean") {
            erros.push(erro(`progressaoEspecial.${campo}`, "Informe verdadeiro ou falso para este requisito da progressão especial.", "E37"));
          }
        });
        if (especial.eventosRevogadores != null && !Array.isArray(especial.eventosRevogadores)) {
          erros.push(erro("progressaoEspecial.eventosRevogadores", "Informe os eventos revogadores em uma lista.", "E37"));
        } else {
          (especial.eventosRevogadores || []).forEach((evento, indice) => {
            const campo = `progressaoEspecial.eventosRevogadores[${indice}]`;
            if (!evento || !["novo_crime_doloso", "falta_grave"].includes(evento.tipo)) {
              erros.push(erro(`${campo}.tipo`, "Escolha novo crime doloso ou falta grave.", "E37"));
              return;
            }
            if (evento.data != null && !dataUTC(evento.data)) {
              erros.push(erro(`${campo}.data`, "Informe a data do evento no formato AAAA-MM-DD.", "E37"));
            }
            if (evento.situacao != null &&
                !["historico", "noticia", "sem_revogacao", "revogacao_reconhecida"].includes(evento.situacao)) {
              erros.push(erro(`${campo}.situacao`, "Informe a situação do evento e se houve decisão reconhecendo a revogação.", "E37"));
            }
          });
        }
      }
    }

    ["condenacoes", "prisoes", "interrupcoes", "detracoes", "remicoes", "faltasGraves", "progressoes", "regressoes"].forEach((campo) => {
      if (entrada[campo] != null && !Array.isArray(entrada[campo])) {
        erros.push(erro(campo, "Informe uma lista válida.", "E90"));
      }
    });
    (Array.isArray(entrada.regressoes) ? entrada.regressoes : []).forEach((regressao, indice) => {
      const campo = `regressoes[${indice}]`;
      if (!regressao || !dataUTC(regressao.data)) {
        erros.push(erro(`${campo}.data`, "Informe a data da regressão no formato AAAA-MM-DD.", "D8"));
      } else if (dataCalculo && dataUTC(regressao.data) > dataCalculo) {
        erros.push(erro(`${campo}.data`, "A data da regressão não pode ser posterior à data do cálculo.", "D8"));
      }
      if (!regressao || !["fechado", "semiaberto", "aberto"].includes(regressao.para)) {
        erros.push(erro(`${campo}.para`, "Escolha o regime para o qual houve regressão.", "D8"));
      }
    });
    (Array.isArray(entrada.progressoes) ? entrada.progressoes : []).forEach((progressao, indice) => {
      ["dataRequisitoSubjetivo", "dataBaseReconhecida"].forEach((campoData) => {
        if (!progressao || progressao[campoData] == null) return;
        const data = dataUTC(progressao[campoData]);
        if (!data) {
          erros.push(erro(
            `progressoes[${indice}].${campoData}`,
            "Informe uma data válida no formato AAAA-MM-DD.",
            "D6"
          ));
        } else if (dataCalculo && data > dataCalculo) {
          erros.push(erro(
            `progressoes[${indice}].${campoData}`,
            "A data do requisito não pode ser posterior à data do cálculo.",
            "D6"
          ));
        }
      });
    });
    [
      ...(Array.isArray(entrada.prisoes) ? entrada.prisoes : [])
        .map((item, indice) => ({ item, campo: `prisoes[${indice}].saldosCondenacoes`, regra: "D8" })),
      ...(Array.isArray(entrada.regressoes) ? entrada.regressoes : [])
        .map((item, indice) => ({ item, campo: `regressoes[${indice}].saldosCondenacoes`, regra: "D8" })),
      ...(Array.isArray(entrada.faltasGraves) ? entrada.faltasGraves : [])
        .map((item, indice) => ({ item, campo: `faltasGraves[${indice}].saldosCondenacoes`, regra: "E23" }))
    ].forEach(({ item, campo, regra }) => {
      if (item) validarSaldosCondenacoes(item.saldosCondenacoes, campo,
        Array.isArray(entrada.condenacoes) ? entrada.condenacoes : [], regra, erros);
    });

    // E90–E93: erros de entrada são retornados à interface, sem exceções.
    const condenacoes = Array.isArray(entrada.condenacoes) ? entrada.condenacoes : [];
    const prisoes = Array.isArray(entrada.prisoes) ? entrada.prisoes : [];
    const detractionsFromPrisons = [];
    if (condenacoes.length === 0) {
      erros.push(erro("condenacoes", "Inclua ao menos uma condenação.", "E90"));
    }
    if (prisoes.length === 0) {
      erros.push(erro("prisoes", "Informe ao menos uma data de início da prisão.", "E90"));
    }
    const eventoE13 = avaliarEventoE13(
      entrada.eventoE13, dataCalculo, condenacoes, avisos, erros
    );

    const datasFato = [];
    condenacoes.forEach((condenacao, indice) => {
      const campo = `condenacoes[${indice}]`;
      if (!condenacao || typeof condenacao !== "object") {
        erros.push(erro(campo, "Informe os dados da condenação.", "E90"));
        return;
      }
      const fato = dataUTC(condenacao.dataFato);
      if (!fato) erros.push(erro(`${campo}.dataFato`, "Informe uma data do fato válida no formato AAAA-MM-DD.", "E90"));
      else if (fato < dataUTC(CORTE_ESCOPO)) {
        erros.push(erro(`${campo}.dataFato`, "Fato anterior a 26/07/1990 está fora do escopo da calculadora.", "E91"));
      } else if (dataCalculo && fato > dataCalculo) {
        erros.push(erro(`${campo}.dataFato`, "A data do fato não pode ser posterior à data do cálculo.", "E90"));
      } else {
        datasFato.push(fato);
      }
      const pena = condenacao.pena;
      if (!pena || !["anos", "meses", "dias"].every((parte) => validarInteiroNaoNegativo(pena[parte]))) {
        erros.push(erro(`${campo}.pena`, "Informe anos, meses e dias como números inteiros não negativos.", "E90"));
      }
      if (condenacao.penaRestante &&
          !["anos", "meses", "dias"].every((parte) => validarInteiroNaoNegativo(condenacao.penaRestante[parte]))) {
        erros.push(erro(`${campo}.penaRestante`, "Informe a pena restante em anos, meses e dias como números inteiros não negativos.", "E80"));
      }
      ["dataTransitoAcusacao", "dataTransito"].forEach((campoData) => {
        if (condenacao[campoData] != null && !dataUTC(condenacao[campoData])) {
          erros.push(erro(`${campo}.${campoData}`, "Informe uma data válida no formato AAAA-MM-DD.", "E81"));
        } else if (condenacao[campoData] && dataCalculo && dataUTC(condenacao[campoData]) > dataCalculo) {
          erros.push(erro(`${campo}.${campoData}`, "A data do trânsito não pode ser posterior à data do cálculo.", "E81"));
        }
      });
      if (condenacao.dataTransitoAcusacao && condenacao.dataTransito &&
          dataUTC(condenacao.dataTransitoAcusacao) && dataUTC(condenacao.dataTransito) &&
          condenacao.dataTransito < condenacao.dataTransitoAcusacao) {
        erros.push(erro(`${campo}.dataTransito`, "O trânsito para ambas as partes não pode anteceder o trânsito para a acusação.", "E81"));
      }
      ["idadeNaDataFato", "idadeNaSentenca"].forEach((campoIdade) => {
        if (condenacao[campoIdade] !== undefined && !validarInteiroNaoNegativo(condenacao[campoIdade])) {
          erros.push(erro(`${campo}.${campoIdade}`, "Informe uma idade inteira e não negativa.", "E80"));
        }
      });
      if (condenacao.natureza === "feminicidio" && condenacao.dataFato < CORTE_FEMINICIDIO) {
        avisos.push({ texto: "Confira a natureza informada: feminicídio autônomo não se aplicava nesta data do fato.", regra: "E92" });
      }
      const crime = typeof condenacao.crime === "string" ? condenacao.crime.toLowerCase() : "";
      if (condenacao.natureza === "hediondo" && /furto.{0,30}explosivo/.test(crime) && condenacao.dataFato < CORTE_LEI_13964) {
        avisos.push({ texto: "Confira a classificação de furto com explosivo nesta data do fato.", regra: "E92" });
      }
    });

    const datasPrisao = [];
    const datasBaseExecucao = [];
    prisoes.forEach((prisao, indice) => {
      const campo = `prisoes[${indice}]`;
      const inicio = prisao && dataUTC(prisao.inicio);
      if (!inicio) {
        erros.push(erro(`${campo}.inicio`, "Informe uma data de início da prisão válida no formato AAAA-MM-DD.", "E90"));
        return;
      }
      if (!["definitiva", "provisoria"].includes(prisao.tipo)) {
        erros.push(erro(`${campo}.tipo`, "Escolha prisão definitiva ou provisória.", "E90"));
      }
      if (dataCalculo && inicio > dataCalculo) {
        erros.push(erro(`${campo}.inicio`, "A prisão não pode começar depois da data do cálculo.", "E90"));
      }
      datasPrisao.push(inicio);
      if (prisao.tipo !== "provisoria") datasBaseExecucao.push(inicio);
      if (prisao.fim != null && !dataUTC(prisao.fim)) {
        erros.push(erro(`${campo}.fim`, "Informe uma data final válida no formato AAAA-MM-DD.", "E90"));
      } else if (prisao.fim != null && dataUTC(prisao.fim) < inicio) {
        erros.push(erro(`${campo}.fim`, "A data final da prisão não pode anteceder o início.", "E90"));
      }
      if (prisao.tipo === "provisoria" && dataCalculo) {
        const fim = prisao.fim == null ? dataCalculo : dataUTC(prisao.fim);
        if (fim) {
          detractionsFromPrisons.push({
            inicio: prisao.inicio,
            fim: serializarData(fim)
          });
        }
      }
    });

    const cenarioD7 = identificarCenarioD7(prisoes);
    const dataBaseD7 = cenarioD7
      ? opcoes && opcoes.teseD7 === "retorno-definitiva"
        ? cenarioD7.retornoDefinitiva
        : cenarioD7.primeiraPrisao
      : null;
    const aplicarBaseE13 = Boolean(eventoE13 && eventoE13.dataInicioExecucao && !dataBaseD7);
    const base = dataBaseD7
      ? dataUTC(dataBaseD7)
      : aplicarBaseE13
        ? dataUTC(eventoE13.dataInicioExecucao)
      : (datasBaseExecucao.length ? datasBaseExecucao : datasPrisao).sort((a, b) => a - b)[0] || null;
    if (base && dataCalculo && base > dataCalculo) {
      erros.push(erro("prisoes", "A data de início deve ser anterior ou igual à data do cálculo.", "E90"));
    }
    if (base) {
      (Array.isArray(entrada.comutacoes) ? entrada.comutacoes : []).forEach((item, indice) => {
        if (!item || item.condenacaoId === undefined || !Number.isSafeInteger(item.dias)) return;
        const condenacao = condenacoes.find((registro) => registro && registro.id === item.condenacaoId);
        if (!condenacao || !condenacao.pena ||
            !["anos", "meses", "dias"].every((parte) => validarInteiroNaoNegativo(condenacao.pena[parte]))) return;
        if (item.dias > diasPena(condenacao.pena, base, convencao)) {
          erros.push(erro(`comutacoes[${indice}].dias`,
            "A comutação vinculada supera a pena original desta condenação. Confira os dias ou o vínculo informado.", "E100"));
        }
      });
      [
        ...(Array.isArray(entrada.prisoes) ? entrada.prisoes : [])
          .map((item, indice) => ({ item, campo: `prisoes[${indice}].saldosCondenacoes`, regra: "D8" })),
        ...(Array.isArray(entrada.regressoes) ? entrada.regressoes : [])
          .map((item, indice) => ({ item, campo: `regressoes[${indice}].saldosCondenacoes`, regra: "D8" })),
        ...(Array.isArray(entrada.faltasGraves) ? entrada.faltasGraves : [])
          .map((item, indice) => ({ item, campo: `faltasGraves[${indice}].saldosCondenacoes`, regra: "E23" }))
      ].forEach(({ item, campo, regra }) => {
        (Array.isArray(item && item.saldosCondenacoes) ? item.saldosCondenacoes : [])
          .forEach((saldo, saldoIndice) => {
            if (!saldo || !validarInteiroNaoNegativo(saldo.dias)) return;
            const condenacao = condenacoes.find((item) => item && item.id === saldo.condenacaoId);
            if (!condenacao || !condenacao.pena ||
                !["anos", "meses", "dias"].every((parte) => validarInteiroNaoNegativo(condenacao.pena[parte]))) return;
            const limiteDias = diasPena(condenacao.pena, base, convencao);
            if (saldo.dias > limiteDias) {
              erros.push(erro(
                `${campo}[${saldoIndice}].dias`,
                "O saldo não pode superar a pena total desta condenação.",
                regra
              ));
            }
          });
      });
    }
    if (base && datasFato.length && datasFato.some((fato) => base < fato)) {
      avisos.push({ texto: "A data de início da prisão é anterior a uma data do fato; confira possível erro de digitação.", regra: "E90" });
    }

    const prisaoAtiva = prisoes.some((prisao) => {
      const inicio = prisao && dataUTC(prisao.inicio);
      const fim = prisao && prisao.fim != null ? dataUTC(prisao.fim) : null;
      return inicio && inicio <= dataCalculo && (!fim || fim > dataCalculo);
    });
    const intervalosInterrupcao = (Array.isArray(entrada.interrupcoes) ? entrada.interrupcoes : [])
      .concat(base && dataCalculo ? interrupcoesEntrePrisoes(prisoes, dataCalculo, base) : []);
    const interrupcoes = intervaloDias(intervalosInterrupcao, dataCalculo || new Date(0), "interrupcoes", erros, true);
    let intervalosDetracao = (Array.isArray(entrada.detracoes) ? entrada.detracoes : []).concat(detractionsFromPrisons);
    if (aplicarBaseE13) {
      const inicioE13 = eventoE13.dataInicioExecucao;
      intervalosDetracao = intervalosDetracao
        .filter((item) => item.fim >= inicioE13)
        .map((item) => item.inicio < inicioE13 ? { ...item, inicio: inicioE13 } : item);
    }
    const detracao = intervaloDias(intervalosDetracao, dataCalculo || new Date(0), "detracoes", erros);
    const cautelarDetracao = prepararDetracoesCautelares(
      Array.isArray(entrada.detracoesCautelares) ? entrada.detracoesCautelares : [],
      intervalosDetracao,
      dataCalculo || new Date(0),
      erros,
      avisos
    );
    const detracaoCautelarDias = cautelarDetracao.diasAte(dataCalculo || new Date(0));
    const detracaoDias = detracao.dias + detracaoCautelarDias;
    if (cautelarDetracao.quantidade) {
      avisos.push({
        texto: "Detração de recolhimento domiciliar calculada provisoriamente pelo Tema 1155/STJ. O Tema 1454/STF aguarda julgamento; confira o período, os comprovantes e a tese alternativa.",
        regra: "E27-A",
        status: "Pendente de validação"
      });
    }
    if (detracao.sobreposto) {
      avisos.push({ texto: "Períodos de detração sobrepostos foram contados uma única vez.", regra: "E27" });
    }
    // E28/E29: apenas dias homologados entram no total principal.
    let remicaoDias = 0;
    let remicaoNaoHomologadaDias = 0;
    (Array.isArray(entrada.remicoes) ? entrada.remicoes : []).forEach((remicao, indice) => {
      if (!remicao || !validarInteiroNaoNegativo(remicao.dias) || typeof remicao.homologada !== "boolean") {
        erros.push(erro(`remicoes[${indice}]`, "Informe dias não negativos e se a remição foi homologada.", "E28"));
        return;
      }
      if (remicao.dataHomologacao != null && !dataUTC(remicao.dataHomologacao)) {
        erros.push(erro(`remicoes[${indice}].dataHomologacao`, "Informe uma data de homologação válida no formato AAAA-MM-DD.", "E28"));
        return;
      }
      if (remicaoDomiciliar(remicao)) {
        const periodo = remicao.periodo;
        if (!periodo || !dataUTC(periodo.inicio) || !dataUTC(periodo.fim) ||
            periodo.inicio > periodo.fim) {
          erros.push(erro(`remicoes[${indice}].periodo`, "Informe início e fim válidos do período domiciliar, em ordem cronológica.", "E39"));
          return;
        }
      }
      if (remicao.homologada && (!remicao.dataHomologacao || !dataCalculo || dataUTC(remicao.dataHomologacao) <= dataCalculo)) {
        if (!remicaoDomiciliarDefensiva(remicao)) remicaoDias += remicao.dias;
      } else if (!remicao.homologada) {
        remicaoNaoHomologadaDias += remicao.dias;
      }
    });
    const remicoesDomiciliaresDefensivas = (Array.isArray(entrada.remicoes) ? entrada.remicoes : [])
      .filter(remicaoDomiciliarDefensiva);
    if (remicoesDomiciliaresDefensivas.length) {
      const diasDefensivos = remicoesDomiciliaresDefensivas.reduce((soma, remicao) => soma + remicao.dias, 0);
      avisos.push({
        texto: `${diasDefensivos} dia(s) de remição em regime domiciliar antes de 08/05/2026 não foram aplicados no cálculo principal; a tese defensiva de aplicação imediata está no cenário E39 (PD-01).`,
        regra: "E39"
      });
    }
    if (remicaoNaoHomologadaDias > 0) {
      avisos.push({ texto: `${remicaoNaoHomologadaDias} dia(s) de remição não homologada não foram abatidos no cenário principal.`, regra: "E29" });
    }
    const diasPerdidosRemicao = (Array.isArray(entrada.faltasGraves) ? entrada.faltasGraves : [])
      .filter((item) => item && item.data <= serializarData(dataCalculo))
      .reduce((soma, item) => soma + (Number.isInteger(item.diasPerdidosRemicao) ? Math.max(item.diasPerdidosRemicao, 0) : 0), 0);
    remicaoDias = Math.max(remicaoDias - diasPerdidosRemicao, 0);

    validarOrigem(entrada, erros);
    if (erros.length) return { erros };
    if (!base || !dataCalculo) return { erros: [erro("entrada", "Não foi possível determinar a data-base.", "E90")] };

    // E10/E12: a unificação soma penas, sem recalcular a data-base.
    const penaTotalBruta = somarPenas(condenacoes);
    const penaTotal = normalizarPena(penaTotalBruta);
    const penaTotalDias = diasPena(penaTotalBruta, base, convencao);
    const prazoLimite = datasFato.some((fato) => serializarData(fato) >= CORTE_LEI_13964) ? 40 : 30;
    const limiteDias = convencao === "360" ? prazoLimite * 360
      : convencao === "365" ? prazoLimite * 365
        : diasEntre(base, adicionarDuracao(base, { anos: prazoLimite, meses: 0, dias: 0 }));
    const limiteAplicado = penaTotalDias > limiteDias;
    const prazoTermino = limiteAplicado ? { anos: prazoLimite, meses: 0, dias: 0 } : penaTotalBruta;
    // E11/E50: o limite do art. 75 afeta somente o término; abatimentos são dias corridos.
    let dataTermino = deslocarDias(
      adicionarDuracao(base, prazoTermino),
      -1 - detracaoDias - remicaoDias + interrupcoes.dias
    );
    const decorrido = Math.max(0, diasEntre(base, dataCalculo) + 1);
    // E51: saldo na data de cálculo, com detração e remição homologada em dias.
    const cumpridoDias = Math.max(0, decorrido + detracaoDias + remicaoDias - interrupcoes.dias);
    const beneficios = calcularBeneficios(
      entrada, dataCalculo, base, penaTotalDias, convencao, intervalosDetracao, cautelarDetracao, intervalosInterrupcao, opcoes, prisaoAtiva, baseRegras
    );
    // E100: nunca deslocar o término para antes da decisão que concedeu a redução.
    const dataTerminoLimitada = dataTermino;
    let dataTerminoSemLimite = deslocarDias(
      adicionarDuracao(base, penaTotalBruta),
      -1 - detracaoDias - remicaoDias + interrupcoes.dias
    );
    (beneficios.comutacoesProjetadas || []).forEach((item) => {
      if (!item || item.dataDecisao > serializarData(dataTermino)) return;
      const reduzido = deslocarDias(dataTerminoSemLimite, -item.diasAplicados);
      dataTerminoSemLimite = reduzido < dataUTC(item.dataDecisao) ? dataUTC(item.dataDecisao) : reduzido;
      // E11/E100: comutar a pena antes de aplicar o teto, sem reduzir automaticamente o teto legal.
      dataTermino = limiteAplicado && dataTerminoLimitada < dataTerminoSemLimite
        ? dataTerminoLimitada : dataTerminoSemLimite;
    });
    const comutacaoDias = beneficios.comutacaoDias || 0;
    const restanteDias = Math.max(0, penaTotalDias - cumpridoDias - comutacaoDias);
    const cenarioSeHomologadas = remicaoNaoHomologadaDias > 0 ? {
      remicaoDias: remicaoDias + remicaoNaoHomologadaDias,
      termino: serializarData(deslocarDias(dataTermino, -remicaoNaoHomologadaDias)),
      cumprido: decomporDias(cumpridoDias + remicaoNaoHomologadaDias, convencao, base),
      restante: decomporDias(Math.max(0, restanteDias - remicaoNaoHomologadaDias), convencao, base)
    } : null;
    if (cenarioD7 && (!opcoes || opcoes.teseD7 !== "retorno-definitiva")) {
      const resultadoRetorno = calcularInterno(entrada, dataCalculoTexto, {
        ...(opcoes || {}),
        teseD7: "retorno-definitiva"
      }, baseRegras);
      const diasCustodiaAnterior = Math.max(
        0,
        diasEntre(dataUTC(cenarioD7.prisaoCautelar), dataUTC(cenarioD7.fimCautelar)) + 1
      );
      const dataAlternativa = resultadoRetorno && !resultadoRetorno.erros
        ? resultadoRetorno.progressao && resultadoRetorno.progressao.data
        : null;
      avisos.push({
        texto: `Tema 1.457/STJ pendente. Padrão defensivo: data-base na primeira prisão. Pelo retorno à prisão definitiva, com detração de ${diasCustodiaAnterior} dias de custódia anterior, a data é ${dataAlternativa || "não calculada"}.`,
        regra: "D7"
      });
    }
    avisos.push(...beneficios.avisos);
    const incluirExecutoria = modulos.inclui(opcoes, "E80");
    const incluirFaltas = modulos.inclui(opcoes, "E82");
    const prescricao = incluirExecutoria || incluirFaltas ? calcularPrescricao(
      entrada, dataCalculo, base, convencao, intervalosDetracao, cautelarDetracao,
      intervalosInterrupcao, opcoes, baseRegras
    ) : null;
    if (prescricao) avisos.push(...prescricao.avisos.filter((aviso) => modulos.inclui(opcoes, aviso.regra)));
    const terminoFinal = beneficios.fugaAberta || !prisaoAtiva ? null : serializarData(dataTermino);
    // E102: a triagem suprime projeções, sem alterar o término calculado.
    const penaIntegralmenteCumprida = terminoFinal && terminoFinal <= serializarData(dataCalculo)
      ? {
        data: terminoFinal,
        diasExcedentes: diasEntre(dataUTC(terminoFinal), dataCalculo)
      }
      : null;
    if (penaIntegralmenteCumprida) {
      const dias = penaIntegralmenteCumprida.diasExcedentes;
      const diasTexto = `${dias} ${dias === 1 ? "dia" : "dias"}`;
      const dataTexto = penaIntegralmenteCumprida.data.split("-").reverse().join("/");
      avisos.unshift({
        regra: "E102",
        texto: `Triagem: pelos dados informados, a pena consta como cumprida desde ${dataTexto}; passaram-se ${diasTexto} até a data do cálculo. Confira pena, prisões, detração e remição; o defensor confere.`
      });
      for (const nome of ["progressao", "livramento", "saidaTemporaria"]) {
        const beneficio = beneficios[nome];
        beneficio.data = null;
        beneficio.estimativa = null;
        beneficio.motivoNaoCabe = "A pena consta como cumprida segundo os dados informados (E102).";
        beneficio.fundamentoNaoCabe = ["E102"];
        if (Object.hasOwn(beneficio, "cabe")) beneficio.cabe = false;
      }
    }
    if ((beneficios.fugaAberta || !prisaoAtiva) && cenarioSeHomologadas) cenarioSeHomologadas.termino = null;
    const linhaDoTempo = [
    { data: serializarData(base), tipo: "data_base", descricao: "Início do cumprimento.", regra: "E20" },
    ...(eventoE13 ? [
      { data: eventoE13.dataCrime, tipo: "novo_crime_livramento", descricao: "Novo fato informado durante o período de prova do livramento.", regra: "E13" },
      ...(eventoE13.dataPrisao ? [{
        data: eventoE13.dataPrisao,
        tipo: "prisao_novo_fato",
        descricao: "Prisão pelo novo fato preservada no histórico; o período anterior ao início da nova execução não foi abatido novamente.",
        regra: "E13"
      }] : []),
      ...(eventoE13.dataInicioInformada ? [{
        data: eventoE13.dataInicioInformada,
        tipo: "inicio_execucao_nova",
        descricao: aplicarBaseE13
          ? "Início da nova execução no dia seguinte ao fim do período de prova."
          : "Data-base provisória; conferir decisão e reconstruir a execução.",
        regra: "E13"
      }] : []),
      ...(eventoE13.dataDecisao ? [{
        data: eventoE13.dataDecisao,
        tipo: "decisao_livramento",
        descricao: "Decisão informada sobre suspensão, revogação ou unificação.",
        regra: "E13"
      }] : [])
    ] : []),
    ...(entrada.progressaoEspecial && Array.isArray(entrada.progressaoEspecial.eventosRevogadores)
      ? entrada.progressaoEspecial.eventosRevogadores
        .filter((item) => item && dataUTC(item.data) && item.data <= serializarData(dataCalculo))
        .map((item) => ({
          data: item.data,
          tipo: item.tipo,
          descricao: item.situacao === "revogacao_reconhecida"
            ? "Decisão reconheceu a revogação da progressão especial."
            : item.situacao === "noticia"
              ? "Notícia de evento potencialmente revogador; decisão não presumida."
              : "Fato histórico informado para conferência da progressão especial.",
          regra: "E37"
        }))
      : []),
    ...(Array.isArray(entrada.faltasGraves) ? entrada.faltasGraves
    .filter((item) => item && item.data <= serializarData(dataCalculo))
    .map((item) => ({
      data: item.tipo === "fuga"
        ? item.dataRecaptura || intervalosInterrupcao.find((intervalo) => intervalo.inicio === item.data)?.fim
        : item.data,
      tipo: "falta_grave",
      descricao: "Falta grave.", regra: "E22"
    }))
    .filter((item) => item.data) : []),
    ...(beneficios.comutacoes || []).map((item) => ({
      data: item.dataDecisao, tipo: "comutacao", regra: "E100",
      descricao: `Comutação concedida: ${item.diasAplicados} dia(s) abatido(s) — ${item.decreto}. CONFERIR.`
    })),
    ...(beneficios.progressao.data ? [{ data: beneficios.progressao.data, tipo: "progressao", descricao: `Requisito para ${beneficios.progressao.proximoRegime}.`, regra: beneficios.progressao.memoria[0].regra }] : []),
    ...(beneficios.livramento.data ? [{ data: beneficios.livramento.data, tipo: "livramento", descricao: "Requisito objetivo do livramento.", regra: beneficios.livramento.memoria[0].regra }] : []),
    ...(beneficios.saidaTemporaria.data ? [{ data: beneficios.saidaTemporaria.data, tipo: "saida_temporaria", descricao: "Requisito objetivo da saída temporária.", regra: "E61" }] : []),
    ...(beneficios.fugaAberta ? [] : [{ data: serializarData(dataTermino), tipo: "termino", descricao: "Término projetado da pena.", regra: "E50" }])
    ].filter((evento) => !penaIntegralmenteCumprida ||
      !["progressao", "livramento", "saida_temporaria"].includes(evento.tipo) ||
      evento.data <= penaIntegralmenteCumprida.data)
      .sort((a, b) => a.data.localeCompare(b.data));

    return {
    status: "a_conferir",
    regrasVersao: baseRegras && baseRegras.versao || Regras.base.versao,
    condenacoes: beneficios.condenacoes,
    penaTotal: { ...penaTotal, emDias: penaTotalDias },
      limiteArt75: {
        aplicado: limiteAplicado && (!comutacaoDias || dataTerminoLimitada <= dataTerminoSemLimite),
        anos: prazoLimite, regra: "E11"
      },
      dataBase: serializarData(base),
      detracaoDias,
      detracaoCautelarDias,
      remicaoDias,
      comutacaoDias,
      comutacoesAplicadas: beneficios.comutacoes || [],
      diasPerdidosRemicao,
      remicaoNaoHomologadaDias,
      interrupcaoDias: interrupcoes.dias,
      termino: terminoFinal,
      cumprido: decomporDias(cumpridoDias, convencao, base),
      restante: decomporDias(restanteDias, convencao, base),
      cenarioSeHomologadas,
      dataBaseProgressao: beneficios.dataBase,
      progressao: beneficios.progressao,
      livramento: beneficios.livramento,
      eventoE13: eventoE13 ? {
        dataCrime: eventoE13.dataCrime,
        dataPrisao: eventoE13.dataPrisao,
        condenacaoId: eventoE13.condenacaoId,
        dataInicioExecucao: eventoE13.dataInicioInformada,
        dataDecisao: eventoE13.dataDecisao,
        situacao: eventoE13.situacao,
        penasUnificadas: eventoE13.penasUnificadas,
        dataBaseAplicada: aplicarBaseE13
      } : null,
      saidaTemporaria: beneficios.saidaTemporaria,
      ...(modulos.inclui(opcoes, "E70") ? { cortesHistoricos: beneficios.cortesHistoricos } : {}),
      ...(incluirExecutoria ? { prescricaoExecutoria: prescricao.executoria } : {}),
      ...(incluirFaltas ? { prescricaoFaltaGrave: prescricao.faltas } : {}),
      ...(prescricao ? {
        linhaDoTempoPrescricao: prescricao.linhaDoTempo.filter((evento) => modulos.inclui(opcoes, evento.regra))
      } : {}),
      ...(penaIntegralmenteCumprida ? { penaIntegralmenteCumprida } : {}),
      memoriaTermino: {
        regra: [
          "E03", "E04", "E06", "E11", "E27",
          ...(cautelarDetracao.quantidade ? ["E27-A"] : []),
          "E28", "E50",
          ...(beneficios.comutacoes && beneficios.comutacoes.length ? ["E100"] : []),
          ...((Array.isArray(entrada.remicoes) ? entrada.remicoes : [])
            .some(remicaoDomiciliar) ? ["E39"] : [])
        ],
        penaDias: penaTotalDias,
        detracaoDias,
        detraçãoDias: detracaoDias,
        remicaoDias,
        comutacaoDias,
        comutacoesAplicadas: beneficios.comutacoes || []
      },
      linhaDoTempo,
      avisos
    };
  }

  function calcular(entrada, dataCalculoTexto, opcoes, baseRegras) {
    try {
      return complementarContrato(calcularInterno(entrada, dataCalculoTexto, opcoes, baseRegras));
    } catch {
      return {
        versaoContrato: 1,
        nucleoVersao: versao,
        erros: [erro("entrada", "Confira os campos e as datas informados.", "E90")]
      };
    }
  }

  function complementarContrato(resultado) {
    for (const nome of ["progressao", "livramento", "saidaTemporaria"]) {
      const beneficio = resultado[nome];
      if (!beneficio || beneficio.data !== null) continue;
      if (resultado.penaIntegralmenteCumprida) {
        beneficio.motivoNaoCabe = "A pena consta como cumprida segundo os dados informados (E102).";
        beneficio.fundamentoNaoCabe = ["E102"];
        continue;
      }
      const regras = (beneficio.memoria || []).flatMap((item) =>
        Array.isArray(item.regra) ? item.regra : item.regra ? [item.regra] : []);
      if (!beneficio.motivoNaoCabe) {
        if (resultado.fugaAberta) {
          beneficio.motivoNaoCabe = "Informe a data da recaptura para projetar a data do benefício.";
          regras.push("E21");
        } else if (nome === "progressao" && beneficio.estimativa) {
          beneficio.motivoNaoCabe = "A data conclusiva depende do saldo de cada condenação; o rateio proporcional é apenas estimativo.";
          regras.push("E23");
        } else {
          beneficio.motivoNaoCabe = "Não foi possível determinar a data com os dados informados; confira os requisitos e complete os dados pendentes.";
        }
      }
      if (nome === "progressao") regras.push("E30");
      if (nome === "livramento") regras.push("E40", "E41");
      if (nome === "saidaTemporaria") regras.push("E60", "E61");
      beneficio.fundamentoNaoCabe = [...new Set(regras)];
    }
    return { ...resultado, versaoContrato: 1, nucleoVersao: versao };
  }

  // E80–E82: mantém o cálculo e a linha do tempo da prescrição separados dos benefícios.
  function calcularPrescricao(entrada, dataCalculo, base, convencao, intervalosDetracao, cautelarDetracao, intervalosInterrupcao, opcoes, baseRegras) {
    const dataCalculoISO = serializarData(dataCalculo);
    const regrasPrescricao = baseRegras && baseRegras.prescricao || Regras.dados.prescricao;
    const regraE80 = regrasPrescricao.E80;
    const regraE81 = regrasPrescricao.E81;
    const regraE82 = regrasPrescricao.E82;
    const faltasOriginais = Array.isArray(entrada.faltasGraves) ? entrada.faltasGraves : [];
    const fugas = intervalosInterrupcao
      .filter((item) => item && item.motivo === "fuga" && item.inicio <= dataCalculoISO)
      .map((item) => ({ inicio: item.inicio, fim: item.fim || null }));
    faltasOriginais.filter((item) => item && item.tipo === "fuga" && item.data <= dataCalculoISO)
      .forEach((falta) => {
        const existente = fugas.find((item) => item.inicio === falta.data);
        if (existente) {
          if (falta.dataRecaptura) existente.fim = falta.dataRecaptura;
        } else {
          fugas.push({ inicio: falta.data, fim: falta.dataRecaptura || null });
        }
      });
    const prisaoDefinitiva = (Array.isArray(entrada.prisoes) ? entrada.prisoes : [])
      .filter((item) => item && item.tipo === "definitiva" && item.inicio <= dataCalculoISO)
      .sort((a, b) => a.inicio.localeCompare(b.inicio))[0] || null;
    const avisos = [
      { texto: "O cálculo da prescrição é provisório e deve ser conferido.", regra: "E80" },
      { texto: "Confira o termo inicial e a modulação do Tema 788 do STF.", regra: "E81" },
      { texto: "O prazo da falta grave é provisório e deve ser conferido.", regra: "E82" }
    ];
    const prescricaoOpcoes = opcoes && opcoes.prescricao || {};
    const porCondenacao = prescricaoOpcoes.porCondenacao || {};
    const executoria = entrada.condenacoes.map((condenacao, indice) => {
      const idOpcoes = condenacao.id || `c${indice + 1}`;
      const opcoesCrime = Object.prototype.hasOwnProperty.call(porCondenacao, idOpcoes)
        ? porCondenacao[idOpcoes] || {}
        : {};
      const extincaoDeclarada = opcoesCrime.extincaoDeclarada === "sim";
      const outraCausaNaoInformada = (Array.isArray(entrada.interrupcoes) ? entrada.interrupcoes : [])
        .some((item) => item && item.motivo && item.motivo !== "fuga");
      const suspensaoE13 = entrada.eventoE13 && entrada.eventoE13.situacao === "suspenso";
      const causasConferidas = opcoesCrime.certidoesConferidas === true &&
        opcoesCrime.outrasCausas === "nao" && !outraCausaNaoInformada && !suspensaoE13;
      const reincidente = ["generico", "especifico"].includes(condenacao.reincidencia);
      const idadesInformadas = Number.isInteger(condenacao.idadeNaDataFato) &&
        Number.isInteger(condenacao.idadeNaSentenca);
      const elegivelRedutorArt115 = idadesInformadas
        ? condenacao.idadeNaDataFato < 21 || condenacao.idadeNaSentenca > 70
        : null;
      const reducaoVedada = condenacao.dataFato >= regraE80.redutorEtario.vedacaoViolenciaSexualMulherDesde &&
        elegivelRedutorArt115 === true && opcoesCrime.violenciaSexualContraMulher === "sim";
      const naturezaSexualConfirmada = condenacao.dataFato < regraE80.redutorEtario.vedacaoViolenciaSexualMulherDesde ||
        elegivelRedutorArt115 !== true ||
        ["sim", "nao"].includes(opcoesCrime.violenciaSexualContraMulher);
      const redutorArt115 = elegivelRedutorArt115 === null || !naturezaSexualConfirmada
        ? null
        : elegivelRedutorArt115 && !reducaoVedada;
      const fugasAplicaveis = fugas.filter((item) => prisaoDefinitiva &&
        item.inicio >= prisaoDefinitiva.inicio).sort((a, b) => a.inicio.localeCompare(b.inicio));
      const fugaAplicavel = fugasAplicaveis[fugasAplicaveis.length - 1] || null;
      const fugaSemRecaptura = fugaAplicavel &&
        (!fugaAplicavel.fim || fugaAplicavel.fim > dataCalculoISO);
      const revogacao = opcoesCrime.revogacaoLivramento || {};
      const revogacaoAplicavel = revogacao.ocorreu === true &&
        typeof revogacao.data === "string" && revogacao.data <= dataCalculoISO;
      const revogacaoSemData = revogacao.ocorreu === true && !revogacaoAplicavel;
      let penaBase = condenacao.pena;
      let penaRestanteDias = null;
      let marcoInicial = null;
      let termoRegular = null;
      const transitoAcusacao = condenacao.dataTransitoAcusacao;
      if (transitoAcusacao && transitoAcusacao <= regraE81.corteTransitoAcusacao) {
        termoRegular = transitoAcusacao;
        marcoInicial = {
          tipo: "transito_acusacao",
          pergunta: `Houve trânsito para a acusação até ${regraE81.corteTransitoAcusacao.split("-").reverse().join("/")}, inclusive?`,
          explicacao: "Até essa data, o marco provisório é o trânsito para a acusação."
        };
      } else if (transitoAcusacao && condenacao.dataTransito) {
        termoRegular = condenacao.dataTransito;
        marcoInicial = {
          tipo: "transito_ambas_partes",
          pergunta: `Houve trânsito para a acusação depois de ${regraE81.corteTransitoAcusacao.split("-").reverse().join("/")}?`,
          explicacao: "Depois dessa data, o marco provisório é o trânsito para ambas as partes."
        };
      }
      if (fugaAplicavel && fugaAplicavel.fim && fugaAplicavel.fim <= dataCalculoISO &&
          (!termoRegular || fugaAplicavel.fim > termoRegular)) {
        termoRegular = fugaAplicavel.fim;
        marcoInicial = {
          tipo: "recaptura",
          pergunta: "Houve fuga? Quando ocorreu a recaptura?",
          explicacao: "Na fuga, o prazo provisório começa na recaptura; confirme a data na certidão."
        };
      }
      if (revogacaoAplicavel && (!termoRegular || revogacao.data > termoRegular)) {
        termoRegular = revogacao.data;
        marcoInicial = {
          tipo: "revogacao_livramento",
          pergunta: "O livramento foi revogado por decisão? Qual a data?",
          explicacao: "Na revogação do livramento, considera-se provisoriamente o saldo da pena e a data da decisão."
        };
      }
      const precisaSaldo = (fugaAplicavel && (fugaSemRecaptura ||
        fugaAplicavel.fim === termoRegular)) ||
        (revogacaoAplicavel && revogacao.data === termoRegular);
      if (precisaSaldo) {
        if (condenacao.penaRestante) {
          penaBase = condenacao.penaRestante;
          penaRestanteDias = diasPena(penaBase, base, convencao);
        } else if (fugaAplicavel && fugaAplicavel.fim === termoRegular &&
            entrada.condenacoes.length === 1) {
          const fugaData = dataUTC(fugaAplicavel.inicio);
          const diasExecutados = Math.max(0, diasEntre(base, fugaData));
          const interrupcoesAte = intervalosInterrupcao
            .filter((item) => item && item.inicio <= fugaAplicavel.inicio)
            .map((item) => ({ inicio: item.inicio, fim: item.fim && item.fim < fugaAplicavel.inicio ? item.fim : fugaAplicavel.inicio }));
          const detraidoAte = intervalosDetracao
            .filter((item) => item && item.inicio <= fugaAplicavel.inicio)
            .map((item) => ({ inicio: item.inicio, fim: item.fim && item.fim < fugaAplicavel.inicio ? item.fim : fugaAplicavel.inicio }));
          const remidoAte = (Array.isArray(entrada.remicoes) ? entrada.remicoes : [])
            .filter((item) => item && item.homologada === true &&
              !remicaoDomiciliarDefensiva(item) &&
              (!item.dataHomologacao || item.dataHomologacao <= fugaAplicavel.inicio))
            .reduce((soma, item) => soma + item.dias, 0);
          const perdidoAte = faltasOriginais
            .filter((item) => item && item.data <= fugaAplicavel.inicio)
            .reduce((soma, item) => soma + (Number.isInteger(item.diasPerdidosRemicao) ? Math.max(item.diasPerdidosRemicao, 0) : 0), 0);
          const afastado = intervaloDias(interrupcoesAte, fugaData, "interrupcoes", [], true).dias;
          const detraido = intervaloDias(detraidoAte, fugaData, "detracoes", [], false).dias +
            cautelarDetracao.diasAte(fugaData);
          const penaTotal = diasPena(condenacao.pena, base, convencao);
          penaRestanteDias = Math.max(penaTotal - (diasExecutados - afastado + detraido + Math.max(remidoAte - perdidoAte, 0)), 0);
          penaBase = null;
        } else {
          penaBase = null;
          avisos.push({
            texto: `Informe a pena restante da condenação ${condenacao.id || ""} na fuga ou revogação do livramento para calcular E80.`,
            regra: "E80"
          });
        }
      }
      const prazoArt109Meses = penaBase
        ? prazoArt109(penaBase, condenacao.dataFato, regraE80.art109)
        : penaRestanteDias > 0
          ? prazoArt109Dias(penaRestanteDias, base, convencao, condenacao.dataFato, regraE80.art109)
          : null;
      const prazoMeses = extincaoDeclarada || prazoArt109Meses === null || redutorArt115 === null
        ? null
        : Math.round(prazoArt109Meses *
          (reincidente ? regraE80.multiplicadorReincidencia : 1) *
          (redutorArt115 ? regraE80.redutorEtario.multiplicador : 1));
      const penaRestanteZero = penaBase &&
        penaBase.anos === 0 && penaBase.meses === 0 && penaBase.dias === 0;
      const termoInicial = fugaSemRecaptura || revogacaoSemData ? null : termoRegular;
      const termoFinal = termoInicial && prazoMeses !== null
        ? serializarData(deslocarDias(adicionarMeses(dataUTC(termoInicial), prazoMeses), -1))
        : null;
      const execucaoIniciada = !fugaAplicavel && !revogacaoAplicavel && prisaoDefinitiva && termoInicial &&
        prisaoDefinitiva.inicio >= termoInicial && termoFinal &&
        prisaoDefinitiva.inicio <= termoFinal;
      let status = "dados_insuficientes";
      if ((fugaAplicavel || revogacaoAplicavel) && (penaRestanteZero || penaRestanteDias === 0)) status = "pena_extinta";
      else if (execucaoIniciada) status = "execucao_iniciada";
      else if (termoFinal) status = dataCalculoISO > termoFinal ? "prescrita" : "em_curso";
      if (!extincaoDeclarada && (!idadesInformadas || !naturezaSexualConfirmada || redutorArt115 === null)) {
        status = "dados_insuficientes";
        avisos.push({
          texto: !idadesInformadas
            ? `Informe as idades na data do fato e na sentença da condenação ${condenacao.id || ""} para verificar o art. 115 do CP.`
            : `Confirme se o crime ${condenacao.id || ""} envolve violência sexual contra a mulher para verificar o art. 115 do CP.`,
          regra: "E80"
        });
      }
      if (!causasConferidas) {
        status = "dados_insuficientes";
        avisos.push({
          texto: `Confira as certidões, o início/continuação do cumprimento e todas as causas de interrupção ou suspensão da condenação ${condenacao.id || ""}.`,
          regra: "E80"
        });
      }
      if (opcoesCrime.outrasCausas === "sim" || outraCausaNaoInformada || suspensaoE13) {
        status = "dados_insuficientes";
        avisos.push({
          texto: `Há causa de interrupção ou suspensão não modelada para a condenação ${condenacao.id || ""}; sem análise dessa causa não há data.`,
          regra: "E80"
        });
      }
      if (extincaoDeclarada && causasConferidas) {
        status = "extincao_declarada";
      }
      if (!termoInicial && !fugaAplicavel && !revogacaoAplicavel && !revogacaoSemData) {
        avisos.push({
          texto: `Informe o trânsito para a acusação${transitoAcusacao && transitoAcusacao > regraE81.corteTransitoAcusacao ? " e para a defesa" : ""} da condenação ${condenacao.id || ""}.`,
          regra: "E81"
        });
      }
      if (fugaSemRecaptura) {
        avisos.push({
          texto: `Informe a data de recaptura da condenação ${condenacao.id || ""}; sem esse marco não há data de prescrição.`,
          regra: "E80"
        });
      }
      if (revogacao.ocorreu === true && !revogacaoAplicavel) {
        status = "dados_insuficientes";
        avisos.push({
          texto: `Informe a data da decisão que revogou o livramento da condenação ${condenacao.id || ""}.`,
          regra: "E80"
        });
      }
      const eventos = [];
      if (termoInicial) eventos.push({
        data: termoInicial, tipo: "termo_inicial",
        descricao: marcoInicial && marcoInicial.explicacao || "Início do prazo da prescrição executória.",
        regra: marcoInicial && marcoInicial.tipo !== "transito_acusacao" &&
          marcoInicial.tipo !== "transito_ambas_partes" ? "E80" : "E81"
      });
      if (prisaoDefinitiva && termoInicial && prisaoDefinitiva.inicio >= termoInicial &&
          !fugaAplicavel && !revogacaoAplicavel) {
        eventos.push({
          data: prisaoDefinitiva.inicio, tipo: "inicio_execucao",
          descricao: "Início do cumprimento da pena.", regra: "E80"
        });
      }
      fugas.forEach((fuga) => {
        eventos.push({ data: fuga.inicio, tipo: "evasao", descricao: "Início da evasão.", regra: "E80" });
        if (fuga.fim) eventos.push({ data: fuga.fim, tipo: "recaptura", descricao: "Recaptura; execução retomada.", regra: "E80" });
      });
      if (termoFinal && causasConferidas && !extincaoDeclarada) eventos.push({
        data: termoFinal, tipo: "fim_prazo",
        descricao: status === "execucao_iniciada" ? "Data teórica antes do início da execução." : "Último dia do prazo calculado.",
        regra: "E80"
      });
      return {
        condenacaoId: condenacao.id || null,
        termoInicial,
        marcoInicial: revogacaoSemData ? null : marcoInicial && { ...marcoInicial, data: termoInicial },
        prazoArt109Meses,
        prazoMeses,
        reincidente,
        redutorArt115,
        reducaoVedadaPorViolenciaSexual: reducaoVedada,
        extincaoDeclarada,
        causasConferidas,
        penaBase,
        penaRestanteDias,
        dataPrescricao: !extincaoDeclarada && causasConferidas &&
          status !== "dados_insuficientes" &&
          (status === "em_curso" || status === "prescrita") ? termoFinal : null,
        status,
        regras: ["E80", "E81"],
        linhaDoTempo: eventos
      };
    });
    const faltas = faltasOriginais
      .map((item, indice) => ({ item, indice }))
      .filter(({ item }) => item && dataUTC(item.data) && item.data <= dataCalculoISO)
      .map(({ item, indice }) => {
        const certificada = Array.isArray(prescricaoOpcoes.faltas) &&
          prescricaoOpcoes.faltas[indice] &&
          prescricaoOpcoes.faltas[indice].certidaoConferida === true;
        const intervaloFuga = fugas.find((fuga) => fuga.inicio === item.data && fuga.fim);
        const recaptura = item.dataRecaptura || intervaloFuga && intervaloFuga.fim;
        const termoInicial = item.tipo === "fuga" ? recaptura : item.data;
        const termoValido = typeof termoInicial === "string" &&
          dataUTC(termoInicial) && termoInicial <= dataCalculoISO;
        const prazoMeses = !termoValido ? null : termoInicial < regraE82.cortePrazo
          ? regraE82.prazoAntesMeses : regraE82.prazoDesdeMeses;
        const dataPrescricao = certificada && termoValido
          ? serializarData(deslocarDias(adicionarMeses(dataUTC(termoInicial), prazoMeses), -1))
          : null;
        return {
          indice,
          dataFalta: item.data,
          termoInicial: termoValido ? termoInicial : null,
          marcoInicial: item.tipo === "fuga" ? "recaptura" : "data_falta",
          prazoAnos: prazoMeses === null ? null : prazoMeses / 12,
          dataPrescricao,
          status: !certificada || !termoValido
            ? "dados_insuficientes"
            : dataCalculoISO > dataPrescricao ? "prescrita" : "em_curso",
          regra: "E82"
        };
      });
    const linhaDoTempo = [
      ...executoria.flatMap((item) => item.linhaDoTempo.map((evento) => ({
        ...evento, condenacaoId: item.condenacaoId
      }))),
      ...faltas.flatMap((item) => [
        { data: item.dataFalta, tipo: "falta_grave", descricao: "Cometimento da falta grave.", regra: "E82" },
        ...(item.termoInicial && item.marcoInicial === "recaptura"
          ? [{ data: item.termoInicial, tipo: "recaptura_falta_grave", descricao: "Recaptura; início da contagem da falta permanente.", regra: "E82" }]
          : []),
        ...(item.dataPrescricao
          ? [{ data: item.dataPrescricao, tipo: "prescricao_falta_grave", descricao: "Último dia do prazo da falta grave.", regra: "E82" }]
          : [])
      ])
    ].sort((a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo));
    return { executoria, faltas, linhaDoTempo, avisos };
  }

  // E80: as faixas e o prazo mínimo vêm da base versionada.
  function prazoArt109(pena, dataFato, regra) {
    const normalizada = normalizarPena(pena);
    const meses = normalizada.anos * 12 + normalizada.meses;
    const faixa = regra.faixasPenaMeses.find((item) =>
      meses > item.acimaDe || (meses === item.acimaDe && normalizada.dias > 0));
    if (faixa) return faixa.prazoMeses;
    if (meses >= regra.penaMinimaMeses) return regra.prazoPenaMinimaMeses;
    return dataFato < regra.prazoMinimo.vigencia
      ? regra.prazoMinimo.antesMeses : regra.prazoMinimo.desdeMeses;
  }

  function prazoArt109Dias(dias, base, convencao, dataFato, regra) {
    for (const faixa of regra.faixasDias) {
      const limite = diasPena({ anos: faixa.anos, meses: 0, dias: 0 }, base, convencao);
      if (dias > limite) return faixa.prazoAcimaMeses;
      if (dias === limite) return faixa.prazoIgualMeses;
    }
    if (dias >= diasPena({ anos: regra.penaMinimaMeses / 12, meses: 0, dias: 0 }, base, convencao)) {
      return regra.prazoPenaMinimaMeses;
    }
    return dataFato < regra.prazoMinimo.vigencia
      ? regra.prazoMinimo.antesMeses : regra.prazoMinimo.desdeMeses;
  }

  function clonarEntrada(entrada) {
    return JSON.parse(JSON.stringify(entrada));
  }

  function gerarCenarios(entrada, dataCalculo, opcoes, baseRegras) {
    if (!entrada || typeof entrada !== "object" || typeof dataCalculo !== "string") return [];
    const cenarios = [];
    const calcularPar = (defensiva, alternativa) => {
      const resultadoDefensivo = calcular(clonarEntrada(defensiva.entrada || entrada), dataCalculo, {
        ...(opcoes || {}),
        ...(defensiva.opcoes || {})
      }, baseRegras);
      const resultadoAlternativo = calcular(clonarEntrada(alternativa.entrada || entrada), dataCalculo, {
        ...(opcoes || {}),
        ...(alternativa.opcoes || {})
      }, baseRegras);
      if (resultadoDefensivo.erros || resultadoAlternativo.erros) return;
      cenarios.push({
        regra: defensiva.regra,
        titulo: defensiva.titulo,
        classificacao: defensiva.classificacao || alternativa.classificacao ||
          (["E31", "E29"].includes(defensiva.regra) ? "falta_confirmar_dado" : "divergencia_juridica"),
        defensiva: {
          tese: defensiva.tese,
          precedente: defensiva.precedente,
          resultado: resultadoDefensivo
        },
        alternativa: {
          tese: alternativa.tese,
          precedente: alternativa.precedente,
          resultado: resultadoAlternativo
        }
      });
    };

    if (Array.isArray(entrada.comutacoes) &&
        entrada.comutacoes.some((item) => item && item.dataDecisao <= dataCalculo)) {
      calcularPar({
        regra: "E100",
        titulo: "Comutação concedida — CONFERIR",
        tese: "Frações sobre o remanescente após comutação, sem alterar a data-base",
        precedente: "E100; decisão provisória (IA), a revisar com a Assessoria Criminal",
        opcoes: { comutacaoAlteraBaseBeneficios: true }
      }, {
        regra: "E100",
        titulo: "Comutação concedida — CONFERIR",
        tese: "Comutação não altera a base de cálculo dos benefícios",
        precedente: "E100; tese alternativa a conferir com a Assessoria Criminal",
        opcoes: { comutacaoAlteraBaseBeneficios: false }
      });
    }

    // E33: reincidência apenas comum tem fração própria; LC permanece independente.
    (entrada.condenacoes || []).forEach((condenacao, indice) => {
      if (!condenacao || condenacao.reincidencia !== "generico" ||
          !["hediondo", "hediondo_morte"].includes(condenacao.natureza) ||
          condenacao.dataFato < "2026-03-25") return;
      try {
        Regras.menorFracao(condenacao, dataCalculo, undefined, baseRegras);
      } catch (_) {
        return;
      }
      const percentualDefensivo = condenacao.natureza === "hediondo" ? 70 : 75;
      const percentualLegal = condenacao.natureza === "hediondo" ? 80 : 85;
      calcularPar({
        regra: "E33",
        titulo: `Reincidência só em crime comum — ${condenacao.id || `condenação ${indice + 1}`}`,
        tese: `${percentualDefensivo}% (posição defensiva)`,
        precedente: "E33; CF art. 5º, XL; conferir o texto da LEP após a Lei 15.358/2026"
      }, {
        regra: "E33",
        titulo: `Reincidência só em crime comum — ${condenacao.id || `condenação ${indice + 1}`}`,
        tese: `${percentualLegal}% (texto legal)`,
        precedente: `LEP art. 112, ${condenacao.natureza === "hediondo" ? "VII" : "VIII"} (Lei 15.358/2026); o livramento é avaliado à parte`,
        opcoes: { teseE33PorCondenacao: { [condenacao.id]: "legal" } }
      });
    });

    // E31: antecedente desconhecido é dado pendente; confirmado como não violento, compara 25% e 30%.
    (entrada.condenacoes || []).forEach((condenacao, indice) => {
      if (!condenacao || condenacao.antecedenteViolento === "sim" ||
          !["generico", "especifico"].includes(condenacao.reincidencia) ||
          typeof condenacao.dataFato !== "string" ||
          condenacao.dataFato < "2020-01-23" || condenacao.dataFato >= "2026-05-08" ||
          !(condenacao.natureza === "violencia" ||
            (condenacao.natureza === "feminicidio" && condenacao.dataFato < "2024-10-10"))) return;
      let regraAtual;
      try {
        regraAtual = Regras.menorFracao(condenacao, dataCalculo, undefined, baseRegras);
        if (condenacao.antecedenteViolento !== "nao") {
          if (!regraAtual.id.endsWith("VIOLENCIA-REINCIDENTE-ANTECEDENTE-NAO")) return;
        } else if (regraAtual.fracao !== 0.25) {
          return;
        }
      } catch (_) {
        return;
      }
      const titulo = `Violência na condenação anterior — ${condenacao.id || `condenação ${indice + 1}`}`;
      if (condenacao.antecedenteViolento === "nao") {
        const entradaAtual = clonarEntrada(entrada);
        const opcoes30 = { teseE31PorCondenacao: { [condenacao.id]: "30" } };
        let regra30;
        try {
          regra30 = Regras.menorFracao(condenacao, dataCalculo, opcoes30, baseRegras);
        } catch (_) {
          return;
        }
        calcularPar({
          regra: "E31",
          classificacao: "divergencia_juridica",
          titulo,
          tese: "25% (regra do motor)",
          precedente: `${regraAtual.id}: ${regraAtual.fonte}`,
          entrada: entradaAtual
        }, {
          regra: "E31",
          classificacao: "divergencia_juridica",
          titulo,
          tese: "30% (regra alternativa)",
          precedente: `${regra30.id}: ${regra30.fonte}`,
          entrada: entradaAtual,
          opcoes: opcoes30
        });
      } else {
        const entradaSemViolenciaAnterior = clonarEntrada(entrada);
        entradaSemViolenciaAnterior.condenacoes[indice].antecedenteViolento = "nao";
        const entradaComViolenciaAnterior = clonarEntrada(entrada);
        entradaComViolenciaAnterior.condenacoes[indice].antecedenteViolento = "sim";
        calcularPar({
          regra: "E31",
          classificacao: "falta_confirmar_dado",
          titulo,
          tese: "Antecedente sem violência (25%)",
          precedente: "LEP art. 112, III, por analogia favorável; STJ, AgRg no HC 675.062/SP (6ª T.), HC 947.647/SP (5ª T., 05/12/2024) e AgRg no HC 766.551/MG (CONFERIR)",
          entrada: entradaSemViolenciaAnterior
        }, {
          regra: "E31",
          classificacao: "falta_confirmar_dado",
          titulo,
          tese: "Antecedente com violência (30%)",
          precedente: "LEP art. 112, IV (Lei 13.964/2019)",
          entrada: entradaComViolenciaAnterior
        });
      }
    });

    // E29: a remição ainda não homologada é apresentada como hipótese favorável.
    const remicoesPendentes = (entrada.remicoes || []).some((remicao) =>
      remicao && remicao.homologada === false && Number.isInteger(remicao.dias) && remicao.dias > 0);
    if (remicoesPendentes) {
      const entradaHomologada = clonarEntrada(entrada);
      entradaHomologada.remicoes = (entradaHomologada.remicoes || []).map((remicao) =>
        remicao && remicao.homologada === false ? { ...remicao, homologada: true } : remicao);
      calcularPar({
        regra: "E29",
        titulo: "Remição não homologada",
        tese: "Se homologada",
        precedente: "LEP arts. 126–128; Resolução CNJ 391/2021 (E28/E29)",
        entrada: entradaHomologada
      }, {
        regra: "E29",
        titulo: "Remição não homologada",
        tese: "Sem homologação lançada",
        precedente: "LEP arts. 126–128; Resolução CNJ 391/2021 (E28/E29)"
      });
    }

    // E39: a aplicação anterior à vigência é apresentada como tese, sem alterar o cálculo principal.
    const remicoesDomiciliaresAnteriores = (entrada.remicoes || []).some(remicaoDomiciliarDefensiva);
    if (remicoesDomiciliaresAnteriores) {
      const entradaDefensivaE39 = clonarEntrada(entrada);
      entradaDefensivaE39.remicoes = (entradaDefensivaE39.remicoes || []).map((remicao) => {
        if (!remicaoDomiciliarDefensiva(remicao)) return remicao;
        const remicaoDefensiva = { ...remicao };
        delete remicaoDefensiva.regime;
        return remicaoDefensiva;
      });
      calcularPar({
        regra: "E39",
        titulo: "Remição em período domiciliar anterior a 08/05/2026",
        tese: "Aplicação imediata da lei mais benéfica",
        precedente: "LEP art. 126, § 9º (Lei 15.402/2026); PD-01",
        entrada: entradaDefensivaE39
      }, {
        regra: "E39",
        titulo: "Remição em período domiciliar anterior a 08/05/2026",
        tese: "Aplicação a partir de 08/05/2026",
        precedente: "LEP art. 126, § 9º (Lei 15.402/2026, art. 3º)"
      });
    }

    // D7: a tese defensiva adota a primeira prisão como data-base provisória.
    const cenarioD7 = identificarCenarioD7(entrada.prisoes);
    if (cenarioD7) {
      calcularPar({
        regra: "D7",
        titulo: "Data-base na descontinuidade da prisão",
        tese: "Primeira prisão",
        precedente: "STJ Tema 1.457 pendente; PD-01/PD-03 (V04)"
      }, {
        regra: "D7",
        titulo: "Data-base na descontinuidade da prisão",
        tese: "Retorno à pena definitiva",
        precedente: "STJ Tema 1.457 pendente; AgRg no AREsp 3.152.463/BA e AgRg no REsp 2.155.199/MG (CONFERIR)",
        opcoes: { teseD7: "retorno-definitiva" }
      });
    }

    // D8: permite comparar o método observado no TJSP/SAJ sem trocar o padrão.
    const variasCondenacoesComEventos = (entrada.condenacoes || []).length > 1 &&
      ((entrada.prisoes || []).length > 1 ||
        (entrada.regressoes || []).length > 0 ||
        (entrada.faltasGraves || []).some((item) => item && item.tipo === "fuga"));
    if (variasCondenacoesComEventos) {
      calcularPar({
        regra: "D8",
        titulo: "Método TJSP/SAJ por condenação",
        classificacao: "divergencia_juridica",
        tese: "Método padrão do motor",
        precedente: "E30, E34 e E23; padrão atual preservado",
        opcoes: { metodoProgressao: "padrao" }
      }, {
        regra: "D8",
        titulo: "Método TJSP/SAJ por condenação",
        classificacao: "divergencia_juridica",
        tese: "Data-base na última prisão/recaptura; fração sobre o saldo de cada condenação",
        precedente: "Cálculos TJSP/SAJ observados (issue #80); premissa operacional pendente de validação",
        opcoes: { metodoProgressao: "tjsp" }
      });
    }

    // E45: maus antecedentes não alteram a reincidência; exibe as duas frações de LC.
    const primarioMausAntecedentes = (entrada.condenacoes || []).some((condenacao) =>
      condenacao && condenacao.reincidencia === "primario" && condenacao.bonsAntecedentes === false);
    if (primarioMausAntecedentes) {
      calcularPar({
        regra: "E45",
        titulo: "Livramento para primário com maus antecedentes",
        tese: "Mais de 1/3",
        precedente: "CP art. 83, I; STJ RHC 12.608/RJ (favorável; CONFERIR)"
      }, {
        regra: "E45",
        titulo: "Livramento para primário com maus antecedentes",
        tese: "Mais de 1/2",
        precedente: "CP art. 83, II; STF Informativo 146 (HC 73.002 e RHC 66.222) e HC 78.410/RJ (CONFERIR)",
        opcoes: { teseE45: "intermediaria" }
      });
    }
    return cenarios;
  }

  return { calcular, gerarCenarios, versao };
});
