(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DadosCasos = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const CHAVE_RADAR = "calcpen:radar-importacoes:v1";
  const CHAVE_CASO = "calcpenal:caso";
  // I18: sete dias completos desde a última gravação, não desde a última leitura.
  const PRAZO_RETENCAO_MS = 7 * 24 * 60 * 60 * 1000;

  function salvarIdentificacao(armazenamento, campos, data) {
    armazenamento.setItem(CHAVE_CASO, JSON.stringify({
      ...campos, gravadoEm: new Date(data).toISOString()
    }));
  }

  function limparExpirados(armazenamento, data) {
    const agora = new Date(data);
    const gravadoEm = agora.toISOString();
    const resultado = { rascunhosRemovidos: 0, identificacoesRemovidas: 0, falhas: [] };
    for (const chave of [CHAVE_RADAR, CHAVE_CASO]) {
      try {
        const texto = armazenamento.getItem(chave);
        if (!texto) continue;
        const dados = JSON.parse(texto);
        const itens = chave === CHAVE_RADAR ? dados : [dados];
        if (!Array.isArray(itens) || itens.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
          throw new Error("Dados locais inválidos.");
        }
        let alterado = false;
        const mantidos = itens.filter((item) => {
          const instante = typeof item.gravadoEm === "string" ? Date.parse(item.gravadoEm) : NaN;
          if (!Number.isFinite(instante)) {
            item.gravadoEm = gravadoEm; // I18: dados legados têm o prazo iniciado no primeiro acesso.
            alterado = true;
            return true;
          }
          return agora.getTime() - instante < PRAZO_RETENCAO_MS;
        });
        const removidos = itens.length - mantidos.length;
        if (removidos || alterado) {
          if (!mantidos.length) armazenamento.removeItem(chave);
          else armazenamento.setItem(chave, JSON.stringify(chave === CHAVE_RADAR ? mantidos : mantidos[0]));
        }
        if (chave === CHAVE_RADAR) resultado.rascunhosRemovidos = removidos;
        else resultado.identificacoesRemovidas = removidos;
      } catch (_) {
        resultado.falhas.push(chave);
      }
    }
    return resultado;
  }

  function apagar(armazenamento) {
    armazenamento.removeItem(CHAVE_RADAR);
    armazenamento.removeItem(CHAVE_CASO);
  }

  return { CHAVE_RADAR, CHAVE_CASO, PRAZO_RETENCAO_MS, salvarIdentificacao, limparExpirados, apagar };
});
