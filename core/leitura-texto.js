(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LeituraTexto = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // I01/I02: apenas rótulos explícitos; nenhum enquadramento jurídico ou cálculo.
  const ROTULOS = {
    dataFato: "data (?:do fato|do delito)",
    pena: "pena(?: imposta| aplicada)?",
    lei: "(?:lei|diploma legal)",
    artigo: "(?:artigo(?: da lei)?|art\\.?|capitulacao(?: legal)?|tipificacao(?: penal)?)",
    natureza: "natureza(?: do crime)?",
    violencia: "violencia ou grave ameaca",
    resultadoMorte: "resultado morte",
    reincidencia: "reincidencia",
    antecedenteViolento: "(?:antecedente(?:s)? violentos?|violencia (?:na|da) condenacao anterior|condenacao anterior com violencia(?: ou grave ameaca)?)",
    equiparado: "equiparado",
    bonsAntecedentes: "bons antecedentes",
    regimeInicial: "regime inicial",
    inicio: "data (?:de inicio do cumprimento|da prisao|de prisao)",
    tipo: "tipo de prisao",
    regimeAtual: "regime atual",
    dataEmissao: "data de emissao",
    progressao: "(?:data prevista para |previsao de |data (?:da|de) )?progressao(?: de regime)?",
    livramento: "(?:data prevista para |previsao de |data (?:do|de) )?livramento(?: condicional)?",
    termino: "(?:data prevista para |previsao de |data (?:do|de) )?termino(?: (?:da pena|de pena))?",
    penaTotalDias: "pena total(?: imposta)?",
    penaCumpridaDias: "pena cumprida",
    remicaoDias: "(?:total de |saldo de )?remicao",
    detracaoDias: "(?:total de )?detracao"
  };
  const REGIMES = { fechado: "fechado", semiaberto: "semiaberto", "semi-aberto": "semiaberto", aberto: "aberto" };
  const NATUREZAS = {
    comum: "comum", "sem violencia": "comum", "comum sem violencia": "comum",
    violencia: "violencia", "com violencia ou grave ameaca": "violencia",
    hediondo: "hediondo", "hediondo com resultado morte": "hediondo_morte",
    "trafico privilegiado": "trafico_privilegiado", feminicidio: "feminicidio",
    "comando de organizacao criminosa": "comando_orcrim", milicia: "milicia"
  };
  const REINCIDENCIAS = {
    primario: "primario", generico: "generico", especifico: "especifico",
    "reincidente generico": "generico", "reincidente especifico": "especifico"
  };
  const CAMPOS_CONDENACAO = ["dataFato", "pena", "lei", "artigo", "natureza", "violencia", "resultadoMorte", "reincidencia", "antecedenteViolento", "equiparado", "bonsAntecedentes", "regimeInicial"];
  const normalizar = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  function data(texto) {
    const m = texto.match(/^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/);
    if (!m) return undefined;
    const [, dia, mes, ano] = m;
    const d = new Date(`${ano}-${mes}-${dia}T00:00:00Z`);
    return Number(ano) > 0 && !isNaN(d) && d.toISOString().slice(0, 10) === `${ano}-${mes}-${dia}`
      ? `${ano}-${mes}-${dia}` : undefined;
  }

  function pena(texto) {
    const resultado = { anos: 0, meses: 0, dias: 0 };
    const re = /(\d+)\s*(anos?|a\b|mes(?:es)?|m\b|dias?|d\b)/g;
    let m, encontrou = false;
    const sobra = texto.replace(re, (_, numero, unidade) => {
      const campo = unidade[0] === "a" ? "anos" : unidade[0] === "m" ? "meses" : "dias";
      if (resultado[campo] !== 0 || !Number.isSafeInteger(Number(numero))) return "?";
      resultado[campo] = Number(numero);
      encontrou = true;
      return "";
    });
    m = sobra.replace(/[\s,e.]/g, "");
    return encontrou && !m ? resultado : undefined;
  }

  function converter(campo, texto) {
    texto = texto.trim().replace(/^[\s:]+|[\s;|]+$/g, "");
    if (["dataFato", "inicio", "dataEmissao", "progressao", "livramento", "termino"].includes(campo)) return data(texto);
    if (campo === "pena") return pena(texto);
    if (campo === "lei" || campo === "artigo") return texto;
    if (campo === "natureza") return NATUREZAS[texto];
    if (campo === "violencia" || campo === "resultadoMorte") {
      if (texto === "sim") return true;
      if (texto === "nao") return false;
      return undefined;
    }
    if (campo === "reincidencia") return REINCIDENCIAS[texto];
    if (campo === "antecedenteViolento") {
      if (texto === "sim") return "sim";
      if (texto === "nao") return "nao";
      return ["desconhecido", "nao informado"].includes(texto) ? "desconhecido" : undefined;
    }
    if (campo.startsWith("regime")) return REGIMES[texto];
    if (campo === "tipo") return ["definitiva", "provisoria"].includes(texto) ? texto : undefined;
    if (campo === "equiparado" || campo === "bonsAntecedentes") return texto === "sim" ? true : texto === "nao" ? false : undefined;
    const m = texto.match(/^(\d+|\d{1,3}(?:\.\d{3})+)\s*dias?$/);
    const n = m && Number(m[1].replace(/\./g, ""));
    return m && Number.isSafeInteger(n) ? n : undefined;
  }

  function analisarTexto(texto) {
    return analisarPaginas([{ texto, origem: "Texto colado da tela" }]);
  }

  function analisarPaginas(paginas) {
    const entrada = {
      formato: "calcpen", versao: 1, condenacoes: [], prisoes: [], interrupcoes: [],
      detracoes: [], remicoes: [], faltasGraves: [], progressoes: [],
      atestadoSEEU: {}, pendencias: [], observacoes: ""
    };
    const origens = {}, rastros = {}, conflitos = new Set(), vistos = new Map();
    let condenacao, prisao;
    const pendencia = (mensagem) => {
      if (!entrada.pendencias.includes(mensagem)) entrada.pendencias.push(mensagem);
    };
    function atribuir(alvo, campo, valor, caminho, origem, trecho, pagina) {
      if (conflitos.has(caminho)) return;
      if (valor === undefined || (vistos.has(caminho) && vistos.get(caminho) !== JSON.stringify(valor))) {
        delete alvo[campo];
        delete origens[caminho];
        delete rastros[caminho];
        conflitos.add(caminho);
        pendencia(`${caminho}: dado ilegível, inválido ou divergente. Confira o documento e preencha.`);
        return;
      }
      vistos.set(caminho, JSON.stringify(valor));
      alvo[campo] = valor;
      alvo.origem = alvo.origem || origem;
      origens[caminho] = origem;
      rastros[caminho] = { trecho, ...(Number.isInteger(pagina) ? { pagina } : {}) };
    }
    const pares = Object.entries(ROTULOS).filter(([campo]) => campo !== "pena");
    pares.push(["pena", ROTULOS.pena]);
    const marcador = "(?:condenacao(?:\\s+\\d+)?(?!\\s+anterior)|acao penal|processo de conhecimento)";
    const padrao = `${marcador}|${pares.map((p) => p[1]).join("|")}`.replace(/ /g, "[ \\t]+");
    const re = new RegExp(`(^|\\n|[;|]|[ \\t]{2,})(${padrao})(?=\\s|:|$)[ \\t]*:?[ \\t]*`, "g");
    let texto = "";
    const fontes = paginas.map((pagina) => {
      const inicio = texto.length;
      texto += normalizar(String(pagina.texto || "")).replace(/\r/g, "").replace(/\u00a0/g, " ") + "\n";
      return {
        inicio, fim: texto.length, origem: pagina.origem || (Number.isInteger(pagina.numero) ? `PDF, página ${pagina.numero}` : "Texto sem paginação"),
        numero: pagina.numero, textoOriginal: String(pagina.texto || "")
      };
    });
    const matches = [...texto.matchAll(re)];
    matches.forEach((match, indice) => {
      const posicao = match.index + match[1].length;
      const fonte = fontes.find((item) => posicao >= item.inicio && posicao < item.fim);
      const origem = fonte.origem;
      const rotulo = match[2].replace(/[ \t]+/g, " ");
      if (new RegExp(`^${marcador}$`).test(rotulo)) {
        condenacao = { id: `c${entrada.condenacoes.length + 1}`, origem };
        entrada.condenacoes.push(condenacao);
        return;
      }
      const par = pares.find((p) => new RegExp(`^(?:${p[1]})$`).test(rotulo));
      if (!par) return;
      const campo = par[0];
      const inicio = match.index + match[0].length;
      const trecho = texto.slice(inicio, matches[indice + 1]?.index ?? texto.length);
      const valor = converter(campo, campo === "pena" ? trecho.replace(/\n/g, " ") : trecho.trimStart().split("\n")[0]);
      const linhasOriginais = fonte.textoOriginal.split(/\r\n?|\n/);
      const linhaOriginal = linhasOriginais.findIndex((linha) =>
        normalizar(linha).replace(/^[\s•*-]+/, "").startsWith(normalizar(rotulo)));
      let evidencia;
      if (linhaOriginal < 0) {
        evidencia = `${rotulo}: ${trecho.trim().split("\n")[0]}`;
      } else {
        const linha = linhasOriginais[linhaOriginal].trim();
        const separador = linha.indexOf(":");
        const valorOriginal = (separador < 0 ? trecho.trim().split("\n")[0] : linha.slice(separador + 1))
          .split(/[ \t]{2,}(?=[^:\n]+:)|[;|][ \t]*(?=[^:\n]+:)/)[0].trim();
        const continuacao = campo === "pena" && linhasOriginais[linhaOriginal + 1] &&
          !linhasOriginais[linhaOriginal + 1].includes(":") ? ` ${linhasOriginais[linhaOriginal + 1].trim()}` : "";
        evidencia = `${separador < 0 ? linha : linha.slice(0, separador).trim()}: ${valorOriginal}${continuacao}`.slice(0, 500);
      }
      let alvo, caminho;
      if (CAMPOS_CONDENACAO.includes(campo)) {
        if (!condenacao) {
          condenacao = { id: `c${entrada.condenacoes.length + 1}`, origem };
          entrada.condenacoes.push(condenacao);
        }
        alvo = condenacao;
        caminho = `condenacoes[${entrada.condenacoes.indexOf(alvo)}].${campo}`;
      } else if (campo === "inicio" || campo === "tipo") {
        if (!prisao) {
          prisao = { fim: null, origem };
          entrada.prisoes.push(prisao);
        }
        alvo = prisao;
        caminho = `prisoes[0].${campo}`;
      } else {
        alvo = campo === "regimeAtual" ? entrada : entrada.atestadoSEEU;
        caminho = campo === "regimeAtual" ? campo : `atestadoSEEU.${campo}`;
      }
      const fonteValor = campo === "pena" ? fontes
        .filter((fonte) => fonte.fim > posicao && fonte.inicio < inicio + trecho.trimEnd().length)
        .map((fonte) => fonte.origem).join("; ") : origem;
      atribuir(alvo, campo, valor, caminho, fonteValor, evidencia, fonte.numero);
    });
    entrada.condenacoes.forEach((c, i) => CAMPOS_CONDENACAO.forEach((campo) => {
      if (c[campo] === undefined) pendencia(`condenacoes[${i}].${campo}: não identificado com segurança. Confira e preencha.`);
    }));
    if (!entrada.condenacoes.length) pendencia("Condenações individuais não identificadas. O total não substitui cada condenação.");
    if (!prisao?.inicio || !prisao?.tipo) pendencia("Prisão: confirme o início e o tipo de cada período; a data-base não é presumida como prisão.");
    pendencia("Confira no documento também prisões, interrupções, detrações, remições e faltas graves: listas vazias não significam ausência de eventos.");
    if (!Object.keys(entrada.atestadoSEEU).length) delete entrada.atestadoSEEU;
    delete entrada.origem;
    return { entrada, origens, rastros };
  }

  // I05: monta linhas pela posição dos trechos de texto do PDF. Os PDFs gerados
  // pelo SEEU e pelo SAJ trazem cada palavra como um trecho separado; juntar na
  // ordem do arquivo quebra rótulos ("Regime Atual:") e mistura colunas.
  // Entrada: páginas como lista de trechos { str, x, y, largura } (ou o formato
  // do pdf.js: { str, transform, width }). Saída: texto com uma linha por
  // altura; colunas separadas por três espaços. Sem DOM e sem dependências.
  const TOLERANCIA_LINHA = 2.5;
  const DISTANCIA_COLUNA = 8;

  function normalizarTrecho(item) {
    if (!item || typeof item.str !== "string") return null;
    const x = Number.isFinite(item.x) ? item.x : item.transform?.[4];
    const y = Number.isFinite(item.y) ? item.y : item.transform?.[5];
    const largura = Number.isFinite(item.largura) ? item.largura : Number(item.width) || 0;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { str: item.str, x, y, largura };
  }

  function montarTextoDeItens(paginas, opcoes = {}) {
    const tolerancia = opcoes.toleranciaLinha ?? TOLERANCIA_LINHA;
    const distancia = opcoes.distanciaColuna ?? DISTANCIA_COLUNA;
    const saida = (paginas || []).map((pagina, indice) => {
      const itens = (Array.isArray(pagina) ? pagina : pagina?.itens || [])
        .map(normalizarTrecho)
        .filter((item) => item && item.str.trim())
        .sort((a, b) => b.y - a.y || a.x - b.x);
      const linhas = [];
      itens.forEach((item) => {
        const linha = linhas[linhas.length - 1];
        if (linha && Math.abs(linha.y - item.y) <= tolerancia) linha.itens.push(item);
        else linhas.push({ y: item.y, itens: [item] });
      });
      const texto = linhas.map(({ itens: daLinha }) => {
        const ordenados = daLinha.sort((a, b) => a.x - b.x);
        return ordenados.map((item, posicao) => {
          if (!posicao) return item.str.trim();
          const anterior = ordenados[posicao - 1];
          const lacuna = item.x - (anterior.x + anterior.largura);
          return (lacuna > distancia ? "   " : " ") + item.str.trim();
        }).join("");
      }).join("\n");
      return { numero: pagina?.numero ?? indice + 1, texto };
    });
    return { paginas: saida, texto: saida.map((pagina) => pagina.texto).join("\n") };
  }

  return { analisarTexto, analisarPaginas, montarTextoDeItens };
});
