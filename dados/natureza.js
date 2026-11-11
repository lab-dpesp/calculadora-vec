(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DadosNatureza = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const status = "Provisória (IA) — CONFERIR";
  return [
    {
      id: "E99-CP155-CAPUT",
      lei: "CP",
      artigo: "155",
      natureza: "comum",
      naturezaComViolencia: "violencia",
      equiparado: false,
      fonte: "CP, art. 155, caput; Lei 8.072/1990, art. 1º",
      vigencia: { inicio: "1990-07-26", fim: null },
      status
    },
    {
      id: "E99-CP157-CAPUT",
      lei: "CP",
      artigo: "157",
      natureza: "violencia",
      equiparado: false,
      fonte: "CP, art. 157, caput; LEP, art. 112, I e II",
      vigencia: { inicio: "1990-07-26", fim: null },
      status
    },
    {
      id: "E99-CP157-ARMA-ANTES",
      lei: "CP",
      artigo: "157",
      paragrafo: "2-a",
      natureza: "violencia",
      equiparado: false,
      fonte: "CP, art. 157, § 2º-A, I; Lei 13.654/2018; Lei 8.072/1990, art. 1º, II, b",
      vigencia: { inicio: "2018-04-24", fim: "2020-01-22" },
      status
    },
    {
      id: "E99-CP157-ARMA-DEPOIS",
      lei: "CP",
      artigo: "157",
      paragrafo: "2-a",
      natureza: "hediondo",
      equiparado: false,
      fonte: "CP, art. 157, § 2º-A, I; Lei 8.072/1990, art. 1º, II, b, incluído pela Lei 13.964/2019",
      vigencia: { inicio: "2020-01-23", fim: null },
      status
    },
    {
      id: "E99-CP157-ARMA-RESTRITA",
      lei: "CP",
      artigo: "157",
      paragrafo: "2-b",
      natureza: "hediondo",
      equiparado: false,
      fonte: "CP, art. 157, § 2º-B; Lei 8.072/1990, art. 1º, II, b, incluído pela Lei 13.964/2019",
      vigencia: { inicio: "2020-01-23", fim: null },
      status
    },
    {
      id: "E99-CP157-LESAO-GRAVE-MORTE",
      lei: "CP",
      artigo: "157",
      paragrafo: "3",
      natureza: "violencia",
      naturezaComMorte: "hediondo_morte",
      equiparado: false,
      fonte: "CP, art. 157, § 3º, parte final; Lei 8.072/1990, art. 1º, II",
      vigencia: { inicio: "1990-07-26", fim: "2020-01-22" },
      status
    },
    {
      id: "E99-CP157-LESAO-GRAVE-MORTE-2020",
      lei: "CP",
      artigo: "157",
      paragrafo: "3",
      natureza: "hediondo",
      naturezaComMorte: "hediondo_morte",
      equiparado: false,
      fonte: "CP, art. 157, § 3º; Lei 8.072/1990, art. 1º, II, c, incluído pela Lei 13.964/2019",
      vigencia: { inicio: "2020-01-23", fim: null },
      status
    },
    {
      id: "E99-CP155-EXPLOSIVO",
      lei: "CP",
      artigo: "155",
      paragrafo: "4-a",
      natureza: "hediondo",
      equiparado: false,
      fonte: "CP, art. 155, § 4º-A; Lei 8.072/1990, art. 1º, IX, incluído pela Lei 13.964/2019",
      vigencia: { inicio: "2020-01-23", fim: null },
      status
    },
    {
      id: "E99-CP121-QUALIFICADO",
      lei: "CP",
      artigo: "121",
      paragrafo: "2",
      natureza: "hediondo_morte",
      excluirIncisos: ["vi"],
      equiparado: false,
      fonte: "CP, art. 121, § 2º; Lei 8.072/1990, art. 1º, I, incluído pela Lei 8.930/1994; LEP, art. 112, VI, a",
      vigencia: { inicio: "1994-09-07", fim: null },
      status
    },
    {
      id: "E99-CP121-FEMINICIDIO-QUALIFICADOR",
      lei: "CP",
      artigo: "121",
      paragrafo: "2",
      inciso: "vi",
      natureza: "hediondo_morte",
      equiparado: false,
      fonte: "CP, art. 121, § 2º, VI; Lei 8.072/1990, art. 1º, I; Lei 13.104/2015",
      vigencia: { inicio: "2015-03-10", fim: "2024-10-09" },
      status
    },
    {
      id: "E99-CP121A-FEMINICIDIO",
      lei: "CP",
      artigo: "121-a",
      natureza: "feminicidio",
      equiparado: false,
      fonte: "CP, art. 121-A; Lei 8.072/1990, art. 1º, I-A; LEP, art. 112, VI-A (Lei 14.994/2024) e VI, d (Lei 15.358/2026)",
      vigencia: { inicio: "2024-10-10", fim: null },
      status
    },
    {
      id: "E99-CP213-ESTUPRO",
      lei: "CP",
      artigo: "213",
      natureza: "hediondo",
      naturezaComMorte: "hediondo_morte",
      qualquerParagrafo: true,
      equiparado: false,
      fonte: "CP, art. 213; Lei 8.072/1990, art. 1º, V, com redação da Lei 12.015/2009",
      vigencia: { inicio: "1990-07-26", fim: null },
      status
    },
    {
      id: "E99-CP217A-ESTUPRO-VULNERAVEL",
      lei: "CP",
      artigo: "217-a",
      natureza: "hediondo",
      naturezaComMorte: "hediondo_morte",
      qualquerParagrafo: true,
      equiparado: false,
      fonte: "CP, art. 217-A; Lei 8.072/1990, art. 1º, VI, incluído pela Lei 12.015/2009",
      vigencia: { inicio: "2009-08-10", fim: null },
      status
    },
    {
      id: "E99-CP158-MORTE",
      lei: "CP",
      artigo: "158",
      paragrafo: "2",
      natureza: "hediondo_morte",
      equiparado: false,
      fonte: "CP, art. 158, § 2º; Lei 8.072/1990, art. 1º, III",
      vigencia: { inicio: "1990-07-26", fim: null },
      status
    },
    {
      id: "E99-CP158-RESTRICAO-LESAO-MORTE",
      lei: "CP",
      artigo: "158",
      paragrafo: "3",
      natureza: "hediondo",
      naturezaComMorte: "hediondo_morte",
      equiparado: false,
      fonte: "CP, art. 158, § 3º; Lei 8.072/1990, art. 1º, III, com redação da Lei 13.964/2019",
      vigencia: { inicio: "2020-01-23", fim: null },
      status
    },
    {
      id: "E99-CP159-SEQUESTRO",
      lei: "CP",
      artigo: "159",
      natureza: "hediondo",
      naturezaComMorte: "hediondo_morte",
      qualquerParagrafo: true,
      equiparado: false,
      fonte: "CP, art. 159, caput e §§ 1º a 3º; Lei 8.072/1990, art. 1º, IV",
      vigencia: { inicio: "1994-09-07", fim: null },
      status
    },
    {
      id: "E99-LEI11343-33-TRAFICO",
      lei: "LEI11343",
      artigo: "33",
      natureza: "hediondo",
      equiparado: true,
      fonte: "Lei 8.072/1990, art. 2º; Lei 11.343/2006, art. 33, caput",
      vigencia: { inicio: "2006-10-08", fim: null },
      status
    },
    {
      id: "E99-LEI11343-33-4-PRIVILEGIADO",
      lei: "LEI11343",
      artigo: "33",
      paragrafo: "4",
      natureza: "trafico_privilegiado",
      equiparado: false,
      fonte: "Lei 11.343/2006, art. 33, § 4º; LEP, art. 112, § 5º, incluído pela Lei 13.964/2019",
      vigencia: { inicio: "2020-01-23", fim: null },
      status
    },
    {
      id: "E99-LEI9455-TORTURA",
      lei: "LEI9455",
      artigo: "1",
      natureza: "hediondo",
      qualquerParagrafo: true,
      equiparado: true,
      fonte: "Lei 8.072/1990, art. 2º; Lei 9.455/1997, art. 1º",
      vigencia: { inicio: "1997-04-08", fim: null },
      status
    },
    {
      id: "E99-LEI13260-TERRORISMO",
      lei: "LEI13260",
      artigo: "2",
      natureza: "hediondo",
      qualquerParagrafo: true,
      equiparado: true,
      fonte: "Lei 8.072/1990, art. 2º; Lei 13.260/2016, art. 2º",
      vigencia: { inicio: "2016-03-17", fim: null },
      status
    },
    {
      id: "E99-CP288A-MILICIA",
      lei: "CP",
      artigo: "288-a",
      natureza: "milicia",
      equiparado: false,
      fonte: "CP, art. 288-A; LEP, art. 112, VI, c, incluído pela Lei 13.964/2019",
      vigencia: { inicio: "2020-01-23", fim: null },
      status
    },
    {
      id: "E99-LEI12850-COMANDO-ORCRIM",
      lei: "LEI12850",
      artigo: "2",
      paragrafo: "3",
      natureza: "comando_orcrim",
      equiparado: false,
      exigeTermo: "ultraviolenta",
      fonte: "Lei 12.850/2013, art. 2º, § 3º; LEP, art. 112, VI, b, incluído pela Lei 13.964/2019 e alterado pela Lei 15.358/2026",
      vigencia: { inicio: "2020-01-23", fim: null },
      status
    }
  ];
});
