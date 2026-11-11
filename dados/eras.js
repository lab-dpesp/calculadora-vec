(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DadosEras = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  return [
    { id: "E31", era: "era1", inicio: "1990-07-26", fim: "2020-01-22", fonte: "LEP art. 112 (redação original/Lei 10.792/2003)", vigencia: { inicio: "1990-07-26", fim: "2020-01-22" }, status: "Implementada" },
    { id: "E31", era: "era2", inicio: "2020-01-23", fim: "2026-03-24", fonte: "LEP art. 112 (Lei 13.964/2019)", vigencia: { inicio: "2020-01-23", fim: "2026-03-24" }, status: "Implementada" },
    { id: "E31", era: "era3a", inicio: "2026-03-25", fim: "2026-05-07", fonte: "LEP art. 112 (Lei 15.358/2026)", vigencia: { inicio: "2026-03-25", fim: "2026-05-07" }, status: "Decidida pelo Núcleo; fontes a conferir" },
    { id: "E31", era: "era3b", inicio: "2026-05-08", fim: null, fonte: "LEP art. 112 (Lei 15.402/2026)", vigencia: { inicio: "2026-05-08", fim: null }, status: "Decidida pelo Núcleo; fontes a conferir" }
  ];
});
