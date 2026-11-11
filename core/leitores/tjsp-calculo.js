(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./calculo-pena.js"), require("../leitura-texto.js"), require("./versoes-documentos.js"), require("../natureza.js"));
  } else {
    root.LeitorCalculoTJSP = factory(root.LeitorCalculoPena, root.LeituraTexto, root.VersoesDocumentos, root.CalcPenNatureza);
  }
})(typeof globalThis === "object" ? globalThis : this, function (leitorCalculoPena, leituraTexto, versoes, natureza) {
  "use strict";

  const SECOES = [
    { chave: "dados-sentenca", titulo: "Dados da sentença", variacoes: ["Sentença"] },
    { chave: "processos-somados", titulo: "Processos somados", variacoes: ["Soma das penas"] },
    { chave: "dados-prisao", titulo: "Dados da prisão", variacoes: ["Dados da prisão/Aguardando internação"] },
    { chave: "periodos-prisao", titulo: "Períodos de prisão considerados", variacoes: ["Períodos considerados"] },
    { chave: "remicao", titulo: "Remição", variacoes: ["Remição e perda de dias remidos"] },
    { chave: "historico-regimes", titulo: "Histórico de regimes de prisão", variacoes: ["Histórico de regimes"] },
    { chave: "controle-pena", titulo: "Controle de pena", variacoes: ["Controle da pena", "Controle de pena (situação em {data})"] },
    { chave: "previsoes", titulo: "Previsões", variacoes: ["Previsão de benefícios"] },
    { chave: "previsao-saida-temporaria", titulo: "Previsão de saída temporária", variacoes: ["Saída temporária"] },
    { chave: "previsao-progressao", titulo: "Previsão de progressão", variacoes: ["Progressão de regime"] },
    { chave: "previsao-livramento", titulo: "Previsão de livramento condicional", variacoes: ["Previsão de livramento"] },
    { chave: "previsao-termino", titulo: "Previsão de término", variacoes: ["Término da pena"] }
  ];

  const rotulosPrevisao = {
    saidaTemporaria: /^(?:previsao de )?saida temporaria$/,
    progressao: /^(?:previsao de )?progressao(?: de regime)?$/,
    livramento: /^(?:previsao de )?livramento(?: condicional)?$/,
    termino: /^(?:previsao de )?termino(?: da pena| de pena)?$/
  };
  const regime = (valor) => {
    const texto = normalizar(valor).replace(/[^a-z]/g, "");
    if (texto === "fechado") return "fechado";
    if (texto === "semiaberto") return "semiaberto";
    if (texto === "aberto") return "aberto";
    return undefined;
  };
  const normalizar = (texto) => String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();

  function data(texto) {
    const match = String(texto).match(/(?:^|\D)(\d{2})\/(\d{2})\/(\d{4})(?!\d)/);
    if (!match) return undefined;
    const [, dia, mes, ano] = match;
    const iso = `${ano}-${mes}-${dia}`;
    const valor = new Date(`${iso}T00:00:00Z`);
    return Number(ano) > 0 && !isNaN(valor) && valor.toISOString().slice(0, 10) === iso
      ? iso : undefined;
  }

  function numeroDias(texto) {
    const match = normalizar(texto).match(/(?:^|[^\d])(\d{1,3}(?:\.\d{3})*|\d+)\s*dias?\b/);
    if (!match) return undefined;
    const valor = Number(match[1].replace(/\./g, ""));
    return Number.isSafeInteger(valor) ? valor : undefined;
  }

  function pena(texto) {
    const resultado = { anos: 0, meses: 0, dias: 0 };
    const unidades = { a: "anos", ano: "anos", anos: "anos", m: "meses", mes: "meses", meses: "meses", d: "dias", dia: "dias", dias: "dias" };
    const regex = /(\d+)\s*(anos?|a\b|mes(?:es)?|m\b|dias?|d\b)/gi;
    const vistos = new Set();
    let encontrou = false;
    let sobra = String(texto);
    sobra = sobra.replace(regex, (_, numero, unidade) => {
      const campo = unidades[normalizar(unidade)];
      const valor = Number(numero);
      if (!campo || !Number.isSafeInteger(valor) || vistos.has(campo)) return "?";
      vistos.add(campo);
      resultado[campo] = valor;
      encontrou = true;
      return "";
    });
    return encontrou && !sobra.replace(/[\s,e.]/g, "") ? resultado : undefined;
  }

  function valorDaLinha(linha) {
    const indice = linha.indexOf(":");
    return indice < 0 ? "" : linha.slice(indice + 1).trim();
  }

  function adicionarAlerta(alertas, mensagem) {
    if (!alertas.includes(mensagem)) alertas.push(mensagem);
  }

  // I07: layout real do "Cálculo de Pena" do TJSP/SAJ (seções sem numeração,
  // "Rótulo   : valor" em colunas, penas por extenso e blocos de previsão).
  const UNIDADES_EXTENSO = {
    zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
    dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16,
    dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
    sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200,
    duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400,
    quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700,
    setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900
  };
  const UNIDADES_PENA = { ano: "anos", anos: "anos", mes: "meses", meses: "meses", dia: "dias", dias: "dias" };

  // "dezoito anos e dez meses", "quatro anos, seis meses e treze dias", "1 ano e 2 meses".
  function penaPorExtenso(texto) {
    const tokens = normalizar(texto)
      .replace(/^(?:reclusao|detencao|prisao simples)\s*:\s*/, "")
      .replace(/[.,;]/g, " ").split(/\s+/).filter(Boolean);
    const resultado = { anos: 0, meses: 0, dias: 0 };
    const vistos = new Set();
    let numero = null;
    for (const token of tokens) {
      if (/^\d+$/.test(token)) { numero = (numero || 0) + Number(token); continue; }
      if (token in UNIDADES_EXTENSO) { numero = (numero || 0) + UNIDADES_EXTENSO[token]; continue; }
      if (token === "mil") { numero = (numero || 1) * 1000; continue; }
      if (token === "e") continue;
      const campo = UNIDADES_PENA[token];
      if (!campo || numero === null || vistos.has(campo)) return undefined;
      resultado[campo] = numero;
      vistos.add(campo);
      numero = null;
    }
    return vistos.size && numero === null ? resultado : undefined;
  }

  // I13: "reclusão: um ano. detenção: quatro meses. prisão simples: dez dias. total geral: ...".
  // Usa o total geral do documento; sem ele, soma as espécies (dias a cada 30 viram mês; meses a cada 12, ano).
  const ESPECIES_PENA = /(reclusao|detencao|prisao simples)\s*:/g;
  function penaComposta(texto) {
    const plano = normalizar(texto).replace(/\s+/g, " ").trim();
    const especies = plano.match(ESPECIES_PENA) || [];
    if (especies.length < 2 && !/total geral\s*:/.test(plano)) return { pena: penaPorExtenso(plano), especies: especies.length };
    const total = plano.match(/total geral\s*:\s*(.*)$/);
    const penaTotal = total && penaPorExtenso(total[1].replace(/\.\s*$/, ""));
    if (penaTotal) return { pena: penaTotal, especies: especies.length };
    const partes = [...plano.replace(/total geral\s*:.*$/, "").matchAll(/(?:reclusao|detencao|prisao simples)\s*:\s*(.*?)(?=(?:reclusao|detencao|prisao simples)\s*:|$)/g)]
      .map((m) => penaPorExtenso(m[1].replace(/\.\s*$/, "")));
    if (!partes.length || partes.some((p) => !p)) return { pena: undefined, especies: especies.length };
    const soma = partes.reduce((a, p) => ({ anos: a.anos + p.anos, meses: a.meses + p.meses, dias: a.dias + p.dias }), { anos: 0, meses: 0, dias: 0 });
    soma.meses += Math.floor(soma.dias / 30); soma.dias %= 30;
    soma.anos += Math.floor(soma.meses / 12); soma.meses %= 12;
    return { pena: soma, especies: especies.length };
  }
  // I13: a linha "Pena : reclusão: ..." pode continuar nas linhas seguintes, sem rótulo próprio.
  function juntarContinuacaoPena(linhas) {
    const saida = [];
    for (let i = 0; i < linhas.length; i++) {
      let linha = linhas[i];
      if (/^pena\s*:\s*(?:reclusao|detencao|prisao simples)\s*:/.test(normalizar(linha.trim().replace(/\s{2,}/g, " ")))) {
        let extras = 0;
        while (extras < 3 && i + 1 < linhas.length) {
          const proxima = linhas[i + 1].trim();
          const plano = normalizar(linha).replace(/\s+/g, " ");
          const completa = /total geral\s*:\s*.*(?:anos?|mes|meses|dias?)\s*\.?\s*$/.test(plano) || (!/total geral/.test(plano) && /\.\s*$/.test(plano));
          if (completa && !/^(?:detencao|prisao simples|total geral)\s*:/.test(normalizar(proxima))) break;
          if (!proxima || /\s{2,}:/.test(proxima) || /^\d{2}\/\d{2}\/\d{4}/.test(proxima) || /^[a-z ]+$/.test(normalizar(proxima)) && !/\b(?:anos?|mes|meses|dias?)\b/.test(normalizar(proxima))) break;
          linha = `${linha} ${proxima}`;
          i++; extras++;
        }
      }
      saida.push(linha);
    }
    return saida;
  }

  const TITULOS_REAIS = [
    ["dados-processo", /^dados do processo$/],
    ["dados-pessoais", /^dados pessoais(?: \(resumido\))?$/],
    ["dados-sentenca", /^dados da sentenca$/],
    ["processos-somados", /^processos somados$/],
    ["pena-privativa", /^pena privativa de liberdade$/],
    ["pena-multa", /^pena de multa$/],
    ["dados-prisao", /^dados da prisao(?:\/aguardando internacao)?$/],
    ["periodos-prisao", /^periodos de prisao considerados$/],
    ["historico-regimes", /^historico de regimes de prisao$/],
    ["observacao", /^observacao$/],
    ["controle-pena", /^controle de pena \(situacao em \d{2}\/\d{2}\/\d{4}\)?$/],
    ["remicao", /^remicao$/],
    ["previsao-progressao", /^previsao de progressao de regime$/],
    ["previsao-livramento", /^previsao de livramento condicional$/],
    ["previsao-saidaTemporaria", /^previsao de saida temporaria$/],
    ["prescricao", /^controle de prescricao/]
  ];
  const INICIO_PRISAO = /^(?:prisao|recaptura|recolhimento|apresentacao espontanea)/;
  const FIM_PRISAO = /^(?:termino da prisao|soltura|alvara|liberdade|livramento condicional|fuga|evasao|abandono|extincao)/;

  function lerModeloReal(texto, paginas, reconhecimento) {
    const alertas = [];
    const origens = {};
    const rastros = {};
    const oficial = { memoria: {} };
    const condenacoes = [];
    const linhasPrisao = [];
    const previsoes = { progressao: [], livramento: [], saidaTemporaria: [] };
    let secao = null;
    let atual = null;
    let processoPendente = null;
    let previsaoAtual = null;
    let reincidenciaGeral;
    const penasControle = [];
    const remicoesTJSP = [];

    function rastrear(caminho, trecho, nomeSecao) {
      const limpo = String(trecho).replace(/\s{2,}/g, " ").trim();
      const pagina = paginas?.find((item) => normalizar(String(item.texto || "")).includes(normalizar(String(trecho))))?.numero;
      origens[caminho] = { secao: nomeSecao || secao || "", trecho: limpo, ...(Number.isInteger(pagina) ? { pagina } : {}), status: "a conferir" };
      rastros[caminho] = { trecho: limpo, ...(Number.isInteger(pagina) ? { pagina } : {}) };
    }
    function oficialUnico(campo, valor, trecho) {
      if (valor === undefined) return;
      if (oficial[campo] !== undefined && JSON.stringify(oficial[campo]) !== JSON.stringify(valor)) {
        adicionarAlerta(alertas, `Valor oficial divergente para ${campo}; confira o cálculo.`);
        return;
      }
      if (oficial[campo] === undefined) { oficial[campo] = valor; rastrear(`oficial.${campo}`, trecho); }
    }
    function novaCondenacao() {
      atual = { id: `c${condenacoes.length + 1}`, origem: "Cálculo de pena TJSP/SAJ" };
      if (processoPendente) atual.processo = processoPendente;
      processoPendente = null;
      condenacoes.push(atual);
      return atual;
    }

    const linhas = juntarContinuacaoPena(String(texto).replace(/\r\n?/g, "\n").replace(/\f/g, "\n").split("\n"));
    linhas.forEach((bruta) => {
      const linha = bruta.trim();
      if (!linha) return;
      const plana = normalizar(linha.replace(/\s{2,}/g, " "));
      const titulo = TITULOS_REAIS.find(([, regex]) => regex.test(plana));
      if (titulo) {
        const [chave] = titulo;
        // O cabeçalho "Controle de pena (situação em ...)" se repete a cada página: não encerra a previsão aberta.
        if (chave === "controle-pena") {
          oficialUnico("dataReferencia", data(plana), linha);
          if (previsaoAtual) return;
        }
        secao = chave;
        previsaoAtual = chave.startsWith("previsao-") ? chave.slice(9) : null;
        return;
      }
      const rotuloValor = linha.match(/^([^:]+?)\s*:\s*(.*)$/);
      const rotulo = rotuloValor ? normalizar(rotuloValor[1].replace(/\s{2,}/g, " ")) : "";
      const valor = rotuloValor ? rotuloValor[2].trim() : "";

      if (rotulo === "previsao de termino da pena") {
        const termino = data(valor);
        if (termino) oficialUnico("termino", termino, linha);
        else adicionarAlerta(alertas, "Previsão de término da pena não identificada com segurança; confira o documento.");
        previsaoAtual = null;
        return;
      }

      if (secao === "dados-processo" && rotulo === "numero do processo") {
        if (/reincidente/.test(normalizar(valor))) reincidenciaGeral = "reincidente";
        else if (/primari[oa]/.test(normalizar(valor))) reincidenciaGeral = "primario";
        return;
      }

      if (["dados-sentenca", "processos-somados", "pena-privativa", "pena-multa"].includes(secao)) {
        if (/^processo(?: de origem)?$/.test(rotulo) && !/de origem/.test(rotulo)) { processoPendente = valor; return; }
        if (/^data do (?:fato|delito)$/.test(rotulo)) {
          const dataFato = data(valor);
          if (!atual || atual.dataFato) novaCondenacao();
          if (dataFato) { atual.dataFato = dataFato; rastrear(`condenacoes[${condenacoes.length - 1}].dataFato`, linha); }
          else adicionarAlerta(alertas, `Condenação ${atual.id}: data do fato ilegível; confira.`);
          return;
        }
        if (!atual && /^(?:lei|diploma legal|artigo(?: da lei)?|capitulacao(?: legal)?|tipificacao(?: penal)?)$/.test(rotulo)) {
          novaCondenacao();
        }
        if (!atual) return;
        if (/^(?:lei|diploma legal)$/.test(rotulo)) {
          atual.lei = valor;
          rastrear(`condenacoes[${condenacoes.length - 1}].lei`, linha);
          return;
        }
        if (/^(?:artigo(?: da lei)?|capitulacao(?: legal)?|tipificacao(?: penal)?)$/.test(rotulo)) {
          atual.artigo = valor;
          rastrear(`condenacoes[${condenacoes.length - 1}].artigo`, linha);
          return;
        }
        if (/^violencia ou grave ameaca$/.test(rotulo) || /^resultado morte$/.test(rotulo)) {
          const chave = rotulo === "resultado morte" ? "resultadoMorte" : "violencia";
          const booleano = normalizar(valor);
          if (["s", "sim", "n", "nao"].includes(booleano)) {
            atual[chave] = booleano === "s" || booleano === "sim";
            rastrear(`condenacoes[${condenacoes.length - 1}].${chave}`, linha);
          }
          return;
        }
        if (/^transito em julgado para o ministerio publico em/.test(plana)) {
          const dt = data(plana); if (dt) atual.dataTransitoAcusacao = dt; return;
        }
        if (/^transito em julgado para a (?:defesa|reu|re|sentenciad[oa])\b/.test(plana)) {
          const dt = data(plana); if (dt) atual.dataTransito = dt; return;
        }
        if (rotulo === "pena" && secao !== "pena-multa") {
          const { pena, especies } = penaComposta(valor);
          if (pena && especies > 1 && !atual.pena) adicionarAlerta(alertas, `Condenação ${atual.id}: pena com espécies diferentes (reclusão, detenção ou prisão simples) somadas pelo total geral; a ordem de execução (CP, art. 69 e 76) não é tratada; confira.`);
          if (pena && !atual.pena) { atual.pena = pena; rastrear(`condenacoes[${condenacoes.length - 1}].pena`, linha); }
          else if (!pena) adicionarAlerta(alertas, `Condenação ${atual.id}: pena não identificada com segurança; confira.`);
          return;
        }
        if (/^regime (?:reclusao|detencao|inicial|prisao simples)$/.test(rotulo)) {
          const r = regime(valor);
          if (r && !atual.regimeInicial) { atual.regimeInicial = r; rastrear(`condenacoes[${condenacoes.length - 1}].regimeInicial`, linha); }
          return;
        }
      }

      if (["dados-prisao", "periodos-prisao", "dados-sentenca", "processos-somados"].includes(secao)) {
        const eventos = [...linha.matchAll(/(\d{2}\/\d{2}\/\d{4})\s+(?:-\s*)?([^\d][^]*?)(?=\s{3,}\d{2}\/\d{2}\/\d{4}|$)/g)]
          .map((m) => ({ data: data(m[1]), evento: m[2].trim(), chave: normalizar(m[2]) }));
        const tabelaPrisao = ["dados-prisao", "periodos-prisao"].includes(secao) && !/^\d{2}\/\d{2}\/\d{4}\s*-/.test(linha);
        if (eventos.length && eventos[0].data && (tabelaPrisao || INICIO_PRISAO.test(eventos[0].chave) || FIM_PRISAO.test(eventos[eventos.length - 1].chave))) {
          linhasPrisao.push({ inicio: eventos[0], fim: eventos[1] || null, trecho: linha, secao });
          return;
        }
      }

      if (secao === "controle-pena" && !previsaoAtual) {
        // Pena em execução de cada processo: "Pena : um ano, dez meses e quinze dias (...) - Réu primário",
        // com as demais em linhas seguintes sem rótulo.
        const trechoPena = (rotulo === "pena" ? valor : !rotuloValor ? linha : "").split(/\(| - /)[0].trim();
        const penaControle = trechoPena && penaPorExtenso(trechoPena);
        if (penaControle) {
          penasControle.push({ pena: penaControle, trecho: linha, classificacao: /primari|reincident/.test(plana) ? plana : "" });
          return;
        }
        // Linha de classificação logo abaixo da pena: "... - Hediondo - Reincidente específico".
        if (!rotuloValor && penasControle.length && /(comum|hediond|equiparad)/.test(plana) && /(primari|reincident)/.test(plana)) {
          penasControle[penasControle.length - 1].classificacao = plana;
          return;
        }
        if (rotulo === "remicao") {
          const remicao = penaPorExtenso(valor) || (numeroDias(valor) !== undefined ? { anos: 0, meses: 0, dias: numeroDias(valor) } : undefined);
          if (remicao) oficialUnico("remicaoDias", remicao.anos * 365 + remicao.meses * 30 + remicao.dias, linha);
          else adicionarAlerta(alertas, "Remição do controle de pena não identificada com segurança; confira.");
          return;
        }
        const mapa = { "pena total": "penaTotal", "pena cumprida": "penaCumprida", "pena a cumprir": "penaRemanescente", "pena restante": "penaRemanescente" };
        if (mapa[rotulo]) {
          const pena = penaPorExtenso(valor);
          if (pena) oficialUnico(mapa[rotulo], pena, linha);
          else adicionarAlerta(alertas, `${rotuloValor[1].trim()}: valor não identificado com segurança; confira.`);
          return;
        }
      }

      if (previsaoAtual) {
        const lista = previsoes[previsaoAtual];
        const regimeAlvo = regime(plana);
        if (regimeAlvo && !rotuloValor) { lista.push({ regime: regimeAlvo, trechos: [linha] }); return; }
        const item = lista[lista.length - 1] || (lista.push({ trechos: [] }), lista[lista.length - 1]);
        item.trechos.push(linha);
        if (/^data[- ]base$/.test(rotulo)) {
          item.dataBase = data(valor);
          const motivo = valor.match(/\(([^)]*)\)\s*$/);
          if (motivo) item.motivoDataBase = motivo[1].trim();
        } else if (/^previsao para o beneficio$/.test(rotulo)) {
          item.data = data(valor);
          if (!item.data) item.situacao = valor;
        } else if (/(?:crime|delito)/.test(rotulo) || /\d+\/\d+ de/.test(plana)) {
          item.fracao = linha.replace(/\s{2,}/g, " ");
        }
      }
    });

    // Previsões: o primeiro benefício de cada bloco é o próximo a ser alcançado.
    Object.entries(previsoes).forEach(([campo, lista]) => {
      const itens = lista.filter((item) => item.data || item.dataBase || item.situacao);
      if (!itens.length) return;
      oficial.memoria[campo] = itens.map((item) => item.trechos.join(" | "));
      const proximo = itens.find((item) => item.data);
      if (proximo) {
        oficialUnico(campo, proximo.data, proximo.trechos.find((t) => /benef/i.test(normalizar(t))) || proximo.trechos[0]);
        if (proximo.dataBase) oficial[`${campo}DataBase`] = proximo.dataBase;
        if (proximo.fracao) oficial[`${campo}Fracao`] = proximo.fracao;
        if (proximo.regime) oficial[`${campo}Regime`] = proximo.regime;
      }
      if (campo === "progressao" && itens.length > 1) {
        oficial.progressoesPrevistas = itens.map(({ regime: r, dataBase, motivoDataBase, data: d, fracao, situacao }) =>
          ({ regime: r, dataBase, motivoDataBase, data: d, fracao, situacao }));
      }
    });

    // I08: cada linha da tabela de prisão é um intervalo de custódia (evento inicial → evento final).
    // Com processos somados, os intervalos se repetem e se sobrepõem; os nomes dos eventos finais
    // (soma de pena, falta grave, sentença) só marcam cortes. Os intervalos são unidos.
    const FORA_CUSTODIA = /^(?:fuga|evasao|abandono|livramento condicional|soltura|alvara|liberdade|extincao|termino da prisao$)/;
    // Fonte: a tabela "Dados da prisão" (intervalos inicial → final); senão "Períodos de prisão
    // considerados", que às vezes traz só a data inicial e condições do regime; só na falta das duas,
    // as linhas de prisão dos blocos de sentença (que podem não ter data final).
    const fonte = ["dados-prisao", "periodos-prisao"].find((chave) => linhasPrisao.some((l) => l.secao === chave));
    const intervalos = linhasPrisao
      .filter((linhaPrisao) => !fonte || linhaPrisao.secao === fonte)
      .filter(({ inicio }) => inicio.data && !FORA_CUSTODIA.test(inicio.chave))
      .map(({ inicio, fim, trecho }) => ({
        inicio: inicio.data,
        fim: fim?.data || null,
        cautelar: /flagrante|preventiva|temporaria/.test(inicio.chave),
        trecho
      }))
      .filter((item) => !item.fim || item.fim >= item.inicio)
      .sort((x, y) => x.inicio.localeCompare(y.inicio));
    const diaSeguinte = (iso) => new Date(Date.parse(`${iso}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
    const prisoes = [];
    intervalos.forEach((item) => {
      const ultimo = prisoes[prisoes.length - 1];
      if (ultimo && (ultimo.fim === null || item.inicio <= diaSeguinte(ultimo.fim))) {
        if (ultimo.fim !== null && (item.fim === null || item.fim > ultimo.fim)) ultimo.fim = item.fim;
        if (item.cautelar) ultimo.iniciouComo = ultimo.iniciouComo || "provisoria";
        return;
      }
      prisoes.push({
        inicio: item.inicio, fim: item.fim, tipo: "definitiva", origem: item.trecho.replace(/\s{2,}/g, " "),
        ...(item.cautelar ? { iniciouComo: "provisoria" } : {})
      });
    });
    if (linhasPrisao.some(({ inicio, fim }) => fim?.data && inicio.data && fim.data < inicio.data)) {
      adicionarAlerta(alertas, "Tabela de prisão com data final anterior à inicial; a linha foi ignorada. Confira.");
    }
    if (linhasPrisao.length) oficial.eventosPrisao = linhasPrisao.map(({ inicio, fim }) => ({
      inicio: { data: inicio.data, evento: inicio.evento }, ...(fim ? { fim: { data: fim.data, evento: fim.evento } } : {})
    }));

    // I07: a pena em execução (controle de pena) prevalece sobre a da sentença, que pode ter sido reformada.
    if (penasControle.length && penasControle.length === condenacoes.length) {
      condenacoes.forEach((c, indice) => {
        const { pena, trecho } = penasControle[indice];
        if (c.pena && JSON.stringify(c.pena) !== JSON.stringify(pena)) {
          c.penaSentenca = c.pena;
          adicionarAlerta(alertas, `Condenação ${c.id}: a pena em execução difere da pena da sentença (possível reforma em recurso); foi usada a pena em execução. Confira.`);
        }
        c.pena = pena;
        rastrear(`condenacoes[${indice}].pena`, trecho, "controle-pena");
        // Classificação informada pelo cálculo oficial: reincidência é lida; a natureza fica só como
        // referência (naturezaDocumento), porque o enquadramento é conferido pelo defensor.
        const classe = penasControle[indice].classificacao || "";
        if (/reincidente especific/.test(classe)) c.reincidencia = "especifico";
        else if (/reincidente/.test(classe)) c.reincidenciaDocumento = "reincidente";
        else if (/primari/.test(classe)) c.reincidencia = "primario";
        const natureza = classe.match(/(hediondo|equiparado|comum)/)?.[1];
        if (natureza) c.naturezaDocumento = natureza;
      });
    } else if (penasControle.length) {
      adicionarAlerta(alertas, "Penas do controle de pena não correspondem às condenações lidas; confira a pena de cada processo.");
    }
    if (reincidenciaGeral === "primario") condenacoes.forEach((c) => { if (!c.reincidencia && !c.reincidenciaDocumento) c.reincidencia = "primario"; });
    condenacoes.forEach((c) => {
      if (c.reincidenciaDocumento) adicionarAlerta(alertas, `Condenação ${c.id}: o cálculo indica reincidência sem dizer se é específica; informe.`);
    });
    // I13: trânsito para ambas as partes é o mais recente entre defesa e Ministério Público.
    condenacoes.forEach((c) => {
      if (c.dataTransitoAcusacao && c.dataTransito && c.dataTransitoAcusacao > c.dataTransito) {
        c.dataTransito = c.dataTransitoAcusacao;
        adicionarAlerta(alertas, `Condenação ${c.id}: trânsito para o Ministério Público posterior ao da defesa; usada a data mais recente como trânsito para ambas as partes; confira.`);
      }
    });
    // I09: remição total do controle de pena entra como remição a conferir.
    if (Number.isInteger(oficial.remicaoDias) && oficial.remicaoDias > 0) {
      remicoesTJSP.push({ dias: oficial.remicaoDias, homologada: true, origem: "Remição do controle de pena (cálculo TJSP/SAJ)" });
      adicionarAlerta(alertas, "Remição: usado o total do controle de pena; confira as decisões de homologação e de perda.");
    }
    if (reincidenciaGeral === "reincidente") {
      adicionarAlerta(alertas, "O cálculo indica reincidência; informe se é genérica ou específica em cada condenação.");
    }

    const calcpen = {
      formato: "calcpen", versao: 1, condenacoes, prisoes, interrupcoes: [], detracoes: [], remicoes: remicoesTJSP,
      faltasGraves: [], progressoes: [], regressoes: [], pendencias: [], observacoes: ""
    };
    natureza.aplicarSugestoes(calcpen, alertas, origens, rastros);
    condenacoes.forEach((c) => {
      if (!c.pena || !c.dataFato) adicionarAlerta(alertas, `Condenação ${c.id}: pena ou data do fato; confira.`);
      if (!c.natureza) adicionarAlerta(alertas, `Condenação ${c.id}: natureza do crime não consta do cálculo; informe.`);
    });
    if (!condenacoes.length) adicionarAlerta(alertas, "Condenações individuais não identificadas com segurança; confira as sentenças.");
    if (prisoes.length) adicionarAlerta(alertas, "Prisões montadas a partir da tabela de eventos do cálculo; confira início, término e tipo de cada período.");
    if (prisoes.some((p) => p.iniciouComo === "provisoria")) {
      adicionarAlerta(alertas, "Período iniciado por prisão cautelar foi tratado como cumprimento, como no cálculo oficial; se for detração, ajuste o tipo.");
    }
    else adicionarAlerta(alertas, "Prisão: confirme o início e o tipo de cada período; a data-base não é presumida como prisão.");
    ["progressao", "livramento", "termino"].forEach((campo) => {
      if (!oficial[campo]) adicionarAlerta(alertas, `Previsão oficial de ${campo} não identificada; confira o documento.`);
    });
    adicionarAlerta(alertas, "Confira no documento também detrações, remições e faltas graves; dados ausentes não significam ausência de eventos.");
    calcpen.pendencias = alertas.slice();
    calcpen.observacoes = "Dados extraídos do cálculo TJSP/SAJ; confira cada campo antes de calcular.";
    return {
      calcpen, oficial, alertas, origens, rastros,
      versaoDocumento: { tipo: reconhecimento.tipo, versao: reconhecimento.versao, reconhecido: true }
    };
  }

  function ler(texto, paginas) {
    if (typeof texto !== "string") throw new TypeError("O texto do cálculo do TJSP deve ser uma string.");
    if (!leitorCalculoPena || typeof leitorCalculoPena.ler !== "function") {
      throw new Error("O leitor de seções do cálculo de pena deve ser carregado antes do leitor TJSP.");
    }

    const reconhecimento = versoes?.reconhecer(texto);
    if (reconhecimento?.tipo === "tjsp-saj-v2" && reconhecimento.reconhecido) {
      return lerModeloReal(texto, paginas, reconhecimento);
    }
    if (reconhecimento?.tipo?.startsWith("tjsp-saj") && !reconhecimento.reconhecido) {
      const calcpen = {
        formato: "calcpen", versao: 1, condenacoes: [], prisoes: [], interrupcoes: [],
        detracoes: [], remicoes: [], faltasGraves: [], progressoes: [],
        regressoes: [], pendencias: [reconhecimento.alerta], observacoes: ""
      };
      return {
        calcpen, oficial: {}, alertas: calcpen.pendencias, origens: {}, rastros: {},
        versaoDocumento: { tipo: reconhecimento.tipo, versao: null, reconhecido: false }
      };
    }
    if (reconhecimento?.tipo === "tjsp-saj-resumo") {
      const { entrada: calcpen, origens, rastros } = leituraTexto.analisarPaginas(
        paginas?.length ? paginas : [{ texto, origem: "Texto colado da tela" }]
      );
      return {
        calcpen, oficial: calcpen.atestadoSEEU || {}, alertas: calcpen.pendencias,
        origens, rastros,
        versaoDocumento: { tipo: reconhecimento.tipo, versao: reconhecimento.versao, reconhecido: true }
      };
    }

    const leitura = leitorCalculoPena.ler(texto, SECOES);
    const calcpen = {
      formato: "calcpen",
      versao: 1,
      condenacoes: [],
      prisoes: [],
      interrupcoes: [],
      detracoes: [],
      remicoes: [],
      faltasGraves: [],
      progressoes: [],
      regressoes: [],
      pendencias: [],
      observacoes: ""
    };
    const oficial = { memoria: {} };
    const alertas = leitura.avisos
      .filter((aviso) => aviso.tipo === "titulo-desconhecido" || (
        aviso.tipo === "secao-ausente" &&
        ["dados-sentenca", "dados-prisao", "controle-pena"].includes(aviso.chave)
      ))
      .map((aviso) => aviso.mensagem);
    const origens = {};
    const rastros = {};
    const camposDivergentes = new Set();
    const condenacoes = [];
    const prisao = {};
    let tipoPrisao;
    const periodos = [];
    const remicoes = [];
    const revogacoes = [];
    const transicoes = [];
    let dataFaltaRemicao;

    function origem(caminho, secao, trecho) {
      const pagina = paginas?.find((item) =>
        normalizar(String(item.texto || "")).includes(normalizar(String(trecho).split(": ").slice(-1)[0])))?.numero;
      origens[caminho] = { secao, trecho, ...(Number.isInteger(pagina) ? { pagina } : {}), status: "a conferir" };
      rastros[caminho] = { trecho, ...(Number.isInteger(pagina) ? { pagina } : {}) };
    }

    function valorOficial(campo, valor, secao, trecho) {
      if (!valor) return;
      if (camposDivergentes.has(campo)) return;
      if (oficial[campo] !== undefined && JSON.stringify(oficial[campo]) !== JSON.stringify(valor)) {
        delete oficial[campo];
        camposDivergentes.add(campo);
        adicionarAlerta(alertas, `Valor oficial divergente para ${campo}; confira o cálculo.`);
        return;
      }
      oficial[campo] = valor;
      origem(`oficial.${campo}`, secao, trecho);
    }

    function previsao(rotulo, valor, secao, trecho) {
      const campo = Object.keys(rotulosPrevisao).find((chave) => rotulosPrevisao[chave].test(rotulo));
      if (!campo) return false;
      const dataOficial = data(valor);
      if (!dataOficial) {
        adicionarAlerta(alertas, `Previsão de ${campo} não identificada com segurança; confira o documento.`);
      } else {
        valorOficial(campo, dataOficial, secao, trecho);
      }
      if (!oficial.memoria[campo]) oficial.memoria[campo] = [];
      oficial.memoria[campo].push(trecho);
      return true;
    }

    function campoPena(secao, trecho, linha, atual) {
      const rotulo = normalizar(linha.split(":")[0]);
      const valor = valorDaLinha(linha);
      if (/^(?:processo|numero do processo|processo de conhecimento)$/.test(rotulo)) {
        if (atual && !atual.processo) atual.processo = valor;
        else {
          atual = { processo: valor };
          condenacoes.push(atual);
        }
        origem(`condenacoes[${condenacoes.length - 1}].processo`, secao, trecho);
        return atual;
      }
      if (/^(?:data do fato|data do delito)$/.test(rotulo)) {
        const dataFato = data(valor);
        if (dataFato) {
          atual = atual || {};
          atual.dataFato = dataFato;
          if (!condenacoes.includes(atual)) condenacoes.push(atual);
          origem(`condenacoes[${condenacoes.indexOf(atual)}].dataFato`, secao, trecho);
        } else adicionarAlerta(alertas, "Data do fato da sentença ilegível ou inválida; confira o documento.");
        return atual;
      }
      if (/^(?:lei|diploma legal)$/.test(rotulo)) {
        atual = atual || {};
        atual.lei = valor;
        if (!condenacoes.includes(atual)) condenacoes.push(atual);
        origem(`condenacoes[${condenacoes.indexOf(atual)}].lei`, secao, trecho);
        return atual;
      }
      if (/^(?:artigo(?: da lei)?|capitulacao(?: legal)?|tipificacao(?: penal)?)$/.test(rotulo)) {
        atual = atual || {};
        atual.artigo = valor;
        if (!condenacoes.includes(atual)) condenacoes.push(atual);
        origem(`condenacoes[${condenacoes.indexOf(atual)}].artigo`, secao, trecho);
        return atual;
      }
      if (/^(?:violencia ou grave ameaca|resultado morte)$/.test(rotulo)) {
        atual = atual || {};
        const chave = rotulo === "resultado morte" ? "resultadoMorte" : "violencia";
        const booleano = normalizar(valor);
        if (["s", "sim", "n", "nao"].includes(booleano)) atual[chave] = booleano === "s" || booleano === "sim";
        if (!condenacoes.includes(atual)) condenacoes.push(atual);
        origem(`condenacoes[${condenacoes.indexOf(atual)}].${chave}`, secao, trecho);
        return atual;
      }
      if (/^(?:pena aplicada|pena imposta|pena da sentenca)$/.test(rotulo)) {
        const valorPena = pena(valor);
        if (valorPena) {
          atual = atual || {};
          atual.pena = valorPena;
          if (!condenacoes.includes(atual)) condenacoes.push(atual);
          origem(`condenacoes[${condenacoes.indexOf(atual)}].pena`, secao, trecho);
        } else adicionarAlerta(alertas, "Pena da sentença ilegível ou inválida; confira o documento.");
        return atual;
      }
      return atual;
    }

    leitura.secoes.forEach((secao) => {
      // Seção numerada que não é título conhecido (ex.: itens de um atestado): ignorar, sem quebrar.
      if (!secao.chave) return;
      let condenacaoAtual;
      let datasPeriodo = {};
      secao.texto.split("\n").forEach((linhaBruta) => {
        const linha = linhaBruta.trim();
        if (!linha || !linha.includes(":")) return;
        const rotulo = normalizar(linha.split(":")[0]).replace(/^[\s•*-]+/, "");
        const valor = valorDaLinha(linha);
        const itemOrigem = `${secao.titulo}: ${linha}`;

        if (secao.chave === "dados-sentenca") {
          condenacaoAtual = campoPena(secao.titulo, itemOrigem, linha, condenacaoAtual);
          if (/^data da sentenca$/.test(rotulo)) {
            const dataSentenca = data(valor);
            if (dataSentenca) {
              oficial.datasSentenca = [...(oficial.datasSentenca || []), dataSentenca];
              origem("oficial.datasSentenca", secao.titulo, itemOrigem);
            }
          }
          if (/^(?:(?:conversao)(?: da| de)? )?(?:pena restritiva de direitos|prd)(?: convertida?)?$/.test(rotulo)) {
            oficial.conversoesPRD = [...(oficial.conversoesPRD || []), itemOrigem];
            origem("oficial.conversoesPRD", secao.titulo, itemOrigem);
          }
        } else if (secao.chave === "processos-somados") {
          if (/^(?:pena total|soma das penas|total da pena)$/.test(rotulo)) {
            const valorPena = pena(valor);
            valorOficial("penaTotal", valorPena || valor, secao.titulo, itemOrigem);
          }
        }

        if (secao.chave === "dados-prisao" || secao.chave === "periodos-prisao") {
          if (/^(?:tipo de prisao|natureza da prisao)$/.test(rotulo)) {
            const tipo = /provisoria/.test(normalizar(valor)) ? "provisoria" : /definitiva/.test(normalizar(valor)) ? "definitiva" : undefined;
            if (secao.chave === "periodos-prisao") datasPeriodo.tipo = tipo;
            else tipoPrisao = tipo;
          }
          if (/^situacao$/.test(rotulo) && /(?:preso|em cumprimento|ativa)/.test(normalizar(valor))) prisao.ativa = true;
          if (/^(?:data da prisao|data de inicio|inicio da prisao|inicio do cumprimento|data de recolhimento)$/.test(rotulo)) {
            const inicio = data(valor);
            if (inicio) {
              if (secao.chave === "periodos-prisao") datasPeriodo.inicio = inicio;
              else {
                prisao.inicio = inicio;
                valorOficial("dataPrisao", inicio, secao.titulo, itemOrigem);
              }
            } else adicionarAlerta(alertas, "Data de início da prisão ilegível ou inválida; confira o documento.");
          }
          if (/^(?:data de soltura|data de termino da prisao|fim da prisao|data final)$/.test(rotulo)) {
            const fim = data(valor);
            if (fim) {
              if (secao.chave === "periodos-prisao") datasPeriodo.fim = fim;
              else {
                prisao.fim = fim;
                valorOficial("fimPrisao", fim, secao.titulo, itemOrigem);
              }
            } else adicionarAlerta(alertas, "Data final do período de prisão ilegível ou inválida; confira o documento.");
          }
          if (/^periodo(?: de prisao)?$/.test(rotulo)) {
            const datas = [...valor.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)].map((match) => data(match[0])).filter(Boolean);
            if (datas.length >= 1) datasPeriodo.inicio = datas[0];
            if (datas.length >= 2) datasPeriodo.fim = datas[1];
            datasPeriodo.trechos = [...(datasPeriodo.trechos || []), itemOrigem];
          }
          if (/^(?:regime atual|regime)$/.test(rotulo)) {
            const regimeAtual = regime(valor);
            if (regimeAtual) calcpen.regimeAtual = regimeAtual;
          }
        }

        if (secao.chave === "remicao") {
          if (/^(?:total de dias remidos|saldo de remicao|remicao total)$/.test(rotulo)) {
            const dias = numeroDias(valor);
            valorOficial("remicaoDias", dias === undefined ? valor : dias, secao.titulo, itemOrigem);
          }
          if (/^(?:remicao homologada|dias remidos homologados)$/.test(rotulo)) {
            const dias = numeroDias(valor);
            if (dias !== undefined) remicoes.push({ dias, homologada: true, origem: itemOrigem });
          }
          if (/^(?:revogacao da remicao|dias perdidos de remicao|perda de dias remidos)$/.test(rotulo)) {
            const dias = numeroDias(valor);
            revogacoes.push({ dias, trecho: itemOrigem, data: dataFaltaRemicao });
            dataFaltaRemicao = undefined;
          }
          if (/^data da falta grave$/.test(rotulo)) {
            const dataFalta = data(valor);
            if (dataFalta) {
              const revogacaoPendente = [...revogacoes].reverse().find((item) => !item.data);
              if (revogacaoPendente) revogacaoPendente.data = dataFalta;
              else dataFaltaRemicao = dataFalta;
            }
          }
        }

        if (secao.chave === "historico-regimes") {
          const progressao = /^(?:data da progressao|progressao(?: para .+)?|progressao)$/.test(rotulo);
          const regressao = /^(?:data da regressao|regressao(?: para .+)?|regressao)$/.test(rotulo);
          if (progressao || regressao) {
            const dataEvento = data(valor);
            const regimeMatch = normalizar(linha).match(/(?:para|→)\s*(fechado|semiaberto|semi-aberto|aberto)/);
            const para = regime(valor) || (regimeMatch && regime(regimeMatch[1]));
            if (dataEvento || para) transicoes.push({ tipo: regressao ? "regressao" : "progressao", data: dataEvento, para, trecho: itemOrigem, secao: secao.titulo });
          }
        }

        const previsaoSecao = secao.chave.startsWith("previsao-") || secao.chave === "previsoes";
        if (previsaoSecao && previsao(rotulo, valor, secao.titulo, itemOrigem)) return;
        if (secao.chave.startsWith("previsao-") && rotulo === "data") {
          previsao(secao.chave.slice("previsao-".length), valor, secao.titulo, itemOrigem);
          return;
        }
        if (secao.chave === "controle-pena") {
          if (previsao(rotulo, valor, secao.titulo, itemOrigem)) return;
          const camposControle = [
            [/^pena total$/, "penaTotal"],
            [/^pena cumprida$/, "penaCumprida"],
            [/^pena restante$/, "penaRestante"],
            [/^(?:data de emissao|data do calculo)$/, "dataEmissao"]
          ];
          const controle = camposControle.find(([padrao]) => padrao.test(rotulo));
          if (controle) {
            const convertido = controle[1] === "dataEmissao" ? data(valor) : pena(valor) || numeroDias(valor) || valor;
            valorOficial(controle[1], convertido, secao.titulo, itemOrigem);
          }
          if (/^(?:total de dias remidos|dias remidos)$/.test(rotulo)) {
            const dias = numeroDias(valor);
            valorOficial("remicaoDias", dias === undefined ? valor : dias, secao.titulo, itemOrigem);
          }
        }

        if (/^(?:data da progressao|data prevista para progressao)$/.test(rotulo)) previsao("progressao", valor, secao.titulo, itemOrigem);
        if (/^(?:data do livramento|data prevista para livramento)$/.test(rotulo)) previsao("livramento", valor, secao.titulo, itemOrigem);
        if (/^(?:data da saida temporaria|data prevista para saida temporaria)$/.test(rotulo)) previsao("saidaTemporaria", valor, secao.titulo, itemOrigem);
        if (/^(?:data do termino|data de termino da pena|termino da pena)$/.test(rotulo)) previsao("termino", valor, secao.titulo, itemOrigem);

        if (/^(?:data base|data base considerada)$/.test(rotulo)) {
          const dataBase = data(valor);
          if (dataBase) valorOficial("dataBase", dataBase, secao.titulo, itemOrigem);
        }
      });

      if (secao.chave === "periodos-prisao" && Object.keys(datasPeriodo).length) {
        periodos.push({ ...datasPeriodo, trechos: datasPeriodo.trechos || [], secao: secao.titulo });
      }
    });

    condenacoes.forEach((item, indice) => {
      if (!item.dataFato || !item.pena) {
        adicionarAlerta(alertas, `Sentença ${indice + 1} incompleta: data do fato e pena aplicada precisam ser conferidas.`);
        return;
      }
      calcpen.condenacoes.push({ id: `c${calcpen.condenacoes.length + 1}`, ...item });
    });

    if (prisao.inicio && tipoPrisao && (prisao.fim !== undefined || prisao.ativa)) {
      delete prisao.ativa;
      calcpen.prisoes.push({ ...prisao, tipo: tipoPrisao });
    }
    periodos.forEach((periodo) => {
      if (periodo.inicio && periodo.tipo && (periodo.fim !== undefined)) {
        calcpen.prisoes.push({
          inicio: periodo.inicio,
          fim: periodo.fim,
          tipo: periodo.tipo,
          origem: periodo.trechos.join("\n")
        });
      }
    });
    oficial.periodosPrisaoConsiderados = periodos;
    oficial.remicoes = remicoes;
    oficial.remicaoRevogada = revogacoes.map((item) => {
      const { data: dataFalta, ...resto } = item;
      return { ...resto, ...(dataFalta ? { data: dataFalta } : {}) };
    });
    if (remicoes.length) calcpen.remicoes = remicoes;
    revogacoes.forEach((item) => {
      if (item.dias !== undefined && item.data) {
        calcpen.faltasGraves.push({
          data: item.data,
          diasPerdidosRemicao: item.dias,
          origem: item.trecho
        });
      }
    });

    transicoes.forEach((item) => {
      const { tipo, trecho, secao, ...evento } = item;
      if (tipo === "progressao" && evento.data && evento.para) {
        calcpen.progressoes.push({ ...evento, origem: trecho });
      } else if (tipo === "regressao" && evento.data && evento.para) {
        calcpen.regressoes.push({ ...evento, origem: trecho });
      }
      origem(`${tipo}s[${tipo === "progressao" ? calcpen.progressoes.length - 1 : calcpen.regressoes.length - 1}]`, secao, trecho);
    });

    if (revogacoes.length) {
      adicionarAlerta(alertas, "Revogação ou perda de remição identificada; confira a decisão e a data antes de informar no cálculo.");
    }
    if (!calcpen.condenacoes.length) {
      adicionarAlerta(alertas, "Condenações individuais não identificadas com segurança; confira as sentenças.");
    }
    natureza.aplicarSugestoes(calcpen, alertas, origens, rastros);
    if (!calcpen.prisoes.length) {
      adicionarAlerta(alertas, "Prisão: confirme o início e o tipo de cada período; a data-base não é presumida como prisão.");
    }
    Object.keys(rotulosPrevisao).forEach((campo) => {
      if (!oficial[campo]) adicionarAlerta(alertas, `Previsão oficial de ${campo} não identificada; confira o documento.`);
    });
    adicionarAlerta(alertas, "Confira no documento também detrações, remições e faltas graves; dados ausentes não significam ausência de eventos.");
    calcpen.pendencias = alertas.slice();
    calcpen.observacoes = "Dados extraídos do cálculo TJSP/SAJ; confira cada campo antes de calcular.";

    return {
      calcpen, oficial, alertas, origens, rastros,
      versaoDocumento: reconhecimento?.reconhecido
        ? { tipo: reconhecimento.tipo, versao: reconhecimento.versao, reconhecido: true }
        : null
    };
  }

  return { ler, penaPorExtenso };
});
