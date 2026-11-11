(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ExemploMinuta = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function criar() {
    return {
      formato: "calcpen",
      versao: 1,
      dataCalculo: "2026-10-01",
      entrada: {
        formato: "calcpen",
        versao: 1,
        processo: "processo de exemplo",
        condenacoes: [{ natureza: "comum", reincidencia: "primario" }],
        detracoesCautelares: [
          { data: "2026-02-01", horas: 12 },
          { data: "2026-02-02", horas: 24 }
        ],
        remicoes: [{ dias: 12, homologada: true }]
      },
      caso: {
        pessoa: "Pessoa de exemplo",
        processo: "processo de exemplo",
        juizo: "Juízo de exemplo",
        cidade: "Cidade de exemplo",
        unidade: "Unidade de exemplo",
        autor: "Defensor(a) de exemplo"
      },
      resultado: {
        cumprido: { emDias: 365 },
        restante: { emDias: 1095 },
        condenacoes: [{ regraPR: "E31-ERA2-COMUM-PRIMARIO", regraLC: "E41" }],
        progressao: { data: "2027-01-15", requisitoDias: 180, memoria: [{ regra: ["E20", "E30", "E31", "E38"] }] },
        livramento: { cabe: true, data: "2028-03-20", memoria: [{ regra: ["E24", "E25", "E40", "E41", "E43", "E44"] }] },
        saidaTemporaria: {
          cabe: true,
          data: "2027-06-10",
          finalidadesPermitidas: ["estudo"],
          memoria: [{ regra: ["E60", "E61"] }]
        },
        detracaoCautelarDias: 1,
        termino: "2030-10-01",
        memoriaTermino: { regra: ["E03", "E04", "E27", "E27-A", "E28", "E50"] },
        conferencia: [{
          item: "progressao",
          seeu: "2027-02-01",
          nossa: "2027-01-15",
          diferencaDias: -17,
          classificacao: "divergencia_juridica",
          explicacao: "Diferença apresentada para conferência no exemplo."
        }],
        avisos: [{ regra: "E60", texto: "Exemplo sujeito a conferência." }]
      }
    };
  }

  return { criar: criar };
});
