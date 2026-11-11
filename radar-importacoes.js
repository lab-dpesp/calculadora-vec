(function (root, factory) {
  "use strict";
  const api = factory(typeof module === "object" && module.exports ? require("./dados-casos.js") : root.DadosCasos);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RadarImportacoes = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (DadosCasos) {
  "use strict";
  const CHAVE = DadosCasos.CHAVE_RADAR;

  // I03: rascunhos independentes, sempre a conferir; sem calcular benefícios.
  function abrir(armazenamento, obterData = () => new Date()) {
    function listar() {
      const texto = armazenamento.getItem(CHAVE);
      if (!texto) return [];
      const itens = JSON.parse(texto);
      if (!Array.isArray(itens) || itens.some((item) => !item?.id || !item.entrada || !item.origens)) {
        throw new Error("Radar: dados locais inválidos. Preserve seus arquivos e restaure uma cópia salva.");
      }
      return itens;
    }
    function salvar(importacoes) {
      const itens = listar();
      const novos = importacoes.map((item) => ({
        id: globalThis.crypto.randomUUID(), formato: "calcpen", versao: 1,
        entrada: item.entrada, origens: item.origens || {}, rastros: item.rastros || {},
        versaoDocumento: item.versaoDocumento || null, alertas: item.alertas || [], status: "a_conferir",
        gravadoEm: obterData().toISOString()
      }));
      armazenamento.setItem(CHAVE, JSON.stringify(itens.concat(novos)));
      return novos;
    }
    function atualizar(id, entrada, origens, status, rastros, versaoDocumento, alertas) {
      const itens = listar();
      const item = itens.find((i) => i.id === id);
      if (!item) throw new Error("Radar: cálculo não encontrado. Importe o documento novamente.");
      Object.assign(item, { entrada, origens, status, rastros, versaoDocumento, alertas,
        gravadoEm: obterData().toISOString() });
      armazenamento.setItem(CHAVE, JSON.stringify(itens));
    }
    function remover(id) {
      armazenamento.setItem(CHAVE, JSON.stringify(listar().filter((i) => i.id !== id)));
    }
    return { listar, salvar, atualizar, remover };
  }
  return { abrir };
});
