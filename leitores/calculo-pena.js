(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./secoes-calculo-pena.json"));
  } else {
    root.LeitorCalculoPena = factory(null);
  }
})(typeof globalThis === "object" ? globalThis : this, function (configuracaoPadrao) {
  "use strict";

  const normalizar = (texto) => String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();

  function escaparRegex(texto) {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function tituloDaLinha(linha) {
    return linha.trim().replace(/^\d{1,2}\s*[.)-]\s*/, "").replace(/:\s*$/, "").trim();
  }

  function correspondeTitulo(linha, secao) {
    const candidato = normalizar(tituloDaLinha(linha));
    return [secao.titulo, ...(secao.variacoes || [])].some((titulo) => {
      const normalizado = normalizar(titulo);
      if (normalizado.includes("{data}")) {
        const [antes, depois] = normalizado.split("{data}");
        return new RegExp(`^${escaparRegex(antes)}\\d{2}/\\d{2}/\\d{4}${escaparRegex(depois)}$`).test(candidato);
      }
      return candidato === normalizado;
    });
  }

  function extrairSecoes(texto, mapa) {
    const linhas = String(texto).replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").split("\n");
    const secoes = [];
    const desconhecidas = [];
    let atual = null;

    linhas.forEach((linha) => {
      const definicao = mapa.find((secao) => correspondeTitulo(linha, secao));
      const titulo = tituloDaLinha(linha);
      const numerada = /^\s*\d{1,2}\s*[.)-]\s*\S/.test(linha);
      if (definicao || numerada) {
        atual = { titulo, chave: definicao ? definicao.chave : null, linhas: [] };
        secoes.push(atual);
        if (!definicao) desconhecidas.push(titulo);
        return;
      }
      if (atual) atual.linhas.push(linha);
    });

    return {
      secoes: secoes.map(({ titulo, chave, linhas: corpo }) => ({
        titulo,
        chave,
        texto: corpo.join("\n").trim()
      })),
      desconhecidas
    };
  }

  function valorDaLinha(linha) {
    const posicao = linha.indexOf(":");
    return (posicao < 0 ? linha : linha.slice(posicao + 1)).trim();
  }

  function correspondeCampo(campo, texto) {
    const linha = normalizar(texto).replace(/^[\s•*-]+/, "");
    const rotulo = linha.split(":")[0].trim();
    switch (campo) {
      case "datasPrisao":
        return /^(?:data (?:de )?(?:inicio|inicial)(?: da prisao)?|data da prisao|data de recolhimento|prisao em|periodo de prisao|inicio da prisao)$/.test(rotulo);
      case "regime":
        return /^regime(?: atual| de cumprimento)?$/.test(rotulo);
      case "penasPorProcesso":
        return /^(?:pena(?: aplicada| imposta| total)?|reclusao|detencao)$/.test(rotulo);
      case "remicao":
        return /^(?:remicao|total de dias remidos|dias remidos|saldo de remicao)$/.test(rotulo);
      case "faltas":
        return /^(?:falta(?: disciplinar| grave)?|data da falta(?: grave)?|faltas disciplinares)$/.test(rotulo);
      case "dataBase":
        return /^data[- ]base(?: considerada)?$/.test(rotulo);
      default:
        return false;
    }
  }

  function secaoPermiteCampo(campo, chave) {
    const permitidas = {
      datasPrisao: ["dados-prisao", "periodos-prisao"],
      regime: ["dados-prisao", "historico-regimes", "controle-pena"],
      penasPorProcesso: ["dados-sentenca", "processos-somados"],
      remicao: ["remicao"],
      faltas: ["faltas-disciplinares"],
      dataBase: ["dados-prisao", "historico-regimes", "controle-pena"]
    };
    return permitidas[campo].includes(chave);
  }

  function extrairDados(secoes) {
    const dados = {
      datasPrisao: [],
      regime: [],
      penasPorProcesso: [],
      remicao: [],
      faltas: [],
      dataBase: []
    };
    const faltantes = [];

    secoes.forEach((secao) => {
      if (!secao.chave) return;
      let processoAtual = null;
      secao.texto.split("\n").forEach((linha) => {
        const texto = linha.trim();
        if (!texto) return;
        if (
          ["dados-sentenca", "processos-somados"].includes(secao.chave) &&
          /^(?:processo|numero do processo|processo de conhecimento|processo somado)\s*:/i.test(normalizar(texto))
        ) {
          processoAtual = { valor: valorDaLinha(texto), trecho: texto };
        }
        Object.keys(dados).forEach((campo) => {
          if (!secaoPermiteCampo(campo, secao.chave) || !correspondeCampo(campo, texto)) return;
          const valor = valorDaLinha(texto);
          if (/^(?:nao legivel|ilegivel|nao identificado|sem leitura)$/i.test(normalizar(valor))) return;
          const item = {
            valor,
            trecho: texto,
            secao: secao.titulo,
            status: "a conferir"
          };
          if (campo === "penasPorProcesso") item.processo = processoAtual;
          dados[campo].push(item);
        });
      });
    });

    Object.entries(dados).forEach(([campo, valores]) => {
      if (!valores.length) faltantes.push(campo);
    });
    return { dados, faltantes };
  }

  function ler(texto, mapa = configuracaoPadrao) {
    if (typeof texto !== "string") throw new TypeError("O texto do relatório deve ser uma string.");
    if (!Array.isArray(mapa) || !mapa.every((secao) =>
      secao && typeof secao.chave === "string" && typeof secao.titulo === "string"
    )) {
      throw new TypeError("O mapa de seções deve ser uma lista válida.");
    }

    const resultado = extrairSecoes(texto, mapa);
    const { dados, faltantes } = extrairDados(resultado.secoes);
    const presentes = new Set(resultado.secoes.map((secao) => secao.chave).filter(Boolean));
    const avisos = [];
    mapa.forEach((secao) => {
      if (!presentes.has(secao.chave)) {
        avisos.push({
          tipo: "secao-ausente",
          chave: secao.chave,
          mensagem: `Seção esperada não encontrada: ${secao.titulo}.`
        });
      }
    });
    resultado.desconhecidas.forEach((titulo) => {
      avisos.push({
        tipo: "titulo-desconhecido",
        titulo,
        mensagem: `Título de seção não reconhecido: ${titulo}.`
      });
    });
    faltantes.forEach((campo) => {
      avisos.push({
        tipo: "campo-nao-lido",
        campo,
        mensagem: `Campo não identificado com segurança: ${campo}. Confira o relatório.`
      });
    });

    return { secoes: resultado.secoes, dados, avisos };
  }

  return { ler };
});
