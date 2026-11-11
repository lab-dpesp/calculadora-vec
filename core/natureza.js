(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../dados/natureza.js"));
  } else {
    root.CalcPenNatureza = factory(root.DadosNatureza);
  }
})(typeof globalThis === "object" ? globalThis : this, function (dados) {
  "use strict";

  const normalizar = (texto) => String(texto || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[ºª]/g, "").replace(/\s+/g, " ").trim();

  function identificarLei(lei) {
    const texto = normalizar(lei).replace(/[.\s/-]/g, "");
    if (/\bcp\b/.test(normalizar(lei)) || texto.includes("2848") || texto.includes("codigopenal")) return "CP";
    if (texto.includes("11343") || texto.includes("leidrogas")) return "LEI11343";
    if (texto.includes("9455")) return "LEI9455";
    if (texto.includes("13260")) return "LEI13260";
    if (texto.includes("12850")) return "LEI12850";
    return null;
  }

  function identificarArtigo(texto) {
    const valor = normalizar(texto);
    const artigo = valor.match(/\b(?:art(?:igo)?\.?\s*)?(\d{1,3}(?:-[a-z]|[a-z])?)(?!\d)/);
    if (!artigo) return null;
    const paragrafo = valor.match(/§+\s*(\d+)\s*(?:o)?(?:\s*-\s*([a-z]))?/);
    let inciso;
    if (paragrafo) {
      const depois = valor.slice(paragrafo.index + paragrafo[0].length);
      inciso = depois.match(/^\s*,?\s*(?:inciso\s*)?(i{1,3}|iv|v?i{0,3}|ix|x)\b/)?.[1];
    } else {
      inciso = valor.match(/\binciso\s+(i{1,3}|iv|v?i{0,3}|ix|x)\b/)?.[1];
    }
    return {
      artigo: artigo[1].toLowerCase(),
      paragrafo: paragrafo ? `${paragrafo[1]}${paragrafo[2] ? `-${paragrafo[2]}` : ""}` : null,
      inciso: inciso ? inciso.toLowerCase() : null,
      caput: /\bcaput\b|\b(?:furto|roubo)\s+simples\b/.test(valor),
      texto: valor
    };
  }

  function validarData(data) {
    if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
    const dataUTC = new Date(`${data}T00:00:00Z`);
    return !Number.isNaN(dataUTC.valueOf()) && dataUTC.toISOString().slice(0, 10) === data;
  }

  function semSugestao(motivo, possibilidades, regrasIds = []) {
    return {
      sugestao: null,
      ...(possibilidades.length ? { possibilidades } : {}),
      ...(regrasIds.length ? { regrasIds } : {}),
      motivo
    };
  }

  function sugerirNatureza(entrada, regras = dados) {
    const lei = identificarLei(entrada?.lei);
    const artigo = identificarArtigo(entrada?.artigo);
    if (!artigo) return semSugestao("Artigo ausente ou não identificado; não é possível sugerir a natureza.", []);
    if (!lei) return semSugestao("Lei ausente ou não identificada; não é possível conferir o artigo.", []);
    if (!validarData(entrada?.dataFato)) return semSugestao("Data do fato ausente ou inválida; a vigência da classificação não pode ser conferida.", []);

    const dataFato = entrada.dataFato;
    const regrasLeiArtigo = regras.filter((regra) => regra.lei === lei && regra.artigo === artigo.artigo);
    const regrasVigentes = regrasLeiArtigo.filter((regra) =>
      dataFato >= regra.vigencia.inicio && (!regra.vigencia.fim || dataFato <= regra.vigencia.fim));
    const regrasDaCapitulacao = regrasVigentes.filter((regra) =>
      (regra.qualquerParagrafo || (regra.paragrafo === undefined ? artigo.paragrafo === null : regra.paragrafo === artigo.paragrafo)) &&
      (regra.inciso === undefined || regra.inciso === artigo.inciso) &&
      (!regra.excluirIncisos || !regra.excluirIncisos.includes(artigo.inciso)));
    const ambiguidades = [];
    if (lei === "CP" && artigo.artigo === "157" && dataFato >= "2020-01-23" &&
        !artigo.caput && (!artigo.paragrafo || artigo.paragrafo === "2")) {
      ambiguidades.push("violencia", "hediondo");
    }
    if (lei === "CP" && artigo.artigo === "155" && dataFato >= "2020-01-23" &&
        !artigo.caput && !artigo.paragrafo) {
      ambiguidades.push(entrada.violencia === true ? "violencia" : "comum", "hediondo");
    }
    if (lei === "LEI11343" && artigo.artigo === "33" && !artigo.caput && !artigo.paragrafo) {
      ambiguidades.push("hediondo", "trafico_privilegiado");
    }
    if (lei === "CP" && ["157", "158"].includes(artigo.artigo) &&
        artigo.paragrafo === "3" && entrada.resultadoMorte !== true && entrada.resultadoMorte !== false) {
      ambiguidades.push(...(regrasVigentes.map((regra) => regra.natureza)));
      ambiguidades.push("hediondo_morte");
    }
    const semDetalhe = regrasDaCapitulacao.find((regra) =>
      regra.exigeTermo && !artigo.texto.includes(regra.exigeTermo));
    if (semDetalhe) ambiguidades.push(semDetalhe.natureza);
    if (ambiguidades.length) {
      const possibilidades = [...new Set(ambiguidades)];
      const regrasIds = (
        (lei === "CP" && ["155", "157"].includes(artigo.artigo) && !artigo.paragrafo) ||
        (lei === "LEI11343" && artigo.artigo === "33" && !artigo.paragrafo)
      ? regrasVigentes : regrasDaCapitulacao)
        .filter((regra) => possibilidades.includes(regra.natureza) ||
          possibilidades.includes(regra.naturezaComMorte))
        .map((regra) => regra.id);
      return semSugestao("O artigo não informa elementos suficientes para distinguir as possibilidades; confira a capitulação.", possibilidades, regrasIds);
    }

    const aplicaveis = regrasDaCapitulacao;
    if (!aplicaveis.length) {
      return semSugestao("Não há correspondência segura para a lei, artigo e data informados; confira a capitulação.", []);
    }
    aplicaveis.sort((a, b) =>
      Number(Boolean(b.inciso)) - Number(Boolean(a.inciso)) ||
      Number(Boolean(b.paragrafo)) - Number(Boolean(a.paragrafo)));
    const regra = aplicaveis[0];
    if (regra.exigeTermo && !artigo.texto.includes(regra.exigeTermo)) {
      return semSugestao("O artigo não confirma a qualificação necessária para esta natureza.", [regra.natureza], [regra.id]);
    }
    if (entrada.resultadoMorte === true && regra.naturezaComMorte) {
      return {
        sugestao: regra.naturezaComMorte,
        equiparado: regra.equiparado,
        regraId: regra.id,
        motivo: `${regra.fonte}; resultado morte informado.`
      };
    }
    if (regra.natureza === "hediondo_morte" && entrada.resultadoMorte === false) {
      return semSugestao("O resultado morte informado contradiz a natureza indicada pelo artigo; confira os dados.", [regra.natureza], [regra.id]);
    }
    if (regra.exigeResultadoMorte && entrada.resultadoMorte !== true && entrada.resultadoMorte !== false) {
      return semSugestao("O artigo admite resultado morte, mas esse dado não foi informado.", [regra.natureza, regra.naturezaComMorte], [regra.id]);
    }
    const sugestao = entrada.violencia === true && regra.natureza === "comum"
      ? regra.naturezaComViolencia || regra.natureza
      : regra.natureza;
    return {
      sugestao,
      equiparado: regra.equiparado,
      regraId: regra.id,
      motivo: `${regra.fonte}${entrada.violencia === true && sugestao === "violencia" ? "; violência ou grave ameaça informada no documento." : "."}`
    };
  }

  function aplicarSugestoes(calcpen, alertas, origens = {}, rastros = {}) {
    const origem = "Sugestão pela lei e artigo — decisão provisória (IA), a conferir";
    (calcpen.condenacoes || []).forEach((condenacao, indice) => {
      if (condenacao.natureza) return;
      const resultado = sugerirNatureza(condenacao);
      const caminho = `condenacoes[${indice}]`;
      if (resultado.sugestao) {
        const classeDocumento = condenacao.naturezaDocumento;
        const compativel = !classeDocumento ||
          (classeDocumento === "comum" && ["comum", "violencia"].includes(resultado.sugestao)) ||
          (classeDocumento === "hediondo" && ["hediondo", "hediondo_morte", "feminicidio"].includes(resultado.sugestao)) ||
          (classeDocumento === "equiparado" && resultado.equiparado === true);
        if (!compativel) {
          alertas.push(`Condenação ${condenacao.id}: sugestão ${resultado.sugestao} (regra ${resultado.regraId}) diverge da classificação ${classeDocumento} informada no documento; natureza não preenchida. Confira. Decisão provisória (IA), a conferir.`);
          return;
        }
        condenacao.natureza = resultado.sugestao;
        condenacao.equiparado = resultado.equiparado;
        const trecho = [
          condenacao.lei, condenacao.artigo, condenacao.dataFato,
          typeof condenacao.violencia === "boolean" ? `Violência/grave ameaça: ${condenacao.violencia ? "S" : "N"}` : "",
          typeof condenacao.resultadoMorte === "boolean" ? `Resultado morte: ${condenacao.resultadoMorte ? "S" : "N"}` : ""
        ].filter(Boolean).join("; ");
        [".natureza", ".equiparado"].forEach((campo) => {
          origens[`${caminho}${campo}`] = {
            origem, regraId: resultado.regraId, status: "a conferir", trecho
          };
          rastros[`${caminho}${campo}`] = { trecho };
        });
        alertas.push(`Condenação ${condenacao.id}: natureza sugerida como ${resultado.sugestao} pela lei e artigo (regra ${resultado.regraId}); decisão provisória (IA), a conferir. Confira a capitulação antes de calcular.`);
      } else if (resultado.possibilidades?.length) {
        const ids = resultado.regrasIds?.length ? ` (regras ${resultado.regrasIds.join(", ")})` : "";
        alertas.push(`Condenação ${condenacao.id}: natureza não preenchida; possibilidades: ${resultado.possibilidades.join(", ")}${ids}. ${resultado.motivo} Decisão provisória (IA), a conferir.`);
      }
    });
    return { origens, rastros, alertas };
  }

  return { sugerirNatureza, aplicarSugestoes };
});
