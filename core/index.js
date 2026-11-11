(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./engine.js"), require("./explicador.js"),
      require("./leitura-texto.js"), require("../package.json").version, require("./regras.js"),
      require("./leitores/seeu-relatorio.js"), require("./leitores/tjsp-calculo.js"),
      require("./indulto.js"), require("./leitores/processo.js"), require("./natureza.js"),
      require("../dados/modulos-provisorios.js"));
  } else {
    root.CalcPenCore = factory(root.CalculadoraExecucaoPenal, root.Explicador,
      root.LeituraTexto, root.CalculadoraExecucaoPenal.versao, root.Regras,
      root.LeitorRelatorioSEEU, root.LeitorCalculoTJSP, root.Indulto, root.LeitorProcesso,
      root.CalcPenNatureza, root.DadosModulosProvisorios);
  }
})(typeof globalThis === "object" ? globalThis : this, function (engine, explicador, leitor, versao, regras, leitorSEEU, leitorTJSP, indulto, leitorProcesso, natureza, modulos) {
  "use strict";

  function lerTexto(texto) {
    const { entrada, origens, rastros } = leitor.analisarTexto(texto);
    return {
      calcpen: entrada,
      oficial: entrada.atestadoSEEU || {},
      alertas: entrada.pendencias,
      origens,
      rastros
    };
  }

  function lerRelatorioSEEU(texto, paginas, dataCalculo) {
    return leitorSEEU.ler(texto, paginas, dataCalculo);
  }

  function lerCalculoTJSP(texto) {
    return leitorTJSP.ler(texto);
  }

  function textoComparacao(valor) {
    if (valor && typeof valor === "object" &&
        ["anos", "meses", "dias"].every((campo) => Number.isSafeInteger(valor[campo]))) {
      return `${valor.anos} a, ${valor.meses} m, ${valor.dias} d`;
    }
    return Number.isInteger(valor) ? `${valor} dias` : String(valor);
  }

  function valorComparacao(valor) {
    if (Number.isInteger(valor)) return valor;
    if (valor && typeof valor === "object" &&
        ["anos", "meses", "dias"].every((campo) => Number.isSafeInteger(valor[campo]))) {
      return ["anos", "meses", "dias"].map((campo) => valor[campo]).join(":");
    }
    return valor;
  }

  function compararSaldos(resultado, oficial) {
    const valorPena = (oficial, dias, pena) =>
      oficial && typeof oficial === "object" ? pena : dias;
    const campos = [
      ["penaTotal", "Pena total", oficial.penaTotal ?? oficial.penaTotalDias,
        valorPena(oficial.penaTotal, resultado.penaTotal?.emDias, resultado.penaTotal)],
      ["penaCumprida", "Pena cumprida", oficial.penaCumprida ?? oficial.penaCumpridaDias,
        valorPena(oficial.penaCumprida, resultado.cumprido?.emDias, resultado.cumprido)],
      ["penaRemanescente", "Pena remanescente", oficial.penaRemanescente ?? oficial.penaRemanescenteDias,
        valorPena(oficial.penaRemanescente, resultado.restante?.emDias, resultado.restante)],
      ["interrupcoes", "Interrupções", oficial.totalInterrupcoes ?? oficial.interrupcoesDias,
        resultado.interrupcaoDias],
      ["remicaoDias", "Remição", oficial.remicaoDias, resultado.remicaoDias],
      ["dataBase", "Data-base", oficial.dataBase, resultado.dataBaseProgressao ?? resultado.dataBase]
    ];
    return campos.flatMap(([item, rotulo, valorOficial, valorCalculadora]) => {
      if (valorOficial == null) return [];
      const oficialTexto = textoComparacao(valorOficial);
      const calculadoraTexto = valorCalculadora == null ? null : textoComparacao(valorCalculadora);
      const falta = valorCalculadora == null;
      const duracoesIncompativeis = item === "interrupcoes" && valorOficial &&
        typeof valorOficial === "object" && Number.isInteger(valorCalculadora);
      const iguais = !falta && valorComparacao(valorOficial) === valorComparacao(valorCalculadora);
      const diferencaData = item === "dataBase" && !falta &&
        /^\d{4}-\d{2}-\d{2}$/.test(valorOficial) && /^\d{4}-\d{2}-\d{2}$/.test(valorCalculadora)
        ? (Date.parse(`${valorCalculadora}T00:00:00Z`) - Date.parse(`${valorOficial}T00:00:00Z`)) / 86400000
        : null;
      return [{
        item,
        rotulo,
        oficial: oficialTexto,
        calculadora: calculadoraTexto,
        diferencaDias: Number.isInteger(diferencaData)
          ? diferencaData
          : Number.isInteger(valorOficial) && Number.isInteger(valorCalculadora)
            ? valorCalculadora - valorOficial : null,
        classificacao: falta || duracoesIncompativeis
          ? "falta_confirmar_dado" : iguais ? "igual" : "sem_explicacao",
        explicacao: duracoesIncompativeis
          ? "O documento informa a duração e a calculadora informa dias; confira os períodos individuais antes de comparar."
          : falta ? `Falta conferir ${rotulo.toLowerCase()} na calculadora.`
          : iguais ? "Os valores coincidem." : "Confira a diferença entre o documento e a calculadora.",
        ...(falta || duracoesIncompativeis
          ? { dadoPendente: duracoesIncompativeis ? "os períodos de interrupção e a unidade do total oficial" : rotulo.toLowerCase() }
          : {})
      }];
    });
  }

  function comparar(dados) {
    const oficial = dados.oficial || dados.atestadoSEEU || {};
    const resultado = dados.resultado || {};
    const linhasDatas = explicador.explicarDivergencias({
      ...dados,
      atestadoSEEU: oficial,
      calcular: dados.calcular || ((entrada, dataCalculo, opcoes) =>
        engine.calcular(entrada, dataCalculo, opcoes, dados.baseRegras))
    }).map((linha) => ({ ...linha, oficial: linha.seeu, calculadora: linha.nossa }));
    return linhasDatas.concat(compararSaldos(resultado, oficial));
  }

  function simularIndulto(entrada, dataCalculo, opcoes, decretos, baseRegras) {
    const resultadoMotor = engine.calcular(entrada, dataCalculo, opcoes, baseRegras);
    if (resultadoMotor.erros) return resultadoMotor;
    if (!modulos.inclui(opcoes, "E70")) return [];
    if (!indulto || typeof indulto.simular !== "function") {
      return { erros: [{ campo: "indulto", mensagem: "O módulo de indulto não foi carregado.", regra: "E70" }] };
    }
    const baseDecretos = decretos || regras.dados.decretos;
    const selecionados = opcoes && opcoes.dataReferencia
      ? baseDecretos.filter((decreto) => decreto.dataReferencia === opcoes.dataReferencia)
      : baseDecretos;
    return indulto.simular(entrada, selecionados, { resultadoMotor });
  }

  const api = {
    calcular: engine.calcular,
    gerarCenarios: engine.gerarCenarios,
    simularIndulto: (entrada, dataCalculo, opcoes) =>
      simularIndulto(entrada, dataCalculo, opcoes),
    sugerirNatureza: natureza.sugerirNatureza,
    baseRegras: regras.dados,
    modulosProvisorios: modulos.lista,
    lerRelatorioSEEU: leitorSEEU ? lerRelatorioSEEU : lerTexto,
    lerCalculoTJSP,
    lerProcesso: (pacote, dataCalculo) => leitorProcesso.ler(pacote, dataCalculo),
    // I05: texto dos PDFs montado pela posição dos trechos.
    montarTexto: leitor.montarTextoDeItens,
    comparar,
    versao
  };
  api.comBase = function (baseRegras) {
    return {
      ...api,
      calcular: (entrada, dataCalculo, opcoes) =>
        engine.calcular(entrada, dataCalculo, opcoes, baseRegras),
      gerarCenarios: (entrada, dataCalculo, opcoes) =>
        engine.gerarCenarios(entrada, dataCalculo, opcoes, baseRegras),
      simularIndulto: (entrada, dataCalculo, opcoes) =>
        simularIndulto(entrada, dataCalculo, opcoes, baseRegras.decretos, baseRegras),
      comparar: (dados) => comparar({ ...dados, baseRegras })
    };
  };
  return api;
});
