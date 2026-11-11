(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./datas.js"));
  } else {
    root.Explicador = factory(root.Datas);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (datas) {
  "use strict";

  const ITENS = {
    progressao: {
      rotulo: "progressão",
      regras: "E30, E31 e E05 (D1–D3)",
      fundamento: "LEP art. 112; CF art. 5º, XL; STJ Tema 1354"
    },
    livramento: {
      rotulo: "livramento condicional",
      regras: "E41, E43 e E05 (D1–D3)",
      fundamento: "CP arts. 83 e 84"
    },
    saidaTemporaria: {
      rotulo: "saída temporária",
      regras: "E60, E61 e E05 (D1–D3)",
      fundamento: "LEP arts. 122 a 125"
    },
    termino: {
      rotulo: "término da pena",
      regras: "E50 e E03",
      fundamento: "CP arts. 10 e 42; LEP art. 128"
    }
  };
  const CONVENCOES = ["calendario", "365", "360"];
  const ARREDONDAMENTOS = ["cima", "baixo", "manter"];

  function dataValida(data) {
    if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
    const instante = Date.parse(`${data}T00:00:00Z`);
    return Number.isFinite(instante) && new Date(instante).toISOString().slice(0, 10) === data;
  }

  function diferencaDias(dataNossa, dataSEEU) {
    if (!dataValida(dataNossa) || !dataValida(dataSEEU)) return null;
    return (Date.parse(`${dataNossa}T00:00:00Z`) - Date.parse(`${dataSEEU}T00:00:00Z`)) / 86400000;
  }

  function dataResultado(resultado, item) {
    if (item === "termino") return resultado && resultado.termino;
    return resultado && resultado[item] && resultado[item].data;
  }

  function restanteCampoACampo(total, cumprida) {
    if (![total, cumprida].every((pena) => pena && ["anos", "meses", "dias"]
      .every((campo) => Number.isSafeInteger(pena[campo]) && pena[campo] >= 0))) return null;
    let dias = total.dias - cumprida.dias;
    let meses = total.meses - cumprida.meses;
    let anos = total.anos - cumprida.anos;
    if (dias < 0) {
      dias += 30;
      meses -= 1;
    }
    if (meses < 0) {
      meses += 12;
      anos -= 1;
    }
    return anos < 0 ? null : { anos, meses, dias };
  }

  function terminoSEEU(oficial) {
    const restante = restanteCampoACampo(oficial.penaTotal, oficial.penaCumprida);
    if (!dataValida(oficial.dataEmissao) || !restante || !datas?.addDuration) return null;
    try {
      return datas.addDuration(oficial.dataEmissao, restante);
    } catch (_) {
      return null;
    }
  }

  function clonar(valor) {
    return JSON.parse(JSON.stringify(valor));
  }

  function variantesDeConvencao(opcoes, item) {
    const d2 = item === "termino" ? [opcoes.menos1Beneficio] : [false, true];
    const d3 = item === "termino" ? [opcoes.arredondamento] : ARREDONDAMENTOS;
    const variantes = [];
    for (const convencaoDias of CONVENCOES) {
      for (const menos1Beneficio of d2) {
        for (const arredondamento of d3) {
          variantes.push({
            id: `convencao:${convencaoDias}:${menos1Beneficio}:${arredondamento}`,
            descricao: descricaoConvencao(convencaoDias, menos1Beneficio, arredondamento),
            regra: "D1–D3",
            entrada: null,
            opcoes: { ...opcoes, convencaoDias, menos1Beneficio, arredondamento }
          });
        }
      }
    }
    return variantes;
  }

  function descricaoConvencao(convencaoDias, menos1Beneficio, arredondamento) {
    const dias = {
      calendario: "calendário",
      "365": "365 dias por ano",
      "360": "360 dias por ano"
    }[convencaoDias];
    const subtracao = menos1Beneficio ? "com −1 dia" : "sem −1 dia";
    const arredondamentoTexto = {
      cima: "arredondamento para cima",
      baixo: "arredondamento para baixo",
      manter: "fração mantida até o fim"
    }[arredondamento];
    return `D1: ${dias}; D2: ${subtracao}; D3: ${arredondamentoTexto}`;
  }

  function avaliarCenario(cenario, entrada, dataCalculo, calcular) {
    try {
      const entradaCenario = cenario.entrada === null
        ? clonar(entrada)
        : cenario.entrada(clonar(entrada));
      const resultado = calcular(entradaCenario, dataCalculo, cenario.opcoes);
      return resultado && !resultado.erros ? resultado : null;
    } catch (_) {
      return null;
    }
  }

  function paragrafo(item, dataSEEU, dataNossa, diferenca, hipoteses, fonteOficial) {
    const dados = ITENS[item];
    const diferencaTexto = diferenca > 0
      ? `${diferenca} dia(s) depois da data oficial`
      : `${Math.abs(diferenca)} dia(s) antes da data oficial`;
    const hipotesesSEEU = hipoteses.filter((hipotese) => hipotese.regra === "E101");
    const hipotesesExatas = hipoteses.filter((hipotese) => hipotese.regra !== "E101");
    const explicacaoExata = hipotesesExatas.length
      ? ` A busca encontrou hipótese(s) que reproduz(em) exatamente a data informada pelo cálculo oficial (${fonteOficial}): ${hipotesesExatas.map((hipotese) => {
        const fundamento = hipotese.fundamento ? ` (fundamento: ${hipotese.fundamento}${hipotese.regra ? `; ${hipotese.regra}` : ""})` : "";
        return `${hipotese.descricao}${fundamento}`;
      }).join("; ")}. Confirme a hipótese nos documentos antes de usar este texto.`
      : "";
    const explicacaoSEEU = hipotesesSEEU.length
      ? ` A hipótese operacional E101 (data de emissão mais o restante campo a campo pelo calendário, sem −1) fica a até 2 dias da data oficial (${fonteOficial}); confirme os campos e a data de emissão no documento.`
      : "";
    const explicacao = hipoteses.length
      ? `${explicacaoExata}${explicacaoSEEU}`
      : ` A busca não encontrou hipótese que reproduza exatamente a data informada pelo cálculo oficial (${fonteOficial}).`;
    const documento = fonteOficial === "TJSP/SAJ" ? "O cálculo do TJSP/SAJ" : "O atestado do SEEU";
    return `${documento} indica ${dados.rotulo} em ${dataSEEU}; pela regra ${dados.regras}, com fundamento em ${dados.fundamento}, o cálculo aponta ${dataNossa}, ${diferencaTexto}.${explicacao}`;
  }

  function compactarConvencoes(hipoteses, item) {
    const grupos = new Map();
    const outras = [];
    for (const hipotese of hipoteses) {
      const partes = hipotese.id.match(/^convencao:([^:]+):([^:]+):([^:]+)$/);
      if (!partes) {
        outras.push(hipotese);
        continue;
      }
      const [, convencaoDias] = partes;
      if (!grupos.has(convencaoDias)) grupos.set(convencaoDias, []);
      grupos.get(convencaoDias).push(hipotese);
    }

    for (const [convencaoDias, grupo] of grupos) {
      const total = item === "termino" ? 1 : 6;
      if (grupo.length === total) {
        const descricao = descricaoConvencao(convencaoDias, false, "cima")
          .replace(/; D2:.*$/, " (as variantes de D2/D3 também produziram esta data)");
        outras.push({
          id: `convencao:${convencaoDias}`,
          descricao,
          regra: "D1–D3",
          fundamento: null
        });
      } else {
        outras.push(...grupo);
      }
    }
    return outras;
  }

  function resultadoDoCenario(cenario, lado, item) {
    const ladoCenario = cenario && cenario[lado];
    return ladoCenario && dataResultado(ladoCenario.resultado, item);
  }

  function cenariosCorrespondentes(cenarios, item, classificacao, dataOficial) {
    return (cenarios || []).filter((cenario) =>
      cenario && cenario.classificacao === classificacao &&
      ["defensiva", "alternativa"].some((lado) => resultadoDoCenario(cenario, lado, item) === dataOficial));
  }

  function cenariosComDadoPendente(cenarios, item) {
    return (cenarios || []).filter((cenario) =>
      cenario && cenario.classificacao === "falta_confirmar_dado" &&
      resultadoDoCenario(cenario, "defensiva", item) !== resultadoDoCenario(cenario, "alternativa", item));
  }

  function datasPossiveis(cenarios, item) {
    const datas = [];
    for (const cenario of cenarios) {
      for (const lado of ["defensiva", "alternativa"]) {
        const data = resultadoDoCenario(cenario, lado, item);
        if (!data || datas.some((possibilidade) => possibilidade.data === data)) continue;
        const ladoCenario = cenario[lado];
        datas.push({
          data,
          descricao: `${ladoCenario.tese || cenario.titulo || cenario.regra}: ${data}`,
          regra: cenario.regra
        });
      }
    }
    return datas;
  }

  function regraAplicada(resultado, item) {
    const campo = item === "livramento" ? "regraLC" : "regraPR";
    const regras = Array.from(new Set((resultado.condenacoes || [])
      .map((condenacao) => condenacao && condenacao[campo])
      .filter(Boolean)));
    return regras.join(", ") || null;
  }

  function explicacaoDeClassificacao(classificacao, dados) {
    if (classificacao === "diferenca_convencao") {
      const explicacaoSEEU = dados.hipoteses.some((hipotese) => hipotese.regra === "E101")
        ? " A hipótese E101 admite diferença de até 2 dias entre a previsão e a data oficial."
        : " A hipótese reproduz a data oficial.";
      return `Diferença de convenção de contagem: ${dados.hipoteses.map((hipotese) => hipotese.descricao).join("; ")}.${explicacaoSEEU}`;
    }
    if (classificacao === "divergencia_juridica") {
      const motor = dados.regraMotor ? `O motor aplica ${dados.regraMotor}. ` : "";
      const oficial = dados.regraOficial
        ? `A regra ${dados.regraOficial} reproduz a data oficial.`
        : "A regra que reproduz a data oficial não foi identificada.";
      return `Divergência jurídica: ${motor}${oficial}`;
    }
    if (classificacao === "falta_confirmar_dado") {
      return `Falta confirmar ${dados.dadoPendente || "o dado indicado"}; datas possíveis: ${dados.possibilidades.map((item) => item.descricao).join("; ")}.`;
    }
    if (classificacao === "igual") return "As datas coincidem.";
    if (classificacao === "sem_explicacao") return "Sem explicação: nenhuma hipótese testada reproduz a data oficial.";
    return "Não comparável: confira a data informada no documento.";
  }

  function explicarDivergencias({
    entrada,
    dataCalculo,
    resultado,
    atestadoSEEU,
    fonteOficial = "SEEU",
    opcoes = {},
    calcular,
    gerarHipotesesEntrada = [],
    cenarios = []
  }) {
    if (typeof calcular !== "function") {
      throw new TypeError("Informe a função calcular(entrada, dataCalculo, opcoes).");
    }
    if (!entrada || !resultado || !atestadoSEEU) return [];

    return Object.keys(ITENS).flatMap((item) => {
      const seeu = atestadoSEEU[item];
      const nossa = dataResultado(resultado, item);
      const diferenca = diferencaDias(nossa, seeu);
      if (diferenca === null) {
        const beneficio = item === "livramento" && resultado.livramento;
        const motivo = beneficio && beneficio.motivoNaoCabe;
        if (!dataValida(seeu) || !beneficio || beneficio.cabe !== false || !motivo || !/\bE(?:40|41|42)\b/.test(motivo)) return [];
        const linha = {
          item,
          seeu,
          nossa: null,
          diferencaDias: null,
          classe: "divergencia_cabimento",
          classificacao: "divergencia_juridica",
          regra: "E97",
          regraMotor: regraAplicada(resultado, item),
          causaProvavel: motivo,
          hipoteses: [],
          possibilidades: [],
          dadoPendente: null
        };
        linha.explicacao = explicacaoDeClassificacao(linha.classificacao, linha);
        linha.paragrafo = `O atestado do cálculo oficial (${fonteOficial}) informa livramento em ${seeu}, mas a calculadora entende que o benefício não cabe: ${motivo}.`;
        return [{
          ...linha
        }];
      }

      const classe = diferenca === 0
        ? "igual"
        : Math.abs(diferenca) <= 3 ? "pequena" : "relevante";
      const hipoteses = [];

      if (diferenca !== 0) {
        const cenarios = variantesDeConvencao(opcoes, item);
        for (const gerar of gerarHipotesesEntrada) {
          let variantes = [];
          try {
            variantes = gerar({
              item,
              entrada: clonar(entrada),
              resultado: clonar(resultado),
              atestadoSEEU: clonar(atestadoSEEU)
            }) || [];
          } catch (_) {
            continue;
          }
          for (const variante of variantes) {
            cenarios.push({
              ...variante,
              entrada: variante.aplicar || variante.entrada,
              opcoes: variante.opcoes || opcoes
            });
          }
        }

        const ids = new Set();
        for (const cenario of cenarios) {
          if (!cenario || !cenario.id || ids.has(cenario.id)) continue;
          ids.add(cenario.id);
          const resultadoCenario = avaliarCenario(cenario, entrada, dataCalculo, calcular);
          if (dataResultado(resultadoCenario, item) !== seeu) continue;
          hipoteses.push({
            id: cenario.id,
            descricao: cenario.descricao || cenario.titulo || cenario.id,
            regra: cenario.regra || null,
            fundamento: cenario.fundamento || null
          });
        }
        // E101: hipótese explicativa do término SEEU; não altera o cálculo nem D1–D3.
        if (item === "termino" && fonteOficial === "SEEU" && Math.abs(diferenca) <= 2) {
          const previstoSEEU = terminoSEEU(atestadoSEEU);
          const diferencaSEEU = diferencaDias(previstoSEEU, seeu);
          if (diferencaSEEU !== null && Math.abs(diferencaSEEU) <= 2) {
            hipoteses.push({
              id: "convencao:seeu:termino-campo-a-campo",
              descricao: "término SEEU: data de emissão + restante campo a campo pelo calendário, sem −1 (E101)",
              regra: "E101",
              fundamento: "docs/INVESTIGACAO-GABARITOS.md"
            });
          }
        }
      }

      const hipotesesCompactadas = compactarConvencoes(hipoteses, item);
      const cenariosDado = cenariosComDadoPendente(cenarios, item);
      const cenariosJuridicos = cenariosCorrespondentes(cenarios, item, "divergencia_juridica", seeu);
      let classificacao = "igual";
      let possibilidades = [];
      let regraOficial = null;
      let dadoPendente = null;

      if (diferenca !== 0) {
        if (cenariosDado.length) {
          classificacao = "falta_confirmar_dado";
          possibilidades = datasPossiveis(cenariosDado, item);
          dadoPendente = cenariosDado.some((cenario) => cenario.regra === "E31")
            ? "a natureza do antecedente gerador da reincidência (E31)"
            : cenariosDado.some((cenario) => cenario.regra === "E29")
              ? "a confirmação da homologação da remição (E29)"
              : cenariosDado.map((cenario) => cenario.titulo).filter(Boolean).join("; ") ||
                "a situação do dado pendente";
        } else if (hipotesesCompactadas.some((hipotese) => /^convencao:/.test(hipotese.id))) {
          classificacao = "diferenca_convencao";
        } else if (cenariosJuridicos.length) {
          classificacao = "divergencia_juridica";
          const cenario = cenariosJuridicos.find((itemCenario) =>
            resultadoDoCenario(itemCenario, "defensiva", item) === seeu ||
            resultadoDoCenario(itemCenario, "alternativa", item) === seeu);
          const lado = cenario && ["defensiva", "alternativa"].find((ladoCenario) =>
            resultadoDoCenario(cenario, ladoCenario, item) === seeu);
          regraOficial = cenario && `${cenario.regra}${lado && cenario[lado].tese ? ` (${cenario[lado].tese})` : ""}`;
        } else {
          classificacao = "sem_explicacao";
        }
      }

      const linha = {
        item,
        seeu,
        nossa,
        diferencaDias: diferenca,
        classe,
        classificacao,
        regraMotor: regraAplicada(resultado, item),
        regraOficial,
        dadoPendente,
        possibilidades,
        hipoteses: hipotesesCompactadas,
        explicacao: null,
        paragrafo: diferenca !== 0
          ? paragrafo(item, seeu, nossa, diferenca, hipotesesCompactadas, fonteOficial)
          : null
      };
      linha.explicacao = explicacaoDeClassificacao(classificacao, linha);
      return [linha];
    });
  }

  return { explicarDivergencias };
});
