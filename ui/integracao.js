(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(require("../dados/modulos-provisorios.js"));
  else root.CalcPenIntegracao = factory(root.DadosModulosProvisorios);
})(typeof globalThis === "object" ? globalThis : this, function (modulos) {
  "use strict";

  const ORIGENS = ["https://defensoria.sp.def.br", "https://*.defensoria.sp.def.br"];
  const objeto = (valor) => valor !== null && typeof valor === "object" && !Array.isArray(valor);

  // I04: HTTPS, origem estrita e somente a janela hospedeira.
  function origemPermitida(origem, permitidas = ORIGENS) {
    try {
      const url = new URL(origem);
      if (url.protocol !== "https:" || url.origin !== origem) return false;
      return Array.isArray(permitidas) && permitidas.some((permitida) => {
        if (permitida === "https://*.defensoria.sp.def.br") {
          return !url.port && url.hostname.endsWith(".defensoria.sp.def.br");
        }
        return permitida === origem;
      });
    } catch (_) {
      return false;
    }
  }

  function preparar(mensagem, core) {
    if (!objeto(mensagem) || mensagem.tipo !== "calcpen:abrir" || mensagem.versao !== 1) {
      throw new Error("Mensagem: use calcpen:abrir, versão 1.");
    }
    const data = mensagem.dataCalculo;
    if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
        !Number.isFinite(Date.parse(data)) || new Date(data).toISOString().slice(0, 10) !== data) {
      throw new Error("Data do cálculo: informe uma data válida em AAAA-MM-DD.");
    }
    const temDocumento = mensagem.documento !== undefined;
    const temProcesso = mensagem.processo !== undefined;
    if ([temDocumento, mensagem.calcpen !== undefined, temProcesso].filter(Boolean).length !== 1) {
      throw new Error("Conteúdo: envie exatamente um de documento, calcpen ou processo.");
    }
    let entrada;
    let fonte;
    let leituraDocumento;
    if (temProcesso) {
      // I04: o limite vale para o pacote inteiro, não para cada documento isoladamente.
      if (JSON.stringify(mensagem.processo).length > 2000000) {
        throw new Error("Processo: envie um pacote de até 2 milhões de caracteres em JSON.");
      }
      leituraDocumento = core.lerProcesso(mensagem.processo, data);
      entrada = { ...leituraDocumento.calcpen, atestadoSEEU: leituraDocumento.oficial,
        pendencias: leituraDocumento.alertas || [] };
      fonte = leituraDocumento.versaoDocumento?.tipo === "tjsp-saj" ? "TJSP" : "SEEU";
    } else if (temDocumento) {
      const documento = mensagem.documento;
      if (!objeto(documento) || !["SEEU", "TJSP"].includes(documento.tipo) ||
          typeof documento.texto !== "string" || !documento.texto.trim() ||
          documento.texto.length > 2000000) {
        throw new Error("Documento: informe SEEU ou TJSP e texto de até 2 milhões de caracteres.");
      }
      fonte = documento.tipo;
      leituraDocumento = fonte === "SEEU"
        ? core.lerRelatorioSEEU(documento.texto, undefined, data) : core.lerCalculoTJSP(documento.texto);
      entrada = { ...leituraDocumento.calcpen, atestadoSEEU: leituraDocumento.oficial,
        pendencias: leituraDocumento.alertas || [] };
    } else {
      entrada = mensagem.calcpen;
      fonte = mensagem.fonteOficial || "SEEU";
      if (!["SEEU", "TJSP"].includes(fonte)) throw new Error("Fonte: informe SEEU ou TJSP.");
    }
    if (!objeto(entrada) || entrada.formato !== "calcpen" || entrada.versao !== 1 ||
        !Array.isArray(entrada.condenacoes) ||
        ["condenacoes", "prisoes", "interrupcoes", "detracoes", "remicoes", "faltasGraves", "progressoes"]
          .some((nome) => entrada[nome] !== undefined &&
            (!Array.isArray(entrada[nome]) || entrada[nome].some((item) => !objeto(item))))) {
      throw new Error("Calcpen: envie uma entrada calcpen versão 1 com listas de registros válidas.");
    }
    const opcoes = mensagem.opcoes === undefined ? {} : mensagem.opcoes;
    if (!objeto(opcoes) || !modulos.validar(opcoes) ||
        (opcoes.convencaoDias !== undefined && !["calendario", "365", "360"].includes(opcoes.convencaoDias)) ||
        (opcoes.menos1Beneficio !== undefined && typeof opcoes.menos1Beneficio !== "boolean") ||
        (opcoes.arredondamento !== undefined && opcoes.arredondamento !== "cima")) {
      throw new Error("Opções: confira a convenção de dias, menos1Beneficio, arredondamento e a lista modulosProvisorios.");
    }
    return {
      entrada: JSON.parse(JSON.stringify(entrada)), dataCalculo: data,
      opcoes: { convencaoDias: opcoes.convencaoDias || "calendario",
        menos1Beneficio: opcoes.menos1Beneficio === true, arredondamento: "cima" },
      fonteOficial: fonte,
      ...(leituraDocumento ? { leituraDocumento: JSON.parse(JSON.stringify(leituraDocumento)) } : {})
    };
  }

  function iniciar(janela, core, receber, falhar, configuracao = {}) {
    const abertura = janela.parent && janela.parent !== janela ? janela.parent : janela.opener;
    if (!abertura || abertura === janela) return;
    const permitidas = configuracao.origensPermitidas === undefined
      ? ORIGENS : configuracao.origensPermitidas;
    janela.addEventListener("message", function (evento) {
      if (evento.source !== abertura || !origemPermitida(evento.origin, permitidas)) return;
      if (!objeto(evento.data) || evento.data.tipo !== "calcpen:abrir") return;
      try {
        receber(preparar(evento.data, core));
      } catch (_) {
        falhar("Dados recebidos: não foi possível abrir. Confira o formato, a data e o documento e envie novamente.");
      }
    });
    // O aviso não contém dados do caso; a origem da abertura só será conhecida no recebimento.
    abertura.postMessage({ tipo: "calcpen:pronto", versao: 1 }, "*");
  }

  function mesclarEdicoes(original, anterior, atual) {
    if (JSON.stringify(anterior) === JSON.stringify(atual)) return original;
    if (Array.isArray(anterior) && Array.isArray(atual) &&
        atual.every((item) => objeto(item) && typeof item.condenacaoId === "string")) {
      return atual.map((saldo) => {
        const antes = anterior.find((item) => item.condenacaoId === saldo.condenacaoId);
        const fonte = (Array.isArray(original) ? original : [])
          .find((item) => item.condenacaoId === saldo.condenacaoId);
        const registro = { ...fonte, ...saldo };
        if (!antes || antes.dias !== saldo.dias) {
          registro.origem = (fonte && fonte.origem ? fonte.origem + "; " : "") +
            "Saldo informado manualmente na conferência da integração";
        }
        return registro;
      });
    }
    if (!objeto(anterior) || !objeto(atual)) return atual;
    const saida = { ...original };
    new Set([...Object.keys(anterior), ...Object.keys(atual)]).forEach((chave) => {
      if (JSON.stringify(anterior[chave]) === JSON.stringify(atual[chave])) return;
      if (atual[chave] === undefined) delete saida[chave];
      else saida[chave] = mesclarEdicoes(original && original[chave], anterior[chave], atual[chave]);
    });
    return saida;
  }

  return { origemPermitida, preparar, iniciar, mesclarEdicoes };
});
