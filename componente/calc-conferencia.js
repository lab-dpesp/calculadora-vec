(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../core/index.js"), require("../ui/textos.js"));
  } else {
    root.CalcConferencia = factory(root.CalcPenCore, root.TextosInterface);
    root.CalcConferencia.registrar();
  }
})(typeof globalThis === "object" ? globalThis : this, function (core, textos) {
  "use strict";

  const ESTILO = `
    :host { display:block; min-width:0; color:var(--texto,#000);
      font:400 14px/1.5 var(--fonte,"Figtree",-apple-system,"Segoe UI",sans-serif);
      font-variant-numeric:tabular-nums; }
    * { box-sizing:border-box; }
    .painel { padding:16px; border:1px solid var(--borda,rgba(0,0,0,.12));
      border-radius:var(--raio,10px); background:var(--fundo,#fff); }
    h2 { margin:0 0 12px; font-size:1.25rem; }
    .nota { padding:10px; border-radius:var(--raio,10px);
      background:var(--origem-fundo,#FFF6DA); color:var(--origem-texto,#6B5A1E); }
    .pena-cumprida { border:1px solid var(--erro,#C10015); border-left:4px solid var(--erro,#C10015);
      border-radius:var(--raio,10px); padding:10px; background:var(--erro-fundo,#FDECEE);
      color:var(--erro,#C10015); font-weight:600; }
    .erro { color:var(--erro,#C10015); }
    .sub { color:var(--rotulo,rgba(0,0,0,.6)); }
    .tabela-rolagem { overflow-x:auto; }
    .tabela-rolagem:focus-visible { outline:2px solid var(--primaria,#4C9A2A); outline-offset:2px; }
    .q-tabela { border-collapse:collapse; width:100%; text-align:left; }
    th,td { padding:10px; vertical-align:top; border-bottom:1px solid var(--borda,rgba(0,0,0,.12));
      overflow-wrap:anywhere; min-width:8rem; }
    th { font-weight:600; }
    caption { text-align:left; font-weight:600; padding:12px 0; }
    li { overflow-wrap:anywhere; }
  `;
  const ITENS = [
    ["progressao", "Progressão"], ["livramento", "Livramento condicional"],
    ["saidaTemporaria", "Saída temporária"], ["termino", "Término"]
  ];

  function dataBR(data) {
    return data ? String(data).replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1") : "Não informada";
  }

  function erro(campo, mensagem, regra) {
    return { versaoContrato: 1, erros: [{ campo, mensagem, regra: regra || "E90" }] };
  }

  function registrar(ambiente) {
    ambiente = ambiente || globalThis;
    const existente = ambiente.customElements.get("calc-conferencia");
    if (existente) return existente;

    class CalcConferencia extends ambiente.HTMLElement {
      static get observedAttributes() { return ["texto", "calcpen", "data-calculo", "tipo-documento"]; }

      constructor() {
        super();
        this._calcpen = null;
        this._processo = null;
        this._oficial = {};
        this._agendado = false;
        this.attachShadow({ mode: "open" });
      }

      get texto() { return this.getAttribute("texto") || ""; }
      set texto(valor) {
        if (valor == null) this.removeAttribute("texto");
        else this.setAttribute("texto", valor);
      }
      get calcpen() { return this._calcpen ?? this.getAttribute("calcpen"); }
      set calcpen(valor) { this._calcpen = valor; this._agendar(); }
      get processo() { return this._processo; }
      set processo(valor) { this._processo = valor; this._agendar(); }
      get dataCalculo() { return this.getAttribute("data-calculo") || ""; }
      set dataCalculo(valor) {
        if (valor == null) this.removeAttribute("data-calculo");
        else this.setAttribute("data-calculo", valor);
      }

      connectedCallback() {
        // Preserva propriedades atribuídas pelo hospedeiro antes de registrar o elemento.
        for (const nome of ["texto", "calcpen", "processo", "dataCalculo"]) {
          if (Object.prototype.hasOwnProperty.call(this, nome)) {
            const valor = this[nome];
            delete this[nome];
            this[nome] = valor;
          }
        }
        this._agendar();
      }

      attributeChangedCallback(nome) {
        if (nome === "calcpen") this._calcpen = null;
        this._agendar();
      }

      _agendar() {
        if (!this.isConnected || this._agendado) return;
        this._agendado = true;
        queueMicrotask(() => {
          this._agendado = false;
          if (!this.isConnected) return;
          const resposta = this._conferir();
          this._mostrar(resposta);
          this.dispatchEvent(new ambiente.CustomEvent("resultado", {
            detail: resposta, bubbles: true, composed: true
          }));
        });
      }

      _conferir() {
        this._oficial = {};
        if (!/^\d{4}-\d{2}-\d{2}$/.test(this.dataCalculo) ||
            !Number.isFinite(Date.parse(this.dataCalculo)) ||
            new Date(this.dataCalculo).toISOString().slice(0, 10) !== this.dataCalculo) {
          return erro("dataCalculo", "Data do cálculo ausente ou em formato inválido. Informe data-calculo no formato AAAA-MM-DD.", "E01");
        }
        const temTexto = this.texto.trim().length > 0;
        const temJSON = this.calcpen != null && this.calcpen !== "";
        const temProcesso = this.processo != null;
        if ([temTexto, temJSON, temProcesso].filter(Boolean).length !== 1) {
          return erro("entrada", "Informe apenas uma entrada: texto do documento, calcpen (JSON) ou processo.", "I04");
        }
        let leituraDocumento;
        let entrada;
        if (temProcesso) {
          try {
            // I04: limite agregado, incluindo documentos e movimentos.
            if (JSON.stringify(this.processo).length > 2000000) {
              return erro("processo", "Pacote muito grande. Envie até 2 milhões de caracteres em JSON.", "I04");
            }
            leituraDocumento = core.lerProcesso(this.processo, this.dataCalculo);
            entrada = leituraDocumento.calcpen;
          } catch {
            return erro("processo", "Pacote inválido. Informe um objeto calcpen-processo v1 com sistema, documentos e movimentos.", "I04");
          }
        } else if (temTexto) {
          const tipo = this.getAttribute("tipo-documento") || "SEEU";
          if (!["SEEU", "TJSP"].includes(tipo)) {
            return erro("tipo-documento", "Tipo de documento inválido. Informe SEEU ou TJSP.");
          }
          leituraDocumento = tipo === "TJSP"
            ? core.lerCalculoTJSP(this.texto) : core.lerRelatorioSEEU(this.texto, undefined, this.dataCalculo);
          entrada = leituraDocumento.calcpen;
        } else {
          try {
            entrada = typeof this.calcpen === "string" ? JSON.parse(this.calcpen) : this.calcpen;
          } catch {
            return erro("calcpen", "JSON inválido. Corrija a sintaxe do objeto calcpen.");
          }
          if (!entrada || entrada.formato !== "calcpen" || entrada.versao !== 1 || Array.isArray(entrada)) {
            return erro("calcpen", 'Formato inválido. Informe o objeto com formato "calcpen" e versao 1.');
          }
        }
        this._oficial = leituraDocumento ? leituraDocumento.oficial : entrada.atestadoSEEU || {};
        try {
          const resultado = core.calcular(entrada, this.dataCalculo);
          const resposta = { ...resultado };
          if (leituraDocumento) resposta.leituraDocumento = leituraDocumento;
          if (!resultado.erros?.length) {
            resposta.comparacao = core.comparar({
              entrada, dataCalculo: this.dataCalculo, resultado,
              oficial: this._oficial,
              cenarios: core.gerarCenarios(entrada, this.dataCalculo)
            });
          }
          return resposta;
        } catch {
          return {
            ...erro("entrada", "Dados incompatíveis com o cálculo. Confira os campos do calcpen v1 ou a transcrição do documento."),
            ...(leituraDocumento ? { leituraDocumento } : {})
          };
        }
      }

      _mostrar(resposta) {
        const criar = (tag, texto, classe) => {
          const no = ambiente.document.createElement(tag);
          if (texto != null) no.textContent = texto;
          if (classe) no.className = classe;
          return no;
        };
        const estilo = criar("style", ESTILO);
        const painel = criar("section", null, "painel");
        painel.setAttribute("aria-label", "Conferência do cálculo");
        const estado = criar("p", "Triagem — dados e resultado a conferir. Não substitui o atestado nem a decisão judicial.", "nota");
        estado.setAttribute("role", "status");
        painel.append(criar("h2", "Conferência do cálculo"), estado);
        const processo = resposta.leituraDocumento?.processo;
        if (processo) {
          const usado = processo.documentoUsado;
          painel.append(criar("p", usado
            ? "Documento usado: " + (usado.nome || usado.tipo || usado.id) + " · " + dataBR(usado.data.slice(0, 10))
            : "Nenhum documento aproveitável.", "sub"));
          painel.append(criar("h3", "Documentos ignorados"));
          const ignorados = criar("ul");
          for (const item of processo.documentosIgnorados) {
            ignorados.append(criar("li", (item.id || "Sem identificador") + ": " + item.motivo));
          }
          painel.append(ignorados);
          if (!processo.documentosIgnorados.length) painel.append(criar("p", "Nenhum documento ignorado.", "sub"));
          painel.append(criar("h3", "Movimentações posteriores ao documento"));
          const movimentos = criar("ul");
          for (const item of processo.movimentosPosteriores) {
            movimentos.append(criar("li", dataBR(item.data.slice(0, 10)) + " · " + item.descricao));
          }
          painel.append(movimentos);
          if (!processo.movimentosPosteriores.length) painel.append(criar("p", "Nenhuma movimentação posterior sinalizada pelo leitor.", "sub"));
        }
        if (resposta.erros?.length) {
          const erros = criar("ul", null, "erro");
          erros.setAttribute("role", "alert");
          for (const item of resposta.erros) erros.append(criar("li", textos.campo(item.campo) + ": " + item.mensagem));
          painel.append(erros);
        } else {
          painel.append(criar("p", "Data do cálculo: " + dataBR(this.dataCalculo) +
            " · Núcleo: " + resposta.nucleoVersao + " · Base de regras: " + resposta.regrasVersao, "sub"));
          const avisoPenaCumprida = (resposta.avisos || []).find((aviso) => aviso && aviso.regra === "E102");
          if (avisoPenaCumprida) {
            const destaque = criar("p", avisoPenaCumprida.regra + " — " + avisoPenaCumprida.texto, "pena-cumprida");
            destaque.setAttribute("role", "alert");
            painel.append(destaque);
          }
          const rolagem = criar("div", null, "tabela-rolagem");
          rolagem.setAttribute("tabindex", "0");
          rolagem.setAttribute("role", "region");
          rolagem.setAttribute("aria-label", "Quadro oficial × calculadora; role para ver todas as colunas");
          const tabela = criar("table", null, "q-tabela");
          tabela.append(criar("caption", "Oficial × calculadora"));
          const cabecalho = criar("thead");
          const titulos = criar("tr");
          for (const titulo of ["Item", "Oficial", "Calculadora", "Diferença em dias", "Causa provável", "Motivo de não calcular"]) {
            const th = criar("th", titulo);
            th.setAttribute("scope", "col");
            titulos.append(th);
          }
          cabecalho.append(titulos);
          tabela.append(cabecalho);
          const corpo = criar("tbody");
          for (const [item, nome] of ITENS) {
            const comparacao = (resposta.comparacao || []).find((linha) => linha.item === item) || {};
            const oficial = comparacao.oficial ?? this._oficial[item];
            const beneficio = resposta[item];
            const data = item === "termino" ? beneficio : beneficio?.data;
            const linha = criar("tr");
            const titulo = criar("th", nome);
            titulo.setAttribute("scope", "row");
            linha.append(titulo);
            const diferenca = comparacao.diferencaDias;
            const motivo = beneficio?.motivoNaoCabe;
            for (const valor of [
              dataBR(oficial), dataBR(data),
              diferenca == null ? "—" : (diferenca > 0 ? "+" : "") + diferenca,
              comparacao.explicacao || (oficial ? "Comparação indisponível com os dados informados." : "Data oficial não informada."),
              motivo ? motivo + " " + (beneficio.fundamentoNaoCabe || []).join(", ") : "—"
            ]) linha.append(criar("td", valor));
            corpo.append(linha);
          }
          tabela.append(corpo);
          rolagem.append(tabela);
          painel.append(rolagem, criar("p", "Diferença = calculadora − oficial. Causa provável é hipótese para conferência.", "sub"));
        }
        const avisos = criar("ul", null, "revisao-lista");
        for (const alerta of textos.pendencias(resposta.leituraDocumento?.alertas,
          resposta.leituraDocumento?.calcpen)) avisos.append(criar("li", alerta));
        for (const aviso of resposta.avisos || []) {
          if (core.modulosProvisorios.some((modulo) => modulo.id === aviso.regra)) continue;
          if (aviso && aviso.regra === "E102") continue;
          avisos.append(criar("li", [aviso.regra, aviso.status, aviso.texto].filter(Boolean).join(" — ")));
        }
        painel.append(avisos);
        this.shadowRoot.replaceChildren(estilo, painel);
      }
    }

    ambiente.customElements.define("calc-conferencia", CalcConferencia);
    return CalcConferencia;
  }

  return { registrar };
});
