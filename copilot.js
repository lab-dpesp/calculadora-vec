(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./ui/textos.js") : root.TextosInterface);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CalculadoraExecucaoCopilot = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (textos) {
  "use strict";

  const FORMATO = "calcpenal-copilot";
  const ORIGEM_PADRAO = "Resposta colada do Copilot";
  const CAMPOS_SEM_CITACAO = new Set(["id", "origem", "condenacaoId", "formato", "versao", "citacoes", "pendencias"]);
  const ENUMERACOES = {
    natureza: ["comum", "violencia", "hediondo", "hediondo_morte", "trafico_privilegiado", "feminicidio", "comando_orcrim", "milicia"],
    reincidencia: ["primario", "generico", "especifico"],
    antecedenteViolento: ["sim", "nao", "desconhecido"],
    lei15358LC: ["art2-paragrafo4-III", "art3-paragrafo-unico"],
    regimeInicial: ["fechado", "semiaberto", "aberto"],
    regimeAtual: ["fechado", "semiaberto", "aberto"],
    tipoPrisao: ["definitiva", "provisoria"],
    tipoFalta: ["fuga", "outra"],
    para: ["fechado", "semiaberto", "aberto"]
  };

  function erro(campo, mensagem) {
    return { campo, mensagem };
  }

  function dataValida(valor) {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const [ano, mes, dia] = valor.split("-").map(Number);
    if (ano < 1 || mes < 1 || mes > 12) return false;
    const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
    const diasNoMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return dia >= 1 && dia <= diasNoMes[mes - 1];
  }

  // I15: na conferência de documento lido localmente, campos a mais do leitor são preservados.
  let modoLocal = false;
  let modoEstrito = false;
  let versaoEsperada = 1;
  let registrarAusencia = null;
  function validarPropriedades(item, permitidas, campo, erros) {
    if (modoLocal && !modoEstrito) return;
    Object.keys(item).forEach((chave) => {
      if (!permitidas.includes(chave)) erros.push(erro(campo ? `${campo}.${chave}` : chave,
        `Campo não previsto no formato calcpenal-copilot v${versaoEsperada}.`));
    });
  }

  function validarOrigem(item, campo, erros) {
    if (modoLocal && !modoEstrito) return;
    if (typeof item.origem !== "string" || !item.origem.trim()) {
      erros.push(erro(`${campo}.origem`, "Informe a origem deste dado."));
    }
  }

  function validarData(valor, campo, erros, nula) {
    if (valor === undefined && registrarAusencia) {
      registrarAusencia(campo, "data não encontrada");
      return;
    }
    if (nula && valor === null) return;
    if (!dataValida(valor)) erros.push(erro(campo, "Use uma data válida no formato AAAA-MM-DD."));
  }

  function validarInteiro(valor, campo, erros) {
    if (valor === undefined && registrarAusencia) {
      registrarAusencia(campo, "valor não encontrado");
      return;
    }
    if (!Number.isInteger(valor) || valor < 0) erros.push(erro(campo, "Informe um número inteiro igual ou maior que zero."));
  }

  function validarEnumeracao(valor, enumeracao, campo, erros) {
    if (valor === undefined && registrarAusencia) {
      registrarAusencia(campo, "valor não encontrado");
      return;
    }
    if (!enumeracao.includes(valor)) erros.push(erro(campo, `Use uma destas opções: ${enumeracao.join(", ")}.`));
  }

  function validarObjeto(item, campo, erros) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      erros.push(erro(campo, "Informe um objeto válido."));
      return false;
    }
    return true;
  }

  function caminhoPartes(caminho) {
    return caminho.match(/[^.[\]]+|\[\d+\]/g)?.map((parte) =>
      parte[0] === "[" ? Number(parte.slice(1, -1)) : parte) || [];
  }

  function removerNoCaminho(objeto, caminho) {
    const partes = caminhoPartes(caminho);
    const chave = partes.pop();
    const pai = partes.reduce((valor, parte) => valor?.[parte], objeto);
    if (pai && chave !== undefined) delete pai[chave];
  }

  function listarValores(valor, caminho, callback) {
    if (Array.isArray(valor)) {
      valor.forEach((item, indice) => {
        if (!item || typeof item !== "object") return;
        listarValores(item, `${caminho}[${indice}]`, callback);
      });
    } else if (valor && typeof valor === "object") {
      Object.entries(valor).forEach(([chave, item]) => {
        const proximo = caminho ? `${caminho}.${chave}` : chave;
        if (!CAMPOS_SEM_CITACAO.has(chave)) listarValores(item, proximo, callback);
      });
    } else if (caminho) callback(caminho, valor);
  }

  function citacaoDoCampo(caminho, citacoes) {
    return Object.hasOwn(citacoes, caminho) ? citacoes[caminho] : null;
  }

  function textoNaoEncontrado(valor) {
    return typeof valor === "string" && /^\s*n[aã]o\s+(?:foi\s+)?encontrad[oa]\s*$/i.test(valor);
  }

  function paginaValida(pagina) {
    return pagina === null || (Number.isInteger(pagina) && pagina > 0);
  }

  function citacaoSegura(citacao) {
    if (!citacao || typeof citacao !== "object" || Array.isArray(citacao)) return null;
    const chaves = Object.keys(citacao);
    if (citacao.status === "nao_encontrado" && chaves.length === 1 && chaves[0] === "status") {
      return { status: "nao_encontrado" };
    }
    const trechoValido = typeof citacao.trecho === "string" && !!citacao.trecho.trim() &&
      paginaValida(citacao.pagina);
    if (!trechoValido) return null;
    if (citacao.status === "encontrado" &&
        chaves.every((chave) => ["status", "trecho", "pagina"].includes(chave))) {
      return { status: "encontrado", trecho: citacao.trecho, pagina: citacao.pagina };
    }
    if (citacao.status === "contraditorio" &&
        chaves.every((chave) => ["status", "trecho", "pagina", "conflitos"].includes(chave)) &&
        Array.isArray(citacao.conflitos) && citacao.conflitos.length > 0 &&
        citacao.conflitos.every((item) => item && typeof item === "object" && !Array.isArray(item) &&
          Object.keys(item).length === 2 && Object.hasOwn(item, "trecho") && Object.hasOwn(item, "pagina") &&
          typeof item.trecho === "string" && !!item.trecho.trim() && paginaValida(item.pagina))) {
      return {
        status: "contraditorio", trecho: citacao.trecho, pagina: citacao.pagina,
        conflitos: citacao.conflitos.map(({ trecho, pagina }) => ({ trecho, pagina }))
      };
    }
    return null;
  }

  function eCitacaoValida(citacao) {
    return citacao?.status === "encontrado" && typeof citacao.trecho === "string" &&
      !!citacao.trecho.trim() && paginaValida(citacao.pagina);
  }

  function sugestaoNatureza(dados, alertas, origens, rastros) {
    let api;
    if (typeof module === "object" && module.exports) api = require("./core/natureza.js");
    else api = globalThis.CalcPenNatureza;
    return api?.aplicarSugestoes
      ? api.aplicarSugestoes(dados, alertas, origens, rastros)
      : { origens, rastros, alertas };
  }

  function normalizarV2(resposta) {
    const dados = JSON.parse(JSON.stringify(resposta));
    const citacoesBrutas = dados.citacoes && typeof dados.citacoes === "object" && !Array.isArray(dados.citacoes)
      ? dados.citacoes : {};
    const citacoes = Object.fromEntries(Object.entries(citacoesBrutas)
      .map(([caminho, citacao]) => [caminho, citacaoSegura(citacao)]));
    delete dados.citacoes;
    const pendencias = [];
    const recusados = [];
    const alertas = [];
    const erros = [];
    const origens = {};
    const rastros = {};
    if (!resposta.citacoes || typeof resposta.citacoes !== "object" || Array.isArray(resposta.citacoes)) {
      return { erro: erro("citacoes", "Informe um mapa de citações por campo.") };
    }
    (Array.isArray(dados.condenacoes) ? dados.condenacoes : []).forEach((item, indice) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return;
      if (Object.hasOwn(item, "natureza") || Object.hasOwn(item, "equiparado")) {
        erros.push(erro(`condenacoes[${indice}]`, "Não informe natureza ou equiparação; a calculadora só sugere pela lei e artigo (E99/I17)."));
        delete item.natureza;
        delete item.equiparado;
      }
    });
    if (dados.pendencias !== undefined && !Array.isArray(dados.pendencias)) {
      erros.push(erro("pendencias", "Informe uma lista de textos de pendência."));
      delete dados.pendencias;
    }
    const campos = [];
    listarValores(dados, "", (caminho, valor) => campos.push({ caminho, valor }));
    campos.forEach(({ caminho, valor }) => {
      const citacao = citacaoDoCampo(caminho, citacoes);
      const naoEncontrado = textoNaoEncontrado(valor) || citacao?.status === "nao_encontrado";
      if (naoEncontrado || !eCitacaoValida(citacao) || citacao.status === "contraditorio") {
        removerNoCaminho(dados, caminho);
        const motivo = naoEncontrado ? "não encontrado" :
          citacao?.status === "contraditorio" ? "informação contraditória" : "sem trecho literal";
        const pendencia = `${caminho}: ${motivo}; não importado. Preencha manualmente após conferir o documento.`;
        pendencias.push(pendencia);
        recusados.push({ campo: caminho, citacao, motivo });
      } else {
        rastros[caminho] = citacao;
        const pagina = citacao.pagina === null ? "" : `, página ${citacao.pagina}`;
        origens[caminho] = `${ORIGEM_PADRAO}${pagina}`;
      }
    });
    const caminhosDados = campos.map((item) => item.caminho);
    Object.entries(citacoes).forEach(([caminho, citacao]) => {
      if (!caminhosDados.includes(caminho) &&
          !recusados.some((item) => item.campo === caminho)) {
        const motivo = citacao?.status === "nao_encontrado" ? "não encontrado" :
          citacao?.status === "contraditorio" ? "informação contraditória" : "valor não informado";
        const pendencia = `${caminho}: ${motivo}; preencha manualmente após conferir o documento.`;
        pendencias.push(pendencia);
        recusados.push({ campo: caminho, citacao, motivo });
      }
    });
    (dados.condenacoes || []).forEach((item, indice) => {
      ["pena", "penaRestante"].forEach((campo) => {
        if (item[campo] && ["anos", "meses", "dias"].some((parte) => item[campo][parte] === undefined)) {
          delete item[campo];
          const caminho = `condenacoes[${indice}].${campo}`;
          pendencias.push(`${caminho}: incompleta; preencha manualmente após conferir o documento.`);
          recusados.push({ campo: caminho, citacao: null, motivo: "campo incompleto" });
        }
      });
    });
    const resultadoNatureza = sugestaoNatureza(dados, alertas, origens, rastros);
    Object.keys(resultadoNatureza.rastros).forEach((caminho) => {
      if (/^condenacoes\[\d+\]\.(?:natureza|equiparado)$/.test(caminho)) {
        const origem = resultadoNatureza.origens[caminho];
        resultadoNatureza.rastros[caminho] = {
          ...resultadoNatureza.rastros[caminho],
          status: "sugestao",
          ...(origem?.regraId ? { regraId: origem.regraId } : {})
        };
        if (origem && typeof origem === "object" && typeof origem.origem === "string") {
          resultadoNatureza.origens[caminho] =
            `${origem.origem} (${origem.regraId}; ${origem.status})`;
        }
      }
    });
    dados.pendencias = [...new Set([...(Array.isArray(dados.pendencias) ? dados.pendencias : []), ...pendencias,
      ...resultadoNatureza.alertas])];
    return {
      dados, citacoes, rastros: { ...citacoes, ...resultadoNatureza.rastros }, origens: resultadoNatureza.origens,
      alertas: resultadoNatureza.alertas, recusados, erros
    };
  }

  function validarLista(dados, nome, propriedades, validadores, erros) {
    if (dados[nome] === undefined) return;
    if (!Array.isArray(dados[nome])) {
      erros.push(erro(nome, "Informe uma lista válida."));
      return;
    }
    dados[nome].forEach((item, indice) => {
      const campo = `${nome}[${indice}]`;
      if (validarObjeto(item, campo, erros)) {
        validarPropriedades(item, propriedades, campo, erros);
        validarOrigem(item, campo, erros);
        validadores(item, campo, erros);
      }
    });
  }

  // I15: com { local: true } (PDF ou texto lido neste navegador), campos a mais são preservados,
  // a origem vem do mapa de fontes do leitor e dados obrigatórios ausentes viram pendências.
  function validar(dados, opcoes = {}) {
    modoLocal = opcoes.local === true;
    modoEstrito = opcoes.estrito === true;
    versaoEsperada = opcoes.versao === 2 ? 2 : 1;
    const ausencias = [];
    registrarAusencia = modoEstrito ? (campo, motivo) =>
      ausencias.push(`${campo}: ${motivo}; informe manualmente após conferir o documento.`) : null;
    try {
      const resultado = validarDados(dados);
      resultado.pendenciasLocais = [...(resultado.pendenciasLocais || []), ...ausencias];
      return resultado;
    } finally {
      modoLocal = false;
      modoEstrito = false;
      versaoEsperada = 1;
      registrarAusencia = null;
    }
  }

  function validarDados(dados) {
    const erros = [];
    const pendenciasLocais = [];
    const local = modoLocal;
    const ausente = (valor) => valor === undefined || valor === null || valor === "";
    if (!validarObjeto(dados, "resposta", erros)) return { valido: false, erros, dados: null };
    validarPropriedades(dados, ["formato", "versao", "processo", "condenacoes", "prisoes", "interrupcoes", "detracoes", "remicoes", "comutacoes", "faltasGraves", "progressoes", "regimeAtual", "atestadoSEEU", "pendencias", "observacoes"], "", erros);
    if (dados.formato !== FORMATO) erros.push(erro("formato", `Use "${FORMATO}".`));
    if (dados.versao !== versaoEsperada) erros.push(erro("versao", `Use a versão ${versaoEsperada}.`));

    if (local && Array.isArray(dados.condenacoes) && dados.condenacoes.length === 0) {
      pendenciasLocais.push("Nenhuma condenação lida do documento: acrescente cada condenação antes de calcular.");
    } else if (!Array.isArray(dados.condenacoes) || dados.condenacoes.length === 0) {
      erros.push(erro("condenacoes", "Informe ao menos uma condenação."));
    } else {
      dados.condenacoes.forEach((item, indice) => {
        const campo = `condenacoes[${indice}]`;
        if (!validarObjeto(item, campo, erros)) return;
        validarPropriedades(item, ["id", "processo", "dataFato", "dataTransitoAcusacao", "dataTransito", "idadeNaDataFato", "idadeNaSentenca", "pena", "penaRestante", "natureza", "equiparado", "lei", "artigo", "paragrafo", "violencia", "resultadoMorte", "reincidencia", "antecedenteViolento", "lei15358LC", "bonsAntecedentes", "regimeInicial", "origem"], campo, erros);
        validarOrigem(item, campo, erros);
        if (typeof item.id !== "string" || !item.id.trim()) erros.push(erro(`${campo}.id`, "Informe um identificador."));
        const nome = indice + 1;
        const faltando = (chave, texto) => {
          if (!local || !ausente(item[chave])) return false;
          // Não repete a pendência que o leitor já registrou para o mesmo campo.
          const jaAvisado = (dados.pendencias || []).some((p) => typeof p === "string" &&
            (p.startsWith(`${campo}.${chave}:`) ||
              [nome, item.id].some((id) => p.startsWith(`Condenação ${id}: ${texto} `))));
          if (!jaAvisado) pendenciasLocais.push(`Condenação ${nome}: ${texto} não consta do documento; informe antes de calcular.`);
          return true;
        };
        if (!faltando("dataFato", "data do fato")) validarData(item.dataFato, `${campo}.dataFato`, erros);
        if (!faltando("natureza", "natureza do crime")) validarEnumeracao(item.natureza, ENUMERACOES.natureza, `${campo}.natureza`, erros);
        if (!faltando("reincidencia", "reincidência")) validarEnumeracao(item.reincidencia, ENUMERACOES.reincidencia, `${campo}.reincidencia`, erros);
        if (item.antecedenteViolento !== undefined) {
          validarEnumeracao(item.antecedenteViolento, ENUMERACOES.antecedenteViolento, `${campo}.antecedenteViolento`, erros);
        }
        if (item.lei15358LC !== undefined) {
          validarEnumeracao(item.lei15358LC, ENUMERACOES.lei15358LC, `${campo}.lei15358LC`, erros);
        }
        if (!faltando("regimeInicial", "regime inicial")) validarEnumeracao(item.regimeInicial, ENUMERACOES.regimeInicial, `${campo}.regimeInicial`, erros);
        if (!faltando("equiparado", "equiparação a hediondo") && typeof item.equiparado !== "boolean") erros.push(erro(`${campo}.equiparado`, "Informe verdadeiro ou falso."));
        if (local && item.bonsAntecedentes === undefined) {
          pendenciasLocais.push(`Condenação ${nome}: bons antecedentes não constam do documento; informe se forem relevantes.`);
        } else if (typeof item.bonsAntecedentes !== "boolean" && item.bonsAntecedentes !== null) {
          erros.push(erro(`${campo}.bonsAntecedentes`, "Informe verdadeiro, falso ou null."));
        }
        ["violencia", "resultadoMorte"].forEach((chave) => {
          if (item[chave] !== undefined && typeof item[chave] !== "boolean") {
            erros.push(erro(`${campo}.${chave}`, "Informe verdadeiro ou falso."));
          }
        });
        if (item.dataTransitoAcusacao !== undefined) validarData(item.dataTransitoAcusacao, `${campo}.dataTransitoAcusacao`, erros);
        if (item.dataTransito !== undefined) validarData(item.dataTransito, `${campo}.dataTransito`, erros);
        ["idadeNaDataFato", "idadeNaSentenca"].forEach((campoIdade) => {
          if (item[campoIdade] !== undefined) validarInteiro(item[campoIdade], `${campo}.${campoIdade}`, erros);
        });
        if (faltando("pena", "pena")) return;
        if (!validarObjeto(item.pena, `${campo}.pena`, erros)) return;
        validarPropriedades(item.pena, ["anos", "meses", "dias"], `${campo}.pena`, erros);
        ["anos", "meses", "dias"].forEach((parte) => validarInteiro(item.pena[parte], `${campo}.pena.${parte}`, erros));
        if (item.penaRestante !== undefined && validarObjeto(item.penaRestante, `${campo}.penaRestante`, erros)) {
          validarPropriedades(item.penaRestante, ["anos", "meses", "dias"], `${campo}.penaRestante`, erros);
          ["anos", "meses", "dias"].forEach((parte) => validarInteiro(item.penaRestante[parte], `${campo}.penaRestante.${parte}`, erros));
        }
      });
    }

    validarLista(dados, "prisoes", ["inicio", "fim", "tipo", "origem"], (item, campo, errosLista) => {
      validarData(item.inicio, `${campo}.inicio`, errosLista);
      validarData(item.fim, `${campo}.fim`, errosLista, true);
      validarEnumeracao(item.tipo, ENUMERACOES.tipoPrisao, `${campo}.tipo`, errosLista);
    }, erros);
    validarLista(dados, "interrupcoes", ["inicio", "fim", "motivo", "origem"], (item, campo, errosLista) => {
      validarData(item.inicio, `${campo}.inicio`, errosLista);
      validarData(item.fim, `${campo}.fim`, errosLista, true);
      if (item.motivo === undefined && registrarAusencia) registrarAusencia(`${campo}.motivo`, "motivo não encontrado");
      else if (typeof item.motivo !== "string" || !item.motivo.trim()) errosLista.push(erro(`${campo}.motivo`, "Informe o motivo."));
    }, erros);
    validarLista(dados, "detracoes", ["inicio", "fim", "origem"], (item, campo, errosLista) => {
      validarData(item.inicio, `${campo}.inicio`, errosLista);
      validarData(item.fim, `${campo}.fim`, errosLista, true);
    }, erros);
    validarLista(dados, "remicoes", ["dias", "homologada", "dataHomologacao", "origem"], (item, campo, errosLista) => {
      validarInteiro(item.dias, `${campo}.dias`, errosLista);
      if (item.homologada === undefined && registrarAusencia) registrarAusencia(`${campo}.homologada`, "homologação não encontrada");
      else if (typeof item.homologada !== "boolean") errosLista.push(erro(`${campo}.homologada`, "Informe verdadeiro ou falso."));
      if (item.dataHomologacao !== undefined) validarData(item.dataHomologacao, `${campo}.dataHomologacao`, errosLista, true);
    }, erros);
    validarLista(dados, "comutacoes", ["dias", "decreto", "dataDecisao", "condenacaoId", "origem"], (item, campo, errosLista) => {
      if (item.dias === undefined && registrarAusencia) {
        registrarAusencia(`${campo}.dias`, "dias não encontrados");
      } else if (!Number.isSafeInteger(item.dias) || item.dias <= 0) {
        errosLista.push(erro(`${campo}.dias`, "Dias abatidos: informe um número inteiro maior que zero."));
      }
      if (item.decreto === undefined && registrarAusencia) registrarAusencia(`${campo}.decreto`, "decreto não encontrado");
      else if (typeof item.decreto !== "string" || !item.decreto.trim()) {
        errosLista.push(erro(`${campo}.decreto`, "Informe o decreto citado na decisão de comutação."));
      }
      validarData(item.dataDecisao, `${campo}.dataDecisao`, errosLista);
      if (item.condenacaoId !== undefined &&
          (typeof item.condenacaoId !== "string" || !item.condenacaoId.trim())) {
        errosLista.push(erro(`${campo}.condenacaoId`, "Informe o ID da condenação ou omita o campo para abatimento global."));
      }
    }, erros);
    validarLista(dados, "faltasGraves", ["data", "tipo", "dataRecaptura", "diasPerdidosRemicao", "homologada", "saldosCondenacoes", "origem"], (item, campo, errosLista) => {
      validarData(item.data, `${campo}.data`, errosLista);
      validarEnumeracao(item.tipo, ENUMERACOES.tipoFalta, `${campo}.tipo`, errosLista);
      if (item.dataRecaptura !== undefined) validarData(item.dataRecaptura, `${campo}.dataRecaptura`, errosLista, true);
      if (item.diasPerdidosRemicao !== undefined) validarInteiro(item.diasPerdidosRemicao, `${campo}.diasPerdidosRemicao`, errosLista);
      if (item.homologada === undefined && registrarAusencia) registrarAusencia(`${campo}.homologada`, "homologação não encontrada");
      else if (typeof item.homologada !== "boolean") errosLista.push(erro(`${campo}.homologada`, "Informe verdadeiro ou falso."));
      if (item.saldosCondenacoes !== undefined) {
        if (!Array.isArray(item.saldosCondenacoes)) {
          errosLista.push(erro(`${campo}.saldosCondenacoes`, "Informe uma lista de saldos por condenação."));
        } else {
          item.saldosCondenacoes.forEach((saldo, indice) => {
            const campoSaldo = `${campo}.saldosCondenacoes[${indice}]`;
            if (!validarObjeto(saldo, campoSaldo, errosLista)) return;
            validarPropriedades(saldo, ["condenacaoId", "dias", "origem"], campoSaldo, errosLista);
            validarOrigem(saldo, campoSaldo, errosLista);
            if (typeof saldo.condenacaoId !== "string" || !saldo.condenacaoId.trim()) {
              errosLista.push(erro(`${campoSaldo}.condenacaoId`, "Informe o código da condenação."));
            }
            validarInteiro(saldo.dias, `${campoSaldo}.dias`, errosLista);
          });
        }
      }
    }, erros);
    validarLista(dados, "progressoes", ["data", "dataRequisitoSubjetivo", "dataBaseReconhecida", "para", "origem"], (item, campo, errosLista) => {
      validarData(item.data, `${campo}.data`, errosLista);
      if (item.dataRequisitoSubjetivo !== undefined) {
        validarData(item.dataRequisitoSubjetivo, `${campo}.dataRequisitoSubjetivo`, errosLista, true);
      }
      if (item.dataBaseReconhecida !== undefined) {
        validarData(item.dataBaseReconhecida, `${campo}.dataBaseReconhecida`, errosLista, true);
      }
      validarEnumeracao(item.para, ENUMERACOES.para, `${campo}.para`, errosLista);
    }, erros);

    if (dados.regimeAtual !== undefined) validarEnumeracao(dados.regimeAtual, ENUMERACOES.regimeAtual, "regimeAtual", erros);
    if (dados.pendencias !== undefined && (!Array.isArray(dados.pendencias) || dados.pendencias.some((p) => typeof p !== "string" || !p.trim()))) {
      erros.push(erro("pendencias", "Informe uma lista de textos de pendência."));
    }
    if (dados.observacoes !== undefined && typeof dados.observacoes !== "string") erros.push(erro("observacoes", "Informe um texto."));
    if (dados.processo !== undefined && typeof dados.processo !== "string") erros.push(erro("processo", "Informe um texto."));

    if (dados.atestadoSEEU !== undefined && (!local || modoEstrito)) {
      const campo = "atestadoSEEU";
      if (validarObjeto(dados.atestadoSEEU, campo, erros)) {
        validarPropriedades(dados.atestadoSEEU, ["dataEmissao", "progressao", "livramento", "termino", "penaTotalDias", "penaCumpridaDias", "remicaoDias", "detracaoDias", "origem"], campo, erros);
        validarOrigem(dados.atestadoSEEU, campo, erros);
        ["dataEmissao", "progressao", "livramento", "termino"].forEach((chave) => {
          if (dados.atestadoSEEU[chave] !== undefined) validarData(dados.atestadoSEEU[chave], `${campo}.${chave}`, erros, true);
        });
        ["penaTotalDias", "penaCumpridaDias", "remicaoDias", "detracaoDias"].forEach((chave) => {
          const valor = dados.atestadoSEEU[chave];
          if (valor !== undefined && valor !== null) validarInteiro(valor, `${campo}.${chave}`, erros);
        });
      }
    }

    return { valido: erros.length === 0, erros, dados: erros.length === 0 ? dados : null, pendenciasLocais };
  }

  function proximoObjeto(texto, inicio) {
    let profundidade = 0;
    let string = false;
    let escape = false;
    for (let indice = inicio; indice < texto.length; indice += 1) {
      const caractere = texto[indice];
      if (string) {
        if (escape) escape = false;
        else if (caractere === "\\") escape = true;
        else if (caractere === '"') string = false;
      } else if (caractere === '"') string = true;
      else if (caractere === "{") profundidade += 1;
      else if (caractere === "}" && --profundidade === 0) return texto.slice(inicio, indice + 1);
    }
    return null;
  }

  function extrairBloco(texto) {
    if (typeof texto !== "string" || !texto.trim()) return { erro: "Cole a resposta do Copilot." };
    const blocos = [...texto.matchAll(/```json\s*([\s\S]*?)```/gi)];
    if (blocos.length > 1) return { erro: "A resposta tem mais de um bloco JSON. Cole apenas um." };
    if (blocos.length === 1) return { json: blocos[0][1].trim() };
    try {
      JSON.parse(texto.trim());
      return { json: texto.trim() };
    } catch (_) {
      const inicio = texto.indexOf("{");
      const bloco = inicio < 0 ? null : proximoObjeto(texto, inicio);
      if (bloco) {
        const restante = texto.slice(inicio + bloco.length);
        const inicioSeguinte = restante.indexOf("{");
        const blocoSeguinte = inicioSeguinte < 0 ? null : proximoObjeto(restante, inicioSeguinte);
        if (blocoSeguinte) {
          try {
            JSON.parse(blocoSeguinte);
            return { erro: "A resposta tem mais de um bloco JSON. Cole apenas um." };
          } catch (_) {}
        }
        return { json: bloco };
      }
      return { erro: "Não encontrei um bloco JSON. Cole a resposta completa do Copilot." };
    }
  }

  function analisar(texto, opcoes = {}) {
    const bloco = extrairBloco(texto);
    if (bloco.erro) return { valido: false, erros: [erro("resposta", bloco.erro)], pendencias: [] };
    let dados;
    try {
      dados = JSON.parse(bloco.json);
    } catch (_) {
      return { valido: false, erros: [erro("JSON", "O bloco está malformado. Corrija a resposta antes de importar.")], pendencias: [] };
    }
    if (dados?.formato === FORMATO && dados.versao === 1 && !opcoes.local) {
      return {
        valido: false, dados: null, pendencias: [],
        erros: [erro("versao", "Este é o formato antigo calcpenal-copilot-v1. Use o agente atualizado, que gera calcpenal-copilot v2 com trechos e páginas.")]
      };
    }
    if (dados?.formato === FORMATO && dados.versao === 2) {
      const normalizada = normalizarV2(dados);
      if (normalizada.erro) {
        return { valido: false, dados: null, erros: [normalizada.erro], pendencias: [] };
      }
      const resultado = validar(normalizada.dados, { local: true, estrito: true, versao: 2 });
      const erros = [...resultado.erros, ...(normalizada.erros || [])];
      const pendencias = [...new Set([
        ...(normalizada.dados.pendencias || []),
        ...resultado.pendenciasLocais
      ])];
      return {
        ...resultado,
        valido: erros.length === 0,
        erros,
        dados: erros.length === 0 ? normalizada.dados : null,
        pendencias,
        citacoes: normalizada.citacoes,
        rastros: normalizada.rastros,
        origens: normalizada.origens,
        alertas: normalizada.alertas,
        recusados: normalizada.recusados
      };
    }
    const resultado = validar(dados, opcoes);
    const pendencias = resultado.valido ? [...new Set([...(dados.pendencias || []), ...resultado.pendenciasLocais])] : [];
    return { ...resultado, pendencias };
  }

  function iniciarImportacao(dados, fontes, origemPadrao = ORIGEM_PADRAO, opcoes = {}) {
    const copiados = JSON.parse(JSON.stringify(dados));
    const origens = {};
    const campos = [];
    listarCampos(copiados, "", origemPadrao, campos);
    campos.forEach((item) => { origens[item.campo] = origemDoCampo(item.campo, fontes) || item.origem; });
    return {
      dados: copiados, origens, status: "a_conferir",
      ...(opcoes.rastros ? { rastros: opcoes.rastros } : {}),
      ...(opcoes.requerRevisao ? { requerRevisao: true } : {}),
      ...(opcoes.reutilizarRascunho ? { reutilizarRascunho: true } : {}),
      ...(opcoes.alertas ? { alertas: opcoes.alertas } : {})
    };
  }

  function origemDoCampo(campo, fontes) {
    let caminho = campo;
    while (caminho) {
      if (typeof fontes?.[caminho] === "string") return fontes[caminho];
      const pai = caminho.replace(/(?:\.[^.[]+|\[\d+\])$/, "");
      if (pai === caminho) break;
      caminho = pai;
    }
    return null;
  }

  function concluirRevisao(importacao) {
    return { ...importacao, status: "revisado" };
  }

  function podeCalcular(importacao) {
    return importacao?.requerRevisao !== true || importacao.status === "revisado";
  }

  function criarElemento(documento, tag, texto, classe) {
    const elemento = documento.createElement(tag);
    if (texto !== undefined) elemento.textContent = texto;
    if (classe) elemento.className = classe;
    return elemento;
  }

  function listarCampos(valor, caminho, origem, campos) {
    if (Array.isArray(valor)) {
      valor.forEach((item, indice) => listarCampos(item, `${caminho}[${indice}]`, origem, campos));
    } else if (valor && typeof valor === "object") {
      const fonte = typeof valor.origem === "string" && valor.origem.trim() ? valor.origem : origem;
      Object.entries(valor).forEach(([chave, item]) => {
        if (chave !== "origem") listarCampos(item, caminho ? `${caminho}.${chave}` : chave, fonte, campos);
      });
    } else {
      campos.push({ campo: caminho, valor: valor === null ? "Não informado" : String(valor), origem });
    }
  }

  function textoCitacao(citacao) {
    if (!citacao) return "Sem trecho literal — não importado.";
    const formatarTrecho = (item) =>
      `${item.pagina === null ? "Página não indicada" : `Página ${item.pagina}`}: ${item.trecho}`;
    if (citacao.status === "nao_encontrado") return "Trecho não encontrado — preencha manualmente.";
    if (citacao.status === "contraditorio") {
      return `Contradição: ${[citacao, ...(citacao.conflitos || [])].map(formatarTrecho).join(" / ")}`;
    }
    return formatarTrecho(citacao);
  }

  function renderizar(container, opcoes) {
    const documento = container.ownerDocument;
    const callbacks = opcoes || {};
    container.replaceChildren();
    const painel = criarElemento(documento, "section", undefined, "importar-copilot");
    const titulo = criarElemento(documento, "h2", "Importar do Copilot");
    const instrucao = criarElemento(documento, "p", "Cole a resposta do Copilot para conferir os dados e suas fontes antes de preencher.");
    const rotulo = criarElemento(documento, "label");
    const textoRotulo = criarElemento(documento, "span", "Resposta do Copilot");
    const texto = criarElemento(documento, "textarea");
    texto.rows = 10;
    texto.setAttribute("aria-label", "Resposta do Copilot");
    rotulo.append(textoRotulo, texto);
    const validarBotao = criarElemento(documento, "button", "Validar e conferir", "q-btn");
    validarBotao.type = "button";
    const resultado = criarElemento(documento, "div");
    resultado.setAttribute("aria-live", "polite");
    const confirmacao = criarElemento(documento, "button", "Preencher campos", "q-btn");
    confirmacao.type = "button";
    confirmacao.hidden = true;
    const revisar = criarElemento(documento, "button", "Concluí a revisão", "q-btn q-btn-outline");
    revisar.type = "button";
    revisar.hidden = true;
    let validacaoAtual;
    let importacaoAtual;
    let fontesAtuais = {};
    let fontesOriginais = {};
    let camposOriginais = new Map();
    let importacaoLocal = false;
    let revisaoObrigatoria = false;
    let citacoesOriginais = {};

    validarBotao.addEventListener("click", () => {
      resultado.replaceChildren();
      confirmacao.hidden = true;
      revisar.hidden = true;
      validacaoAtual = analisar(texto.value, { local: importacaoLocal });
      if (!validacaoAtual.valido) {
        const lista = criarElemento(documento, "ul");
        validacaoAtual.erros.forEach((item) => {
          lista.append(criarElemento(documento, "li", `${textos.campo(item.campo)}: ${item.mensagem}`));
        });
        resultado.append(criarElemento(documento, "p", "Não foi possível importar. Corrija os campos indicados.", "erro"));
        resultado.append(lista);
        return;
      }
      if (revisaoObrigatoria) {
        validacaoAtual.citacoes = citacoesOriginais;
        validacaoAtual.rastros = citacoesOriginais;
      }
      const usaCitacoes = validacaoAtual.dados.versao === 2 || revisaoObrigatoria;
      const tabela = criarElemento(documento, "table", undefined, "q-tabela");
      const cabecalho = criarElemento(documento, "tr");
      ["Campo", "Dado", "Origem", ...(usaCitacoes ? ["Trecho e página"] : [])]
        .forEach((textoCabecalho) => cabecalho.append(criarElemento(documento, "th", textoCabecalho)));
      const cabecalhoTabela = criarElemento(documento, "thead");
      cabecalhoTabela.append(cabecalho);
      tabela.append(cabecalhoTabela);
      const corpo = criarElemento(documento, "tbody");
      const campos = [];
      listarCampos(validacaoAtual.dados, "", importacaoLocal ? "Documento importado — confira a origem" : ORIGEM_PADRAO, campos);
      fontesAtuais = { ...fontesOriginais, ...(validacaoAtual.origens || {}) };
      if (importacaoLocal) {
        campos.forEach((item) => {
          if (camposOriginais.get(item.campo) !== item.valor) {
            fontesAtuais[item.campo] = "Informado pelo usuário — conferir com o documento";
          }
        });
      }
      campos.forEach((item) => {
        if (/^(formato|versao|pendencias(?:\[|$))/.test(item.campo)) return;
        const linha = criarElemento(documento, "tr");
        const naturezaProvisoria = /condenacoes\[\d+\]\.(?:natureza|equiparado)$/.test(item.campo);
        linha.append(criarElemento(documento, "td", textos.campo(item.campo)));
        linha.append(criarElemento(documento, "td", item.valor));
        linha.append(criarElemento(documento, "td", naturezaProvisoria
          ? "Sugestão provisória E99/I17 — a conferir"
          : origemDoCampo(item.campo, fontesAtuais) || item.origem, "origem-item"));
        if (usaCitacoes) {
          const citacao = citacaoDoCampo(item.campo, validacaoAtual.citacoes || {});
          linha.append(criarElemento(documento, "td", citacao
            ? textoCitacao(citacao)
            : naturezaProvisoria ? "Sugestão provisória E99/I17 — confira a capitulação."
              : "Campo interno — confira os dados.", "origem-item"));
        }
        corpo.append(linha);
      });
      if (usaCitacoes && validacaoAtual.recusados?.length) {
        const vistos = new Set();
        validacaoAtual.recusados.forEach((item) => {
          if (vistos.has(item.campo)) return;
          vistos.add(item.campo);
          const linha = criarElemento(documento, "tr");
          linha.append(criarElemento(documento, "td", textos.campo(item.campo)));
          linha.append(criarElemento(documento, "td", "Não importado — preencher manualmente."));
          linha.append(criarElemento(documento, "td", "Campo recusado", "origem-item"));
          linha.append(criarElemento(documento, "td", textoCitacao(item.citacao), "origem-item"));
          corpo.append(linha);
        });
      }
      tabela.append(corpo);
      resultado.append(criarElemento(documento, "p", "Confira cada dado e sua origem.", "nota"));
      resultado.append(tabela);
      const pendentes = textos.pendencias(validacaoAtual.pendencias, validacaoAtual.dados);
      if (pendentes.length) {
        const pendencias = criarElemento(documento, "ul");
        pendentes.forEach((item) => pendencias.append(criarElemento(documento, "li", item)));
        resultado.append(criarElemento(documento, "h3", "Pendências"));
        resultado.append(pendencias);
      }
      const avisosNovos = (validacaoAtual.alertas || []).filter((item) => !pendentes.includes(item));
      if (avisosNovos.length) {
        const lista = criarElemento(documento, "ul");
        avisosNovos.forEach((item) => lista.append(criarElemento(documento, "li", item)));
        resultado.append(criarElemento(documento, "h3", "Avisos"));
        resultado.append(lista);
      }
      confirmacao.hidden = false;
    });

    confirmacao.addEventListener("click", () => {
      const requerRevisao = revisaoObrigatoria || validacaoAtual.dados.versao === 2;
      const opcoesImportacao = {
        ...(requerRevisao ? {
          rastros: {
            ...(validacaoAtual.rastros || {}),
            __copilotV2: { requerRevisao: true }
          },
          requerRevisao: true,
          reutilizarRascunho: revisaoObrigatoria
        } : {}),
        ...(validacaoAtual.alertas ? { alertas: validacaoAtual.alertas } : {})
      };
      importacaoAtual = iniciarImportacao(validacaoAtual.dados, fontesAtuais,
        importacaoLocal ? "Documento importado — confira a origem" : ORIGEM_PADRAO, opcoesImportacao);
      if (typeof callbacks.onImport === "function") callbacks.onImport(importacaoAtual);
      resultado.append(criarElemento(documento, "p", "Dados preenchidos — a conferir.", "nota"));
      confirmacao.hidden = true;
      revisar.hidden = false;
    });
    revisar.addEventListener("click", () => {
      importacaoAtual = concluirRevisao(importacaoAtual);
      if (typeof callbacks.onReview === "function") callbacks.onReview(importacaoAtual);
      resultado.append(criarElemento(documento, "p", "Revisão concluída.", "nota"));
      revisar.hidden = true;
    });

    painel.append(titulo, instrucao, rotulo, validarBotao, resultado, confirmacao, revisar);
    container.append(painel);
    // I01/E93: PDF e texto passam pela mesma validação e conferência do Copilot.
    painel.carregar = (dados, origens, opcoesCarregamento = {}) => {
      fontesOriginais = { ...origens };
      importacaoLocal = !!origens;
      revisaoObrigatoria = opcoesCarregamento.requerRevisao === true;
      citacoesOriginais = opcoesCarregamento.citacoes || {};
      titulo.textContent = importacaoLocal ? "Conferir documento importado" : "Importar do Copilot";
      instrucao.textContent = importacaoLocal
        ? "Confira os dados lidos do documento e suas fontes antes de preencher." : "Cole a resposta do Copilot para conferir os dados e suas fontes antes de preencher.";
      texto.setAttribute("aria-label", importacaoLocal ? "Dados do documento importado" : "Resposta do Copilot");
      textoRotulo.textContent = importacaoLocal ? "Dados do documento importado" : "Resposta do Copilot";
      const campos = [];
      listarCampos(dados, "", ORIGEM_PADRAO, campos);
      camposOriginais = new Map(campos.map((item) => [item.campo, item.valor]));
      texto.value = JSON.stringify(dados, null, 2);
      validarBotao.click();
    };
    texto.addEventListener("input", () => {
      confirmacao.hidden = true;
      revisar.hidden = true;
      validacaoAtual = null;
      revisaoObrigatoria = false;
    });
    return painel;
  }

  return { analisar, validar, extrairBloco, iniciarImportacao, concluirRevisao, podeCalcular, renderizar };
});
