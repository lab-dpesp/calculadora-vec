(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Antecedentes = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const NATUREZAS_HEDIONDAS = new Set([
    "hediondo",
    "hediondo_morte",
    "equiparado",
    "hediondo/equiparado"
  ]);

  function falha(regra, mensagem, tipo) {
    const erro = new (tipo || TypeError)(mensagem);
    erro.regra = regra;
    throw erro;
  }

  function validarData(valor, campo, regra, podeSerNula) {
    if (podeSerNula && (valor === null || valor === undefined)) return null;
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      falha(regra, `${campo} deve estar no formato AAAA-MM-DD.`);
    }
    const data = new Date(`${valor}T00:00:00.000Z`);
    if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) {
      falha(regra, `${campo} não é uma data válida.`, RangeError);
    }
    return valor;
  }

  function validarNatureza(valor, campo, regra) {
    if (typeof valor !== "string" || valor.trim() === "") {
      falha(regra, `${campo} deve informar a natureza do crime.`);
    }
    return valor.trim().toLocaleLowerCase("pt-BR");
  }

  function validarPassagem(passagem, indice) {
    if (!passagem || typeof passagem !== "object" || Array.isArray(passagem)) {
      falha("P01", `A passagem ${indice + 1} deve ser um objeto.`);
    }
    const dataFato = validarData(passagem.dataFato, `Data do fato da passagem ${indice + 1}`, "P01");
    const dataTransito = validarData(
      passagem.dataTransito,
      `Data do trânsito da passagem ${indice + 1}`,
      "P01",
      true
    );
    const dataExtincao = validarData(
      passagem.dataExtincao,
      `Data da extinção da passagem ${indice + 1}`,
      "P01",
      true
    );
    if (dataTransito && dataTransito < dataFato) {
      falha("P01", `O trânsito da passagem ${indice + 1} não pode anteceder o fato.`, RangeError);
    }
    if (dataExtincao && dataTransito && dataExtincao < dataTransito) {
      falha("P01", `A extinção da passagem ${indice + 1} não pode anteceder o trânsito.`, RangeError);
    }
    for (const campo of ["militarProprio", "politico"]) {
      if (passagem[campo] !== undefined && typeof passagem[campo] !== "boolean") {
        falha("P04", `${campo} da passagem ${indice + 1} deve ser verdadeiro ou falso.`);
      }
    }
    return {
      dataFato,
      dataTransito,
      dataExtincao,
      natureza: validarNatureza(passagem.natureza, `Natureza da passagem ${indice + 1}`, "P05"),
      militarProprio: passagem.militarProprio === true,
      politico: passagem.politico === true,
      indice
    };
  }

  function limitePeriodoDepurador(dataExtincao) {
    const data = new Date(`${dataExtincao}T00:00:00.000Z`);
    const ano = data.getUTCFullYear() + 5;
    if (ano > 9999) return null;
    const mes = data.getUTCMonth();
    const dia = data.getUTCDate();
    const ultimoDia = new Date(0);
    ultimoDia.setUTCHours(0, 0, 0, 0);
    ultimoDia.setUTCFullYear(ano, mes + 1, 0);
    const limite = new Date(0);
    limite.setUTCHours(0, 0, 0, 0);
    limite.setUTCFullYear(ano, mes, Math.min(dia, ultimoDia.getUTCDate()));
    return limite.toISOString().slice(0, 10);
  }

  function formatarData(data) {
    if (!data) return null;
    return data.slice(8, 10) + "/" + data.slice(5, 7) + "/" + data.slice(0, 4);
  }

  function formatarAno(data) {
    return data.slice(0, 4);
  }

  function diaSeguinte(data) {
    const dataUTC = new Date(`${data}T00:00:00.000Z`);
    dataUTC.setUTCDate(dataUTC.getUTCDate() + 1);
    return dataUTC.toISOString().slice(0, 10);
  }

  function mesmaNatureza(atual, anterior) {
    // P05: para hediondos, a natureza específica não altera a reincidência específica.
    const atualHediondo = NATUREZAS_HEDIONDAS.has(atual);
    const anteriorHediondo = NATUREZAS_HEDIONDAS.has(anterior);
    return atualHediondo && anteriorHediondo || atual === anterior;
  }

  function avaliarPassagem(passagem, fatoAtual, naturezaAtual, cenario) {
    if (!passagem.dataTransito) {
      return {
        ...passagem,
        reincidencia: false,
        mausAntecedentes: false,
        regras: ["P03"],
        avisos: [],
        explicacao: "Sem trânsito em julgado: não conta como reincidência nem maus antecedentes (P03)."
      };
    }

    const excluidaDaReincidencia = passagem.militarProprio || passagem.politico;
    const fatoAnterior = passagem.dataFato < fatoAtual;
    const transitoAnterior = passagem.dataTransito < fatoAtual;
    const limite = passagem.dataExtincao
      ? limitePeriodoDepurador(passagem.dataExtincao)
      : null;
    const dentroDoPeriodo = !passagem.dataExtincao || !limite || fatoAtual <= limite;
    // P01/P04: o trânsito deve anteceder o novo fato; o período só se depura após cinco anos completos.
    const geraReincidencia = fatoAnterior && transitoAnterior &&
      !excluidaDaReincidencia && dentroDoPeriodo;

    if (geraReincidencia) {
      const especifica = mesmaNatureza(naturezaAtual, passagem.natureza);
      return {
        ...passagem,
        reincidencia: true,
        especifica,
        mausAntecedentes: false,
        regras: especifica ? ["P01", "P05"] : ["P01"],
        avisos: [],
        explicacao: especifica
          ? `Condenação pelo fato de ${formatarAno(passagem.dataFato)}, com trânsito em ${formatarData(passagem.dataTransito)} antes do novo fato: reincidência específica (P01, P05).`
          : `Condenação pelo fato de ${formatarAno(passagem.dataFato)}, com trânsito em ${formatarData(passagem.dataTransito)} antes do novo fato: reincidência genérica (P01).`
      };
    }

    const regras = ["P01"];
    if (excluidaDaReincidencia) regras.push("P04");
    regras.push("P02");
    const contaComoMausAntecedentes = cenario === "desfavoravel";
    let motivo = "não gera reincidência (P01)";
    if (excluidaDaReincidencia) motivo = "não gera reincidência por ser crime militar próprio ou político (P04)";
    else if (!fatoAnterior || !transitoAnterior) motivo = "não gera reincidência porque o trânsito não antecedeu o novo fato (P01)";
    else if (!dentroDoPeriodo) {
      motivo = `foi depurada em ${formatarData(diaSeguinte(limite))} após o período de cinco anos e não gera reincidência (P01)`;
    }
    const contexto = `Condenação pelo fato de ${formatarAno(passagem.dataFato)}` +
      (passagem.dataExtincao
        ? `, com pena extinta em ${formatarData(passagem.dataExtincao)}`
        : ", ainda sem extinção da pena");
    const avisoP02 = {
      regra: "P02",
      texto: "A consideração de condenação definitiva como maus antecedentes pode ser contestada pela tese do direito ao esquecimento (P02; STF Tema 150)."
    };

    return {
      ...passagem,
      reincidencia: false,
      mausAntecedentes: contaComoMausAntecedentes,
      regras,
      avisos: [avisoP02],
      explicacao: contaComoMausAntecedentes
        ? `${contexto}: ${motivo}; pode ser considerada como maus antecedentes no cenário desfavorável (P02).`
        : `${contexto}: ${motivo}; ignorada como maus antecedentes no cenário favorável (P02).`
    };
  }

  function classificarAntecedentes(passagens, fatoAtual, naturezaAtual, opcoes) {
    if (!Array.isArray(passagens)) {
      falha("P01", "A lista de passagens deve ser uma lista.");
    }
    const dataFatoAtual = validarData(fatoAtual, "Data do novo fato", "P01");
    const natureza = validarNatureza(naturezaAtual, "Natureza do novo fato", "P05");
    const cenario = opcoes && opcoes.cenario !== undefined ? opcoes.cenario : "desfavoravel";
    if (!["favoravel", "desfavoravel"].includes(cenario)) {
      falha("P02", "O cenário deve ser favoravel ou desfavoravel.");
    }

    const avaliadas = passagens.map((passagem, indice) =>
      avaliarPassagem(validarPassagem(passagem, indice), dataFatoAtual, natureza, cenario)
    );
    const reincidentes = avaliadas.filter((passagem) => passagem.reincidencia);
    const reincidenciaEspecifica = reincidentes.some((passagem) => passagem.especifica);
    const temMausAntecedentes = avaliadas.some((passagem) => passagem.mausAntecedentes);
    let classificacao = "primario";
    if (reincidentes.length) {
      classificacao = reincidenciaEspecifica ? "reincidente_especifico" : "reincidente_generico";
    } else if (temMausAntecedentes) {
      classificacao = "maus_antecedentes";
    }

    const regras = [...new Set(avaliadas.flatMap((passagem) => passagem.regras))];
    if (reincidentes.length && reincidenciaEspecifica) {
      regras.splice(regras.indexOf("P05"), 1);
      regras.push("P05");
    }
    const explicacoes = avaliadas.map((passagem) => passagem.explicacao);
    if (!explicacoes.length) {
      explicacoes.push(cenario === "desfavoravel"
        ? "Nenhuma condenação definitiva informada gera reincidência ou maus antecedentes (P01–P04)."
        : "Nenhuma condenação definitiva informada gera reincidência (P01, P03, P04).");
    }

    return {
      classificacao,
      reincidencia: classificacao === "reincidente_especifico"
        ? "especifico"
        : classificacao === "reincidente_generico" ? "generico" : "primario",
      mausAntecedentes: temMausAntecedentes,
      cenario,
      regras,
      avisos: avaliadas.flatMap((passagem) => passagem.avisos),
      explicacao: explicacoes.join(" "),
      passagens: avaliadas
    };
  }

  return { classificarAntecedentes };
});
