(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DadosVedacoes = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  return [
    {
      id: "E41",
      categorias: ["hediondo", "hediondo_morte", "feminicidio", "comando_orcrim", "trafico_privilegiado", "equiparado"],
      reincidencia: "especifico",
      fundamento: "CP art. 83, V",
      fonte: "CP art. 83, V",
      vigencia: { inicio: "1990-07-26", fim: null },
      status: "Implementada"
    },
    {
      id: "E42-LEI15358-ART2-P4-III",
      enquadramento: "art2-paragrafo4-III",
      vigenciaMinima: "2026-03-25",
      fundamento: "Lei 15.358/2026, art. 2º, § 4º, III",
      fonte: "Lei 15.358/2026, art. 2º, § 4º, III",
      vigencia: { inicio: "2026-03-25", fim: null },
      status: "Decidida pelo Núcleo; fontes a conferir"
    },
    {
      id: "E42-LEI15358-ART3-PU",
      enquadramento: "art3-paragrafo-unico",
      vigenciaMinima: "2026-03-25",
      fundamento: "Lei 15.358/2026, art. 3º, parágrafo único",
      fonte: "Lei 15.358/2026, art. 3º, parágrafo único",
      vigencia: { inicio: "2026-03-25", fim: null },
      status: "Decidida pelo Núcleo; fontes a conferir"
    }
  ];
});
