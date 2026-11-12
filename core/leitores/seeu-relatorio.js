(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../leitura-texto.js"), require("./versoes-documentos.js"), require("../natureza.js"));
  } else {
    root.LeitorRelatorioSEEU = factory(root.LeituraTexto, root.VersoesDocumentos, root.CalcPenNatureza);
  }
})(typeof globalThis === "object" ? globalThis : this, function (leitura, versoes, natureza) {
  "use strict";

  const normalizar = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const origem = "Texto colado da tela";
  const dataValida = (valor) => {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const data = new Date(`${valor}T00:00:00Z`);
    return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
  };
  const dataBR = (valor) => valor.split("-").reverse().join("/");
  const rotulosCampos = [
    "Pena Total", "Pena Total Imposta", "Pena Cumprida Até Data Atual", "Pena Cumprida", "Pena Remanescente",
    "Total Interrupções", "Saldo dias Remidos", "Regime Atual", "Número", "Lei", "Artigo da Lei",
    "Fração adotada no cálculo para progressão de regime", "Fração adotada no cálculo para livramento condicional",
    "Violência ou grave ameaça", "Resultado morte", "Reincidente comum", "Reincidente específico",
    "Condenado por exercer comando de organização criminosa", "Extinto", "Suspenso", "Pena Imposta",
    "Data da infração", "Data da extinção", "Data de suspensão", "Data do recebimento da denúncia",
    "Data da Sentença", "Data do trânsito em julgado do Ministério Público", "Data do trânsito em julgado do processo",
    "Juízo/Vara de condenação", "Observação", "Data prevista para o Término da Pena",
    "Data prevista para progressão de regime", "Data prevista para livramento condicional",
    "Data prevista para o livramento condicional", "Data prevista livramento condicional", "Data prevista",
    "Data do benefício", "Data-base", "Data-base considerada",
    "Data-base adotada no cálculo para progressão de regime", "Data-base adotada no cálculo para progresso regime",
    "Data-base adotada no cálculo para livramento condicional", "Fração", "Tipo", "Motivo", "Complemento",
    "Data", "Data Decisão", "Data Referência", "Processos Selecionados", "Situação", "Status", "Resultado",
    "Decreto"
  ];
  const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regexCampos = new RegExp(`(?:^|[ \\t]+)(${rotulosCampos.sort((a, b) => b.length - a.length).map((rotulo) =>
    rotulo.split(/\s+/).map(escaparRegex).join("[ \\t]+")
  ).join("|")})[ \\t]*:`, "gi");

  const CONFERENCIAS = [
    ["SC-01", "Pena cumprida + pena remanescente = pena total imposta"],
    ["SC-02", "Soma das penas dos crimes não suspensos e não extintos = pena total imposta"],
    ["SC-03", "Em cada sentença, soma das penas dos crimes = pena total da sentença"],
    ["SC-04", "Saldo de dias remidos = soma dos incidentes de remição"],
    ["SC-05", "Regime atual = regime do último incidente de fixação ou alteração de regime"],
    ["SC-06", "Texto do relatório sem rótulo reconhecido"]
  ];
  const ROTULOS_SEEU = new Set([
    "numero unico", "numero antigo", "numero", "nome", "cpf", "rg", "nome da mae", "data de nascimento",
    "regime atual", "pena total imposta", "pena cumprida ate data atual", "pena cumprida",
    "pena remanescente", "total interrupcoes", "saldo dias remidos", "data prevista para o termino da pena",
    "data prevista para progressao de regime", "data prevista para livramento condicional",
    "data prevista livramento condicional", "data prevista",
    "data do beneficio", "data-base", "data-base adotada no calculo para progresso regime",
    "data-base adotada no calculo para progressao de regime",
    "data-base adotada no calculo para livramento condicional", "fracao", "fracao adotada",
    "tipo", "juizo/vara de condenacao", "data do recebimento da denuncia", "data da sentenca",
    "data do transito em julgado do ministerio publico", "data do transito em julgado do processo",
    "observacao", "pena total", "regime imposto na sentenca/acordao", "lei", "artigo da lei", "pena",
    "pena imposta", "data da infracao", "violencia ou grave ameaca", "resultado morte",
    "reincidente comum", "reincidente especifico", "condenado por exercer comando de organizacao criminosa",
    "fracao adotada no calculo para progressao de regime",
    "fracao adotada no calculo para livramento condicional", "extinto", "data da extincao",
    "suspenso", "data de suspensao", "motivo", "data", "processos selecionados", "complemento",
    "data decisao", "data referencia", "gerado em", "situacao", "status", "resultado", "decreto"
  ]);
  const ACENTOS = { a: "aáàâã", c: "cç", e: "eéèêë", i: "iíìîï", o: "oóòôõö", u: "uúùûü" };
  const ROTULOS_REGEX = [...ROTULOS_SEEU].sort((a, b) => b.length - a.length)
    .map((rotulo) => [...rotulo].map((letra) => ACENTOS[letra]
      ? `[${ACENTOS[letra]}]` : letra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(""))
    .join("|");

  function conferenciasSemLeitura() {
    return CONFERENCIAS.map(([id, descricao]) => ({
      id, situacao: "não deu para conferir", conta: `${descricao}; dados insuficientes para conferir.`
    }));
  }

  function diasPena(pena) {
    if (!pena || !Number.isSafeInteger(pena.anos) || !Number.isSafeInteger(pena.meses) ||
        !Number.isSafeInteger(pena.dias)) return undefined;
    const dias = pena.anos * 365 + pena.meses * 30 + pena.dias;
    return Number.isSafeInteger(dias) ? dias : undefined;
  }

  function somarPenas(penas) {
    if (!Array.isArray(penas) || !penas.every((pena) =>
      pena && Number.isSafeInteger(pena.anos) && pena.anos >= 0 &&
      Number.isSafeInteger(pena.meses) && pena.meses >= 0 &&
      Number.isSafeInteger(pena.dias) && pena.dias >= 0)) return undefined;
    const anos = penas.reduce((soma, pena) => soma + pena.anos, 0);
    const meses = penas.reduce((soma, pena) => soma + pena.meses, 0);
    const dias = penas.reduce((soma, pena) => soma + pena.dias, 0);
    if (![anos, meses, dias].every(Number.isSafeInteger)) return undefined;
    const mesesComDias = meses + Math.floor(dias / 30);
    const totalAnos = anos + Math.floor(mesesComDias / 12);
    const totalMeses = mesesComDias % 12;
    const totalDias = dias % 30;
    return [totalAnos, totalMeses, totalDias].every(Number.isSafeInteger)
      ? { anos: totalAnos, meses: totalMeses, dias: totalDias } : undefined;
  }

  function penasIguais(a, b) {
    return a && b && a.anos === b.anos && a.meses === b.meses && a.dias === b.dias;
  }

  function descreverPena(pena) {
    return `${pena.anos} ano(s), ${pena.meses} mês(es) e ${pena.dias} dia(s)`;
  }

  function contarSobras(texto) {
    const marcadores = /^(?:processo de execucao|calculos da pena|termino de pena|calculos para progressao de regime|calculos para livramento condicional|processos criminais|eventos de inicio, reinicio e inter+upcao.*|incidentes(?: concedidos| indeferidos| pendentes| nao concedidos| em andamento)?|fim do relatorio|grafico representativo.*|sentenca\/acordao\/recurso(?:\s*\([^)]*\))?|desmembramento(?:\(s\))?)$/;
    const cabecalho = /^(?:poder judiciario|relatorio da situacao processual executoria|processo eletronico - seeu|gerado em:|pag\.:)/;
    let emCabecalho = true;
    let iniciou = false;
    let ultimoRotulo = "";
    let caracteres = 0;
    texto.replace(/\r\n?/g, "\n").replace(/\f/g, "\n").split("\n").forEach((linha) => {
      const limpa = linha.trim();
      if (!limpa) return;
      const canonica = normalizar(limpa).replace(/:\s*$/, "");
      if (cabecalho.test(canonica)) {
        emCabecalho = true;
        ultimoRotulo = "";
        return;
      }
      if (marcadores.test(canonica)) {
        if (canonica === "processo de execucao") {
          if (!iniciou) { iniciou = true; emCabecalho = false; }
          return;
        }
        emCabecalho = false;
        ultimoRotulo = "";
        if (canonica === "fim do relatorio") emCabecalho = true;
        return;
      }
      if (emCabecalho) return;
      const regexCampos = new RegExp(`(?:^|[ \\t]{2,})(${ROTULOS_REGEX}):`, "gi");
      const camposDaLinha = [...linha.matchAll(regexCampos)]
        .map((match) => normalizar(match[1].trim()));
      if (camposDaLinha.length) {
        if (camposDaLinha.every((rotulo) => ROTULOS_SEEU.has(rotulo) ||
            /^.+\(\d+(?:%|\/\d+)\)$/.test(rotulo))) {
          ultimoRotulo = camposDaLinha[camposDaLinha.length - 1];
        } else {
          caracteres += limpa.length;
          ultimoRotulo = "";
        }
        return;
      }
      if (ultimoRotulo === "pena") return;
      if (limpa.includes(":")) {
        const rotulo = normalizar(limpa.slice(0, limpa.indexOf(":")));
        if (ROTULOS_SEEU.has(rotulo) || /^.+\(\d+(?:%|\/\d+)\)$/.test(rotulo)) {
          ultimoRotulo = rotulo; return;
        }
        caracteres += limpa.length;
        ultimoRotulo = "";
        return;
      }
      if (["pena", "complemento", "motivo", "observacao"].includes(ultimoRotulo)) return;
      if (/^(?:poder judiciario|sao paulo|.+\bvara\b.*)$/.test(canonica)) return;
      caracteres += limpa.length;
      ultimoRotulo = "";
    });
    return caracteres;
  }

  function ler(texto, paginas, dataCalculo) {
    // I15: a origem diz se o relatório veio de PDF (páginas numeradas) ou de texto colado.
    const origemDocumento = paginas?.some((p) => Number.isInteger(p.numero)) ? "Relatório SEEU (PDF)" : origem;
    if (typeof texto !== "string") throw new TypeError("O texto do relatório deve ser uma string.");
    // I10: o título genérico é uma variante do layout, não prova de concessão.
    const textoReconhecido = texto.replace(/^[ \t]*incidentes[ \t]*:?[ \t]*$/gim, "INCIDENTES CONCEDIDOS");
    const reconhecimentoInicial = versoes?.reconhecer(textoReconhecido);
    const relatorioSemFim = reconhecimentoInicial?.tipo === "seeu-relatorio" &&
      !reconhecimentoInicial.reconhecido && !/fim do relat[oó]rio/i.test(textoReconhecido)
      ? versoes?.reconhecer(`${textoReconhecido}\nFim do Relatório`) : null;
    const reconhecimento = relatorioSemFim?.reconhecido
      ? { ...relatorioSemFim, incompleto: true } : reconhecimentoInicial;
    const pistaRelatorio = reconhecimento?.tipo === "seeu-relatorio";
    if (pistaRelatorio && !reconhecimento.reconhecido) {
      const calcpen = {
        formato: "calcpen", versao: 1, condenacoes: [], prisoes: [], interrupcoes: [],
        detracoes: [], remicoes: [], faltasGraves: [], progressoes: [],
        pendencias: [reconhecimento.alerta], observacoes: ""
      };
      return {
        calcpen, oficial: {}, alertas: calcpen.pendencias, origens: {}, rastros: {},
        conferencias: conferenciasSemLeitura(), lembretes: [],
        avisos: { possivelProvidencia: [], dadoAConferir: [] },
        versaoDocumento: { tipo: reconhecimento.tipo, versao: null, reconhecido: false }
      };
    }
    if (!/c[aá]lculos da pena\s*:/i.test(texto)) {
      const { entrada, origens, rastros } = leitura.analisarPaginas(paginas?.length ? paginas : [{ texto, origem }]);
      const atestado = reconhecimento?.tipo?.startsWith("seeu-atestado") ? reconhecimento : null;
      if (atestado && !atestado.reconhecido) {
        const vazio = {
          formato: "calcpen", versao: 1, condenacoes: [], prisoes: [], interrupcoes: [],
          detracoes: [], remicoes: [], faltasGraves: [], progressoes: [],
          pendencias: [atestado.alerta], observacoes: ""
        };
        return {
          calcpen: vazio, oficial: {}, alertas: vazio.pendencias, origens: {}, rastros: {},
          conferencias: conferenciasSemLeitura(), lembretes: [],
          avisos: { possivelProvidencia: [], dadoAConferir: [] },
          versaoDocumento: { tipo: atestado.tipo, versao: null, reconhecido: false }
        };
      }
      natureza.aplicarSugestoes(entrada, entrada.pendencias, origens, rastros);
      return {
        calcpen: entrada, oficial: entrada.atestadoSEEU || {}, alertas: entrada.pendencias, origens,
        rastros: rastros || {},
        conferencias: conferenciasSemLeitura(),
        lembretes: [],
        avisos: { possivelProvidencia: [], dadoAConferir: [] },
        versaoDocumento: atestado?.reconhecido
          ? { tipo: atestado.tipo, versao: atestado.versao, reconhecido: true }
          : null
      };
    }

    const secoes = {};
    const blocosIncidentes = [];
    let blocoIncidentes;
    let secao = "";
    texto.replace(/\r\n?/g, "\n").replace(/\f/g, "\n").split("\n").forEach((linha) => {
      const titulo = normalizar(linha.trim()).replace(/:\s*$/, "");
      if (/^calculos da pena$/.test(titulo)) secao = "pena";
      else if (/^termino de pena$/.test(titulo)) secao = "termino";
      else if (/^calculos para progressao de regime$/.test(titulo)) secao = "progressao";
      else if (/^calculos para livramento condicional$/.test(titulo)) secao = "livramento";
      else if (/^processos criminais$/.test(titulo)) secao = "processos";
      else if (/^eventos de inicio, reinicio e inter+upcao/.test(titulo)) { secao = "eventos"; secoes.eventos ||= []; }
      else if (/^incidentes(?: (?:concedidos|indeferidos|pendentes|nao concedidos|em andamento))?$/.test(titulo)) {
        secao = "incidentes";
        blocoIncidentes = { concedido: titulo === "incidentes concedidos", generico: titulo === "incidentes", linhas: [] };
        blocosIncidentes.push(blocoIncidentes);
      }
      else if (/^(?:grafico representativo|fim do relatorio)/.test(titulo)) secao = "";
      else if (secao) {
        (secoes[secao] ||= []).push(linha);
        if (secao === "incidentes") blocoIncidentes.linhas.push(linha);
      }
    });

    const alertas = [];
    const lembretes = [];
    const avisosProvidencia = [];
    const avisosConferir = [];
    const lembrar = (mensagem) => {
      if (!lembretes.includes(mensagem)) lembretes.push(mensagem);
    };
    if (reconhecimento.incompleto || (pistaRelatorio && !normalizar(texto).includes("fim do relatorio"))) {
      alertas.push('Relatório incompleto: Relatório sem "Fim do Relatório"; confira o documento.');
    }
    const rastros = {};
    function registrar(caminho, trecho) {
      const linha = String(trecho || "").trim();
      if (!linha) return;
      const pagina = paginas?.find((item) => normalizar(String(item.texto || "")).includes(normalizar(linha)))?.numero;
      rastros[caminho] = { trecho: linha, ...(Number.isInteger(pagina) ? { pagina } : {}) };
    }
    const avisar = (campo) => {
      const mensagem = `${campo}: dado ausente, inválido ou divergente. Confira o relatório.`;
      if (!alertas.includes(mensagem)) alertas.push(mensagem);
    };
    const registrarAviso = (regra, tipo, texto) => {
      const aviso = { regra, tipo, status: "a conferir", texto };
      const destino = tipo === "possível providência" ? avisosProvidencia : avisosConferir;
      if (destino.some((item) => item.regra === regra)) return;
      destino.push(aviso);
      alertas.push(`${regra} — ${texto}`);
    };
    function campos(linhas) {
      const resultado = [];
      (linhas || []).forEach((linha) => {
        const matches = [...linha.matchAll(regexCampos)];
        matches.forEach((m, i) => resultado.push({
          rotulo: normalizar(m[1].trim()),
          valor: linha.slice(m.index + m[0].length, matches[i + 1]?.index ?? linha.length).trim(),
          trecho: `${m[1].trim()}: ${linha.slice(m.index + m[0].length, matches[i + 1]?.index ?? linha.length).trim()}`
        }));
      });
      return resultado;
    }
    function unico(lista, rotulo, nome, converter, caminho) {
      const itens = lista.filter((c) => rotulo.test(c.rotulo) && c.valor);
      const valores = itens.map((c) => c.valor);
      if (!valores.length) return undefined;
      const convertidos = valores.map(converter);
      if (convertidos.some((v) => v === undefined) || convertidos.some((v) => JSON.stringify(v) !== JSON.stringify(convertidos[0]))) {
        avisar(nome);
        return undefined;
      }
      if (caminho) registrar(caminho, itens[0].trecho);
      return convertidos[0];
    }
    // I01/I02: reaproveita o analisador comum para datas, penas e conflitos.
    function convertido(rotulo, valor, caminho) {
      const { entrada } = leitura.analisarPaginas([{ texto: `${rotulo}: ${valor}`, origem }]);
      return caminho.split(".").reduce((o, chave) => o?.[chave], entrada);
    }
    const data = (v) => convertido("Término", v, "atestadoSEEU.termino");
    const duracao = (v) => {
      const adaptado = normalizar(v).replace(/ano\(s\)/g, "anos").replace(/mes\(es\)/g, "meses").replace(/dia\(s\)/g, "dias").replace(/([amd])(?=\d)/g, "$1 ");
      return convertido("Pena", adaptado, "condenacoes.0.pena");
    };
    const literal = (v) => v;
    const oficial = {};
    const resumo = campos(secoes.pena);
    [
      ["penaTotal", /^pena total imposta$/, duracao],
      ["penaCumprida", /^pena cumprida(?: ate data atual)?$/, duracao],
      ["penaRemanescente", /^pena remanescente$/, duracao],
      ["totalInterrupcoes", /^total (?:de )?interrupcoes$/, duracao],
      ["remicaoDias", /^saldo (?:de |dias )?remid(?:os|a)$/, (v) => {
        const m = v.match(/^(\d+)\s*dias?\b/i);
        return m && Number.isSafeInteger(Number(m[1])) ? Number(m[1]) : undefined;
      }]
    ].forEach(([nome, re, conversor]) => {
      const valor = unico(resumo, re, nome, conversor, `oficial.${nome}`);
      if (valor !== undefined) oficial[nome] = valor;
    });
    const datasEmissao = texto.replace(/\r\n?/g, "\n").replace(/\f/g, "\n").split("\n").flatMap((linha) => {
      const match = linha.match(/\b(?:gerado em:\s*(\d{2}\/\d{2}\/\d{4})|em:\s*(\d{2}\/\d{2}\/\d{4})\s*$)/i);
      return match ? [{ rotulo: "data de emissao", valor: match[1] || match[2], trecho: linha.trim() }] : [];
    });
    const dataEmissao = unico(datasEmissao, /^data de emissao$/, "Data de emissão", data, "oficial.dataEmissao");
    if (dataEmissao) oficial.dataEmissao = dataEmissao;
    // I06: rótulos que faltam em parte dos relatórios reais geram aviso, nunca valor presumido.
    if (secoes.pena && !resumo.some((c) => /^total (?:de )?interrupcoes$/.test(c.rotulo))) {
      alertas.push("Total de interrupções: não consta do relatório. Confira os eventos antes de presumir que não houve interrupção.");
    }
    if (secoes.pena && !resumo.some((c) => c.rotulo === "regime atual")) {
      alertas.push("Regime atual: não consta do relatório. Confira e preencha.");
    }
    const regime = unico(resumo, /^regime atual$/, "Regime atual", (v) => {
      const m = normalizar(v).match(/^(fechado|semi-?aberto|aberto)(?:\s*-\s*ativo)?$/);
      return m ? m[1].replace("-", "") : undefined;
    }, "calcpen.regimeAtual");
    const linhasCanonicas = [];
    const condenacoes = [];
    const sentencas = [];
    const conflitos = new WeakMap();
    // E108: conserva a presença de marcações vazias sem preencher dados do cálculo.
    const marcacoesEmBranco = new Map();
    let processo, trechoProcesso, processoOficial, condenacaoOficial, condenacao,
      situacaoSentenca, sentencaAtual, emDesmembramento = false;
    function atribuir(alvo, chave, valor) {
      const conflitosDoItem = conflitos.get(alvo);
      if (conflitosDoItem.has(chave)) return;
      if (valor === undefined || (Object.prototype.hasOwnProperty.call(alvo, chave) && JSON.stringify(alvo[chave]) !== JSON.stringify(valor))) {
        delete alvo[chave];
        conflitosDoItem.add(chave);
        avisar(`Condenação ${alvo.id}: ${chave}`);
      } else {
        alvo[chave] = valor;
      }
    }
    (secoes.processos || []).forEach((linha, indiceLinha) => {
      const n = normalizar(linha.trim());
      if (/^sentenca\/acordao\/recurso\b/.test(n)) {
        condenacao = null;
        condenacaoOficial = null;
        emDesmembramento = false;
        situacaoSentenca = n.match(/\(([^)]+)\)/)?.[1];
        sentencaAtual = { penaTotal: undefined, totalValido: true, crimes: [] };
        sentencas.push(sentencaAtual);
      }
      if (/^desmembramento/.test(n)) emDesmembramento = true;
      campos([linha]).forEach(({ rotulo, valor, trecho }) => {
        if (rotulo === "numero") {
          processo = valor; trechoProcesso = trecho;
          processoOficial = { numero: valor };
          (oficial.processos ||= []).push(processoOficial);
          registrar(`oficial.processos[${oficial.processos.length - 1}].numero`, trecho);
          condenacao = null; situacaoSentenca = undefined; sentencaAtual = null; emDesmembramento = false;
        }
        const camposDoProcesso = {
          "data do recebimento da denuncia": "dataRecebimentoDenuncia",
          "data da sentenca": "dataSentenca",
          "data do transito em julgado do ministerio publico": "dataTransitoMinisterioPublico",
          "data do transito em julgado do processo": "dataTransitoProcesso",
          "juizo/vara de condenacao": "juizoVara"
        };
        const campoProcesso = camposDoProcesso[rotulo];
        if (campoProcesso && processoOficial && !emDesmembramento) {
          let valorProcesso = valor;
          let trechoProcessoOficial = trecho;
          if (campoProcesso === "juizoVara" && !valorProcesso) {
            const anteriores = (secoes.processos || []).slice(Math.max(0, indiceLinha - 2), indiceLinha)
              .map((item) => item.trim())
              .filter((item) => item && !item.includes(":") && /\b(?:vara|foro|comarca)\b/i.test(item));
            valorProcesso = anteriores.join(" ");
            if (valorProcesso) trechoProcessoOficial = `Juízo/Vara de condenação: ${valorProcesso}`;
          }
          if (valorProcesso) {
            const valorNormalizado = normalizar(valorProcesso);
            const convertido = campoProcesso.startsWith("data")
              ? valorNormalizado === "nao informado" ? valorProcesso : data(valorProcesso)
              : valorProcesso;
            if (convertido === undefined) avisar(`Processo ${processoOficial.numero}: ${rotulo}`);
            else {
              processoOficial[campoProcesso] = convertido;
              registrar(`oficial.processos[${oficial.processos.indexOf(processoOficial)}].${campoProcesso}`,
                trechoProcessoOficial);
            }
          }
        }
        if (rotulo === "pena total" && sentencaAtual) {
          const pena = duracao(valor.split(/\s+-\s+/)[0]);
          if (!pena || (sentencaAtual.penaTotal &&
              diasPena(sentencaAtual.penaTotal) !== diasPena(pena))) {
            sentencaAtual.totalValido = false;
            sentencaAtual.penaTotal = undefined;
          } else if (sentencaAtual.totalValido) sentencaAtual.penaTotal = pena;
        }
        if (rotulo === "lei" && emDesmembramento) {
          condenacao = { id: `c${condenacoes.length + 1}`, processo, lei: valor, origem: origemDocumento, situacaoSentenca };
          conflitos.set(condenacao, new Set());
          condenacoes.push(condenacao);
          condenacaoOficial = { id: condenacao.id, processo };
          (oficial.condenacoes ||= []).push(condenacaoOficial);
          if (sentencaAtual) sentencaAtual.crimes.push(condenacao);
          registrar(`condenacoes[${condenacoes.length - 1}].processo`, trechoProcesso);
          registrar(`condenacoes[${condenacoes.length - 1}].lei`, trecho);
        }
        if (!condenacao || !emDesmembramento) return;
        const mapa = {
          "artigo da lei": "artigo", "fracao adotada no calculo para progressao de regime": "fracaoProgressao",
          "fracao adotada no calculo para livramento condicional": "fracaoLivramento",
          "condenado por exercer comando de organizacao criminosa": "comandoOrcrim",
          "violencia ou grave ameaca": "violencia", "resultado morte": "resultadoMorte",
          "reincidente comum": "reincidenteComum", "reincidente especifico": "reincidenteEspecifico",
          "extinto": "extinto", "suspenso": "suspenso"
        };
        const camposOficiaisCondenacao = ["fracaoProgressao", "fracaoLivramento", "comandoOrcrim"];
        if (rotulo === "condenado por exercer comando de organizacao criminosa") {
          if (valor.trim()) {
            const v = normalizar(valor);
            const comando = ["s", "sim", "n", "nao"].includes(v) ? v === "s" || v === "sim" : undefined;
            if (comando === undefined) avisar(`Condenação ${condenacao.id}: comando de organização criminosa`);
            else {
              condenacaoOficial.comandoOrcrim = comando;
              registrar(`oficial.condenacoes[${oficial.condenacoes.indexOf(condenacaoOficial)}].comandoOrcrim`, trecho);
            }
          }
          return;
        }
        if (rotulo === "artigo da lei") {
          registrar(`condenacoes[${condenacoes.indexOf(condenacao)}].artigo`, trecho);
        }
        const marcacoesRelevantes = {
          "violencia ou grave ameaca": "violência ou grave ameaça",
          "resultado morte": "resultado morte",
          "condenado por exercer comando de organizacao criminosa": "comando de organização criminosa",
          "reincidente comum": "reincidência",
          "reincidente especifico": "reincidência"
        };
        if (marcacoesRelevantes[rotulo] && !valor.trim()) {
          const emBranco = marcacoesEmBranco.get(condenacao.id) || new Set();
          emBranco.add(marcacoesRelevantes[rotulo]);
          marcacoesEmBranco.set(condenacao.id, emBranco);
        }
        if (mapa[rotulo]) {
          const chave = mapa[rotulo];
          registrar(`condenacoes[${condenacoes.indexOf(condenacao)}].${chave}`, trecho);
          if (camposOficiaisCondenacao.includes(chave)) {
            if (valor.trim()) {
              condenacaoOficial[chave] = valor;
              registrar(`oficial.condenacoes[${oficial.condenacoes.indexOf(condenacaoOficial)}].${chave}`, trecho);
            }
            if (["fracaoProgressao", "fracaoLivramento"].includes(chave)) atribuir(condenacao, chave, valor);
            return;
          }
          if (["violencia", "resultadoMorte", "reincidenteComum", "reincidenteEspecifico", "extinto", "suspenso"].includes(chave)) {
            if (!valor.trim()) return;
            const v = normalizar(valor);
            atribuir(condenacao, chave, ["s", "sim", "n", "nao"].includes(v) ? v === "s" || v === "sim" : undefined);
          } else atribuir(condenacao, chave, valor);
        }
        if (rotulo === "pena imposta") {
          registrar(`condenacoes[${condenacoes.indexOf(condenacao)}].pena`, trecho);
          atribuir(condenacao, "pena", duracao(valor));
        }
        if (rotulo === "data da infracao") {
          registrar(`condenacoes[${condenacoes.indexOf(condenacao)}].dataFato`, trecho);
          atribuir(condenacao, "dataFato", data(valor));
        }
      });
    });
    const aptas = condenacoes.filter((c) => {
      const conflitosItem = conflitos.get(c);
      const pendente = (c.situacaoSentenca && c.situacaoSentenca !== "ativo") ||
        c.extinto === true || c.suspenso === true || conflitosItem.has("extinto") || conflitosItem.has("suspenso");
      if (pendente) {
        (oficial.desmembramentosPendentes ||= []).push(c);
        avisar(`Condenação ${c.id}: situação da sentença ou do desmembramento`);
      }
      return !pendente;
    });
    aptas.forEach((c) => {
      if (c.reincidenteEspecifico === true) c.reincidencia = "especifico";
      else if (c.reincidenteEspecifico === false && c.reincidenteComum === true) c.reincidencia = "generico";
      else if (c.reincidenteEspecifico === false && c.reincidenteComum === false) c.reincidencia = "primario";
      if (!c.pena || !c.dataFato) avisar(`Condenação ${c.id}: pena ou data da infração`);
      linhasCanonicas.push(`Condenação ${aptas.indexOf(c) + 1}`);
      if (c.dataFato) {
        const [a, m, d] = c.dataFato.split("-");
        linhasCanonicas.push(`Data do fato: ${d}/${m}/${a}`);
      }
      if (c.pena) linhasCanonicas.push(`Pena: ${c.pena.anos} anos ${c.pena.meses} meses ${c.pena.dias} dias`);
      if (c.reincidencia) linhasCanonicas.push(`Reincidência: ${c.reincidencia}`);
    });
    const { entrada, origens } = leitura.analisarPaginas([{ texto: linhasCanonicas.join("\n"), origem }]);
    entrada.condenacoes = aptas.map((c, i) => ({ ...entrada.condenacoes[i], ...c }));
    // I22: a leitura genérica marca campos que o leitor dedicado preenche logo acima;
    // só permanece pendente o campo que continua sem valor depois da mescla.
    entrada.pendencias = (entrada.pendencias || []).filter((mensagem) => {
      const campo = /^condenacoes\[(\d+)\]\.(\w+): não identificado com segurança\./.exec(mensagem);
      return !campo || entrada.condenacoes[Number(campo[1])]?.[campo[2]] === undefined;
    });
    if (regime) entrada.regimeAtual = regime;

    [["termino", "Término"], ["progressao", "Progressão"], ["livramento", "Livramento"]].forEach(([chave, nome]) => {
      const lista = campos(secoes[chave]);
      const prevista = unico(lista, /^(?:data prevista (?:para )?(?:o )?(?:termino (?:da )?pena|progressao de regime|livramento condicional)|data (?:prevista|do beneficio))$/, nome, (v) => {
        if (/^\(/.test(v)) return null;
        // I06: "DD/MM/AAAA (Em livramento condicional deferido em ...)": a data vale; a observação é situação.
        const inicioData = v.match(/^(\d{2}\/\d{2}\/\d{4})\s*\(/);
        return data(inicioData ? inicioData[1] : v);
      }, `oficial.${chave}`);
      if (prevista) oficial[chave] = prevista;
      // I06: "(Em regime aberto deferido em ...)" e semelhantes: guarda a situação, sem inventar data.
      const situacao = lista.find((c) => /^data prevista/.test(c.rotulo) && /\(/.test(c.valor));
      if (situacao) oficial[`${chave}Situacao`] = situacao.valor.replace(/^[^(]*\(/, "").replace(/\)\s*$/, "").trim();
      if (chave !== "termino") {
        const base = unico(lista, /^data[- ]base(?: considerada| adotada no calculo para (?:progressao de regime|progresso regime|livramento condicional))?$/, `${nome}: data-base`, data, `oficial.${chave}DataBase`);
        const fracao = unico(lista, /^fracao(?: adotada)?$/, `${nome}: fração`, literal, `oficial.${chave}Fracao`);
        if (base) oficial[`${chave}DataBase`] = base;
        if (fracao) oficial[`${chave}Fracao`] = fracao;
      }
    });
    const incidentesConcedidos = new WeakSet();
    const incidentesGenericos = new WeakSet();
    function registros(linhas, concedido = false, generico = false) {
      const itens = [];
      let atual;
      campos(linhas).forEach(({ rotulo, valor, trecho }) => {
        if (rotulo === "tipo") {
          atual = { tipo: valor }; itens.push(atual);
          if (concedido) incidentesConcedidos.add(atual);
          if (generico) incidentesGenericos.add(atual);
          registrar(`oficial.${atual.tipo}.${itens.length - 1}.tipo`, trecho);
          return;
        }
        if (!atual || !valor) return;
        const nomes = { motivo: "motivo", complemento: "complemento", data: "data", "data decisao": "dataDecisao", "data referencia": "dataReferencia", "processos selecionados": "processos", situacao: "situacao", status: "status", resultado: "resultado", decreto: "decreto" };
        const chave = nomes[rotulo];
        if (!chave) return;
        const convertido = chave.startsWith("data") ? data(valor) : valor;
        if (convertido === undefined) avisar(`${atual.tipo}: ${rotulo}`);
        else {
          atual[chave] = convertido;
          registrar(`oficial.${atual.tipo}.${chave}`, trecho);
        }
      });
      return itens;
    }
    if (!secoes.eventos) alertas.push("Eventos de início, reinício e interrupção: seção ausente no relatório. Confira prisões e interrupções em outro documento.");
    oficial.eventos = registros(secoes.eventos);
    oficial.incidentes = blocosIncidentes.flatMap((bloco) => registros(bloco.linhas, bloco.concedido, bloco.generico));
    const incidenteConcedido = (incidente) => incidentesConcedidos.has(incidente) ||
      (incidentesGenericos.has(incidente) &&
        [incidente.situacao, incidente.status, incidente.resultado]
          .some((situacao) => /^(?:concedid[oa]|deferid[oa])\b/.test(normalizar(situacao || ""))));
    const regimeDoTexto = (valor) => {
      const match = normalizar(String(valor || "")).replace(/[–—]/g, " ")
        .match(/\b(semi\s*aberto|semiaberto|fechado|aberto)\b/);
      return match ? match[1].replace(/\s/g, "") : undefined;
    };
    if (oficial.eventos.length) lembrar("Confira os eventos e períodos de prisão e interrupção antes de usar os dados.");
    oficial.interrupcoes = oficial.eventos.filter((evento) =>
      /^interrupcao\b/.test(normalizar(evento.tipo || "")))
      .map((evento) => ({
        tipo: evento.tipo,
        ...(evento.data ? { data: evento.data } : {}),
        ...(evento.motivo ? { motivo: evento.motivo } : {})
      }));
    if (oficial.incidentes.length) lembrar("Confira os incidentes e os efeitos de cada decisão.");
    const incidentesRegime = oficial.incidentes.filter((incidente) =>
      /^fixacao\/alteracao de regime\b/.test(normalizar(incidente.tipo || "")) &&
      incidenteConcedido(incidente));
    const registrosRegime = incidentesRegime.map((incidente) => ({
      regime: regimeDoTexto(incidente.complemento),
      data: incidente.dataDecisao || incidente.dataReferencia || incidente.data
    }));
    const progressoesOficiais = incidentesRegime
      .filter((incidente) => /progressao de regime/.test(normalizar(incidente.complemento || "")))
      .map((incidente) => ({
        ...(incidente.dataDecisao || incidente.dataReferencia || incidente.data
          ? { data: incidente.dataDecisao || incidente.dataReferencia || incidente.data } : {}),
        ...(regimeDoTexto(incidente.complemento) ? { regime: regimeDoTexto(incidente.complemento) } : {})
      }));
    const regressoesOficiais = incidentesRegime
      .filter((incidente) => /\bregressao\b/.test(normalizar(incidente.complemento || "")))
      .map((incidente) => ({
        ...(incidente.dataDecisao || incidente.dataReferencia || incidente.data
          ? { data: incidente.dataDecisao || incidente.dataReferencia || incidente.data } : {}),
        ...(regimeDoTexto(incidente.complemento) ? { regime: regimeDoTexto(incidente.complemento) } : {})
      }));
    if (progressoesOficiais.length) oficial.progressoes = progressoesOficiais;
    if (regressoesOficiais.length) oficial.regressoes = regressoesOficiais;
    if (progressoesOficiais.length || regressoesOficiais.length) {
      lembrar("Progressões e regressões foram identificadas nos incidentes; confira as datas e os regimes.");
    }
    oficial.incidentes.filter((incidente) =>
      incidenteConcedido(incidente) && /^homologacao de falta grave\b/.test(normalizar(incidente.tipo || "")))
      .forEach((incidente) => {
        const datas = [...String(incidente.complemento || "").matchAll(/\b\d{2}\/\d{2}\/\d{4}\b/g)]
          .map((match) => data(match[0]));
        if (datas.length !== 1 || !datas[0]) {
          avisar("Falta grave homologada: a data no complemento está ausente, inválida ou ambígua.");
          return;
        }
        entrada.faltasGraves.push({
          data: datas[0],
          homologada: true,
          origem: `Incidente SEEU: ${incidente.tipo} — ${incidente.complemento}`
        });
        alertas.push("Falta grave homologada importada do incidente; confira a data e os demais dados antes de usar.");
      });
    // I20: conferências independentes dos dados lidos; não alteram o cálculo.
    const conferencias = [];
    function registrarConferencia(id, situacao, conta) {
      conferencias.push({ id, situacao, conta });
    }
    const penaCumpridaMaisRemanescente = somarPenas([oficial.penaCumprida, oficial.penaRemanescente]);
    if (penaCumpridaMaisRemanescente && oficial.penaTotal) {
      registrarConferencia("SC-01",
        penasIguais(penaCumpridaMaisRemanescente, oficial.penaTotal) ? "bateu" : "não bateu",
        `Pena cumprida (${descreverPena(oficial.penaCumprida)}) + pena remanescente (${descreverPena(oficial.penaRemanescente)}) = ${descreverPena(penaCumpridaMaisRemanescente)}; pena total imposta (${descreverPena(oficial.penaTotal)}).`);
    } else {
      registrarConferencia("SC-01", "não deu para conferir",
        "Pena cumprida + pena remanescente = pena total imposta; faltam valores válidos.");
    }

    const situacoesConhecidas = condenacoes.every((c) =>
      c.extinto === true || c.suspenso === true || (c.extinto === false && c.suspenso === false));
    const crimesIncluidos = condenacoes.filter((c) => c.extinto === false && c.suspenso === false);
    const somaPenasCrimes = somarPenas(crimesIncluidos.map((c) => c.pena));
    if (condenacoes.length && oficial.penaTotal && situacoesConhecidas && somaPenasCrimes) {
      registrarConferencia("SC-02",
        penasIguais(somaPenasCrimes, oficial.penaTotal) ? "bateu" : "não bateu",
        `Penas de ${crimesIncluidos.length} crime(s) não suspenso(s) nem extinto(s) somam ${descreverPena(somaPenasCrimes)}; a pena total imposta é ${descreverPena(oficial.penaTotal)}.`);
    } else {
      registrarConferencia("SC-02", "não deu para conferir",
        "Soma das penas dos crimes não suspensos e não extintos = pena total imposta; faltam penas ou situações válidas.");
    }

    const sentencasConferiveis = sentencas.length > 0 && sentencas.every((sentenca) =>
      sentenca.totalValido && diasPena(sentenca.penaTotal) !== undefined &&
      sentenca.crimes.length > 0 && sentenca.crimes.every((c) => diasPena(c.pena) !== undefined));
    if (sentencasConferiveis) {
      const contas = sentencas.map((sentenca, indice) => {
        const soma = sentenca.crimes.reduce((total, c) => total + diasPena(c.pena), 0);
        const total = diasPena(sentenca.penaTotal);
        return { soma, total, texto: `Sentença ${indice + 1}: penas dos crimes somam ${soma} dia(s); pena total é ${total} dia(s)` };
      });
      registrarConferencia("SC-03", contas.every((item) => item.soma === item.total) ? "bateu" : "não bateu",
        `${contas.map((item) => item.texto).join("; ")}.`);
    } else {
      registrarConferencia("SC-03", "não deu para conferir",
        "Em cada sentença, soma das penas dos crimes = pena total da sentença; faltam valores válidos.");
    }

    const incidentesRemicao = oficial.incidentes.filter((incidente) =>
      /remicao/.test(normalizar(incidente.tipo || "")));
    const diasDosIncidentesRemicao = incidentesRemicao.map((incidente) => {
      const complemento = normalizar(incidente.complemento || "");
      const match = complemento.match(/\b(\d+)\s*dia(?:s|\(s\))\s+remid(?:o|a)(?:s|\(s\))?\b/);
      return match && Number.isSafeInteger(Number(match[1])) ? Number(match[1]) : undefined;
    });
    const somaRemicoes = diasDosIncidentesRemicao.reduce((soma, dias) => soma + (dias || 0), 0);
    if (blocosIncidentes.length && Number.isSafeInteger(oficial.remicaoDias) &&
        diasDosIncidentesRemicao.every(Number.isSafeInteger) && Number.isSafeInteger(somaRemicoes)) {
      registrarConferencia("SC-04",
        oficial.remicaoDias === somaRemicoes ? "bateu" : "não bateu",
        `Saldo de ${oficial.remicaoDias} dia(s) remido(s) = soma de ${somaRemicoes} dia(s) nos incidentes de remição.`);
    } else {
      registrarConferencia("SC-04", "não deu para conferir",
        "Saldo de dias remidos = soma dos incidentes de remição; faltam valores válidos.");
    }

    if (regime && registrosRegime.length && registrosRegime.every((item) => item.regime && item.data)) {
      const datasRegime = registrosRegime.map((item) => item.data).sort();
      const ultimaData = datasRegime[datasRegime.length - 1];
      const regimesUltimaData = new Set(registrosRegime
        .filter((item) => item.data === ultimaData).map((item) => item.regime));
      if (regimesUltimaData.size === 1) {
        const ultimoRegime = [...regimesUltimaData][0];
        registrarConferencia("SC-05", regime === ultimoRegime ? "bateu" : "não bateu",
          `Regime atual (${regime}) = regime do último incidente de fixação ou alteração (${ultimoRegime}).`);
      } else {
        registrarConferencia("SC-05", "não deu para conferir",
          "Regime atual = regime do último incidente de fixação ou alteração; há mais de um regime na data mais recente.");
      }
    } else {
      registrarConferencia("SC-05", "não deu para conferir",
        "Regime atual = regime do último incidente de fixação ou alteração; faltam dados válidos.");
    }

    const caracteresSobra = contarSobras(texto);
    registrarConferencia("SC-06", caracteresSobra === 0 ? "bateu" : "não bateu",
      `${caracteresSobra} caractere(s) sem rótulo reconhecido.`);
    // I08: períodos de prisão a partir dos eventos do relatório (a conferir).
    // "PRISÃO/INÍCIO DE CUMPRIMENTO" abre um período; "INTERRUPÇÃO" fecha o período aberto.
    if (!entrada.prisoes?.length && oficial.eventos.length) {
      const ordenados = oficial.eventos.filter((e) => e.data).slice().sort((a, b) => a.data.localeCompare(b.data));
      const prisoes = [];
      let aberto = null;
      let ambiguo = oficial.eventos.some((e) => !e.data);
      const ABRE = /^prisao\/inicio de cumprimento$|^(?:prisao|inicio de cumprimento|reinicio|recaptura)\b/;
      const ehLivramento = (e) => ABRE.test(normalizar(e.tipo || "")) && /livramento condicional/.test(normalizar(e.motivo || ""));
      // I11: datas em que o relatório registra o início do livramento condicional.
      const datasLivramento = new Set(ordenados.filter(ehLivramento).map((e) => e.data));
      const livramentos = [];
      const processarEvento = (evento) => {
        const tipo = normalizar(evento.tipo || "");
        const motivo = normalizar(evento.motivo || "");
        if (ABRE.test(tipo) && /livramento condicional/.test(motivo)) {
          // I11: o SEEU conta o período de prova do livramento como pena cumprida. O início do
          // livramento continua o período em curso (ou abre um novo, se não houver período aberto).
          livramentos.push(evento.data);
          if (aberto) { aberto.origem += ` (livramento condicional desde ${evento.data})`; return; }
          aberto = { inicio: evento.data, fim: null, tipo: "definitiva", origem: `Evento SEEU: ${evento.tipo} — ${evento.motivo}` };
          prisoes.push(aberto);
          return;
        }
        if (ABRE.test(tipo)) {
          if (aberto) { ambiguo = true; return; }
          // I08: o relatório conta o período como cumprimento da pena (inclusive o que começou
          // em flagrante). Marcar como provisória duplicaria o tempo como detração.
          aberto = { inicio: evento.data, fim: null, tipo: "definitiva", origem: `Evento SEEU: ${evento.tipo}${evento.motivo ? ` — ${evento.motivo}` : ""}` };
          if (/flagrante|preventiva|temporaria/.test(motivo)) aberto.iniciouComo = "provisoria";
          prisoes.push(aberto);
        } else if (/^interrupcao\b/.test(tipo)) {
          // I11: a interrupção na mesma data do início do livramento é a saída da prisão para o
          // período de prova, que o relatório continua contando como cumprimento.
          if (datasLivramento.has(evento.data)) return;
          if (!aberto) { ambiguo = true; return; }
          aberto.fim = evento.data;
          aberto.origem += ` até ${evento.tipo}${evento.motivo ? ` — ${evento.motivo}` : ""}`;
          aberto = null;
        } else {
          ambiguo = true;
        }
      };
      for (let inicio = 0; inicio < ordenados.length;) {
        let fim = inicio + 1;
        while (fim < ordenados.length && ordenados[fim].data === ordenados[inicio].data) fim += 1;
        const grupo = ordenados.slice(inicio, fim);
        const interrupcoesNoDia = grupo.filter((evento) => /^interrupcao\b/.test(normalizar(evento.tipo || "")));
        const novosInicios = grupo.filter((evento) =>
          ABRE.test(normalizar(evento.tipo || "")) && !ehLivramento(evento));
        if (aberto && interrupcoesNoDia.length && novosInicios.length) {
          interrupcoesNoDia.forEach(processarEvento);
          grupo.filter((evento) => !interrupcoesNoDia.includes(evento)).forEach(processarEvento);
        } else {
          grupo.forEach(processarEvento);
        }
        inicio = fim;
      }
      if (prisoes.length && !ambiguo) {
        entrada.prisoes = prisoes;
        lembrar("Prisões montadas a partir dos eventos do relatório; confira início, término e tipo de cada período.");
        if (prisoes.some((p) => p.iniciouComo === "provisoria")) {
          alertas.push("Período iniciado por prisão cautelar foi tratado como cumprimento, como no relatório; se for detração, ajuste o tipo.");
        }
        livramentos.forEach((dataLivramento) => {
          alertas.push(`Livramento condicional desde ${dataLivramento.split("-").reverse().join("/")}: o relatório conta o período de prova como pena cumprida e as prisões montadas seguem o relatório. Se o livramento for revogado, esse tempo pode não contar (CP, art. 88; LEP, art. 141 e 142); confira.`);
        });
      } else if (prisoes.length) {
        alertas.push("Eventos do relatório com sequência não reconhecida; preencha as prisões manualmente.");
      }
    }
    // I10: conserva as penas originais; a diferença positiva com comutação concedida
    // entra uma única vez para aplicação pelo motor (E100), sempre a conferir.
    if (oficial.penaTotal && entrada.condenacoes.length && entrada.condenacoes.every((c) => c.pena)) {
      const emDias = (p) => p.anos * 365 + p.meses * 30 + p.dias;
      const diferenca = entrada.condenacoes.reduce((soma, c) => soma + emDias(c.pena), 0) - emDias(oficial.penaTotal);
      if (Math.abs(diferenca) > 10) {
        oficial.diferencaPenaTotalDias = diferenca;
        const comutacoes = oficial.incidentes.filter((i) => (incidentesConcedidos.has(i) || (incidentesGenericos.has(i) &&
          [i.situacao, i.status, i.resultado].some((situacao) => /^(?:concedid[oa]|deferid[oa])\b/.test(normalizar(situacao || ""))))) &&
          /^comutacao\b/.test(normalizar(i.tipo || "")) &&
          !/indeferid|pendente|revogad|rejeitad|negad|nao (?:concedid|deferid|apreciad)|aguardando|em analise|em andamento/.test(
            normalizar([i.tipo, i.complemento, i.situacao, i.status, i.resultado].filter(Boolean).join(" "))
          ));
        const medidaSeguranca = (oficial.incidentes || []).some((i) => /medida de seguranca/.test(normalizar(i.tipo || "")));
        // I12: com medida de segurança registrada, a pena total do relatório deixa de refletir as condenações.
        if (medidaSeguranca) alertas.push("Medida de segurança registrada nos incidentes do relatório: a calculadora não calcula medida de segurança (CP, art. 96 a 99; LEP, art. 183); confira a situação antes de usar o resultado.");
        else if (comutacoes.length && diferenca > 0) {
          const item = {
            dias: diferenca,
            origem: "Diferença entre a soma das condenações e a pena total do relatório — a conferir"
          };
          if (comutacoes.length === 1) {
            const incidente = comutacoes[0];
            if (incidente.dataDecisao) item.dataDecisao = incidente.dataDecisao;
            const textoDecreto = normalizar(incidente.decreto ? `Decreto ${incidente.decreto}` : incidente.complemento || "");
            const decreto = textoDecreto.match(/\bdecreto\s*(?:n[º°o.]?\s*)?(\d[\d.]*)(?:\s*\/\s*(\d{4})|,\s*de\s+\d{1,2}\s+de\s+[a-z]+\s+de\s+(\d{4}))?/);
            if (decreto && Number(decreto[1].replace(/\./g, "")) > 0) {
              const ano = decreto[2] || decreto[3];
              item.decreto = `${decreto[1]}${ano ? `/${ano}` : ""}`;
            }
            const faltantes = [!item.decreto && "o decreto", !item.dataDecisao && "a data da decisão"].filter(Boolean);
            if (faltantes.length) alertas.push(`Comutação: preencha ${faltantes.join(" e ")} com base na decisão; o relatório não permite inferir esses dados.`);
          } else {
            alertas.push("Comutação: diferença agregada de várias decisões, lançada uma única vez. Confira os dias de cada decisão e preencha os respectivos decretos e datas antes de calcular períodos históricos.");
          }
          entrada.comutacoes = [item];
          alertas.push(`Comutação: a pena total do relatório é ${diferenca} dia(s) menor que a soma das condenações; a diferença foi lançada como comutação já concedida, a conferir. As penas originais foram preservadas.`);
        } else alertas.push(`Pena total do relatório difere da soma das condenações em ${diferenca} dia(s); confira as penas de cada condenação.`);
      }
    }
    // I12: condenação com pena imposta zerada (só multa, pena extinta ou substituída) é sinalizada.
    entrada.condenacoes.forEach((c) => {
      if (c.pena && c.pena.anos === 0 && c.pena.meses === 0 && c.pena.dias === 0) {
        alertas.push(`Condenação ${c.id}: pena imposta zerada no relatório (pode ser só multa, pena extinta ou substituída); confira se deve entrar no cálculo.`);
      }
    });
    // I09: o saldo de dias remidos do relatório (remidos menos perdidos) entra como remição a conferir.
    if (!entrada.remicoes?.length && Number.isInteger(oficial.remicaoDias) && oficial.remicaoDias > 0) {
      const decisao = (oficial.incidentes || []).filter((i) => /remicao/.test(normalizar(i.tipo || "")) && (i.dataDecisao || i.data))
        .map((i) => i.dataDecisao || i.data).sort().pop();
      entrada.remicoes = [{
        dias: oficial.remicaoDias, homologada: true, ...(decisao ? { dataHomologacao: decisao } : {}),
        origem: "Saldo de dias remidos do relatório SEEU (remidos menos perdidos)"
      }];
      alertas.push("Remição: usado o saldo de dias remidos do relatório; confira as decisões de homologação e de perda.");
    }
    natureza.aplicarSugestoes(entrada, alertas, origens, rastros);
    // E102–E113: triagem documental, sem alterar a entrada ou os critérios de cálculo.
    if (dataValida(dataCalculo) && oficial.penaRemanescente &&
        diasPena(oficial.penaRemanescente) === 0) {
      registrarAviso("E102", "possível providência",
        `O relatório informa pena remanescente zerada; confira se a pena consta como cumprida na data do cálculo (${dataBR(dataCalculo)}).`);
    }
    const situacaoLivramento = normalizar(oficial.livramentoSituacao || "");
    const livramentoConcedido = /concedid|deferid/.test(situacaoLivramento) ||
      oficial.incidentes.some((incidente) =>
        incidenteConcedido(incidente) && /livramento condicional/.test(normalizar(incidente.tipo || ""))) ||
      oficial.eventos.some((evento) => /livramento condicional/.test(normalizar(evento.motivo || "")));
    if (dataValida(dataCalculo) && oficial.progressao &&
        oficial.progressao < dataCalculo && entrada.regimeAtual &&
        entrada.regimeAtual !== "aberto" &&
        !(oficial.progressoes || []).some((item) => item.data && item.data >= oficial.progressao) &&
        !livramentoConcedido &&
        !/concedid|deferid/.test(normalizar(oficial.progressaoSituacao || ""))) {
      registrarAviso("E103", "possível providência",
        "Data prevista para a progressão já passou e não há benefício posterior anotado: verificar pedido de progressão (requisito objetivo aparentemente cumprido).");
    }
    const vedacaoLivramento = entrada.condenacoes.some((condenacao) => {
      const naturezaCrime = condenacao.natureza;
      const categoriasVedadas = ["hediondo", "hediondo_morte", "feminicidio",
        "comando_orcrim", "trafico_privilegiado", "equiparado"];
      return condenacao.reincidenteEspecifico === true && categoriasVedadas.includes(naturezaCrime) ||
        ["art2-paragrafo4-III", "art3-paragrafo-unico"].includes(condenacao.lei15358LC) &&
          dataValida(condenacao.dataFato) && condenacao.dataFato >= "2026-03-25" ||
        /vedad|nao cabe/.test(situacaoLivramento);
    });
    if (dataValida(dataCalculo) && oficial.livramento &&
        oficial.livramento < dataCalculo && !livramentoConcedido && !vedacaoLivramento) {
      registrarAviso("E104", "possível providência",
        "Data prevista para o livramento condicional já passou e não há livramento concedido anotado: verificar possível pedido, sem prejuízo da conferência das vedações (E42).");
    }
    const eventosComData = oficial.eventos.filter((evento) => evento.data)
      .slice().sort((a, b) => a.data.localeCompare(b.data));
    const ultimoEvento = eventosComData.length === oficial.eventos.length
      ? eventosComData[eventosComData.length - 1]
      : oficial.eventos[oficial.eventos.length - 1];
    const eventoInterrompe = (evento) =>
      /^(?:interrupcao|fuga)\b/.test(normalizar(evento.tipo || "")) ||
      /cumprimento nao iniciado/.test(normalizar([evento.tipo, evento.motivo].join(" ")));
    const eventoPrende = (evento) => /^(?:prisao|inicio|reinicio|recaptura)/.test(normalizar(evento.tipo || ""));
    // E105/I22: interrupção e nova prisão na mesma data indicam custódia contínua; livramento
    // concedido depois da interrupção também afasta a execução interrompida.
    const mesmaData = ultimoEvento?.data
      ? oficial.eventos.filter((evento) => evento.data === ultimoEvento.data) : [];
    const livramentoDepois = ultimoEvento?.data && oficial.incidentes.some((incidente) =>
      incidenteConcedido(incidente) && /livramento condicional/.test(normalizar(incidente.tipo || "")) &&
      (incidente.dataReferencia || incidente.dataDecisao || "") >= ultimoEvento.data);
    if (ultimoEvento && eventoInterrompe(ultimoEvento) &&
        !mesmaData.some(eventoPrende) && !livramentoDepois) {
      registrarAviso("E105", "possível providência",
       "Execução interrompida (fuga ou cumprimento não iniciado): verificar prescrição da pretensão executória. Marco inicial: Tema 788 do STF (CONFERIR).");
    }
    const datasSomatorio = oficial.incidentes.filter((incidente) =>
      /somatorio de penas/.test(normalizar([incidente.tipo, incidente.complemento].join(" "))))
      .map((incidente) => incidente.dataDecisao || incidente.dataReferencia || incidente.data)
      .filter(Boolean);
    const basesIguais = [oficial.progressaoDataBase, oficial.livramentoDataBase]
      .some((base) => base && datasSomatorio.includes(base));
    if (basesIguais) {
      registrarAviso("E106", "possível providência",
        "A data-base coincide com a data de um “Somatório de Penas”; conferir se a unificação alterou indevidamente a data-base (STJ, REsp 1.557.461/SC — CONFERIR).");
    }
    entrada.condenacoes.forEach((condenacao) => {
        const fracoes = [condenacao.fracaoProgressao, condenacao.fracaoLivramento].filter(Boolean);
        const fracaoUmSexto = (fracao) => /^1\s*\/\s*6(?:\D|$)/.test(normalizar(String(fracao || "")));
        if (condenacao.dataFato && condenacao.dataFato < "2020-01-23" &&
            fracoes.some((fracao) => /%|por cento/.test(normalizar(fracao)))) {
          registrarAviso("E107", "possível providência",
            `Condenação ${condenacao.id}: fração percentual em crime anterior a 23/01/2020; verificar a regra mais benéfica.`);
        }
        const marcacoes = marcacoesEmBranco.get(condenacao.id);
        if (marcacoes?.size && fracoes.length) {
          registrarAviso("E108", "dado a conferir",
            `Condenação ${condenacao.id}: marcação em branco (${[...marcacoes].join(", ")}) pode alterar a fração; confira o relatório.`);
        }
        const reincidenciaMarcada = [condenacao.reincidenteComum,
          condenacao.reincidenteEspecifico].includes(true);
        const marcacaoAfetandoProgressao = reincidenciaMarcada ||
          [condenacao.violencia, condenacao.resultadoMorte, condenacao.comandoOrcrim].includes(true);
        const fracaoLivramento = normalizar(condenacao.fracaoLivramento || "");
        const livramentoPrimarioComReincidencia = reincidenciaMarcada &&
          (/primari/.test(fracaoLivramento) || /\b1\s*\/\s*3\b/.test(fracaoLivramento));
        const livramentoReincidenteSemReincidencia = !reincidenciaMarcada &&
          /reincident/.test(fracaoLivramento);
        const fracaoProgressao = normalizar(condenacao.fracaoProgressao || "");
        const progressaoPrimarioComReincidencia = reincidenciaMarcada &&
          /%|por cento/.test(fracaoProgressao) &&
          (/\b16\s*%/.test(fracaoProgressao) || /primari/.test(fracaoProgressao));
        if (fracaoUmSexto(condenacao.fracaoProgressao) && marcacaoAfetandoProgressao ||
            progressaoPrimarioComReincidencia || livramentoPrimarioComReincidencia ||
            livramentoReincidenteSemReincidencia) {
          registrarAviso("E110", "dado a conferir",
            `Condenação ${condenacao.id}: a fração registrada e as marcações de reincidência ou violência podem não coincidir; confira ambos os dados.`);
        }
        if (condenacao.dataFato >= "2020-01-23" &&
            fracoes.some(fracaoUmSexto)) {
          registrarAviso("E111", "dado a conferir",
            `Condenação ${condenacao.id}: fração 1/6 registrada para crime posterior a 23/01/2020; confira a fração e os dados da condenação.`);
        }
        const artigo = normalizar(condenacao.artigo || "");
        const lei = normalizar(condenacao.lei || "");
        if (condenacao.violencia === false && /\b129\b/.test(artigo) &&
            (/\bcp\b|codigo penal|2848/.test(lei))) {
          registrarAviso("E113", "dado a conferir",
            `Condenação ${condenacao.id}: “Violência ou grave ameaça: Não” em lesão corporal; confira essa marcação. O cálculo mantém os dados do relatório.`);
        }
    });
    if (oficial.processos?.some((processo) =>
        [processo.dataTransitoMinisterioPublico, processo.dataTransitoProcesso]
          .some((data) => normalizar(data || "") === "nao informado"))) {
      registrarAviso("E109", "dado a conferir",
        "Trânsito em julgado consta como “Não informado”; confira a certidão e os dados do processo.");
    }
    if (dataValida(dataCalculo) && oficial.dataEmissao) {
      const diasDesdeEmissao = (Date.parse(`${dataCalculo}T00:00:00Z`) -
        Date.parse(`${oficial.dataEmissao}T00:00:00Z`)) / 86400000;
      if (Number.isInteger(diasDesdeEmissao) && diasDesdeEmissao > 30) {
        registrarAviso("E112", "dado a conferir",
          `O relatório foi gerado há ${diasDesdeEmissao} dias na data do cálculo (${dataBR(dataCalculo)}); confira se há documento mais recente.`);
      }
    }
    entrada.atestadoSEEU = oficial;
    const pendencias = [...new Set([...entrada.pendencias, ...alertas])];
    const lembretesResultado = [...new Set([
      ...lembretes,
      ...pendencias.filter((mensagem) =>
        /^Confira no documento também prisões, interrupções, detrações, remições e faltas graves: listas vazias não significam ausência de eventos\.$/.test(mensagem))
    ])];
    const alertasResultado = pendencias.filter((mensagem) =>
      !lembretesResultado.includes(mensagem));
    entrada.pendencias = pendencias;
    return {
      calcpen: entrada, oficial, alertas: alertasResultado, lembretes: lembretesResultado, origens, rastros,
      avisos: { possivelProvidencia: avisosProvidencia, dadoAConferir: avisosConferir },
      conferencias,
      versaoDocumento: reconhecimento?.reconhecido
        ? { tipo: reconhecimento.tipo, versao: reconhecimento.versao, reconhecido: true }
        : null
    };
  }

  return { ler };
});
