(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DadosFracoesLivramento = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  return [
    { id: "E41", reincidencia: "primario", bonsAntecedentes: true, fracao: 1 / 3, maisDe: true, fonte: "CP art. 83, I", vigencia: { inicio: "1940-01-01", fim: null }, status: "Implementada" },
    { id: "E41", reincidencia: "reincidente", fracao: 1 / 2, maisDe: true, fonte: "CP art. 83, II", vigencia: { inicio: "1940-01-01", fim: null }, status: "Implementada" },
    { id: "E41", categorias: ["hediondo", "hediondo_morte", "trafico_privilegiado", "feminicidio"], equiparado: true, fracao: 2 / 3, maisDe: true, fonte: "CP art. 83, V", vigencia: { inicio: "1990-07-26", fim: null }, status: "Implementada" },
    { id: "E45", reincidencia: "primario", bonsAntecedentes: false, fracao: 1 / 3, fracaoAlternativa: 1 / 2, maisDe: true, fonte: "CP art. 83, I e II; STJ RHC 12.608/RJ; STF Informativo 146 e HC 78.410/RJ (CONFERIR)", vigencia: { inicio: "1940-01-01", fim: null }, status: "Decisão provisória (IA, 05/11/2026); revisão da Assessoria Criminal pendente" }
  ];
});
