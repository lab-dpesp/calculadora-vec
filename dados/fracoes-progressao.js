(function (root, factory) {
  "use strict";
  const api = factory(typeof module === "object" && module.exports
    ? require("./eras.js") : root.DadosEras);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DadosFracoesProgressao = api;
})(typeof globalThis === "object" ? globalThis : this, function (eras) {
  "use strict";

  const regras = [
    { id: "E37", fracao: 1 / 8, fonte: "LEP art. 112, § 3º (Lei 13.769/2018)", vigencia: { inicio: "2018-12-20", fim: null }, status: "Pendente de validação" },
    { id: "E31-ERA1-COMUM", era: "era1", natureza: "comum", reincidencia: "qualquer", fracao: 1 / 6, fonte: "LEP art. 112 (redação original/Lei 10.792/2003)", status: "Implementada" },
    { id: "E31-ERA1-HEDIONDO-ANTES-2007", era: "era1", natureza: "hediondo", reincidencia: "qualquer", fracao: 1 / 6, dataMinFato: "1990-07-26", dataMaxFato: "2007-03-28", fonte: "STF HC 82.959; SV 26; STJ Súm. 471", status: "Implementada" },
    { id: "E31-ERA1-HEDIONDO-PRIMARIO", era: "era1", natureza: "hediondo", reincidencia: "primario", fracao: 2 / 5, dataMinFato: "2007-03-29", dataMaxFato: "2020-01-22", fonte: "Lei 8.072/90, art. 2º, § 2º (Lei 11.464/2007)", status: "Implementada" },
    { id: "E31-ERA1-HEDIONDO-REINCIDENTE", era: "era1", natureza: "hediondo", reincidencia: "reincidente", fracao: 3 / 5, dataMinFato: "2007-03-29", dataMaxFato: "2020-01-22", fonte: "Lei 8.072/90, art. 2º, § 2º (Lei 11.464/2007)", status: "Implementada" },
    { id: "E31-ERA2-COMUM-PRIMARIO", era: "era2", natureza: "comum", reincidencia: "primario", fracao: 0.16, fonte: "LEP art. 112, I (Lei 13.964/2019)", status: "Implementada" },
    { id: "E31-ERA2-COMUM-REINCIDENTE", era: "era2", natureza: "comum", reincidencia: "reincidente", fracao: 0.2, fonte: "LEP art. 112, II (Lei 13.964/2019)", status: "Implementada" },
    { id: "E31-ERA2-VIOLENCIA-PRIMARIO", era: "era2", natureza: "violencia", reincidencia: "primario", fracao: 0.25, fonte: "LEP art. 112, III (Lei 13.964/2019)", status: "Implementada" },
    { id: "E31-ERA2-VIOLENCIA-REINCIDENTE-ANTECEDENTE-NAO", era: "era2", natureza: "violencia", reincidencia: "reincidente", antecedenteViolento: "nao", fracao: 0.25, fonte: "LEP art. 112, III, por analogia favorável; STJ, AgRg no HC 675.062/SP (6ª T.), HC 947.647/SP (5ª T., 05/12/2024) e AgRg no HC 766.551/MG (CONFERIR)", status: "Pendente de validação" },
    { id: "E31-ERA2-VIOLENCIA-REINCIDENTE", era: "era2", natureza: "violencia", reincidencia: "reincidente", antecedenteViolento: "sim", fracao: 0.3, tese: "30", fonte: "LEP art. 112, IV (Lei 13.964/2019)", status: "Pendente de validação" },
    { id: "E31-ERA2-HEDIONDO-PRIMARIO-GENERICO", era: "era2", natureza: "hediondo", reincidencia: "primario_ou_generico", fracao: 0.4, fonte: "LEP art. 112, V (Lei 13.964/2019); STJ Tema 1084", status: "Implementada" },
    { id: "E31-ERA2-HEDIONDO-MORTE-PRIMARIO-GENERICO", era: "era2", natureza: "hediondo_morte", reincidencia: "primario_ou_generico", fracao: 0.5, fonte: "LEP art. 112, VI (Lei 13.964/2019); Tema 1196/STJ — Tema 1319/STF", status: "Implementada" },
    { id: "E31-ERA2-COMANDO-ORCRIM", era: "era2", natureza: "comando_orcrim", reincidencia: "qualquer", fracao: 0.5, fonte: "LEP art. 112, VI, b (Lei 13.964/2019); docs/legislacao/LEP.md", status: "Implementada" },
    { id: "E31-ERA2-MILICIA", era: "era2", natureza: "milicia", reincidencia: "qualquer", fracao: 0.5, fonte: "LEP art. 112, VI, c (Lei 13.964/2019); docs/legislacao/LEP.md", status: "Implementada" },
    { id: "E31-ERA2-FEMINICIDIO-PRIMARIO", era: "era2", natureza: "feminicidio", reincidencia: "primario", fracao: 0.55, dataMinFato: "2024-10-10", fonte: "LEP art. 112, VI-A (Lei 14.994/2024); docs/legislacao/LEP.md", status: "Implementada" },
    { id: "E31-ERA2-HEDIONDO-ESPECIFICO", era: "era2", natureza: "hediondo", reincidencia: "especifico", fracao: 0.6, fonte: "LEP art. 112, VII (Lei 13.964/2019)", status: "Implementada" },
    { id: "E31-ERA2-HEDIONDO-MORTE-ESPECIFICO", era: "era2", natureza: "hediondo_morte", reincidencia: "especifico", fracao: 0.7, fonte: "LEP art. 112, VIII (Lei 13.964/2019)", status: "Implementada" },
    { id: "E31-ERA3A-COMUM-PRIMARIO", era: "era3a", natureza: "comum", reincidencia: "primario", fracao: 0.16, fonte: "LEP art. 112, I (Lei 13.964/2019); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3A-COMUM-REINCIDENTE", era: "era3a", natureza: "comum", reincidencia: "reincidente", fracao: 0.2, fonte: "LEP art. 112, II (Lei 13.964/2019); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3A-VIOLENCIA-PRIMARIO", era: "era3a", natureza: "violencia", reincidencia: "primario", fracao: 0.25, fonte: "LEP art. 112, III (Lei 13.964/2019); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3A-VIOLENCIA-REINCIDENTE-ANTECEDENTE-NAO", era: "era3a", natureza: "violencia", reincidencia: "reincidente", antecedenteViolento: "nao", fracao: 0.25, fonte: "LEP art. 112, III, por analogia favorável; STJ, AgRg no HC 675.062/SP (6ª T.), HC 947.647/SP (5ª T., 05/12/2024) e AgRg no HC 766.551/MG (CONFERIR)", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3A-VIOLENCIA-REINCIDENTE", era: "era3a", natureza: "violencia", reincidencia: "reincidente", antecedenteViolento: "sim", fracao: 0.3, tese: "30", fonte: "LEP art. 112, IV (Lei 13.964/2019); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3A-HEDIONDO-PRIMARIO", era: "era3a", natureza: "hediondo", reincidencia: "primario", fracao: 0.7, fonte: "LEP art. 112, V (Lei 15.358/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3A-HEDIONDO-GENERICO", era: "era3a", natureza: "hediondo", reincidencia: "generico", fracao: 0.7, fonte: "LEP art. 112, V e VII (Lei 15.358/2026); E33, posição defensiva; docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3A-HEDIONDO-MORTE-PRIMARIO", era: "era3a", natureza: "hediondo_morte", reincidencia: "primario", fracao: 0.75, fonte: "LEP art. 112, VI, a (Lei 15.358/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3A-HEDIONDO-MORTE-GENERICO", era: "era3a", natureza: "hediondo_morte", reincidencia: "generico", fracao: 0.75, fonte: "LEP art. 112, VI, a e VIII (Lei 15.358/2026); E33, posição defensiva; docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3A-HEDIONDO-REINCIDENTE", era: "era3a", natureza: "hediondo", reincidencia: "especifico", fracao: 0.8, fonte: "LEP art. 112, VII (Lei 15.358/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3A-HEDIONDO-MORTE-REINCIDENTE", era: "era3a", natureza: "hediondo_morte", reincidencia: "especifico", fracao: 0.85, fonte: "LEP art. 112, VIII (Lei 15.358/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3A-COMANDO-ORCRIM", era: "era3a", natureza: "comando_orcrim", reincidencia: "qualquer", fracao: 0.75, fonte: "LEP art. 112, VI, b (Lei 15.358/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3A-MILICIA", era: "era3a", natureza: "milicia", reincidencia: "qualquer", fracao: 0.75, fonte: "LEP art. 112, VI, c (Lei 15.358/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3A-FEMINICIDIO-PRIMARIO", era: "era3a", natureza: "feminicidio", reincidencia: "primario", fracao: 0.75, dataMinFato: "2024-10-10", fonte: "LEP art. 112, VI, d (Lei 15.358/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3B-COMUM-PRIMARIO", era: "era3b", natureza: "comum", reincidencia: "primario", fracao: 1 / 6, fonte: "LEP art. 112, caput (Lei 15.402/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3B-COMUM-REINCIDENTE", era: "era3b", natureza: "comum", reincidencia: "reincidente", fracao: 0.2, fonte: "LEP art. 112, III (Lei 15.402/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3B-VIOLENCIA-PRIMARIO", era: "era3b", natureza: "violencia", reincidencia: "primario", fracao: 0.25, fonte: "LEP art. 112, I (Lei 15.402/2026), exceto Título XII; docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3B-VIOLENCIA-REINCIDENTE", era: "era3b", natureza: "violencia", reincidencia: "reincidente", fracao: 0.3, tese: "30", fonte: "LEP art. 112, II (Lei 15.402/2026), exceto Título XII; docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3B-TITULO-XII-PRIMARIO", era: "era3b", natureza: "titulo_xii", reincidencia: "primario", fracao: 1 / 6, fonte: "LEP art. 112, caput (Lei 15.402/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3B-TITULO-XII-REINCIDENTE", era: "era3b", natureza: "titulo_xii", reincidencia: "reincidente", fracao: 0.2, fonte: "LEP art. 112, III (Lei 15.402/2026); PD-01; docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3B-HEDIONDO-PRIMARIO", era: "era3b", natureza: "hediondo", reincidencia: "primario", fracao: 0.7, fonte: "LEP art. 112, V (Lei 15.358/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3B-HEDIONDO-GENERICO", era: "era3b", natureza: "hediondo", reincidencia: "generico", fracao: 0.7, fonte: "LEP art. 112, V e VII (Lei 15.358/2026); E33, posição defensiva; docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3B-HEDIONDO-MORTE-PRIMARIO", era: "era3b", natureza: "hediondo_morte", reincidencia: "primario", fracao: 0.75, fonte: "LEP art. 112, VI, a (Lei 15.358/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3B-HEDIONDO-MORTE-GENERICO", era: "era3b", natureza: "hediondo_morte", reincidencia: "generico", fracao: 0.75, fonte: "LEP art. 112, VI, a e VIII (Lei 15.358/2026); E33, posição defensiva; docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3B-HEDIONDO-REINCIDENTE", era: "era3b", natureza: "hediondo", reincidencia: "especifico", fracao: 0.8, fonte: "LEP art. 112, VII (Lei 15.358/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3B-HEDIONDO-MORTE-REINCIDENTE", era: "era3b", natureza: "hediondo_morte", reincidencia: "especifico", fracao: 0.85, fonte: "LEP art. 112, VIII (Lei 15.358/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3B-COMANDO-ORCRIM", era: "era3b", natureza: "comando_orcrim", reincidencia: "qualquer", fracao: 0.75, fonte: "LEP art. 112, VI, b (Lei 15.358/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3B-MILICIA", era: "era3b", natureza: "milicia", reincidencia: "qualquer", fracao: 0.75, fonte: "LEP art. 112, VI, c (Lei 15.358/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31-ERA3B-FEMINICIDIO-PRIMARIO", era: "era3b", natureza: "feminicidio", reincidencia: "primario", fracao: 0.75, dataMinFato: "2024-10-10", fonte: "LEP art. 112, VI, d (Lei 15.358/2026); docs/legislacao/LEP.md", status: "Decidida pelo Núcleo; fontes a conferir" }
  ];

  return regras.map((regra) => {
    if (!regra.era) return regra;
    const era = eras.find((item) => item.era === regra.era);
    const vigenciaEra = era && era.vigencia;
    return {
      ...regra,
      vigencia: {
        inicio: regra.dataMinFato || vigenciaEra.inicio,
        fim: regra.dataMaxFato || vigenciaEra.fim
      }
    };
  });
});
