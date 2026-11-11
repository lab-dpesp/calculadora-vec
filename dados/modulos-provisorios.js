(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DadosModulosProvisorios = factory();
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const lista = Object.freeze([
    { id: "E70", modulo: "indultoComutacao", motivo: "Cortes históricos e triagem de indulto/comutação aguardam revisão da Assessoria Criminal." },
    { id: "E71", modulo: "indultoComutacao", motivo: "Datas de falta grave na triagem aguardam revisão da Assessoria Criminal." },
    { id: "E80", modulo: "prescricaoExecutoria", motivo: "Critérios de prescrição executória aguardam revisão da Assessoria Criminal." },
    { id: "E81", modulo: "prescricaoExecutoria", motivo: "Marcos da prescrição executória aguardam revisão da Assessoria Criminal." },
    { id: "E82", modulo: "prescricaoFaltaGrave", motivo: "Prescrição da falta grave aguarda revisão da Assessoria Criminal." }
  ].map((item) => Object.freeze({ ...item, status: "Pendente de validação" })));
  const ids = Object.freeze(lista.map((item) => item.id));

  function validar(opcoes) {
    const selecionados = opcoes ? opcoes.modulosProvisorios : undefined;
    return selecionados === undefined || Array.isArray(selecionados) &&
      selecionados.every((id) => ids.includes(id)) &&
      new Set(selecionados).size === selecionados.length;
  }

  function inclui(opcoes, id) {
    const item = lista.find((modulo) => modulo.id === id);
    const selecionados = opcoes && opcoes.modulosProvisorios;
    return !!item && Array.isArray(selecionados) &&
      lista.some((modulo) => modulo.modulo === item.modulo && selecionados.includes(modulo.id));
  }

  return Object.freeze({ lista, ids, validar, inclui });
});
