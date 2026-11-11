(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const leitor = window.ImportacaoLocal, copilot = window.CalculadoraExecucaoCopilot;
  let radar, atual, idAtual, ocupado = false, rastrosAtuais = {}, versaoAtual = null, alertasAtuais = [];
  function avisar(texto) { $("estadoImportacao").textContent = texto; }
  function falha(texto) {
    const li = document.createElement("li");
    li.textContent = texto;
    $("falhasImportacao").append(li);
  }
  function comoEntrada(dados) { return { ...dados, formato: "calcpen", versao: 1 }; }
  function mostrarDados(importacao) {
    if (importacao.requerRevisao && !importacao.reutilizarRascunho) idAtual = null;
    rastrosAtuais = importacao.rastros || rastrosAtuais;
    alertasAtuais = importacao.alertas || alertasAtuais;
    atual = {
      entrada: comoEntrada(importacao.dados), origens: importacao.origens,
      rastros: rastrosAtuais, versaoDocumento: versaoAtual, alertas: alertasAtuais,
      status: importacao.status, requerRevisao: importacao.requerRevisao === true
    };
    $("dadosEntrada").textContent = JSON.stringify(atual, null, 2);
    $("seloRevisao").textContent = atual.status === "revisado" ? "Revisão concluída" : "a conferir";
    $("calcularImportado").hidden = !copilot.podeCalcular(importacao);
    mostrarRastros();
    $("salvarCalculo").disabled = false;
    if (radar && idAtual) {
      try {
        radar.atualizar(idAtual, atual.entrada, atual.origens, atual.status, atual.rastros, atual.versaoDocumento, atual.alertas);
        importacao.reutilizarRascunho = true;
        atualizarRadar();
      }
      catch (_) { falha("Radar: não foi possível salvar. Baixe o cálculo para preservar os dados."); }
    } else if (radar && importacao.requerRevisao) {
      try {
        const [salvo] = radar.salvar([atual]);
        idAtual = salvo.id;
        importacao.reutilizarRascunho = true;
        atualizarRadar();
      } catch (_) { falha("Radar: não foi possível guardar a resposta. Confira os avisos de privacidade e libere espaço."); }
    }
  }
  const painel = copilot.renderizar($("conferencia"), { onImport: mostrarDados, onReview: mostrarDados });
  function mostrarRastros() {
    const versao = versaoAtual;
    $("versaoDocumento").textContent = versao?.reconhecido
      ? `Modelo reconhecido: ${versao.versao}`
      : alertasAtuais.find((alerta) => /modelo de documento não reconhecido/i.test(alerta)) ||
        "Modelo de documento não reconhecido — confira todos os campos.";
    const lista = $("rastroCampos");
    lista.replaceChildren();
    Object.entries(rastrosAtuais).forEach(([campo, rastro]) => {
      if (campo === "__copilotV2") return;
      const li = document.createElement("li");
      const cita = (item) => `${Number.isInteger(item.pagina) ? `Página ${item.pagina}` : "Página não indicada"} — ${item.trecho}`;
      const trecho = rastro.status === "sugestao"
        ? "Sugestão provisória pela lei e artigo (E99/I17); não é citação literal. Confira a capitulação."
        : rastro.status === "nao_encontrado"
        ? "Trecho não encontrado — preencher manualmente."
        : rastro.status === "contraditorio"
          ? `Contradição: ${[rastro, ...(rastro.conflitos || [])].map(cita).join(" / ")}`
          : `${Number.isInteger(rastro.pagina) ? `Página ${rastro.pagina} — ` : "Página não indicada — "}${rastro.trecho}`;
      li.textContent = `${window.TextosInterface.campo(campo)}: ${trecho}`;
      lista.append(li);
    });
  }
  function conferir(item, id) {
    idAtual = id || null;
    atual = null;
    rastrosAtuais = item.rastros || {};
    versaoAtual = item.versaoDocumento || null;
    alertasAtuais = item.alertas || item.entrada?.pendencias || [];
    mostrarRastros();
    $("dadosEntrada").textContent = "Confira os dados abaixo e preencha os campos.";
    $("seloRevisao").textContent = "a conferir";
    $("salvarCalculo").disabled = true;
    $("calcularImportado").hidden = true;
    const entrada = { ...item.entrada };
    const oficial = item.oficial || entrada.atestadoSEEU;
    if (oficial && Object.keys(oficial).length) entrada.atestadoSEEU = oficial;
    painel.carregar({ ...entrada, formato: "calcpenal-copilot" }, item.origens, {
      requerRevisao: item.rastros?.__copilotV2?.requerRevisao === true,
      citacoes: Object.fromEntries(Object.entries(item.rastros || {}).filter(([campo]) => campo !== "__copilotV2"))
    });
    painel.scrollIntoView({ block: "start" });
  }
  function atualizarRadar() {
    $("listaRadar").replaceChildren();
    if (!radar) return;
    radar.listar().forEach((item, indice) => {
      const li = document.createElement("li");
      li.append(document.createTextNode(`Cálculo ${indice + 1} — ${item.status === "revisado" ? "Revisão concluída" : "a conferir"} `));
      const abrir = document.createElement("button");
      abrir.type = "button"; abrir.className = "q-btn q-btn-outline"; abrir.textContent = "Conferir";
      abrir.addEventListener("click", () => conferir(item, item.id));
      const excluir = document.createElement("button");
      excluir.type = "button"; excluir.className = "q-btn q-btn-flat"; excluir.textContent = "Excluir";
      excluir.addEventListener("click", () => {
        try { radar.remover(item.id); atualizarRadar(); }
        catch (_) { falha("Radar: não foi possível excluir. Verifique o armazenamento do navegador."); }
      });
      li.append(abrir, excluir); $("listaRadar").append(li);
    });
  }
  try { radar = window.RadarImportacoes.abrir(window.localStorage); atualizarRadar(); }
  catch (_) { radar = null; falha("Radar: armazenamento local indisponível. Permita o armazenamento neste navegador ou salve cada cálculo em arquivo."); }

  async function importarPDFs(arquivos) {
    if (ocupado || !arquivos.length) return;
    ocupado = true;
    $("importar").setAttribute("aria-busy", "true");
    $("arquivosPDF").disabled = true;
    $("lerTexto").disabled = true;
    $("falhasImportacao").replaceChildren();
    avisar("Lendo os PDFs neste navegador…");
    try {
      const lote = await leitor.lerLote(arquivos);
      lote.erros.forEach((erro) => falha(`${erro.arquivo}: ${erro.mensagem}`));
      let salvos = [];
      if (lote.itens.length && radar) {
        try { salvos = radar.salvar(lote.itens); atualizarRadar(); }
        catch (_) { falha("Radar: não foi possível guardar o lote. Libere espaço e importe novamente. O primeiro cálculo está disponível para conferência."); }
      }
      if (!radar && lote.itens.length) falha("Radar indisponível: os PDFs não foram guardados. Importe e salve um por vez.");
      if (lote.itens.length) conferir({ ...lote.itens[0], ...(salvos[0] || {}) }, salvos[0]?.id);
      avisar(`${lote.itens.length} PDF(s) lido(s); ${salvos.length} cálculo(s) no radar; ${lote.erros.length} arquivo(s) não lido(s). Confira as pendências.`);
    } finally {
      ocupado = false;
      $("importar").removeAttribute("aria-busy");
      $("arquivosPDF").disabled = false;
      $("lerTexto").disabled = false;
      $("arquivosPDF").value = "";
    }
  }
  function lerTexto(texto) {
    if (ocupado) return;
    if (!texto.trim()) { avisar("Texto: cole o conteúdo da tela do SEEU ou SAJ e tente novamente."); return; }
    if (texto.length > 2000000) { avisar("Texto: muito extenso. Cole apenas os dados do cálculo."); return; }
    conferir(leitor.analisarTexto(texto));
    $("textoTela").value = "";
    avisar("Texto lido. Confira os dados e complete as pendências.");
  }
  $("arquivosPDF").addEventListener("change", (ev) => importarPDFs(Array.from(ev.target.files)));
  $("lerTexto").addEventListener("click", () => lerTexto($("textoTela").value));
  document.addEventListener("dragover", (ev) => {
    if (Array.from(ev.dataTransfer.types).includes("Files")) ev.preventDefault();
  });
  document.addEventListener("drop", (ev) => {
    if (!ev.dataTransfer.files.length) return;
    ev.preventDefault();
    importarPDFs(Array.from(ev.dataTransfer.files));
  });
  document.addEventListener("paste", (ev) => {
    if (ev.target.closest("textarea, input, [contenteditable]") && ev.target !== $("textoTela")) return;
    const texto = ev.clipboardData?.getData("text/plain");
    if (!texto) return;
    ev.preventDefault();
    lerTexto(texto);
  });
  $("novoCalculo").addEventListener("click", () => {
    idAtual = null; atual = null;
    rastrosAtuais = {}; versaoAtual = null; alertasAtuais = [];
    $("calcularImportado").hidden = true;
    mostrarRastros();
    painel.carregar({ formato: "calcpenal-copilot", versao: 1, condenacoes: [] });
    $("dadosEntrada").textContent = "Nenhum dado preenchido.";
    $("seloRevisao").textContent = "a conferir";
    $("salvarCalculo").disabled = true;
    $("textoTela").value = "";
  });
  $("salvarCalculo").addEventListener("click", () => {
    if (!atual) return;
    const blob = new Blob([JSON.stringify({ formato: "calcpen", versao: 1, ...atual }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "calculo.calcpen"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  $("calcularImportado").addEventListener("click", () => {
    if (!atual) return;
    if (!copilot.podeCalcular(atual)) return;
    try {
      const payload = {
        formato: "calcpen-documento", versao: 1,
        entrada: atual.entrada, origens: atual.origens, rastros: atual.rastros,
        versaoDocumento: atual.versaoDocumento, alertas: atual.alertas
      };
      const texto = JSON.stringify(payload);
      if (texto.length > 2000000) throw new Error();
      sessionStorage.setItem("calcpenal:documento-importado", texto);
      window.location.href = "index.html#condenacoes";
    } catch (_) {
      falha("Não foi possível preparar o cálculo neste navegador. Confira o espaço disponível e tente novamente.");
    }
  });
  $("abrirCalculo").addEventListener("change", async (ev) => {
    const arquivo = ev.target.files[0];
    if (!arquivo) return;
    try {
      if (arquivo.size > 20 * 1024 * 1024) throw new Error();
      const item = JSON.parse(await arquivo.text());
      if (item.formato !== "calcpen" || item.versao !== 1 || !item.entrada) throw new Error();
      conferir(item);
      avisar("Cálculo aberto para nova conferência. Nenhuma data foi recalculada.");
    } catch (_) { falha("Cálculo salvo: arquivo inválido. Escolha um arquivo .calcpen versão 1."); }
    ev.target.value = "";
  });
})();
