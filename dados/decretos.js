(function (root, factory) {
  "use strict";
  const api = factory(typeof module === "object" && module.exports
    ? [require("./decretos/2024.js"), require("./decretos/2025.js")]
    : root.DadosDecretos);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DadosDecretosLista = api;
})(typeof globalThis === "object" ? globalThis : this, function (decretos) {
  "use strict";
  return Array.isArray(decretos) ? decretos : Object.values(decretos || {});
});
