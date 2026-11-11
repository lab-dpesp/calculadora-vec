(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.DadosDecretos = root.DadosDecretos || {};
    root.DadosDecretos[api.identificacao.slice(-4)] = api;
  }
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const avaliacoes = {
    "9º, I": { tipo: "pena_e_tempo", penaMaximaAnos: 8, violencia: false, fracaoPrimario: 1 / 5, fracaoReincidente: 1 / 3 },
    "9º, II": { tipo: "pena_e_tempo", penaMaximaAnos: 12, violencia: false, fracaoPrimario: 1 / 3, fracaoReincidente: 1 / 2 },
    "9º, III": { tipo: "pena_e_tempo", penaMaximaAnos: 4, violencia: true, fracaoPrimario: 1 / 3, fracaoReincidente: 1 / 2 },
    "9º, IV": { tipo: "tempo_ininterrupto", anosPrimario: 15, anosReincidente: 20 },
    "9º, V": { tipo: "tempo_com_liberdade", anosPrimario: 20, anosReincidente: 25, maxAnosEmLiberdade: 2 },
    "9º, VI": { tipo: "tempo_semiaberto", anosPrimario: 10, anosReincidente: 15 },
    "9º, VII": { tipo: "regime_ou_alternativa", fracaoPrimario: 1 / 6, fracaoReincidente: 1 / 5 },
    "9º, VIII": { tipo: "regime_e_saldo", anosSaldoPrimario: 6, anosSaldoReincidente: 4 },
    "13, caput": { tipo: "comutacao_geral", fracaoPrimario: 1 / 5, fracaoReincidente: 1 / 4 },
  };

  const decreto = {
  "identificacao": "12.790/2025",
  "dataDecreto": "2025-12-22",
  "dataPublicacao": "2025-12-23",
  "dataReferencia": "2025-12-25",
  "fonte": "https://www2.camara.leg.br/legin/fed/decret/2025/decreto-12790-22-dezembro-2025-798547-publicacaooriginal-177536-pe.html",
  "requisitosGerais": [
    { "artigo": "2º", "criterio": "Benefício cabível nas hipóteses processuais descritas no decreto, inclusive trânsito para a acusação, certos recursos, livramento condicional e guia não expedida." },
    { "artigo": "3º", "criterio": "Aplicação também às penas substituídas, regimes aberto ou domiciliar, período de prova do livramento e suspensão condicional." },
    { "artigo": "4º", "criterio": "Indulto ou comutação da pena privativa de liberdade alcança a multa cumulativa; inadimplência não impede a declaração." },
    { "artigo": "5º", "criterio": "Computar prisão cautelar, domiciliar, especial e recolhimento domiciliar noturno, com ou sem monitoração, além da remição." },
    { "artigo": "6º", "criterio": "Não pode haver sanção judicial reconhecida por falta grave cometida nos 12 meses anteriores a 25/12/2025; falta cometida após a publicação não impede o benefício." },
    { "artigo": "7º, caput", "criterio": "Somar penas de infrações diversas até 25/12/2025." },
    { "artigo": "7º, parágrafo único", "criterio": "Em concurso com crime impeditivo, aguardar o cumprimento de dois terços da pena do crime impeditivo para declarar benefício sobre crime não impeditivo." },
    { "artigo": "8º", "criterio": "Não exigir exame criminológico nem requisito além dos previstos no decreto." },
    { "artigo": "14", "criterio": "Aferir reincidência em 25/12/2025." }
  ],
  "impedimentos": [
    { "artigo": "1º, I", "criterio": "Crime hediondo ou equiparado; classificar na data do fato como padrão PD-01 e exibir a classificação na data do decreto como cenário alternativo (D5)." },
    { "artigo": "1º, II", "criterio": "Crimes previstos na Lei 9.455/1997 (tortura)." },
    { "artigo": "1º, III", "criterio": "Crimes previstos na Lei 9.613/1998, salvo pena aplicada não superior a quatro anos." },
    { "artigo": "1º, IV", "criterio": "Crimes previstos na Lei 12.850/2013 e no art. 288-A do Código Penal." },
    { "artigo": "1º, V", "criterio": "Crimes previstos na Lei 13.260/2016 (terrorismo)." },
    { "artigo": "1º, VI", "criterio": "Crimes previstos na Lei 7.716/1989 (racismo)." },
    { "artigo": "1º, VII", "criterio": "Crimes previstos nos arts. 149 e 149-A do Código Penal." },
    { "artigo": "1º, VIII", "criterio": "Crimes previstos na Lei 2.889/1956 (genocídio)." },
    { "artigo": "1º, IX", "criterio": "Crimes previstos na Lei 7.492/1986, salvo pena aplicada não superior a quatro anos." },
    { "artigo": "1º, X", "criterio": "Crimes previstos nas Leis 14.133/2021 ou 8.666/1993, salvo pena aplicada não superior a quatro anos." },
    { "artigo": "1º, XI", "criterio": "Crimes previstos nos arts. 215, 216-A, 217-A, 218, 218-A, 218-B e 218-C do Código Penal." },
    { "artigo": "1º, XII", "criterio": "Crimes previstos nos arts. 312 a 319 e 333 do Código Penal, salvo pena aplicada não superior a quatro anos." },
    { "artigo": "1º, XIII", "criterio": "Crimes previstos nos arts. 239 a 244-B do ECA." },
    { "artigo": "1º, XIV", "criterio": "Crimes previstos na Lei 9.605/1998 (crimes ambientais)." },
    { "artigo": "1º, XV", "criterio": "Crimes contra o Estado Democrático de Direito previstos nos arts. 359-I a 359-R do Código Penal." },
    { "artigo": "1º, XVI", "criterio": "Crimes previstos na Lei 13.869/2019 (abuso de autoridade)." },
    { "artigo": "1º, XVII", "criterio": "Crimes de violência contra a mulher previstos nos arts. 121-A e 147-A do Código Penal e na legislação indicada no decreto." },
    { "artigo": "1º, XVIII", "criterio": "Crimes de tráfico descritos no art. 33, caput e § 1º, e nos arts. 34 a 37 e 39 da Lei 11.343/2006." },
    { "artigo": "1º, XIX", "criterio": "Crimes militares correspondentes aos crimes impeditivos dos incisos I a XVIII." },
    { "artigo": "1º, § 1º", "criterio": "Pessoa que firmou acordo de colaboração premiada, independentemente do crime." },
    { "artigo": "1º, § 2º", "criterio": "Indulto não alcança penas acessórias militares nem efeitos da condenação." },
    { "artigo": "1º, §§ 3º a 5º", "criterio": "Restrições relativas à liderança ou participação relevante em facção, RDD e estabelecimento penal de segurança máxima; decisão sobre liderança deve indicar elementos objetivos e admite renovação após absolvição ou não comprovação." }
  ],
  "indulto": {
    "penaPrivativaDeLiberdade": [
      { "artigo": "9º, I", "criterio": "Pena até 8 anos; crime sem violência ou grave ameaça; cumprir 1/5 se não reincidente ou 1/3 se reincidente." },
      { "artigo": "9º, II", "criterio": "Pena até 12 anos; crime sem violência ou grave ameaça; cumprir 1/3 se não reincidente ou 1/2 se reincidente." },
      { "artigo": "9º, III", "criterio": "Pena até 4 anos; crime com violência ou grave ameaça; cumprir 1/3 se não reincidente ou 1/2 se reincidente." },
      { "artigo": "9º, IV", "criterio": "Cumprir ininterruptamente 15 anos se não reincidente ou 20 anos se reincidente." },
      { "artigo": "9º, V", "criterio": "Cumprir não ininterruptamente 20 anos se não reincidente ou 25 anos se reincidente; período em liberdade não superior a 2 anos." },
      { "artigo": "9º, VI", "criterio": "Cumprir ininterruptamente em regime semiaberto 10 anos se não reincidente ou 15 anos se reincidente." },
      { "artigo": "9º, VII", "criterio": "Regime aberto, pena substituída ou suspensão condicional; cumprir 1/6 se não reincidente ou 1/5 se reincidente." },
      { "artigo": "9º, VIII", "criterio": "Em livramento condicional ou regime aberto; saldo de até 6 anos se não reincidente ou 4 anos se reincidente." },
      { "artigo": "9º, IX", "criterio": "Regime inicial aberto, pena substituída, livramento ou sursis; integrar programa de pré-egresso/egresso por pelo menos 2 anos e obter parecer favorável." },
      { "artigo": "9º, X", "criterio": "Regime semiaberto com monitoração, liberação fundada na SV 56 e permanência nessa condição por mais de 3 anos." },
      { "artigo": "9º, XI", "criterio": "Pena até 12 anos; cumprir 1/3 se não reincidente ou 1/2 se reincidente em regime semiaberto ou aberto; ao menos 5 saídas temporárias ou 12 meses de trabalho externo nos 3 anos anteriores." },
      { "artigo": "9º, XII", "criterio": "Pena até 12 anos; cumprir 1/6 se não reincidente ou 1/5 se reincidente; frequentar curso por 12 meses nos últimos 3 anos ou 18 meses nos últimos 5 anos, respectivamente." },
      { "artigo": "9º, XIII", "criterio": "Pena até 12 anos; cumprir 1/5 se não reincidente ou 1/4 se reincidente; concluir curso certificado nos 3 anos anteriores." },
      { "artigo": "9º, XIV", "criterio": "Crime patrimonial sem violência; bem de valor até um salário mínimo da época do fato; cumprir ao menos 3 meses." },
      { "artigo": "9º, XV", "criterio": "Crime patrimonial sem violência e reparação do dano até a data de referência, ressalvadas as hipóteses do art. 12, § 2º." },
      { "artigo": "9º, XVI", "criterio": "Hipóteses humanitárias de deficiência grave, HIV terminal, gestação de alto risco, doença grave com limitação ou cuidado indisponível, ou autismo severo, com comprovação médica prevista." },
      { "artigo": "9º, § 1º", "criterio": "Presume a incapacidade do estabelecimento para prestar cuidados em doenças expressamente listadas." },
      { "artigo": "9º, §§ 2º a 4º", "criterio": "Reduz pela metade os lapsos dos incisos I a XI para pessoas maiores de 60 anos, gestantes ou mulheres com filho até 16 anos, homens únicos responsáveis por filho menor de 16, cuidadores imprescindíveis de criança até 12 anos com doença grave ou deficiência, pessoas com deficiência e participantes de programa de justiça restaurativa; a redução dos grupos de cuidado não vale para violência contra filho, criança ou adolescente; prever encaminhamento ao SUAS." }
    ],
    "mulheres": [
      { "artigo": "10, caput e I a III", "criterio": "Indulto especial à mulher que não responda ou tenha condenação por outro crime violento, não tenha sido punida por falta grave e se enquadre em uma das categorias previstas." },
      { "artigo": "10, III, a a d", "criterio": "Mães e avós responsáveis por filho/neto de até 16 anos (ou pessoa com deficiência que necessite de cuidado) e mulheres com 60 anos ou mais, menores de 21 anos ou com deficiência; as hipóteses a a c exigem 1/8 cumprido, e a alínea d não prevê fração própria." }
    ],
    "multa": [
      { "artigo": "12, I", "criterio": "Multa não superior ao mínimo para ajuizamento de execução fiscal federal." },
      { "artigo": "12, II e §§ 1º e 2º", "criterio": "Multa acima do mínimo se comprovada incapacidade econômica; aplicável isolada ou cumulativamente e com presunções legais de incapacidade." }
    ]
  },
  "comutacao": {
    "mulheres": [
      { "artigo": "11, I", "criterio": "Reincidente, pena até 8 anos, crime sem violência e 1/3 cumprido: comutar 1/4." },
      { "artigo": "11, II", "criterio": "Não reincidente, crime sem violência, mãe de filho menor de 16 anos ou pessoa dependente com deficiência/doença grave e 1/5 cumprido: comutar 2/3." },
      { "artigo": "11, III", "criterio": "Reincidente, crime sem violência, mãe de filho menor de 16 anos ou pessoa dependente com deficiência/doença grave e 1/5 cumprido: comutar 1/2." }
    ],
    "geral": [
      { "artigo": "13, caput", "criterio": "Comutar 1/5 do saldo após cumprir 1/5 se não reincidente ou 1/4 se reincidente." },
      { "artigo": "13, §§ 1º e 2º", "criterio": "Regras de cálculo sobre período cumprido ou saldo quando houve comutação anterior, sem novo requisito temporal na hipótese prevista." },
      { "artigo": "13, §§ 3º a 5º", "criterio": "Rotas não cumulativas; aplicar a mais benéfica; grupo do art. 9º, § 2º, comutação de 2/3; não aplicar se preencher requisitos para indulto." }
    ]
  },
  };
    function catalogar(valor) {
      if (Array.isArray(valor)) return valor.map(catalogar);
      if (!valor || typeof valor !== "object") return valor;
      const resultado = {};
      Object.entries(valor).forEach(([chave, item]) => { resultado[chave] = catalogar(item); });
      if (valor === decreto) {
        resultado.id = "E70";
        resultado.vigencia = { inicio: decreto.dataPublicacao, fim: decreto.dataReferencia };
        resultado.status = "Pendente de validação";
      } else if (typeof valor.artigo === "string" && typeof valor.criterio === "string") {
        resultado.id = "E70";
        resultado.fonte = decreto.fonte;
        resultado.vigencia = { inicio: decreto.dataPublicacao, fim: decreto.dataReferencia };
        resultado.status = "Pendente de validação";
        if (avaliacoes[valor.artigo]) resultado.avaliacao = avaliacoes[valor.artigo];
      }
      return resultado;
    }
    return catalogar(decreto);
  });
