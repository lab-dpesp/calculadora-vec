(function () {
  "use strict";

  const radar = window.RadarCarteira;
  const dbPromise = radar.openDatabase();
  const today = new Date().toISOString().slice(0, 10);
  let records = [];
  let key = null;
  let vaultEnabled = false;
  let db;
  const ruleErrors = new Map();
  let pendingWrites = Promise.resolve();
  let clearing = false;

  const list = document.getElementById("lista");
  const message = document.getElementById("mensagem");
  const password = document.getElementById("senha");
  const passwordAction = document.getElementById("senha-acao");

  function write(action) {
    if (clearing) return Promise.reject(new Error("Aguarde a exclusão da carteira antes de salvar."));
    const pending = pendingWrites.then(action);
    pendingWrites = pending.catch(() => {});
    return pending;
  }

  function notify(text, error) {
    message.textContent = text;
    message.classList.toggle("erro", Boolean(error));
  }

  function displayDate(value) {
    const date = radar.parseDate(value);
    return date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date) : value;
  }

  function render() {
    renderRuleChanges();
    list.replaceChildren();
    const rows = radar.buildRows(records, today);
    const byId = new Map(records.map((record) => [record.id, record]));
    for (const row of rows) {
      const tr = document.createElement("tr");
      const title = document.createElement("td");
      title.textContent = row.titulo;
      const benefit = document.createElement("td");
      benefit.textContent = row.nome;
      const faultDate = radar.noFaultRequirement(row.calculo);
      if (faultDate && row.tipo === "livramento") {
        const note = document.createElement("span");
        note.className = "sem-falta";
        note.textContent = `12 meses sem falta se cumprem em ${displayDate(faultDate)}`;
        benefit.append(note);
      }
      const date = document.createElement("td");
      date.textContent = displayDate(row.data);
      const status = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `status${row.status === "vencido sem pedido" ? " vencido" : ""}`;
      badge.textContent = row.status;
      status.append(badge);
      const petition = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = row.solicitado;
      checkbox.setAttribute("aria-label", `Pedido de ${row.nome} protocolado para ${row.titulo}`);
      checkbox.addEventListener("change", async () => {
        const record = byId.get(row.id);
        const previous = record.pedidos[row.tipo];
        record.pedidos[row.tipo] = checkbox.checked;
        try {
          const recordKey = key;
          await write(() => radar.saveRecord(db, record, recordKey));
          render();
        } catch (error) {
          record.pedidos[row.tipo] = previous;
          checkbox.checked = Boolean(previous);
          notify(error.message, true);
        }
      });
      petition.append(checkbox);
      const actions = document.createElement("td");
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "q-btn q-btn-flat";
      remove.textContent = "Remover";
      remove.addEventListener("click", async () => {
        try {
          await write(() => radar.deleteRecord(db, row.id));
          ruleErrors.delete(row.id);
          records = records.filter((item) => item.id !== row.id);
          render();
          notify("Cálculo removido.");
        } catch (error) {
          notify(error.message, true);
        }
      });
      actions.append(remove);
      tr.append(title, benefit, date, status, petition, actions);
      list.append(tr);
    }
    const empty = document.getElementById("vazio");
    empty.hidden = rows.length > 0;
    empty.textContent = vaultEnabled && !key
      ? "Carteira protegida. Informe a senha para ver os cálculos."
      : records.length
        ? "Nenhum benefício com data disponível nestes cálculos."
        : "Nenhum cálculo salvo nesta carteira.";
  }

  function displayValue(value) {
    if (value === null) return "não disponível";
    if (typeof value === "boolean") return value ? "sim" : "não";
    if (typeof value === "object") return JSON.stringify(value);
    return String(displayDate(value));
  }

  function renderRuleChanges() {
    const changes = document.getElementById("alteracoes-regras");
    changes.replaceChildren();
    let affected = 0;
    for (const record of records) {
      const report = record.atualizacaoRegras;
      const failure = ruleErrors.get(record.id);
      if (!failure && (!report || !report.alteracoes.length)) continue;
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = record.titulo;
      item.append(title);
      if (failure) {
        item.append(document.createTextNode(` — ${failure}`));
      } else {
        affected++;
        const description = document.createElement("p");
        description.textContent = `Base ${report.de || "não informada"} → ${report.para}. Comparação em ${displayDate(report.dataCalculo)}. A conferir.`;
        item.append(description);
        const details = document.createElement("ul");
        for (const change of report.alteracoes) {
          const detail = document.createElement("li");
          detail.textContent = `${change.nome}: ${displayValue(change.antes)} → ${displayValue(change.depois)}. ` +
            `${change.causaConfirmada ? "Regra alterada" : "Regras associadas; causa não confirmada"}: ${change.regras.join(", ") || "não identificadas"}.`;
          details.append(detail);
        }
        for (const revision of report.revisoes) {
          const reason = document.createElement("p");
          reason.textContent = `${revision.versao}: ${revision.descricao}`;
          item.append(reason);
        }
        item.append(details);
      }
      changes.append(item);
    }
    document.getElementById("resumo-regras").textContent = vaultEnabled && !key
      ? "Desbloqueie a carteira para verificar os casos afetados."
      : `${affected} cálculo(s) com alterações. ${ruleErrors.size} cálculo(s) não puderam ser comparados.`;
  }

  async function refreshRules() {
    ruleErrors.clear();
    const activeRecords = records;
    const activeKey = key;
    for (let index = 0; index < activeRecords.length; index++) {
      if (records !== activeRecords || key !== activeKey) return;
      const record = activeRecords[index];
      try {
        const updated = radar.updateRules(record, window.CalculadoraExecucaoPenal.calcular);
        if (updated !== record) {
          await write(() => radar.saveRecord(db, updated, activeKey));
          if (records !== activeRecords || key !== activeKey) return;
          activeRecords[index] = updated;
        }
      } catch (error) {
        if (records !== activeRecords || key !== activeKey) return;
        ruleErrors.set(record.id, `Cálculo preservado. ${error.message}`);
      }
    }
  }

  function updateVaultControls() {
    passwordAction.textContent = vaultEnabled ? "Desbloquear" : "Ativar senha";
    document.getElementById("travar").hidden = !vaultEnabled || !key;
    passwordAction.disabled = clearing;
    document.getElementById("apagar-tudo").disabled = clearing;
    document.getElementById("arquivos").disabled = clearing || (vaultEnabled && !key);
    document.getElementById("exportar-csv").disabled = clearing || (vaultEnabled && !key);
    document.getElementById("exportar-ics").disabled = clearing || (vaultEnabled && !key);
    document.getElementById("senha-ajuda").textContent = vaultEnabled
      ? (key ? "Carteira desbloqueada neste navegador." : "Informe a senha para acessar os cálculos. Não há recuperação.")
      : "A senha protege os dados neste navegador. Guarde-a: não há recuperação.";
  }

  async function start() {
    db = await dbPromise;
    vaultEnabled = Boolean(await radar.getSetting(db));
    if (!vaultEnabled) records = (await radar.getAll(db)).map((item) => item.conteudo);
    await refreshRules();
    updateVaultControls();
    render();
  }

  document.getElementById("senha-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (clearing) return;
    const value = password.value;
    if (!value) {
      notify("Informe a senha local.", true);
      return;
    }
    const activeRecords = records;
    try {
      if (vaultEnabled) {
        const unlocked = await radar.unlockPassword(db, value);
        if (clearing || records !== activeRecords) return;
        key = unlocked.key;
        records = unlocked.records.map((item) => item.conteudo);
        notify("Carteira desbloqueada.");
      } else {
        const enabled = await write(() => radar.enablePassword(db, value));
        if (clearing || records !== activeRecords) return;
        key = enabled.key;
        records = enabled.records;
        vaultEnabled = true;
        notify("Senha local ativada.");
      }
      password.value = "";
      await refreshRules();
      updateVaultControls();
      render();
    } catch (error) {
      notify(error.message, true);
    }
  });

  document.getElementById("travar").addEventListener("click", () => {
    key = null;
    records = [];
    ruleErrors.clear();
    render();
    updateVaultControls();
    notify("Carteira travada.");
  });

  document.getElementById("arquivos").addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    const activeRecords = records;
    const activeKey = key;
    let imported = 0;
    try {
      for (const file of files) {
        const calculation = radar.validateCalculation(JSON.parse(await file.text()));
        if (clearing || records !== activeRecords || key !== activeKey) break;
        const item = {
          id: crypto.randomUUID(),
          titulo: file.name.replace(/\.calcpen$/i, ""),
          calculo: calculation,
          pedidos: {}
        };
        await write(() => radar.saveRecord(db, item, activeKey));
        if (clearing || records !== activeRecords || key !== activeKey) break;
        activeRecords.push(item);
        imported += 1;
      }
      notify(`${imported} cálculo(s) importado(s).`);
    } catch (error) {
      notify(error.message, true);
    } finally {
      await refreshRules();
      render();
      event.target.value = "";
    }
  });

  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById("exportar-csv").addEventListener("click", () => download("radar-beneficios.csv", radar.exportCSV(records, today), "text/csv;charset=utf-8"));
  document.getElementById("exportar-ics").addEventListener("click", () => download("radar-beneficios.ics", radar.exportICS(records, today), "text/calendar;charset=utf-8"));
  document.getElementById("apagar-tudo").addEventListener("click", async () => {
    if (clearing) return;
    if (!window.confirm("Apagar todos os cálculos e a senha local desta carteira?")) return;
    const previousRecords = records;
    const previousKey = key;
    clearing = true;
    records = [];
    ruleErrors.clear();
    updateVaultControls();
    render();
    try {
      await pendingWrites;
      await radar.clearAll(db);
      records = [];
      ruleErrors.clear();
      key = null;
      vaultEnabled = false;
      notify("Todos os dados da carteira foram apagados.");
    } catch (error) {
      if (key === previousKey) records = previousRecords;
      notify(error.message, true);
    } finally {
      clearing = false;
      updateVaultControls();
      render();
    }
  });

  document.getElementById("base-versao").textContent = window.Regras.base.versao;
  const history = document.getElementById("historico-regras");
  for (const revision of window.Regras.base.historico) {
    const item = document.createElement("li");
    item.textContent = `${revision.versao}: ${revision.descricao}` +
      (revision.regras.length ? ` (${revision.regras.join(", ")})` : "");
    history.append(item);
  }
  start().catch((error) => notify(`Não foi possível abrir a carteira local: ${error.message}`, true));
})();
