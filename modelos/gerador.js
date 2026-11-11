(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GeradorDocumentos = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function formatarData(valor) {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor || "não informada";
    return valor.slice(8, 10) + "/" + valor.slice(5, 7) + "/" + valor.slice(0, 4);
  }

  function formatarQuantidade(valor) {
    if (valor == null) return "não informado";
    if (typeof valor === "number") return valor + " dias";
    if (typeof valor !== "object") return String(valor);
    if (Number.isFinite(valor.emDias)) return valor.emDias + " dias";
    var partes = [];
    if (valor.anos) partes.push(valor.anos + (valor.anos === 1 ? " ano" : " anos"));
    if (valor.meses) partes.push(valor.meses + (valor.meses === 1 ? " mês" : " meses"));
    if (valor.dias) partes.push(valor.dias + (valor.dias === 1 ? " dia" : " dias"));
    return partes.length ? partes.join(", ") : "não informado";
  }

  var REGRAS_POR_MODELO = {
    "pedido-progressao.md": ["E20", "E30", "E31", "E34", "D6", "E38"],
    "pedido-livramento.md": ["E24", "E25", "E40", "E41", "E42", "E43", "E44", "E45"],
    "pedido-saida-temporaria.md": ["E60", "E61"],
    "pedido-detracao-horas.md": ["E27-A"],
    "pedido-remicao.md": ["E28", "E29"],
    "pedido-indulto.md": ["E70", "E71", "D5"],
    "pedido-prescricao.md": ["E80", "E81", "E82"],
    "impugnacao-calculo.md": ["E98"]
  };

  var PROPRIEDADES_POR_MODELO = {
    "pedido-progressao.md": ["progressao", "condenacoes"],
    "pedido-livramento.md": ["livramento", "condenacoes"],
    "pedido-saida-temporaria.md": ["saidaTemporaria"],
    "pedido-detracao-horas.md": ["memoriaTermino"],
    "pedido-remicao.md": ["progressao", "livramento", "memoriaTermino"],
    "pedido-indulto.md": ["indulto"],
    "pedido-prescricao.md": ["prescricaoExecutoria", "prescricaoFaltaGrave"],
    "impugnacao-calculo.md": ["conferencia"]
  };

  function adicionarIds(valor, ids) {
    (Array.isArray(valor) ? valor : [valor]).forEach(function (item) {
      if (typeof item !== "string") return;
      var encontrados = item.match(/[ED]\d+(?:-[A-Z0-9]+)*/gi) || [];
      encontrados.forEach(function (id) { ids.add(id.toUpperCase()); });
    });
  }

  function idsDoResultado(valor, ids) {
    if (!valor || typeof valor !== "object") return;
    if (Array.isArray(valor)) {
      valor.forEach(function (item) { idsDoResultado(item, ids); });
      return;
    }
    Object.keys(valor).forEach(function (chave) {
      if (/^(regra|regras|regraPR|regraLC|regraMotor|regraOficial)$/.test(chave)) {
        adicionarIds(valor[chave], ids);
      }
      if (valor[chave] && typeof valor[chave] === "object") idsDoResultado(valor[chave], ids);
    });
  }

  function citarRegras(ids, textoRegras) {
    if (typeof textoRegras !== "string") return "A memória não contém referências individualizadas; confira os IDs citados e os autos.";
    var citacoes = [];
    textoRegras.split(/\r?\n/).forEach(function (linha) {
      var celulas = linha.split("|").map(function (celula) { return celula.trim(); });
      if (celulas.length < 5) return;
      var id = celulas[1];
      if (!ids.has(id)) return;
      var fundamento = celulas[3];
      if (!fundamento || fundamento === "—" || fundamento === "-") return;
      var status = celulas[4] || "";
      var conferir = /conferir|pendente|provis[oó]ria|revis[aã]o.*pendente|a conferir/i.test(fundamento + " " + status);
      citacoes.push((conferir ? "⚠️ CONFERIR — " : "") + id + ": " + fundamento);
    });
    return citacoes.length ? Array.from(new Set(citacoes)).join("\n") :
      "A memória não contém precedente individualizado; confira os IDs citados e os autos.";
  }

  function camposDoCalculo(arquivo, nomeModelo, textoRegras) {
    var resultado = arquivo && arquivo.resultado || {};
    var entrada = arquivo && arquivo.entrada || {};
    var caso = arquivo && arquivo.caso || {};
    var progressao = resultado.progressao || {};
    var livramento = resultado.livramento || {};
    var saida = resultado.saidaTemporaria || {};
    var indulto = resultado.indulto || {};
    var prescricaoExecutoria = Array.isArray(resultado.prescricaoExecutoria)
      ? resultado.prescricaoExecutoria : [];
    var prescricaoFaltas = Array.isArray(resultado.prescricaoFaltaGrave)
      ? resultado.prescricaoFaltaGrave : [];
    var remicoes = Array.isArray(entrada.remicoes) ? entrada.remicoes : [];
    var divergencia = Array.isArray(resultado.conferencia)
      ? resultado.conferencia.find(function (item) { return item && item.diferencaDias !== 0; })
      : null;
    var conferencias = Array.isArray(resultado.conferencia)
      ? resultado.conferencia.filter(function (item) { return item && item.diferencaDias !== 0; })
      : [];
    var diasRemidos = remicoes.reduce(function (total, remicao) {
      return total + (remicao && remicao.homologada === true && Number.isFinite(remicao.dias) ? remicao.dias : 0);
    }, 0);
    var proximoPasso = progressao.data
      ? "Acompanhar a data estimada da próxima mudança de regime e pedir à Defensoria que confira os requisitos."
      : "Conversar com a Defensoria para conferir os requisitos e os documentos necessários.";
    var rotulos = {
      diferenca_convencao: "Diferença de convenção de contagem",
      divergencia_juridica: "Divergência jurídica",
      falta_confirmar_dado: "Falta confirmar dado",
      sem_explicacao: "Sem explicação",
      divergencia_cabimento: "Divergência jurídica"
    };
    var linhasConferencia = conferencias.map(function (item) {
      var classificacao = rotulos[item.classificacao] || "Sem explicação";
      var diferenca = Number.isInteger(item.diferencaDias) ? item.diferencaDias + " dias" : "não comparável";
      return item.item + ": oficial " + formatarData(item.seeu) + "; calculadora " +
        formatarData(item.nossa) + "; " + diferenca + "; " + classificacao + ". " +
        (item.explicacao || "Nenhuma hipótese testada reproduz o valor oficial.");
    });
    var ids = new Set(REGRAS_POR_MODELO[nomeModelo] || []);
    if (nomeModelo === "folha-assistido.md") {
      idsDoResultado(resultado, ids);
    } else {
      (PROPRIEDADES_POR_MODELO[nomeModelo] || []).forEach(function (propriedade) {
        var fonte = resultado[propriedade];
        if (propriedade === "condenacoes" && nomeModelo === "pedido-progressao.md") {
          fonte = (Array.isArray(fonte) ? fonte : []).map(function (item) { return { regra: item && item.regraPR }; });
        } else if (propriedade === "condenacoes" && nomeModelo === "pedido-livramento.md") {
          fonte = (Array.isArray(fonte) ? fonte : []).map(function (item) { return { regra: item && item.regraLC }; });
        }
        idsDoResultado(fonte, ids);
      });
      var regrasAviso = new Set(REGRAS_POR_MODELO[nomeModelo] || []);
      (Array.isArray(resultado.avisos) ? resultado.avisos : []).forEach(function (aviso) {
        if (aviso && regrasAviso.has(aviso.regra)) ids.add(aviso.regra);
      });
    }
    if (Array.isArray(entrada.detracoesCautelares) && entrada.detracoesCautelares.length) ids.add("E27-A");
    var horasCautelares = (Array.isArray(entrada.detracoesCautelares) ? entrada.detracoesCautelares : [])
      .reduce(function (total, item) {
        return total + (item && Number.isFinite(item.horas) ? item.horas : 0);
      }, 0);
    var textosRegra = Array.from(ids).sort().join(", ");
    var precedentes = citarRegras(ids, textoRegras);
    var avisoConferir = /⚠️ CONFERIR/.test(precedentes)
      ? "Há precedente ou fundamento marcado CONFERIR. Revise o destaque antes de usar a minuta."
      : "Revise os fundamentos e a memória de cálculo antes de usar a minuta.";
    var statusHipotese = function (item) {
      return item.artigo + ": " + (item.status === "candidato_a_conferir"
        ? "candidato indicado, a conferir"
        : item.status === "sem_candidato_automatico"
          ? "sem candidato automático; isso não significa que não cabe"
          : "a conferir");
    };
    var requisitosIndulto = indulto.requisitos || {};
    var datasFalta = (indulto.faltaGrave && indulto.faltaGrave.datas || []).map(function (item) {
      return "Fato " + formatarData(item.fato) + "; instauração " + formatarData(item.instauracao) +
        "; reconhecimento judicial " + formatarData(item.reconhecimentoJudicial) +
        "; publicação do decreto " + formatarData(item.publicacaoDecreto) + ".";
    });
    var descricaoPrescricao = function (item) {
      return "Crime " + (item.condenacaoId || "sem identificação") + ": marco " +
        formatarData(item.termoInicial) + (item.marcoInicial && item.marcoInicial.explicacao
          ? " (" + item.marcoInicial.explicacao + ")" : "") + "; prazo " +
        (Number.isInteger(item.prazoMeses) ? item.prazoMeses + " meses" : "a conferir") +
        (item.reincidente ? " (com aumento provisório de 1/3 por reincidência)" : "") +
        (item.reducaoVedadaPorViolenciaSexual ? "; redução etária não aplicada" : "") +
        "; data " + formatarData(item.dataPrescricao) + "; situação " +
        statusPrescricao(item.status) + ".";
    };
    var descricaoFalta = function (item) {
      return "Falta em " + formatarData(item.dataFalta) + ": marco " +
        formatarData(item.termoInicial) + "; prazo " +
        (item.prazoAnos ? item.prazoAnos + " anos" : "a conferir") + "; data " +
        formatarData(item.dataPrescricao) + "; situação " + statusPrescricao(item.status) + ".";
    };
    function statusPrescricao(status) {
      return {
        dados_insuficientes: "faltam dados ou certidão",
        execucao_iniciada: "execução iniciada",
        pena_extinta: "pena extinta",
        extincao_declarada: "extinção já declarada",
        em_curso: "em curso",
        prescrita: "prazo encerrado"
      }[status] || "a conferir";
    }

    return {
      data_calculo: formatarData(arquivo && arquivo.dataCalculo),
      decreto_indulto: indulto.decreto || "a conferir",
      data_referencia_indulto: formatarData(indulto.dataReferencia),
      tempo_cumprido_indulto: formatarQuantidade(requisitosIndulto.tempoCumpridoDias),
      pena_total_indulto: formatarQuantidade(requisitosIndulto.penaTotalDias),
      pena_impeditiva_indulto: formatarQuantidade(requisitosIndulto.penaImpeditivaDias),
      pena_nao_impeditiva_indulto: formatarQuantidade(requisitosIndulto.penaNaoImpeditivaDias),
      hipoteses_indulto: (indulto.indulto && indulto.indulto.hipoteses || [])
        .map(statusHipotese).join("\n") || "a conferir",
      hipoteses_comutacao: (indulto.comutacao && indulto.comutacao.hipoteses || [])
        .map(statusHipotese).join("\n") || "a conferir",
      impedimentos_indulto: (indulto.impedimentosEncontrados || [])
        .map(function (item) { return item.artigo + ": impedimento identificado."; }).join("\n") ||
          "Nenhum impedimento automático identificado; confira os itens pendentes.",
      datas_falta_indulto: datasFalta.join("\n") || "Nenhuma falta grave informada.",
      itens_conferir_indulto: (indulto.itensAConferir || []).join("\n") || "a conferir",
      prescricao_executoria: prescricaoExecutoria.map(descricaoPrescricao).join("\n") || "Não calculada; confira os dados e as certidões.",
      prescricao_faltas: prescricaoFaltas.map(descricaoFalta).join("\n") || "Nenhuma falta grave informada.",
      aviso_prescricao: prescricaoExecutoria.some(function (item) { return item.causasConferidas !== true; }) ||
        prescricaoFaltas.some(function (item) { return item.status === "dados_insuficientes"; })
        ? "Há dados ou certidões pendentes. Não use datas não calculadas como conclusão."
        : "Análise provisória. Confira os autos, as certidões e as causas de interrupção ou suspensão.",
      juizo: caso.juizo || "",
      processo: caso.processo || entrada.processo || "",
      assistido: caso.pessoa || "",
      local_data: [caso.cidade || "", formatarData(arquivo && arquivo.dataCalculo)].filter(Boolean).join(", "),
      assinatura: [caso.unidade || "", caso.autor || ""].filter(Boolean).join("\n"),
      pena_cumprida: formatarQuantidade(resultado.cumprido),
      pena_restante: formatarQuantidade(resultado.restante),
      data_progressao: formatarData(progressao.data),
      requisito_dias: formatarQuantidade(progressao.requisitoDias),
      data_livramento: livramento.cabe === false
        ? "não indicado neste cálculo"
        : formatarData(livramento.data),
      data_saida_temporaria: saida.cabe === false ? "não indicado neste cálculo" : formatarData(saida.data),
      motivo_saida_temporaria: saida.motivoNaoCabe || "requisitos subjetivos e autorização judicial precisam ser conferidos",
      finalidades_saida_temporaria: Array.isArray(saida.finalidadesPermitidas)
        ? saida.finalidadesPermitidas.join(", ") : "a conferir conforme a lei aplicável",
      data_termino: formatarData(resultado.termino),
      dias_detracao_horas: horasCautelares
        ? horasCautelares + " horas (" + (resultado.detracaoCautelarDias || 0) + " dias completos no cálculo)"
        : (resultado.detracaoCautelarDias || 0) + " dias completos; horas de origem não registradas",
      horas_registradas: (Array.isArray(entrada.detracoesCautelares) ? entrada.detracoesCautelares : [])
        .map(function (item) { return item.data + ": " + item.horas + " horas"; }).join("; ") || "não informados no arquivo",
      atividade: "atividade e comprovantes a especificar",
      periodo: "período a especificar",
      dias_requeridos: "quantidade a especificar",
      documentos: "documentos a especificar",
      dias_remicao: diasRemidos ? diasRemidos + " dias homologados registrados no cálculo" : "nenhum dia homologado informado no cálculo",
      item_divergente: divergencia ? divergencia.item : "não identificada",
      valor_atual: divergencia ? formatarData(divergencia.seeu) : "não informado",
      valor_conferido: divergencia ? formatarData(divergencia.nossa) : "não informado",
      diferenca: divergencia && Number.isInteger(divergencia.diferencaDias)
        ? divergencia.diferencaDias + " dias"
        : divergencia ? "não comparável" : "não informada",
      classificacao_divergencia: divergencia
        ? rotulos[divergencia.classificacao] || "Sem explicação"
        : "não identificada",
      descricao_divergencia: divergencia && divergencia.explicacao ? divergencia.explicacao : "descreva a divergência e indique os documentos que a demonstram",
      conferencias: linhasConferencia.length ? linhasConferencia.join("\n") : "Nenhuma diferença classificada.",
      fundamentos_ids: textosRegra || "a conferir",
      precedentes: precedentes,
      aviso_precedentes: avisoConferir,
      proximos_passos: proximoPasso,
      aviso_comportamento: "A data é aproximada. A progressão também depende da análise do requisito de comportamento (E38). O livramento e o fim da pena também podem depender de outros requisitos e de decisões judiciais."
    };
  }

  function preencher(modelo, campos) {
    return modelo.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, function (marcador, chave) {
      return Object.prototype.hasOwnProperty.call(campos, chave) && campos[chave] !== ""
        ? String(campos[chave])
        : marcador;
    });
  }

  function escaparXml(texto) {
    return Array.from(texto).filter(function (caractere) {
      var ponto = caractere.codePointAt(0);
      return ponto === 9 || ponto === 10 || ponto === 13 ||
        (ponto >= 0x20 && ponto <= 0xd7ff) ||
        (ponto >= 0xe000 && ponto <= 0xfffd) ||
        (ponto >= 0x10000 && ponto <= 0x10ffff);
    }).join("").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function paragrafoDocx(linha) {
    var estilo = "";
    var texto = linha;
    if (/^# /.test(linha)) {
      estilo = '<w:pPr><w:pStyle w:val="Title"/></w:pPr>';
      texto = linha.slice(2);
    } else if (/^## /.test(linha)) {
      estilo = '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>';
      texto = linha.slice(3);
    } else if (/^- /.test(linha)) {
      texto = "• " + linha.slice(2);
    }
    texto = texto.replace(/\*\*/g, "");
    return "<w:p>" + estilo + '<w:r><w:t xml:space="preserve">' + escaparXml(texto) + "</w:t></w:r></w:p>";
  }

  function crc32(bytes) {
    var crc = -1;
    for (var i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (var bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ -1) >>> 0;
  }

  function zip(entries) {
    var encoder = new TextEncoder();
    var locals = [];
    var centrals = [];
    var offset = 0;
    entries.forEach(function (entry) {
      var name = encoder.encode(entry.name);
      var data = encoder.encode(entry.content);
      var crc = crc32(data);
      var local = new Uint8Array(30 + name.length + data.length);
      var localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, 0, true);
      localView.setUint16(12, 0x21, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, data.length, true);
      localView.setUint32(22, data.length, true);
      localView.setUint16(26, name.length, true);
      localView.setUint16(28, 0, true);
      local.set(name, 30);
      local.set(data, 30 + name.length);
      locals.push(local);

      var central = new Uint8Array(46 + name.length);
      var centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, 0, true);
      centralView.setUint16(14, 0x21, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, data.length, true);
      centralView.setUint32(24, data.length, true);
      centralView.setUint16(28, name.length, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint16(36, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, offset, true);
      central.set(name, 46);
      centrals.push(central);
      offset += local.length;
    });
    var centralLength = centrals.reduce(function (total, part) { return total + part.length; }, 0);
    var end = new Uint8Array(22);
    var endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, centralLength, true);
    endView.setUint32(16, offset, true);
    var parts = locals.concat(centrals, [end]);
    var result = new Uint8Array(offset + centralLength + end.length);
    var cursor = 0;
    parts.forEach(function (part) {
      result.set(part, cursor);
      cursor += part.length;
    });
    return result;
  }

  function criarDocumentoXml(texto) {
    var body = texto.split(/\r?\n/).map(paragrafoDocx).join("");
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>';
  }

  function escaparHtml(texto) {
    return String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function linhaHtml(linha) {
    if (/^# /.test(linha)) return "<h1>" + escaparHtml(linha.slice(2)) + "</h1>";
    if (/^## /.test(linha)) return "<h2>" + escaparHtml(linha.slice(3)) + "</h2>";
    if (/^⚠️ CONFERIR/.test(linha)) return '<p class="conferir"><strong>' + escaparHtml(linha) + "</strong></p>";
    if (/^- /.test(linha)) return "<p>• " + escaparHtml(linha.slice(2)) + "</p>";
    return linha ? "<p>" + escaparHtml(linha) + "</p>" : "<br>";
  }

  function criarHtml(texto) {
    return "<!doctype html>\n<html lang=\"pt-BR\"><head><meta charset=\"utf-8\">" +
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
      "<title>Minuta editável</title><style>" +
      "body{max-width:48rem;margin:2rem auto;padding:0 1rem;font:16px/1.6 Arial,sans-serif;color:#202820}" +
      "h1,h2{line-height:1.25}.conferir{padding:.75rem;border-left:4px solid #e9a820;background:#fff7df}" +
      "@media print{body{max-width:none;margin:0}}</style></head><body>" +
      String(texto).split(/\r?\n/).map(linhaHtml).join("\n") + "</body></html>";
  }

  function criarDocx(texto) {
    var documentXml = criarDocumentoXml(texto);
    var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '</Types>';
    var relationships = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>';
    var documentRelationships = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';
    var stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:color w:val="4C9A2A"/><w:sz w:val="32"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>' +
      '</w:styles>';
    return zip([
      { name: "[Content_Types].xml", content: contentTypes },
      { name: "_rels/.rels", content: relationships },
      { name: "word/document.xml", content: documentXml },
      { name: "word/_rels/document.xml.rels", content: documentRelationships },
      { name: "word/styles.xml", content: stylesXml }
    ]);
  }

  return {
    camposDoCalculo: camposDoCalculo,
    preencher: preencher,
    criarHtml: criarHtml,
    criarDocumentoXml: criarDocumentoXml,
    criarDocx: criarDocx
  };
});
