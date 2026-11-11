(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./seeu-relatorio.js"),
      require("./tjsp-calculo.js"),
      require("../../dados/movimentos-execucao.js")
    );
  } else {
    root.LeitorProcesso = factory(root.LeitorRelatorioSEEU, root.LeitorCalculoTJSP, root.MovimentosExecucao);
  }
})(typeof globalThis === "object" ? globalThis : this, function (leitorSEEU, leitorTJSP, movimentos) {
  "use strict";

  const normalizar = (texto) => String(texto).normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const formatoDataHora = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

  function instanteDataHora(valor) {
    if (typeof valor !== "string" || !formatoDataHora.test(valor)) return NaN;
    const data = valor.slice(0, 10);
    const meiaNoiteUTC = new Date(`${data}T00:00:00Z`);
    if (!Number.isFinite(meiaNoiteUTC.getTime()) || meiaNoiteUTC.toISOString().slice(0, 10) !== data) return NaN;
    return Date.parse(valor);
  }

  function calcpenVazio(alertas = []) {
    return {
      formato: "calcpen",
      versao: 1,
      condenacoes: [],
      prisoes: [],
      interrupcoes: [],
      detracoes: [],
      remicoes: [],
      faltasGraves: [],
      progressoes: [],
      pendencias: [...alertas],
      observacoes: ""
    };
  }

  function motivoDocumento(documento) {
    const motivos = [];
    if (documento.situacao !== "OK") motivos.push("situação diferente de OK");
    if (documento.nivelSigilo === 5) motivos.push("nível de sigilo 5");
    if (typeof documento.texto !== "string" || !documento.texto.trim()) motivos.push("sem texto");
    return motivos;
  }

  function tipoCandidato(documento) {
    const rotulo = normalizar(`${documento.nome || ""} ${documento.tipo || ""}`);
    if (rotulo.includes("relatorio da situacao")) return "relatorio";
    if (rotulo.includes("calculo de pena")) return "calculo";
    return null;
  }

  function metadadosDocumento(documento) {
    return {
      id: documento.id,
      ...(documento.nome === undefined ? {} : { nome: documento.nome }),
      ...(documento.tipo === undefined ? {} : { tipo: documento.tipo }),
      data: documento.data
    };
  }

  function movimentacaoPosterior(movimento, dataDocumento) {
    if (!movimento || typeof movimento !== "object" || Array.isArray(movimento)) return null;
    const instante = instanteDataHora(movimento.data);
    if (!Number.isFinite(instante) || instante <= dataDocumento) return null;
    const descricao = normalizar(movimento.descricao || "");
    const regra = movimentos.find((item) => new RegExp(item.padrao, "i").test(descricao));
    if (!regra) return null;
    return {
      id: movimento.id,
      ...(Object.prototype.hasOwnProperty.call(movimento, "codigo") ? { codigo: movimento.codigo } : {}),
      descricao: movimento.descricao,
      data: movimento.data,
      ...(movimento.complemento === undefined ? {} : { complemento: [...movimento.complemento] }),
      ...(movimento.documentos === undefined ? {} : { documentos: [...movimento.documentos] }),
      idRegra: regra.id,
      objeto: regra.objeto,
      status: regra.status
    };
  }

  function ler(pacote, dataCalculo) {
    if (!pacote || typeof pacote !== "object" || Array.isArray(pacote) ||
      pacote.formato !== "calcpen-processo" || pacote.versao !== 1 ||
      !["SEEU", "eproc"].includes(pacote.sistema) ||
      !Array.isArray(pacote.documentos) || !Array.isArray(pacote.movimentos)) {
      throw new TypeError("Pacote inválido: informe calcpen-processo v1, sistema, documentos e movimentos.");
    }

    const documentosIgnorados = [];
    const disponiveis = [];
    pacote.documentos.forEach((documento) => {
      if (!documento || typeof documento !== "object" || Array.isArray(documento)) {
        documentosIgnorados.push({ motivo: "documento inválido" });
        return;
      }
      const motivos = motivoDocumento(documento);
      if (motivos.length) {
        documentosIgnorados.push({ id: documento.id, motivo: motivos.join("; ") });
        return;
      }
      const categoria = tipoCandidato(documento);
      if (!categoria) {
        documentosIgnorados.push({ id: documento.id, motivo: "nome ou tipo não corresponde a um documento candidato" });
        return;
      }
      const instante = instanteDataHora(documento.data);
      if (!Number.isFinite(instante)) {
        documentosIgnorados.push({ id: documento.id, motivo: "data inválida" });
        return;
      }
      disponiveis.push({ documento, categoria, instante });
    });

    const alertas = [];
    const temRelatorio = disponiveis.some((item) => item.categoria === "relatorio");
    const candidatos = disponiveis.filter((item) => item.categoria === (temRelatorio ? "relatorio" : "calculo"));
    let escolhido = null;
    if (candidatos.length) {
      const dataMaisRecente = Math.max(...candidatos.map((item) => item.instante));
      const maisRecentes = candidatos.filter((item) => item.instante === dataMaisRecente);
      escolhido = maisRecentes[0];
      if (maisRecentes.length > 1) {
        alertas.push("Há empate entre documentos candidatos mais recentes; foi escolhido o primeiro da lista. Confira a seleção.");
      }
      disponiveis.filter((item) => item !== escolhido).forEach(({ documento, categoria }) => {
        const motivo = temRelatorio && categoria === "calculo"
          ? "Relatório da Situação tem preferência sobre Cálculo de Pena"
          : "documento candidato não selecionado por ser mais antigo ou desempate";
        documentosIgnorados.push({ id: documento.id, motivo });
      });
    } else {
      alertas.push("Nenhum documento aproveitável encontrado; nenhum dado do processo foi presumido.");
    }

    let leitura = null;
    let versaoDocumento = null;
    let calcpen = calcpenVazio();
    let oficial = {};
    let origens = {};
    let rastros = {};
    if (escolhido) {
      leitura = escolhido.categoria === "relatorio"
        ? leitorSEEU.ler(escolhido.documento.texto, undefined, dataCalculo)
        : leitorTJSP.ler(escolhido.documento.texto);
      versaoDocumento = leitura.versaoDocumento || { tipo: null, versao: null, reconhecido: false };
      if (versaoDocumento?.reconhecido === true) {
        calcpen = leitura.calcpen;
        oficial = leitura.oficial || {};
        origens = leitura.origens || {};
        rastros = leitura.rastros || {};
      } else {
        alertas.push("Modelo do documento não reconhecido; confira o documento. Nenhum dado foi presumido.");
        if (Array.isArray(leitura.alertas)) alertas.push(...leitura.alertas);
      }
    }

    const movimentosPosteriores = escolhido
      ? pacote.movimentos.map((movimento) => movimentacaoPosterior(movimento, escolhido.instante)).filter(Boolean)
      : [];
    if (movimentosPosteriores.length) {
      alertas.push("Há movimentos de execução posteriores ao documento usado; o cálculo pode estar desatualizado. Confira cada movimento.");
    }

    return {
      calcpen,
      oficial,
      alertas: [...new Set([...alertas, ...(leitura?.alertas || [])])],
      avisos: leitura?.avisos || { possivelProvidencia: [], dadoAConferir: [] },
      origens,
      rastros,
      versaoDocumento,
      processo: {
        documentoUsado: escolhido ? {
          ...metadadosDocumento(escolhido.documento),
          reconhecido: versaoDocumento?.reconhecido === true
        } : null,
        documentosIgnorados,
        movimentosPosteriores
      }
    };
  }

  return { ler };
});
