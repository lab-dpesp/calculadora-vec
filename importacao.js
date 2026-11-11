(function (root, factory) {
  "use strict";
  const api = factory(typeof module === "object" && module.exports
    ? require("./core/leitura-texto.js") : root.LeituraTexto,
  typeof module === "object" && module.exports ? require("./core/leitores/versoes-documentos.js") : root.VersoesDocumentos,
  typeof module === "object" && module.exports ? require("./core/leitores/seeu-relatorio.js") : root.LeitorRelatorioSEEU,
  typeof module === "object" && module.exports ? require("./core/leitores/tjsp-calculo.js") : root.LeitorCalculoTJSP);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ImportacaoLocal = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (leituraTexto, versoes, leitorSEEU, leitorTJSP) {
  "use strict";

  const { analisarPaginas: analisarPaginasCore } = leituraTexto;

  function analisarPaginas(paginas, dataCalculo) {
    const texto = paginas.map((pagina) => pagina.texto || "").join("\n");
    const reconhecimento = versoes?.reconhecer(texto);
    if (reconhecimento?.tipo && !reconhecimento.reconhecido) {
      const alerta = reconhecimento.alerta;
      const dados = {
        formato: "calcpen", versao: 1, condenacoes: [], prisoes: [], interrupcoes: [],
        detracoes: [], remicoes: [], faltasGraves: [], progressoes: [], regressoes: [],
        pendencias: [alerta], observacoes: ""
      };
      return {
        entrada: dados, calcpen: dados, dados, oficial: {}, origens: {}, rastros: {},
        versaoDocumento: { ...reconhecimento, versao: null }, alertas: [alerta]
      };
    }

    if (reconhecimento?.reconhecido) {
      const resultado = reconhecimento.tipo.startsWith("seeu-")
        ? leitorSEEU.ler(texto, paginas, dataCalculo)
        : reconhecimento.tipo.startsWith("tjsp-saj")
          ? leitorTJSP.ler(texto, paginas)
          : null;
      if (!resultado) {
        const generico = analisarPaginasCore(paginas);
        return {
          entrada: generico.entrada, calcpen: generico.entrada, dados: generico.entrada,
          oficial: generico.entrada.atestadoSEEU || {}, origens: generico.origens, rastros: generico.rastros || {},
          versaoDocumento: { ...reconhecimento }, alertas: generico.entrada.pendencias
        };
      }
      const origens = Object.fromEntries(Object.entries(resultado.origens || {}).map(([chave, fonte]) => [
        chave, typeof fonte === "string" ? fonte : fonte.origem || (fonte.pagina ? `PDF, página ${fonte.pagina}` : fonte.secao || "Documento importado")
      ]));
      Object.entries(resultado.rastros || {}).forEach(([campo, rastro]) => {
        if (origens[campo] && !origens[campo].includes("Texto colado da tela")) return;
        origens[campo] = Number.isInteger(rastro.pagina) ? `PDF, página ${rastro.pagina}`
          : paginas.some((pagina) => Number.isInteger(pagina.numero)) ? "PDF — confira a página no documento" : "Texto colado da tela";
      });
      if (paginas.some((pagina) => Number.isInteger(pagina.numero))) {
        Object.keys(origens).forEach((campo) => {
          origens[campo] = origens[campo].replace(/Texto colado da tela/g, "PDF — confira a página no documento");
        });
      }
      return {
        entrada: resultado.calcpen, calcpen: resultado.calcpen, dados: resultado.calcpen,
        oficial: resultado.oficial || resultado.calcpen.atestadoSEEU || {},
        origens, rastros: resultado.rastros || {},
        versaoDocumento: resultado.versaoDocumento, alertas: resultado.alertas || [],
        lembretes: resultado.lembretes || [], avisos: resultado.avisos || {}
      };
    }

    const resultado = analisarPaginasCore(paginas);
    return {
      entrada: resultado.entrada, calcpen: resultado.entrada, dados: resultado.entrada,
      oficial: resultado.entrada.atestadoSEEU || {},
      origens: resultado.origens, rastros: resultado.rastros || {},
      versaoDocumento: null, alertas: resultado.entrada.pendencias
    };
  }

  function analisarTexto(texto, dataCalculo) {
    return analisarPaginas([{ texto, origem: "Texto colado da tela" }], dataCalculo);
  }

  function lerASN1(bytes, inicio) {
    if (inicio >= bytes.length) throw new Error("P7Z: envelope inválido.");
    const tag = bytes[inicio++];
    if (inicio >= bytes.length) throw new Error("P7Z: envelope inválido.");
    let tamanho = bytes[inicio++];
    if (tamanho & 0x80) {
      const octetos = tamanho & 0x7f;
      if (!octetos || octetos > 4 || inicio + octetos > bytes.length) throw new Error("P7Z: envelope inválido.");
      tamanho = 0;
      for (let indice = 0; indice < octetos; indice += 1) tamanho = tamanho * 256 + bytes[inicio++];
    }
    const fim = inicio + tamanho;
    if (fim > bytes.length) throw new Error("P7Z: envelope inválido.");
    return { tag, inicio, fim };
  }

  function filhosASN1(bytes, no) {
    const filhos = [];
    for (let posicao = no.inicio; posicao < no.fim;) {
      const filho = lerASN1(bytes, posicao);
      filhos.push(filho);
      posicao = filho.fim;
    }
    if (filhos.length && filhos[filhos.length - 1].fim !== no.fim) throw new Error("P7Z: envelope inválido.");
    return filhos;
  }

  function oidASN1(bytes, no) {
    if (no?.tag !== 0x06 || no.inicio === no.fim) return "";
    const valores = [];
    let numero = 0;
    for (let indice = no.inicio; indice < no.fim; indice += 1) {
      numero = numero * 128 + (bytes[indice] & 0x7f);
      if (!(bytes[indice] & 0x80)) { valores.push(numero); numero = 0; }
    }
    if (numero) throw new Error("P7Z: identificador ASN.1 inválido.");
    const primeiro = valores.shift();
    return [Math.floor(primeiro / 40), primeiro % 40, ...valores].join(".");
  }

  function conteudoOctetos(bytes, no) {
    const pilha = [no], partes = [];
    while (pilha.length) {
      const parte = pilha.pop();
      if (parte.tag === 0x04) {
        partes.push(bytes.slice(parte.inicio, parte.fim));
      } else if (parte.tag === 0x24) {
        pilha.push(...filhosASN1(bytes, parte).reverse());
      } else {
        throw new Error("P7Z: conteúdo comprimido inválido.");
      }
    }
    return juntar(partes);
  }

  function juntar(partes) {
    const tamanho = partes.reduce((total, parte) => total + parte.length, 0);
    const resultado = new Uint8Array(tamanho);
    let posicao = 0;
    partes.forEach((parte) => { resultado.set(parte, posicao); posicao += parte.length; });
    return resultado;
  }

  async function descomprimirP7Z(bytes) {
    const raiz = lerASN1(bytes, 0);
    const contentInfo = filhosASN1(bytes, raiz);
    if (raiz.tag !== 0x30 || oidASN1(bytes, contentInfo[0]) !== "1.2.840.113549.1.9.16.1.9" || contentInfo[1]?.tag !== 0xa0) {
      throw new Error("P7Z: envelope de compressão não reconhecido. Exporte o PDF diretamente do sistema.");
    }
    const comprimido = filhosASN1(bytes, contentInfo[1])[0];
    const dados = filhosASN1(bytes, comprimido);
    const algoritmo = filhosASN1(bytes, dados[1]);
    if (comprimido.tag !== 0x30 || oidASN1(bytes, algoritmo[0]) !== "1.2.840.113549.1.9.16.3.8") {
      throw new Error("P7Z: algoritmo do envelope não reconhecido. Exporte o PDF diretamente do sistema.");
    }
    const encapsulado = filhosASN1(bytes, dados[2]);
    const explicito = filhosASN1(bytes, encapsulado[1]);
    const payload = conteudoOctetos(bytes, explicito[0]);
    if (typeof DecompressionStream !== "function" || typeof Blob === "undefined") {
      throw new Error("P7Z: este navegador não oferece leitura local do envelope. Exporte o PDF diretamente.");
    }
    const leitor = new Blob([payload]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
    const partes = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await leitor.read();
        if (done) break;
        total += value.length;
        if (total > 20 * 1024 * 1024) throw new Error("P7Z: conteúdo extraído excede 20 MB.");
        partes.push(value);
      }
    } catch (erro) {
      await leitor.cancel().catch(() => {});
      throw erro;
    } finally {
      leitor.releaseLock();
    }
    return juntar(partes);
  }

  function extrairPDFP7Z(bytes) {
    const inicio = bytes.findIndex((valor, indice) => valor === 0x25 && bytes[indice + 1] === 0x50 &&
      bytes[indice + 2] === 0x44 && bytes[indice + 3] === 0x46 && bytes[indice + 4] === 0x2d);
    if (inicio >= 0) {
      const fim = bytes.findIndex((valor, indice) => indice >= inicio && valor === 0x25 &&
        bytes[indice + 1] === 0x25 && bytes[indice + 2] === 0x45 && bytes[indice + 3] === 0x4f &&
        bytes[indice + 4] === 0x46);
      if (fim >= 0) return bytes.slice(inicio, fim + 5);
    }
    const texto = new TextDecoder("latin1").decode(bytes);
    const limite = texto.match(/boundary="?([^";\r\n]+)"?/i)?.[1];
    if (limite) {
      for (const parte of texto.split(`--${limite}`)) {
        const separador = parte.search(/\r?\n\r?\n/);
        if (separador < 0) continue;
        const cabecalho = parte.slice(0, separador);
        if (!/content-type:\s*(?:application\/pdf|application\/octet-stream)[^;\r\n]*(?:filename="?[^"\r\n]*\.pdf"?|name="?[^"\r\n]*\.pdf"?)?/i.test(cabecalho) &&
          !/(?:filename|name)="?[^"\r\n]*\.pdf"?/i.test(cabecalho)) continue;
        const corpo = parte.slice(separador).replace(/^\r?\n\r?\n/, "").replace(/\s/g, "");
        try {
          const binario = atob(corpo);
          const pdf = Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
          const encontrado = extrairPDFP7Z(pdf);
          if (encontrado) return encontrado;
        } catch (_) {}
      }
    }
    throw new Error("P7Z: não encontrei um PDF incorporado. Exporte novamente o documento como PDF.");
  }

  async function pdfDoP7Z(bytes) {
    try {
      return extrairPDFP7Z(await descomprimirP7Z(bytes));
    } catch (erro) {
      if (erro.message?.startsWith("P7Z:")) throw erro;
      throw new Error("P7Z: não foi possível abrir o envelope localmente. Exporte novamente o documento como PDF.");
    }
  }

  // I01: os bytes e o worker ficam locais; não executa scripts do PDF.
  async function lerPDF(arquivo, biblioteca) {
    const p7z = /\.p7z$/i.test(arquivo?.name || "");
    if (!arquivo || (!/\.pdf$/i.test(arquivo.name || "") && !p7z)) throw new Error("Arquivo: escolha um PDF ou envelope P7Z do SEEU ou SAJ.");
    if (arquivo.size > 20 * 1024 * 1024) throw new Error("PDF: excede 20 MB. Divida o documento e tente novamente.");
    let bytes = new Uint8Array(await arquivo.arrayBuffer());
    if (bytes.length > 20 * 1024 * 1024) throw new Error("PDF: excede 20 MB. Divida o documento e tente novamente.");
    if (p7z) bytes = await pdfDoP7Z(bytes);
    if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new Error("PDF: arquivo inválido. Exporte novamente do SEEU ou SAJ.");
    const pdfjs = biblioteca || await import("./vendor/pdfjs/pdf.mjs");
    pdfjs.GlobalWorkerOptions && (pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.mjs",
      typeof document === "undefined" ? `file://${__filename}` : document.baseURI).href);
    const tarefa = pdfjs.getDocument({
      data: bytes, isEvalSupported: false, useSystemFonts: false,
      disableFontFace: true, useWorkerFetch: false
    });
    try {
      const pdf = await tarefa.promise;
      if (pdf.numPages > 200) throw new Error("PDF: mais de 200 páginas. Separe apenas o atestado ou o cálculo.");
      const paginas = [];
      let total = 0;
      for (let numero = 1; numero <= pdf.numPages; numero += 1) {
        const pagina = await pdf.getPage(numero);
        const conteudo = await pagina.getTextContent();
        // I05: linhas montadas pela posição de cada trecho, não pela ordem do arquivo.
        const texto = leituraTexto.montarTextoDeItens([conteudo.items]).texto;
        total += texto.length;
        if (total > 2000000) throw new Error("PDF: texto muito extenso. Separe apenas o cálculo.");
        paginas.push({ numero, texto: texto.replace(/[ \t]+\n/g, "\n") });
        pagina.cleanup();
      }
      if (!paginas.some((p) => p.texto.trim())) throw new Error("PDF: sem texto selecionável ou escaneado. Exporte novamente do sistema ou use leitura por IA; OCR não é feito nesta tela.");
      return analisarPaginas(paginas);
    } catch (erro) {
      if (erro.name === "PasswordException") throw new Error("PDF: protegido por senha. Abra e exporte uma cópia sem senha para importar.");
      if (erro.message?.startsWith("PDF:")) throw erro;
      throw new Error("PDF: não foi possível ler. Exporte novamente ou cole o texto da tela.");
    } finally {
      await tarefa.destroy();
    }
  }

  // I03: um documento não impede a leitura dos demais.
  async function lerLote(arquivos, ler = lerPDF) {
    const itens = [], erros = [];
    for (const arquivo of arquivos) {
      try {
        itens.push({ ...await ler(arquivo), status: "a_conferir" });
      } catch (erro) {
        erros.push({ arquivo: arquivo.name, mensagem: erro.message });
      }
    }
    return { itens, erros };
  }

  return { analisarTexto, analisarPaginas, lerPDF, lerLote };
});
