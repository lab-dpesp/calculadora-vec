(function () {
  "use strict";
  let resultado;
  // I18: executar antes de as telas carregarem dados locais.
  try {
    resultado = DadosCasos.limparExpirados(localStorage, new Date());
  } catch (_) {
    resultado = { falhas: [true] };
  }

  document.addEventListener("DOMContentLoaded", function () {
    const mensagem = document.createElement("p");
    mensagem.className = "nota";
    mensagem.setAttribute("role", "status");
    mensagem.setAttribute("aria-live", "polite");
    const avisos = [];
    if (resultado.rascunhosRemovidos) {
      avisos.push("Rascunhos removidos automaticamente após 7 dias: " + resultado.rascunhosRemovidos + ".");
    }
    if (resultado.identificacoesRemovidas) avisos.push("A identificação do caso expirou e foi apagada.");
    if (resultado.falhas.length) {
      avisos.push("Não foi possível verificar o prazo de alguns dados locais. Apague os dados de casos ou limpe os dados do site no navegador.");
    }
    mensagem.textContent = avisos.join(" ");
    const botao = document.getElementById("apagar-dados-casos");
    const destino = botao ? botao.parentElement : document.querySelector("main") || document.body;
    destino.append(mensagem);
    if (!botao) return;
    const indice = document.getElementById("indice-secoes");
    if (indice) {
      const ajustarIndice = () => { indice.style.top = destino.getBoundingClientRect().height + "px"; };
      new ResizeObserver(ajustarIndice).observe(destino);
      ajustarIndice();
    }
    botao.addEventListener("click", function () {
      if (!window.confirm("Apagar os rascunhos de importação e a identificação do caso deste navegador? Dados de quem assina, tema, carteira do Radar e arquivos salvos não serão apagados.")) return;
      try {
        DadosCasos.apagar(localStorage);
        // Descartar também os campos em memória, para não gravá-los novamente.
        window.location.reload();
      } catch (_) {
        mensagem.textContent = "Não foi possível apagar os dados de casos. Limpe os dados do site nas configurações do navegador.";
      }
    });
  });
})();
