(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TextosInterface = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const NOMES = {
    condenacoes: "Condenação", prisoes: "Prisão", interrupcoes: "Interrupção",
    detracoes: "Detração", remicoes: "Remição", comutacoes: "Comutação",
    faltasGraves: "Falta grave", progressoes: "Progressão", regressoes: "Regressão",
    atestadoSEEU: "Documento oficial", saldosCondenacoes: "Saldo da condenação",
    processo: "processo", dataFato: "data do fato", pena: "pena", penaRestante: "pena restante",
    anos: "anos", meses: "meses", dias: "dias", emDias: "total em dias",
    natureza: "natureza do crime", reincidencia: "reincidência",
    violencia: "houve violência ou grave ameaça?", resultadoMorte: "houve resultado morte?",
    equiparado: "crime equiparado a hediondo", bonsAntecedentes: "bons antecedentes",
    antecedenteViolento: "violência na condenação anterior", regimeInicial: "regime inicial",
    regimeAtual: "regime atual", inicio: "início", fim: "término", tipo: "tipo",
    origem: "origem do dado", id: "identificação", data: "data", homologada: "homologação",
    dataHomologacao: "data da homologação", dataDecisao: "data da decisão", decreto: "decreto",
    lei: "lei", artigo: "artigo", tituloXII: "crime do Título XII do Código Penal",
    emCumprimento: "pena em cumprimento", motivo: "motivo", para: "regime de destino", de: "regime anterior",
    dataTransito: "trânsito em julgado", dataTransitoAcusacao: "trânsito para a acusação",
    dataRequisitoSubjetivo: "data do requisito subjetivo", dataBaseReconhecida: "data-base reconhecida",
    progressao: "progressão", livramento: "livramento condicional", saidaTemporaria: "saída temporária",
    termino: "término da pena", dataEmissao: "data de emissão", penaTotalDias: "pena total em dias",
    penaCumpridaDias: "pena cumprida em dias", remicaoDias: "dias de remição", detracaoDias: "dias de detração",
    observacoes: "observações", pendencias: "pendência", formato: "formato do arquivo", versao: "versão",
    dataCalculo: "data do cálculo", entrada: "dados do cálculo", resposta: "resposta",
    calcpen: "arquivo de cálculo", JSON: "dados do arquivo", "tipo-documento": "tipo do documento",
    penaTotal: "pena total", penaCumprida: "pena cumprida", penaRemanescente: "pena restante",
    fracaoProgressao: "fração de progressão", fracaoLivramento: "fração de livramento",
    reincidenteComum: "reincidência comum", reincidenteEspecifico: "reincidência específica",
    situacaoSentenca: "situação da sentença", extinto: "pena extinta", suspenso: "pena suspensa",
    totalInterrupcoes: "total de interrupções", iniciouComo: "tipo de prisão no início",
    eventos: "Evento", incidentes: "Incidente", processos: "Processo",
    complemento: "complemento", progressaoSituacao: "situação da progressão",
    dataReferencia: "data de referência", diasPerdidosRemicao: "dias de remição perdidos"
  };

  function campo(caminho) {
    return String(caminho).split(".").map((parte) => {
      const item = parte.match(/^([\w-]+)(?:\[(\d+)\])?$/);
      if (!item) return "Dado a conferir";
      const nome = Object.prototype.hasOwnProperty.call(NOMES, item[1]) ? NOMES[item[1]]
        : item[1].replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").toLowerCase();
      return nome + (item[2] == null ? "" : " " + (Number(item[2]) + 1));
    }).join(" — ");
  }

  function valor(dados, caminho) {
    return caminho.replace(/\[(\d+)\]/g, ".$1").split(".").reduce((atual, chave) =>
      atual != null && Object.prototype.hasOwnProperty.call(atual, chave) ? atual[chave] : undefined, dados);
  }

  function preenchido(dado) {
    if (dado == null || dado === "" || dado === "desconhecido") return false;
    if (typeof dado === "object") return Object.keys(dado).length > 0 && Object.values(dado).every(preenchido);
    return true;
  }

  function pendencias(avisos, dados) {
    return [...new Set((avisos || []).map((aviso) => {
      const texto = String(aviso);
      const partes = texto.match(/^(\w+(?:\[\d+\]|\.\w+)*):\s*(.*)$/);
      if (!partes || (!/[.[]/.test(partes[1]) && !Object.prototype.hasOwnProperty.call(NOMES, partes[1]))) return texto;
      const ausencia = /não identificad|não consta|ausente|não informad/i.test(partes[2]) &&
        !/diverg|conflit|inválid/i.test(partes[2]);
      if (ausencia && preenchido(valor(dados, partes[1]))) return null;
      const rotulo = campo(partes[1]);
      return rotulo.endsWith("?") && ausencia
        ? rotulo + " Confira e preencha." : rotulo + ": " + partes[2];
    }).filter(Boolean))];
  }

  return { campo, pendencias };
});
