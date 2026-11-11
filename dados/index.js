(function (root, factory) {
  "use strict";
  const api = factory(typeof module === "object" && module.exports
    ? {
        eras: require("./eras.js"),
        fracoesProgressao: require("./fracoes-progressao.js"),
        fracoesLivramento: require("./fracoes-livramento.js"),
        vedacoes: require("./vedacoes.js"),
        decretos: require("./decretos.js"),
        naturezas: require("./natureza.js")
      }
    : {
        eras: root.DadosEras,
        fracoesProgressao: root.DadosFracoesProgressao,
        fracoesLivramento: root.DadosFracoesLivramento,
        vedacoes: root.DadosVedacoes,
        decretos: root.DadosDecretosLista,
        naturezas: root.DadosNatureza
      });
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DadosExecucaoPenal = api;
})(typeof globalThis === "object" ? globalThis : this, function (dados) {
  "use strict";

  const base = {
    versao: "2026.11.15",
    historico: [
      { versao: "2026.11.1", regras: [], descricao: "Versão inicial da base numerada; critérios de cálculo preservados." },
      { versao: "2026.11.2", regras: ["E96"], descricao: "Fim da prisão encerra a contagem; sem prisão ativa, as projeções dependem de novo recolhimento." },
      { versao: "2026.11.3", regras: ["E31"], descricao: "Distingue reincidência em crime violento conforme violência na condenação anterior." },
      { versao: "2026.11.4", regras: ["E97"], descricao: "Classificação da conferência quando o livramento não cabe; sem mudança no cálculo." },
      { versao: "2026.11.5", regras: ["D2", "D3", "E05"], descricao: "Motor aplica D2 às datas dos benefícios e D3 aos requisitos de progressão e saída temporária; padrões mantidos." },
      { versao: "2026.11.6", regras: ["E23", "E31", "E33", "E42", "E45"], descricao: "Atualiza eras 3A/3B, comparação de leis por condenação, base remanescente na falta e vedações independentes de LC." },
      { versao: "2026.11.7", regras: ["E13", "E23", "E27-A", "E31", "E33", "E37", "E45", "E60", "E61"], descricao: "Registra decisões provisórias da MVT e detalha o cálculo auxiliar de E27-A por período, feriados e exclusões." },
      { versao: "2026.11.8", regras: ["E97", "E98"], descricao: "Classifica divergências jurídicas, convenções de contagem, dados pendentes e diferenças sem explicação." },
      { versao: "2026.11.9", regras: ["E23", "E34", "D6", "D7", "E93"], descricao: "Usa saldos por condenação após falta, data do último requisito na progressão seguinte e cenário D7 desde a primeira prisão sem crédito duplicado." },
      { versao: "2026.11.10", regras: ["E39"], descricao: "Admite remição em regime domiciliar desde 08/05/2026 e mostra aplicação anterior como tese defensiva, sem abatimento silencioso." },
      { versao: "2026.11.11", regras: ["D8"], descricao: "Adiciona método opcional e provisório do TJSP/SAJ para progressão por condenação." },
      { versao: "2026.11.12", regras: ["E70", "E71"], descricao: "Estrutura triagem provisória de indulto/comutação e datas de falta grave; revisão da Assessoria Criminal pendente." },
      { versao: "2026.11.13", regras: ["E99", "I17"], descricao: "Adiciona sugestões provisórias de natureza do crime por lei, artigo e vigência; revisão da Assessoria Criminal pendente." },
      { versao: "2026.11.14", regras: ["E80", "E81", "E82"], descricao: "Adiciona critérios provisórios de prescrição por crime, marcos guiados, recaptura e confirmação documental à base com E99/I17; revisão da Assessoria Criminal pendente." },
      { versao: "2026.11.15", regras: ["E100"], descricao: "Aplica comutação já concedida ao término e, provisoriamente, à base remanescente dos benefícios, sem mudar a data-base; cenário contrário e revisão jurídica pendente." }
    ],
    prescricao: {
      E80: {
        art109: {
          faixasPenaMeses: [
            { acimaDe: 144, prazoMeses: 240 },
            { acimaDe: 96, prazoMeses: 192 },
            { acimaDe: 48, prazoMeses: 144 },
            { acimaDe: 24, prazoMeses: 96 }
          ],
          penaMinimaMeses: 12,
          prazoPenaMinimaMeses: 48,
          faixasDias: [
            { anos: 12, prazoAcimaMeses: 240, prazoIgualMeses: 192 },
            { anos: 8, prazoAcimaMeses: 192, prazoIgualMeses: 144 },
            { anos: 4, prazoAcimaMeses: 144, prazoIgualMeses: 96 },
            { anos: 2, prazoAcimaMeses: 96, prazoIgualMeses: 48 }
          ],
          prazoMinimo: { vigencia: "2010-05-06", antesMeses: 24, desdeMeses: 36 }
        },
        multiplicadorReincidencia: 4 / 3,
        redutorEtario: {
          multiplicador: 0.5,
          vedacaoViolenciaSexualMulherDesde: "2025-07-04"
        },
        fonte: "CP, arts. 109, 110 e 115; Leis 12.234/2010 e 15.160/2025",
        vigencia: { prazoMinimoDesde: "2010-05-06", vedacaoEtariaDesde: "2025-07-04" },
        status: "Pendente de validação"
      },
      E81: {
        corteTransitoAcusacao: "2020-11-12",
        fonte: "STF, Tema 788; REsp 2.073.668/RS (limite exato a CONFERIR)",
        vigencia: "2020-11-12",
        status: "Pendente de validação"
      },
      E82: {
        cortePrazo: "2010-05-06",
        prazoAntesMeses: 24,
        prazoDesdeMeses: 36,
        fonte: "STJ (aplicação analógica do art. 109, VI, do CP); Lei 12.234/2010",
        vigencia: "2010-05-06",
        status: "Pendente de validação"
      }
    }
  };

  return {
    ...base,
    eras: dados.eras,
    fracoesProgressao: dados.fracoesProgressao,
    fracoesLivramento: dados.fracoesLivramento,
    vedacoes: dados.vedacoes,
    decretos: dados.decretos,
    naturezas: dados.naturezas
  };
});
