(function (root, factory) {
  "use strict";

  const dados = typeof module === "object" && module.exports
    ? require("../dados/index.js")
    : root.DadosExecucaoPenal;
  const api = factory(dados);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.Regras = api;
  }
})(typeof globalThis === "object" ? globalThis : this, function (dados) {
  "use strict";

  // E95: cada revisão acrescenta versão, IDs alterados e motivo, sem apagar o histórico.
  const BASE = { versao: dados.versao, historico: dados.historico };
  const ERAS = dados.eras;
  const REGRAS = dados.fracoesProgressao.filter((regra) => regra.era);
  const NATUREZAS = ["comum", "violencia", "hediondo", "hediondo_morte", "trafico_privilegiado", "feminicidio", "comando_orcrim", "milicia"];
  const RECIDIVENCIAS = ["primario", "generico", "especifico"];
  const ANTECEDENTES_VIOLENTOS = ["sim", "nao", "desconhecido"];
  const STATUS_DECIDIDA = "Decidida pelo Núcleo; fontes a conferir";

  function erro(regra, mensagem, tipo) {
    const falha = new (tipo || TypeError)(mensagem);
    falha.regra = regra;
    return falha;
  }

  function validarData(data, campo) {
    if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      throw erro("E01", `${campo} deve estar no formato AAAA-MM-DD.`);
    }
    const dataUTC = new Date(`${data}T00:00:00.000Z`);
    if (Number.isNaN(dataUTC.getTime()) || dataUTC.toISOString().slice(0, 10) !== data) {
      throw erro("E01", `${campo} não é uma data válida.`);
    }
    return data;
  }

  function eraDoFato(data, baseRegras) {
    const eraDados = baseRegras && baseRegras.eras || dados.eras;
    const fato = validarData(data, "Data do fato");
    if (fato < eraDados[0].inicio) {
      throw erro("E91", "Data do fato anterior a 26/07/1990: fora do escopo.", RangeError);
    }
    return eraDados.find((era) => fato >= era.inicio && (!era.fim || fato <= era.fim)).era;
  }

  function validarCondenacao(condenacao, baseRegras) {
    if (!condenacao || typeof condenacao !== "object") {
      throw erro("E90", "Condenação deve ser um objeto.");
    }
    const dataFato = validarData(condenacao.dataFato, "Data do fato");
    eraDoFato(dataFato, baseRegras);
    if (!NATUREZAS.includes(condenacao.natureza)) {
      throw erro("E92", "Natureza da condenação não reconhecida.");
    }
    if (!RECIDIVENCIAS.includes(condenacao.reincidencia)) {
      throw erro("E33", "Reincidência deve ser primario, generico ou especifico.");
    }
    if (condenacao.antecedenteViolento !== undefined &&
        !ANTECEDENTES_VIOLENTOS.includes(condenacao.antecedenteViolento)) {
      throw erro("E31", "Antecedente violento deve ser sim, nao ou desconhecido.");
    }
    if (typeof condenacao.equiparado !== "undefined" && typeof condenacao.equiparado !== "boolean") {
      throw erro("E32", "O campo equiparado deve ser booleano.");
    }
    if (typeof condenacao.resultadoMorte !== "undefined" && typeof condenacao.resultadoMorte !== "boolean") {
      throw erro("E32", "O campo resultadoMorte deve ser booleano.");
    }
    if (typeof condenacao.emCumprimento !== "undefined" && typeof condenacao.emCumprimento !== "boolean") {
      throw erro("E60", "O campo emCumprimento deve ser booleano.");
    }
    if (typeof condenacao.tituloXII !== "undefined" && typeof condenacao.tituloXII !== "boolean") {
      throw erro("E32", "O campo tituloXII deve ser booleano.");
    }
    if (condenacao.lei15358LC !== undefined && condenacao.lei15358LC !== "" &&
        !["art2-paragrafo4-III", "art3-paragrafo-unico"].includes(condenacao.lei15358LC)) {
      throw erro("E42", "Enquadramento da vedação de LC da Lei 15.358 deve ser art2-paragrafo4-III ou art3-paragrafo-unico.");
    }
    return dataFato;
  }

  function hediondoOuEquiparado(condenacao) {
    if (condenacao.natureza === "trafico_privilegiado") return false;
    return condenacao.equiparado === true || ["hediondo", "hediondo_morte"].includes(condenacao.natureza);
  }

  function reincidenciaCompativel(regra, reincidencia) {
    if (regra === "qualquer") return true;
    if (regra === "reincidente") return reincidencia !== "primario";
    if (regra === "primario_ou_generico") return reincidencia !== "especifico";
    return regra === reincidencia;
  }

  function antecedenteViolentoCompativel(regra, antecedenteViolento) {
    if (!regra.antecedenteViolento || antecedenteViolento === undefined ||
        antecedenteViolento === "desconhecido") return true;
    return regra.antecedenteViolento === antecedenteViolento;
  }

  function naturezaCompativel(regra, condenacao, dataFato) {
    const natureza = condenacao.natureza;
    if (regra.natureza === "titulo_xii") {
      return condenacao.tituloXII === true && ["comum", "violencia"].includes(natureza);
    }
    if (regra.era === "era3b" && condenacao.tituloXII === true) {
      if (regra.natureza === "comum" || regra.natureza === "violencia") return false;
    }
    if (regra.natureza === "comum") {
      if (regra.era === "era1") {
        return !hediondoOuEquiparado(condenacao);
      }
      if (hediondoOuEquiparado(condenacao)) return false;
      return natureza === "comum" || natureza === "trafico_privilegiado";
    }
    if (hediondoOuEquiparado(condenacao) &&
        !["hediondo", "hediondo_morte"].includes(regra.natureza)) {
      return false;
    }
    if (regra.natureza === "violencia") {
      return natureza === "violencia" ||
        (natureza === "feminicidio" && dataFato < "2024-10-10");
    }
    if (regra.natureza === "hediondo") {
      return (natureza === "hediondo" && condenacao.resultadoMorte !== true) ||
        (regra.era === "era1" && natureza === "hediondo_morte") ||
        (condenacao.equiparado === true && natureza !== "trafico_privilegiado") ||
        (natureza === "feminicidio" && dataFato >= "2024-10-09" &&
          condenacao.reincidencia !== "primario");
    }
    if (regra.natureza === "hediondo_morte") {
      return natureza === "hediondo_morte" ||
        (natureza === "hediondo" && condenacao.resultadoMorte === true) ||
        (natureza === "feminicidio" && condenacao.resultadoMorte === true);
    }
    return natureza === regra.natureza;
  }

  function avisosIncompatibilidade(condenacao, dataFato, eraInicial) {
    const avisos = [];
    if (condenacao.natureza === "feminicidio" && dataFato < "2024-10-10") {
      avisos.push({
        regra: "E92",
        texto: "Feminicídio como hipótese autônoma da tabela só se aplica a fatos a partir de 10/10/2024; foi usada a hipótese compatível com a era."
      });
    }
    if (["comando_orcrim", "milicia"].includes(condenacao.natureza) && eraInicial === "era1") {
      avisos.push({
        regra: "E92",
        texto: "A hipótese específica de comando de organização criminosa ou milícia não consta na tabela da Era 1; foi usada a regra comum provisoriamente."
      });
    }
    return avisos;
  }

  function menorFracao(condenacao, dataCalculo, opcoes, baseRegras) {
    const eraDados = baseRegras && baseRegras.eras || dados.eras;
    const regrasProgressao = baseRegras && baseRegras.fracoesProgressao || dados.fracoesProgressao;
    const dataFato = validarCondenacao(condenacao, baseRegras);
    const calculo = validarData(dataCalculo, "Data do cálculo");
    if (calculo < dataFato) {
      throw erro("E90", "Data do cálculo não pode ser anterior à data do fato.", RangeError);
    }
    const eraInicial = eraDoFato(dataFato, baseRegras);
    const eraFinal = eraDoFato(calculo, baseRegras);
    const indiceInicial = eraDados.findIndex((era) => era.era === eraInicial);
    const indiceFinal = eraDados.findIndex((era) => era.era === eraFinal);
    const candidatas = regrasProgressao.filter((regra) => {
      const indiceEra = eraDados.findIndex((era) => era.era === regra.era);
      return indiceEra >= indiceInicial &&
        indiceEra <= indiceFinal &&
          (!regra.dataMinFato || dataFato >= regra.dataMinFato) &&
          (!regra.dataMaxFato || dataFato <= regra.dataMaxFato) &&
          naturezaCompativel(regra, condenacao, dataFato) &&
        reincidenciaCompativel(regra.reincidencia, condenacao.reincidencia) &&
        antecedenteViolentoCompativel(regra, condenacao.antecedenteViolento);
    });
    if (candidatas.length === 0) {
      throw erro("E92", "Não há fração cadastrada compatível com a natureza e a era.");
    }
    let escolhida = candidatas.reduce((menor, regra) => regra.fracao < menor.fracao ? regra : menor);
    const teseE33 = opcoes && opcoes.teseE33PorCondenacao &&
      opcoes.teseE33PorCondenacao[condenacao.id] || opcoes && opcoes.teseE33;
    if (teseE33 === "legal" && condenacao.reincidencia === "generico" &&
        ["hediondo", "hediondo_morte"].includes(condenacao.natureza) &&
        ["era3a", "era3b"].includes(escolhida.era)) {
      escolhida = regrasProgressao.find((regra) =>
        regra.era === escolhida.era && regra.natureza === escolhida.natureza &&
        regra.reincidencia === "especifico") || escolhida;
    }
    const teseE31 = opcoes && opcoes.teseE31PorCondenacao &&
      opcoes.teseE31PorCondenacao[condenacao.id] || opcoes && opcoes.teseE31;
    if (teseE31 === "30" && condenacao.natureza === "violencia" &&
        condenacao.reincidencia !== "primario") {
      const regra30 = regrasProgressao.filter((regra) => {
        const indiceEra = eraDados.findIndex((era) => era.era === regra.era);
        return regra.natureza === condenacao.natureza &&
          regra.reincidencia === "reincidente" && regra.tese === "30" &&
          indiceEra >= indiceInicial && indiceEra <= indiceFinal &&
          (!regra.dataMinFato || dataFato >= regra.dataMinFato) &&
          (!regra.dataMaxFato || dataFato <= regra.dataMaxFato);
      }).reduce((maisRecente, regra) =>
        !maisRecente || eraDados.findIndex((era) => era.era === regra.era) >
          eraDados.findIndex((era) => era.era === maisRecente.era) ? regra : maisRecente, null);
      if (regra30) escolhida = regra30;
    }
    const inicioRegra = (regra) => regra.dataMinFato ||
      eraDados.find((era) => era.era === regra.era).inicio;
    const leiNaDataDoFato = candidatas
      .filter((regra) => inicioRegra(regra) <= dataFato)
      .reduce((maisRecente, regra) =>
        !maisRecente || inicioRegra(regra) > inicioRegra(maisRecente) ? regra : maisRecente, null);
    const leiPosteriorMaisFavoravel = inicioRegra(escolhida) > dataFato
      ? escolhida
      : null;
    const resumoLei = (regra) => regra && ({
      id: regra.id,
      era: regra.era,
      fracao: regra.fracao,
      fonte: regra.fonte
    });
    const avisos = [
      {
        regra: "E31",
        texto: "Comparação individual das leis aplicáveis à condenação, sem combinação de normas; confira as fontes indicadas (CF art. 5º, XL; STJ Tema 1354; STF RE 1.531.595)."
      },
      ...avisosIncompatibilidade(condenacao, dataFato, eraInicial)
    ];
    candidatas.filter((regra) =>
      regra.status === "Pendente de validação" || regra.status === STATUS_DECIDIDA).forEach((regra) => {
      avisos.push({
        regra: regra.id,
        texto: regra.status === STATUS_DECIDIDA
          ? `${regra.id}: decisão do Núcleo; fontes a conferir. Fonte: ${regra.fonte}.`
          : `${regra.id}: hipótese provisória, pendente de validação. Fonte: ${regra.fonte}.`
      });
    });
    if (escolhida.antecedenteViolento === "nao" &&
        condenacao.antecedenteViolento !== "sim" &&
        condenacao.antecedenteViolento !== "nao") {
      avisos.push({
        regra: "E31",
        texto: "25% como simulação defensiva condicionada se o antecedente gerador da reincidência foi sem violência ou grave ameaça. Com antecedente violento, a data a 30% deve ser conferida."
      });
    }
    if (leiPosteriorMaisFavoravel && leiNaDataDoFato &&
        escolhida.fracao < leiNaDataDoFato.fracao) {
      avisos.push({
        regra: "E31",
        texto: `Aplicada à condenação ${condenacao.id || "sem identificação"} a redação de ${leiPosteriorMaisFavoravel.fonte}, mais favorável para a progressão.`
      });
    }
    if (escolhida.id === "E31-ERA2-HEDIONDO-PRIMARIO-GENERICO") {
      avisos.push({
        regra: "E33",
        texto: condenacao.reincidencia === "generico"
          ? "Aplicada a fração de 40% do Tema 1.169/STF para reincidência não específica em crime hediondo sem resultado morte."
          : "Aplicada a fração legal de 40% para crime hediondo sem resultado morte; a referência ao Tema 1.169/STF depende da hipótese de reincidência não específica."
      });
    }
    if (escolhida.id === "E31-ERA2-HEDIONDO-MORTE-PRIMARIO-GENERICO" &&
        condenacao.reincidencia === "generico") {
      avisos.push({
        regra: "E33",
        texto: "PD-03: aplicada a fração de 50% do Tema 1.196/STJ, sobrestado até o julgamento do Tema 1.319/STF; o livramento condicional é avaliado separadamente."
      });
    }
    if (condenacao.reincidencia === "generico" &&
        ["hediondo", "hediondo_morte"].includes(condenacao.natureza) &&
        ["era3a", "era3b"].includes(escolhida.era)) {
      avisos.push({
        regra: "E33",
        texto: "Aplicada analogia defensiva para reincidência apenas por crime comum."
      });
    }
    if (condenacao.natureza === "hediondo_morte" &&
        dataFato < "2026-03-25" && calculo >= "2026-03-25") {
      avisos.push({
        regra: "E33",
        texto: "Tema 1.319/STF pendente quanto aos efeitos sobre outros benefícios."
      });
    }
    if (condenacao.reincidencia === "primario" && condenacao.bonsAntecedentes === false) {
      avisos.push({
        regra: "E45",
        texto: "Primário com maus antecedentes: há divergência sobre a fração do livramento condicional."
      });
    }
    if (calculo >= "2026-05-08" && condenacao.tituloXII === true &&
        condenacao.natureza === "violencia" && condenacao.reincidencia !== "primario") {
      avisos.push({
        regra: "E31",
        texto: "Título XII. Padrão defensivo de 20%; leitura do inciso IV: 30%. Confira eventual suspensão aplicável a esta execução.",
        fracaoAlternativa: regrasProgressao.find((regra) => regra.id === "E31-ERA2-VIOLENCIA-REINCIDENTE").fracao,
        regraAlternativa: "E31-ERA2-VIOLENCIA-REINCIDENTE"
      });
    }
    return {
      ...escolhida,
      leiNaDataDoFato: resumoLei(leiNaDataDoFato),
      leiPosteriorMaisFavoravel: resumoLei(leiPosteriorMaisFavoravel),
      fundamentoEscolha: `${escolhida.id}: menor fração aplicável à condenação, sem combinação de leis (CF art. 5º, XL; STJ Tema 1354; STF RE 1.531.595 — fontes a conferir).`,
      avisos
    };
  }

  function regrasVedacaoLC(condenacao, dataCalculo, baseRegras) {
    const dataFato = validarCondenacao(condenacao);
    const calculo = validarData(dataCalculo, "Data do cálculo");
    if (calculo < dataFato) {
      throw erro("E90", "Data do cálculo não pode ser anterior à data do fato.", RangeError);
    }
    const regrasVedacao = baseRegras && baseRegras.vedacoes || dados.vedacoes;
    return regrasVedacao.filter((regra) => {
      if (regra.reincidencia) {
        const categoria = regra.categorias.includes(condenacao.natureza) ||
          regra.categorias.includes("equiparado") && hediondoOuEquiparado(condenacao);
        return categoria && condenacao.reincidencia === regra.reincidencia;
      }
      return dataFato >= regra.vigenciaMinima && condenacao.lei15358LC === regra.enquadramento;
    }).map((regra) => ({ id: regra.id, fundamento: regra.fundamento }));
  }

  function vedaLC(condenacao, dataCalculo, baseRegras) {
    return regrasVedacaoLC(condenacao, dataCalculo, baseRegras).length > 0;
  }

  function fracaoLC(condenacao, dataCalculo, opcoes, baseRegras) {
    if (vedaLC(condenacao, dataCalculo, baseRegras)) return null;
    const fracoes = baseRegras && baseRegras.fracoesLivramento || dados.fracoesLivramento;
    const especial = hediondoOuEquiparado(condenacao) || condenacao.natureza === "trafico_privilegiado" ||
      condenacao.natureza === "feminicidio";
    if (especial) {
      const regra = fracoes.find((item) => item.categorias &&
        item.categorias.includes(condenacao.natureza) ||
        item.equiparado && hediondoOuEquiparado(condenacao));
      return regra.fracao;
    }
    if (condenacao.reincidencia !== "primario") {
      return fracoes.find((item) => item.reincidencia === "reincidente").fracao;
    }
    if (typeof condenacao.bonsAntecedentes !== "boolean") {
      throw erro("E45", "Informe se a condenação tem bons antecedentes.");
    }
    const regra = fracoes.find((item) =>
      item.reincidencia === "primario" &&
      item.bonsAntecedentes === condenacao.bonsAntecedentes);
    return condenacao.bonsAntecedentes === false && opcoes && opcoes.teseE45 === "intermediaria"
      ? regra.fracaoAlternativa
      : regra.fracao;
  }

  function fracaoPorId(id, baseRegras) {
    const regras = baseRegras && baseRegras.fracoesProgressao || dados.fracoesProgressao;
    const regra = regras.find((item) => item.id === id);
    return regra && regra.fracao;
  }

  return {
    base: BASE,
    tabela: REGRAS,
    dados,
    eraDoFato,
    fracaoPorId,
    menorFracao,
    fracaoLC,
    vedaLC,
    regrasVedacaoLC
  };
});
