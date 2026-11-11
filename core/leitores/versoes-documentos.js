(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.VersoesDocumentos = factory();
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const normalizar = (texto) => String(texto).normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[—–]/g, " ").replace(/\s+/g, " ").trim();
  const VERSOES = [
    {
      tipo: "seeu-relatorio",
      versao: "seeu-relatorio-v1",
      ancora: ["calculos da pena", "processos criminais"],
      pistas: ["fim do relatorio", "eventos de inicio, reinicio", "processo de execucao"],
      rotulos: [
        { nomes: ["calculos da pena"], obrigatorio: true },
        { nomes: ["termino de pena"], obrigatorio: true },
        { nomes: ["calculos para progressao de regime"] },
        { nomes: ["calculos para livramento condicional"] },
        { nomes: ["grafico representativo da pena privativa de liberdade"] },
        { nomes: ["processos criminais"], obrigatorio: true },
        { nomes: [
          "eventos de inicio, reinicio e interrupcao(oes) do cumprimento da pena",
          "eventos de inicio, reinicio e interrrupcao(oes) do cumprimento da pena"
        ] }, // I06: ausente em parte dos relatórios reais; o leitor avisa.
        { nomes: ["incidentes concedidos"], obrigatorio: true },
        { nomes: ["fim do relatorio"] }
      ],
      camposSecoes: [
        {
          secao: "calculos da pena",
          rotulos: ["regime atual", "pena total imposta", "pena cumprida ate data atual", "pena remanescente", "total interrupcoes", "saldo dias remidos"],
          // I06: "regime atual" e "total interrupcoes" faltam em parte dos relatórios reais.
          obrigatorios: ["pena total imposta", "pena cumprida ate data atual", "pena remanescente", "saldo dias remidos"]
        },
        {
          secao: "termino de pena",
          rotulos: ["data prevista para o termino da pena"]
        }
      ]
    },
    {
      tipo: "seeu-atestado",
      versao: "seeu-atestado-v1",
      ancora: ["seeu situacao carceraria", "atestado de pena"],
      pistas: ["data de inicio do cumprimento", "bons antecedentes", "regime inicial"],
      camposPermitidos: [
        "numero unico", "numero antigo", "numero", "nome", "cpf", "rg", "nome da mae", "data de nascimento",
        "data do fato", "data do delito", "pena imposta", "pena", "natureza", "equiparado",
        "reincidencia", "bons antecedentes", "regime inicial", "data de inicio do cumprimento",
        "tipo de prisao", "regime atual", "pena total", "pena total imposta", "pena cumprida",
        "total de remicao", "remicao", "detracao", "data de emissao",
        "data prevista para progressao de regime", "progressao de regime", "livramento condicional",
        "termino da pena", "termino"
      ],
      rotulos: [
        { nomes: ["data do fato", "data do delito"], obrigatorio: true },
        { nomes: ["pena", "pena imposta"], obrigatorio: true },
        { nomes: ["natureza"], obrigatorio: true },
        { nomes: ["equiparado"], obrigatorio: true },
        { nomes: ["reincidencia"], obrigatorio: true },
        { nomes: ["bons antecedentes"], obrigatorio: true },
        { nomes: ["regime inicial"], obrigatorio: true },
        { nomes: ["data de inicio do cumprimento"], obrigatorio: true },
        { nomes: ["tipo de prisao"], obrigatorio: true },
        { nomes: ["regime atual"], obrigatorio: true },
        { nomes: ["pena total", "pena total imposta"], obrigatorio: true },
        { nomes: ["pena cumprida"], obrigatorio: true },
        { nomes: ["total de remicao", "remicao"], obrigatorio: true },
        { nomes: ["detracao"], obrigatorio: true },
        { nomes: ["data de emissao"], obrigatorio: true },
        { nomes: ["data prevista para progressao de regime", "progressao de regime"], obrigatorio: true },
        { nomes: ["livramento condicional"], obrigatorio: true },
        { nomes: ["termino da pena", "termino"], obrigatorio: true }
      ]
    },
    {
      tipo: "seeu-atestado-resumo",
      versao: "seeu-atestado-resumo-v1",
      ancora: ["atestado seeu"],
      marcadores: ["pena total", "data prevista para progressao de regime", "livramento condicional", "termino da pena"],
      camposPermitidos: [
        "data do fato", "data do delito", "pena", "pena imposta", "natureza", "equiparado",
        "reincidencia", "bons antecedentes", "regime inicial", "pena total",
        "data prevista para progressao de regime", "livramento condicional", "termino da pena"
      ]
    },
    {
      tipo: "tjsp-saj",
      versao: "tjsp-saj-v1",
      secoes: [
        {
          chave: "dados-sentenca", nomes: ["dados da sentenca", "sentenca"], obrigatorio: true,
          campos: [
            "processo", "data do fato", "data do delito", "lei", "diploma legal",
            "artigo", "artigo da lei", "capitulacao legal", "tipificacao penal",
            "violencia ou grave ameaca", "resultado morte", "data da sentenca",
            "pena aplicada", "pena imposta", "conversao da pena restritiva de direitos"
          ],
          camposObrigatorios: ["processo", "data do fato", "pena aplicada"]
        },
        {
          chave: "processos-somados", nomes: ["processos somados", "soma das penas"],
          campos: ["pena total", "soma das penas", "total da pena"]
        },
        {
          chave: "dados-prisao", nomes: ["dados da prisao", "dados da prisao/aguardando internacao"], obrigatorio: true,
          campos: ["tipo de prisao", "natureza da prisao", "data de inicio", "inicio da prisao", "data da prisao", "data de recolhimento", "data de termino da prisao", "data de soltura", "fim da prisao", "regime atual", "regime"],
          camposObrigatorios: ["tipo de prisao", "data de inicio"]
        },
        {
          chave: "periodos-prisao", nomes: ["periodos de prisao considerados", "periodos considerados"],
          campos: ["tipo de prisao", "natureza da prisao", "periodo", "data de inicio", "data de termino"]
        },
        {
          chave: "remicao", nomes: ["remicao", "remicao e perda de dias remidos"],
          campos: ["total de dias remidos", "saldo de remicao", "remicao homologada", "dias remidos homologados", "revogacao da remicao", "dias perdidos de remicao", "perda de dias remidos", "data da falta grave"]
        },
        {
          chave: "historico-regimes", nomes: ["historico de regimes de prisao", "historico de regimes"],
          campos: ["progressao", "data da progressao", "regressao", "data da regressao"],
          prefixosCampos: ["progressao para ", "regressao para "]
        },
        {
          chave: "controle-pena", nomes: ["controle de pena", "controle da pena"], obrigatorio: true,
          campos: ["data-base", "data-base considerada", "pena total", "pena cumprida", "pena restante", "data de emissao", "data do calculo", "saida temporaria", "previsao de saida temporaria", "progressao", "previsao de progressao", "previsao de progressao de regime", "livramento", "previsao de livramento", "previsao de livramento condicional", "termino", "previsao de termino", "previsao de termino da pena"],
          camposObrigatorios: ["data-base", "pena total", "pena cumprida", "pena restante"]
        },
        { chave: "previsoes", nomes: ["previsoes", "previsao de beneficios"] },
        { chave: "previsao-saida-temporaria", nomes: ["previsao de saida temporaria", "saida temporaria"] },
        { chave: "previsao-progressao", nomes: ["previsao de progressao", "progressao de regime"] },
        { chave: "previsao-livramento", nomes: ["previsao de livramento condicional", "previsao de livramento"] },
        { chave: "previsao-termino", nomes: ["previsao de termino", "termino da pena"] }
      ]
    },
    {
      // I07: layout real do "Cálculo de Pena" do TJSP/SAJ, com seções sem numeração.
      tipo: "tjsp-saj-v2",
      versao: "tjsp-saj-v2",
      // Título "CÁLCULO DE PENA" ou "FICHA DO RÉU", com a mesma estrutura.
      ancoraReal: ["dados do processo", "dados da sentenca", "controle de pena"],
      ordemReal: [/^(?:calculo de pena|ficha do reu)$/, /^dados do processo$/, /^dados da sentenca$/, /^controle de pena \(situacao em \d{2}\/\d{2}\/\d{4}\)$/],
      obrigatoriosReal: []
    },
    {
      tipo: "tjsp-saj-resumo",
      versao: "tjsp-saj-resumo-v1",
      ancora: ["saj - calculo de pena"],
      marcadores: ["data do delito", "pena aplicada", "pena total", "previsao de termino de pena"],
      camposPermitidos: ["data do delito", "pena aplicada", "pena total", "previsao de termino de pena"]
    }
  ];

  function linhasRotuladas(texto) {
    return String(texto).replace(/\r\n?/g, "\n").replace(/\f/g, "\n").split("\n")
      .map((linha) => normalizar(linha.trim()).replace(/:\s*$/, ""));
  }

  function reconhecer(texto, tipoEsperado) {
    const linhas = linhasRotuladas(texto);
    const compactas = linhas.map((linha) => linha.replace(/^\d{1,2}\s*[.)-]\s*/, ""));
    const textoNormalizado = compactas.join("\n");
    const candidato = VERSOES.find((item) => (!tipoEsperado || item.tipo === tipoEsperado) &&
      item.ancora?.every((ancora) => textoNormalizado.includes(ancora)));
    const tjsp = VERSOES.find((item) => item.tipo === "tjsp-saj");
    const secoesTJSP = compactas.flatMap((linha, indiceLinha) => {
      const titulo = linha.replace(/^\d{1,2}\s*[.)-]\s*/, "");
      const secao = tjsp.secoes.find((item) => item.nomes.some((nome) => titulo === nome));
      const numerada = /^\d{1,2}\s*[.)-]\s*\S/.test(linhas[indiceLinha]);
      return numerada ? [{ titulo, secao, linha: indiceLinha }] : [];
    });
    const temPistaTJSP = (!tipoEsperado || tipoEsperado === "tjsp-saj") &&
      secoesTJSP.some(({ secao }) => secao);
    const real = VERSOES.find((item) => item.tipo === "tjsp-saj-v2");
    if ((!tipoEsperado || tipoEsperado.startsWith("tjsp-saj")) && !secoesTJSP.length &&
      real.ancoraReal.every((ancora) => textoNormalizado.includes(ancora))) {
      let anterior = -1;
      let valido = real.ordemReal.every((regex) => {
        const indice = compactas.findIndex((linha, i) => i > anterior && regex.test(linha));
        if (indice < 0) return false;
        anterior = indice;
        return true;
      }) && real.obrigatoriosReal.every((regex) => compactas.some((linha) => regex.test(linha)));
      return {
        tipo: real.tipo,
        versao: valido ? real.versao : null,
        reconhecido: valido,
        alerta: valido ? null : "Modelo de documento não reconhecido — confira todos os campos."
      };
    }
    const relatorio = VERSOES.find((item) => item.tipo === "seeu-relatorio");
    const temPistaRelatorio = (!tipoEsperado || tipoEsperado === "seeu-relatorio") &&
      [...relatorio.ancora, ...relatorio.pistas].some((pista) => textoNormalizado.includes(pista));
    const temPistaAtestado = (!tipoEsperado || tipoEsperado.startsWith("seeu-atestado")) &&
      VERSOES.filter((item) => item.tipo.startsWith("seeu-atestado"))
        .some((item) => [...item.ancora, ...(item.pistas || [])].some((pista) => textoNormalizado.includes(pista)));
    const resumo = VERSOES.find((item) => item.tipo === "tjsp-saj-resumo");
    const temPistaResumoTJSP = (!tipoEsperado || tipoEsperado === "tjsp-saj-resumo") &&
      resumo.ancora.some((ancora) => textoNormalizado.includes(ancora));
    const modelo = candidato || (temPistaTJSP ? tjsp : temPistaRelatorio ? relatorio :
      temPistaAtestado ? VERSOES.find((item) => item.tipo.startsWith("seeu-atestado") &&
        [...item.ancora, ...(item.pistas || [])].some((pista) => textoNormalizado.includes(pista))) :
        temPistaResumoTJSP ? resumo : null);
    if (!modelo) return { tipo: null, versao: null, reconhecido: false };

    let valido = true;
    if (modelo.secoes) {
      let anterior = -1;
      const definidas = new Set(modelo.secoes.map((secao) => secao.chave));
      for (const { secao } of secoesTJSP) {
        if (!secao) { valido = false; break; }
        const indice = modelo.secoes.indexOf(secao);
        if (indice <= anterior) { valido = false; break; }
        anterior = indice;
      }
      if (modelo.secoes.some((secao) => secao.obrigatorio &&
        !secoesTJSP.some((item) => item.secao?.chave === secao.chave))) valido = false;
      if (secoesTJSP.some((item) => !item.secao || !definidas.has(item.secao.chave))) valido = false;
      secoesTJSP.forEach((item, indice) => {
        if (!item.secao?.campos) return;
        const proximaSecao = secoesTJSP[indice + 1]?.linha ?? linhas.length;
        const rotulosObservados = linhas.slice(item.linha + 1, proximaSecao).flatMap((linha) => {
          const separador = linha.indexOf(":");
          return separador < 0 ? [] : [linha.slice(0, separador).replace(/^[\s•*-]+/, "").trim()];
        });
        let campoAnterior = -1;
        rotulosObservados.forEach((rotulo) => {
          const indiceCampo = item.secao.campos.findIndex((campo) => campo === rotulo ||
            item.secao.prefixosCampos?.some((prefixo) => rotulo.startsWith(prefixo)));
          if (indiceCampo < 0 || indiceCampo < campoAnterior) valido = false;
          campoAnterior = indiceCampo;
        });
        if (item.secao.camposObrigatorios?.some((campo) => !rotulosObservados.includes(campo))) valido = false;
      });
    } else if (modelo.marcadores) {
      let anterior = -1;
      modelo.marcadores.forEach((marcador) => {
        const indice = textoNormalizado.indexOf(marcador);
        if (indice < 0 || indice <= anterior) valido = false;
        anterior = indice;
      });
    } else {
      const indices = modelo.rotulos.map((rotulo) => compactas.findIndex((linha) =>
        rotulo.nomes.some((nome) => linha === nome || linha.startsWith(`${nome}:`))));
      let anterior = -1;
      for (let indice = 0; indice < indices.length; indice += 1) {
        const posicao = indices[indice];
        if (posicao < 0) {
          if (modelo.rotulos[indice].obrigatorio) valido = false;
          continue;
        }
        if (posicao <= anterior) valido = false;
        anterior = posicao;
      }
      if (modelo.tipo === "seeu-relatorio") {
        const reconhecidos = new Set(modelo.rotulos.flatMap((rotulo) => rotulo.nomes));
        if (compactas.some((linha) => /^(?:calculos(?: da pena| para )|termino de pena|processos criminais|eventos de inicio|incidentes concedidos|fim do relatorio|grafico representativo)/.test(linha) &&
          !reconhecidos.has(linha.replace(/:\s*$/, "")))) valido = false;
        modelo.camposSecoes.forEach((grupo) => {
          const inicio = compactas.findIndex((linha) => linha === grupo.secao);
          if (inicio < 0) return;
          const fim = modelo.rotulos.flatMap((rotulo) => rotulo.nomes)
            .map((nome) => compactas.findIndex((linha, indice) => indice > inicio && linha === nome))
            .filter((indice) => indice > inicio)
            .sort((a, b) => a - b)[0] ?? compactas.length;
          const observados = compactas.slice(inicio + 1, fim).flatMap((linha) => {
            const separador = linha.indexOf(":");
            return separador < 0 ? [] : [linha.slice(0, separador).trim()];
          });
          if (observados.some((rotulo) => !grupo.rotulos.includes(rotulo))) valido = false;
          if (grupo.obrigatorios?.some((rotulo) => !observados.includes(rotulo))) valido = false;
        });
      }
    }
    if (modelo.camposPermitidos) {
      const posicoesDoisPontos = [...textoNormalizado.matchAll(/:/g)].map((match) => match.index);
      posicoesDoisPontos.forEach((posicao) => {
        const linha = textoNormalizado.slice(textoNormalizado.lastIndexOf("\n", posicao) + 1, posicao).trim();
        if (!modelo.camposPermitidos.some((rotulo) => linha.endsWith(rotulo))) valido = false;
      });
    }
    return {
      tipo: modelo.tipo,
      versao: valido ? modelo.versao : null,
      reconhecido: valido,
      alerta: valido ? null : "Modelo de documento não reconhecido — confira todos os campos."
    };
  }

  return { versoes: VERSOES, reconhecer };
});
