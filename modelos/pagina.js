(function () {
  "use strict";

  var modelo = document.getElementById("modelo");
  var arquivo = document.getElementById("arquivo");
  var resultado = document.getElementById("resultado");
  var mensagem = document.getElementById("mensagem");
  var juizo = document.getElementById("juizo");
  var avisoExemplo = document.getElementById("aviso-exemplo");
  var calculo = ExemploMinuta.criar();
  var regrasNegocio = "";
  var versaoGeracao = 0;
  var opcaoIndulto = modelo.querySelector('option[value="pedido-indulto.md"]');
  var opcaoPrescricao = modelo.querySelector('option[value="pedido-prescricao.md"]');
  var indultoVisivel = !window.Piloto || window.Piloto.moduloVisivel("E70");
  var prescricaoVisivel = !window.Piloto || window.Piloto.moduloVisivel("E80");
  if (opcaoIndulto) {
    opcaoIndulto.hidden = !indultoVisivel;
    opcaoIndulto.disabled = !indultoVisivel;
  }
  if (opcaoPrescricao) {
    opcaoPrescricao.hidden = !prescricaoVisivel;
    opcaoPrescricao.disabled = !prescricaoVisivel;
  }
  if (indultoVisivel && new URLSearchParams(window.location.search).get("modelo") === "pedido-indulto.md") {
    try {
      var rascunhoIndulto = JSON.parse(sessionStorage.getItem("calcpenal:minuta-indulto") || "null");
      if (rascunhoIndulto && rascunhoIndulto.resultado && rascunhoIndulto.resultado.indulto) {
        calculo = rascunhoIndulto;
        modelo.value = "pedido-indulto.md";
        sessionStorage.removeItem("calcpenal:minuta-indulto");
        avisoExemplo.textContent = "Triagem local do indulto aberta. Revise todos os requisitos, documentos e fundamentos antes de usar.";
      }
    } catch (_) {}
  }
  if (prescricaoVisivel && new URLSearchParams(window.location.search).get("modelo") === "pedido-prescricao.md") {
    try {
      var rascunhoPrescricao = JSON.parse(sessionStorage.getItem("calcpenal:minuta-prescricao") || "null");
      if (rascunhoPrescricao && rascunhoPrescricao.resultado &&
          Array.isArray(rascunhoPrescricao.resultado.prescricaoExecutoria)) {
        calculo = rascunhoPrescricao;
        modelo.value = "pedido-prescricao.md";
        sessionStorage.removeItem("calcpenal:minuta-prescricao");
        avisoExemplo.textContent = "Análise provisória de prescrição aberta. Confira certidões, causas de interrupção ou suspensão e fundamentos antes de usar.";
      }
    } catch (_) {}
  }

  function informar(texto, erro) {
    mensagem.textContent = texto;
    mensagem.className = erro ? "erro" : "";
  }

  function carregarPreferencias() {
    try {
      return JSON.parse(localStorage.getItem("calcpenal:assinatura") || "{}");
    } catch (_) {
      return {};
    }
  }

  function juizoSalvo() {
    try {
      return JSON.parse(localStorage.getItem("calcpenal:caso") || "{}").juizo || "";
    } catch (_) {
      return "";
    }
  }

  function baixar(nome, conteudo, tipo) {
    var url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    var link = document.createElement("a");
    link.href = url;
    link.download = nome;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function gerar() {
    if (!calculo) return informar("Abra um cálculo salvo válido antes de gerar a minuta.", true);
    var id = ++versaoGeracao;
    Promise.all([
      fetch(modelo.value).then(function (resposta) {
        if (!resposta.ok) throw new Error("modelo");
        return resposta.text();
      }),
      regrasNegocio ? Promise.resolve(regrasNegocio) : fetch("../REGRAS-DE-NEGOCIO.md").then(function (resposta) {
        if (!resposta.ok) throw new Error("regras");
        return resposta.text();
      }).catch(function () { return ""; })
    ]).then(function (dados) {
      if (id !== versaoGeracao) return;
      regrasNegocio = dados[1] || regrasNegocio;
      var assinatura = carregarPreferencias();
      var campos = GeradorDocumentos.camposDoCalculo(calculo, modelo.value, regrasNegocio);
      campos.juizo = juizo.value.trim() || campos.juizo || "não informado";
      campos.local_data = [assinatura.cidade || "", campos.data_calculo].filter(Boolean).join(", ");
      campos.assinatura = [assinatura.unidade || "", assinatura.autor || ""].filter(Boolean).join("\n") || "assinatura a inserir";
      resultado.value = GeradorDocumentos.preencher(dados[0], campos);
      informar(arquivo.files && arquivo.files.length
        ? "Minuta gerada a partir do cálculo aberto. Revise-a antes de usar."
        : "Prévia de exemplo gerada. Abra um cálculo salvo para usar os dados do caso.");
    }).catch(function () {
      if (id === versaoGeracao) informar("Não foi possível abrir o modelo. Acesse esta página pelo site do projeto.", true);
    });
  }

  arquivo.addEventListener("change", function () {
    var selecionado = arquivo.files && arquivo.files[0];
    if (!selecionado) return;
    var leitor = new FileReader();
    leitor.onload = function () {
      try {
        var dado = JSON.parse(leitor.result);
        if (!dado || typeof dado !== "object" || !dado.resultado || !dado.entrada) {
          throw new Error("formato");
        }
        calculo = dado;
        juizo.value = dado.caso && dado.caso.juizo || juizoSalvo();
        avisoExemplo.textContent = "Cálculo aberto localmente. Processo e pessoa são preenchidos com os dados salvos; confira o juízo e o perfil de assinatura.";
        gerar();
      } catch (_) {
        calculo = null;
        informar("O arquivo não parece ser um cálculo salvo válido. Confira o arquivo e tente novamente.", true);
      }
    };
    leitor.onerror = function () {
      calculo = null;
      informar("Não foi possível ler o arquivo selecionado.", true);
    };
    leitor.readAsText(selecionado);
  });

  juizo.addEventListener("input", function () {
    try {
      var caso = JSON.parse(localStorage.getItem("calcpenal:caso") || "{}");
      caso.juizo = juizo.value;
      localStorage.setItem("calcpenal:caso", JSON.stringify(caso));
    } catch (_) {}
  });
  modelo.addEventListener("change", gerar);
  document.getElementById("gerar").addEventListener("click", gerar);
  document.getElementById("copiar").addEventListener("click", function () {
    var texto = resultado.value;
    if (!texto) return informar("Gere uma minuta antes de copiar.", true);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () {
        informar("Texto copiado.");
      }).catch(function () {
        resultado.focus();
        resultado.select();
        informar("Selecione o texto e copie.");
      });
    } else {
      resultado.focus();
      resultado.select();
      informar("Selecione o texto e copie.");
    }
  });
  document.getElementById("baixar-docx").addEventListener("click", function () {
    if (!resultado.value) return informar("Gere uma minuta antes de baixar.", true);
    baixar(modelo.value.replace(/\.md$/, "") + ".docx", GeradorDocumentos.criarDocx(resultado.value),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    informar("Arquivo DOCX baixado.");
  });
  document.getElementById("baixar-html").addEventListener("click", function () {
    if (!resultado.value) return informar("Gere uma minuta antes de baixar.", true);
    baixar(modelo.value.replace(/\.md$/, "") + ".html", GeradorDocumentos.criarHtml(resultado.value), "text/html;charset=utf-8");
    informar("Arquivo HTML baixado.");
  });
  document.getElementById("imprimir").addEventListener("click", function () {
    if (!resultado.value) return informar("Gere uma minuta antes de imprimir.", true);
    window.print();
  });

  juizo.value = juizoSalvo() || calculo.caso.juizo || "";
  carregarPreferencias();
  gerar();
})();
