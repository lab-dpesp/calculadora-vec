(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MovimentosExecucao = factory();
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  return [
    { id: "I14-M01", padrao: "\\bprogressao\\b", objeto: "progressao", status: "proposta" },
    { id: "I14-M02", padrao: "\\bregressao\\b", objeto: "regressao", status: "proposta" },
    { id: "I14-M03", padrao: "\\blivramento\\b", objeto: "livramento", status: "proposta" },
    { id: "I14-M04", padrao: "\\bremicao\\b", objeto: "remicao", status: "proposta" },
    { id: "I14-M05", padrao: "\\bdetracao\\b", objeto: "detracao", status: "proposta" },
    { id: "I14-M06", padrao: "\\bindulto\\b", objeto: "indulto", status: "proposta" },
    { id: "I14-M07", padrao: "\\bcomutacao\\b", objeto: "comutacao", status: "proposta" },
    { id: "I14-M08", padrao: "\\bfalta grave\\b", objeto: "falta_grave", status: "proposta" },
    { id: "I14-M09", padrao: "\\b(?:unificacao|unificar|soma das penas|penas somadas)\\b", objeto: "unificacao", status: "proposta" },
    { id: "I14-M10", padrao: "\\b(?:prisao|recaptura|captura|recolhimento)\\b", objeto: "prisao_ou_recaptura", status: "proposta" }
  ];
});
