(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./regras.js") : root.Regras,
    typeof module === "object" && module.exports ? require("./piloto.js") : root.Piloto
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.RadarCarteira = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Regras, Piloto) {
  "use strict";

  const DB_NAME = "calculadora-execucao-penal-radar";
  const DB_VERSION = 1;
  const RECORDS = "calculos";
  const SETTINGS = "configuracoes";
  const ITERATIONS = 250000;

  function parseDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date;
  }

  function formatDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function addMonths(value, count) {
    const date = parseDate(value);
    if (!date) return null;
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + count);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
    return formatDate(date);
  }

  function listBenefits(calculation) {
    const result = calculation && calculation.resultado;
    if (!result || typeof result !== "object") return [];
    const benefits = [];
    if (result.progressao && parseDate(result.progressao.data)) {
      benefits.push({ tipo: "progressao", nome: "Progressão", data: result.progressao.data });
    }
    if (result.livramento && result.livramento.cabe !== false && parseDate(result.livramento.data)) {
      benefits.push({ tipo: "livramento", nome: "Livramento condicional", data: result.livramento.data });
    }
    return benefits;
  }

  function noFaultRequirement(calculation) {
    const existing = calculation && calculation.resultado && calculation.resultado.livramento;
    const savedDate = existing && (existing.dataRequisito12Meses || existing.dataSemFalta);
    if (parseDate(savedDate)) return savedDate;

    const entrada = calculation && calculation.entrada;
    const convictions = entrada && Array.isArray(entrada.condenacoes) ? entrada.condenacoes : [];
    if (!convictions.some((item) => parseDate(item.dataFato) >= parseDate("2020-01-23"))) return null;
    const faults = entrada && Array.isArray(entrada.faltasGraves) ? entrada.faltasGraves : [];
    const faultDates = faults
      .map((item) => item && (item.dataRecaptura || item.data))
      .filter((date) => parseDate(date))
      .sort();
    const lastFaultDate = faultDates[faultDates.length - 1];
    return lastFaultDate ? addMonths(lastFaultDate, 12) : null;
  }

  function statusFor(benefit, today, requested) {
    if (requested) return "pedido protocolado";
    const date = parseDate(benefit.data);
    const reference = parseDate(today);
    if (!date || !reference) return "";
    const days = Math.round((date - reference) / 86400000);
    if (days < 0) return "vencido sem pedido";
    if (days === 0) return "vence hoje";
    return `vence em ${days} ${days === 1 ? "dia" : "dias"}`;
  }

  function buildRows(records, today) {
    return records.flatMap((record) => {
      const benefits = listBenefits(record.calculo);
      return benefits.map((benefit) => ({
        id: record.id,
        titulo: record.titulo,
        calculo: record.calculo,
        tipo: benefit.tipo,
        nome: benefit.nome,
        data: benefit.data,
        solicitado: Boolean(record.pedidos && record.pedidos[benefit.tipo]),
        status: statusFor(benefit, today, Boolean(record.pedidos && record.pedidos[benefit.tipo]))
      }));
    }).sort((a, b) => a.data.localeCompare(b.data) || a.titulo.localeCompare(b.titulo, "pt-BR"));
  }

  function csvEscape(value) {
    let text = String(value == null ? "" : value);
    if (/^[\t\r\n=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportCSV(records, today) {
    const rows = buildRows(records, today);
    return "\uFEFF" + [
      ["Cálculo", "Benefício", "Data", "Situação"],
      ...rows.map((row) => [row.titulo, row.nome, row.data, row.status])
    ].map((row) => row.map(csvEscape).join(";")).join("\r\n");
  }

  function icsEscape(value) {
    return String(value).replace(/\r\n?/g, "\n").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  }

  function foldICSLine(line) {
    const folded = [];
    let current = "";
    let bytes = 0;
    for (const character of line) {
      const size = new TextEncoder().encode(character).length;
      if (bytes + size > 75) {
        folded.push(current);
        current = " ";
        bytes = 1;
      }
      current += character;
      bytes += size;
    }
    folded.push(current);
    return folded;
  }

  function exportICS(records, today) {
    const reference = parseDate(today);
    const events = buildRows(records, today).filter((row) => parseDate(row.data) >= reference);
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DPESP Labs//Radar de benefícios//PT-BR", "CALSCALE:GREGORIAN"];
    for (const row of events) {
      const date = row.data.replace(/-/g, "");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${encodeURIComponent(row.id)}-${row.tipo}-${date}@calculadora-execucao-penal`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
        `DTSTART;VALUE=DATE:${date}`,
        `SUMMARY:${icsEscape(`${row.nome}: ${row.titulo}`)}`,
        `DESCRIPTION:${icsEscape(`Data prevista no cálculo salvo. Situação: ${row.status}.`)}`,
        "END:VEVENT"
      );
    }
    lines.push("END:VCALENDAR");
    return lines.flatMap(foldICSLine).join("\r\n") + "\r\n";
  }

  function validateCalculation(calculation) {
    if (!calculation || calculation.formato !== "calcpen" || calculation.versao !== 1) {
      throw new Error("O arquivo não é um cálculo .calcpen versão 1.");
    }
    if (!calculation.resultado || typeof calculation.resultado !== "object") {
      throw new Error("O arquivo não contém o resultado do cálculo.");
    }
    return calculation;
  }

  function compareVersions(a, b) {
    const left = a.split(".").map(Number);
    const right = b.split(".").map(Number);
    return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
  }

  function ruleIds(value) {
    if (!value || typeof value !== "object") return [];
    return Object.entries(value).flatMap(([name, item]) => {
      if (["regra", "regras", "regraPR", "regraLC"].includes(name)) {
        return (Array.isArray(item) ? item : [item]).filter((id) => typeof id === "string");
      }
      return typeof item === "object" ? ruleIds(item) : [];
    });
  }

  // E95: compara resultados na mesma data, sem atribuir ao direito a passagem do tempo.
  function updateRules(record, calculate, base = Regras.base) {
    const saved = validateCalculation(record.calculo);
    const previousVersion = saved.regrasVersao || saved.resultado.regrasVersao;
    if (previousVersion === base.versao) return record;
    if (typeof previousVersion === "string" && /^\d{4}\.(0[1-9]|1[0-2])\.[1-9]\d*$/.test(previousVersion) &&
        compareVersions(previousVersion, base.versao) > 0) {
      throw new Error("Base do arquivo mais recente que a disponível. Atualize a calculadora para conferir este caso.");
    }
    if (!saved.entrada || !parseDate(saved.dataCalculo)) {
      throw new Error("Arquivo sem entrada ou data do cálculo válida. Abra o original e salve um cálculo completo para comparar as regras.");
    }
    const result = calculate(JSON.parse(JSON.stringify(saved.entrada)), saved.dataCalculo,
      saved.opcoes && JSON.parse(JSON.stringify(saved.opcoes)));
    if (!result || (result.erros && result.erros.length)) {
      throw new Error(`Não foi possível recalcular: ${(result && result.erros || []).map((item) => item.mensagem).join("; ") || "resultado indisponível"}. Confira o arquivo original.`);
    }
    if (!Array.isArray(result.condenacoes) || result.condenacoes.some((item) =>
      !item.regraPR || item.fracaoPR === null || (item.fracaoLC === null && !item.vedaLC))) {
      throw new Error("Resultado incompleto. Confira natureza, reincidência e antecedentes das condenações no arquivo original.");
    }
    const knownVersion = base.historico.some((item) => item.versao === previousVersion);
    const revisions = knownVersion ? base.historico.filter((item) =>
      compareVersions(item.versao, previousVersion) > 0 && compareVersions(item.versao, base.versao) <= 0) : [];
    const changedRules = [...new Set(revisions.flatMap((item) => item.regras))];
    const before = saved.resultado;
    const alterations = [];
    const fields = [
      ["progressao.data", "Data da progressão", "progressao"],
      ["progressao.requisitoDias", "Dias para progressão", "progressao"],
      ["progressao.proximoRegime", "Próximo regime", "progressao"],
      ["livramento.data", "Data do livramento", "livramento"],
      ["livramento.cabe", "Cabimento do livramento", "livramento"],
      ["livramento.requisitoDias", "Dias para livramento", "livramento"],
      ["livramento.motivoNaoCabe", "Impedimento ao livramento", "livramento"],
      ["termino", "Término da pena", "memoriaTermino"],
      ["dataBaseProgressao", "Data-base da progressão", "progressao"],
      ["condenacoes", "Frações e vedações por condenação", "condenacoes"],
      ["avisos", "Avisos do cálculo", "avisos"],
    ];
    for (const [field, label, memory] of fields) {
      const read = (object) => field.split(".").reduce((value, name) => value && value[name], object) ?? null;
      const oldValue = field === "avisos"
        ? (read(before) || []).filter((item) => !Piloto || Piloto.moduloVisivel(item.regra))
        : read(before);
      const newValue = field === "avisos"
        ? (read(result) || []).filter((item) => !Piloto || Piloto.moduloVisivel(item.regra))
        : read(result);
      if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
      const associated = [...new Set([
        ...ruleIds(before[memory]), ...ruleIds(result[memory]),
        ...(["progressao", "livramento"].includes(memory) ? [
          ...ruleIds(before.condenacoes), ...ruleIds(result.condenacoes)
        ] : [])
      ])];
      const matching = changedRules.filter((id) => associated.some((rule) =>
        rule === id || rule.startsWith(id + "-") || id.startsWith(rule + "-")));
      alterations.push({
        campo: field, nome: label, antes: oldValue, depois: newValue,
        regras: matching.length ? matching : associated,
        causaConfirmada: matching.length > 0
      });
    }
    return {
      ...record,
      calculo: { ...saved, resultado: { ...result, regrasVersao: base.versao }, regrasVersao: base.versao },
      atualizacaoRegras: {
        de: previousVersion || null, para: base.versao, dataCalculo: saved.dataCalculo,
        revisoes: revisions, alteracoes: alterations
      }
    };
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(RECORDS)) db.createObjectStore(RECORDS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function getAll(db) {
    return requestResult(db.transaction(RECORDS, "readonly").objectStore(RECORDS).getAll());
  }

  function getSetting(db) {
    return requestResult(db.transaction(SETTINGS, "readonly").objectStore(SETTINGS).get("vault"));
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function base64ToBytes(value) {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  }

  async function deriveKey(password, salt) {
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptValue(value, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(value)));
    return { iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(data)) };
  }

  async function decryptValue(encrypted, key) {
    const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(encrypted.iv) }, key, base64ToBytes(encrypted.data));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async function enablePassword(db, password) {
    if (typeof password !== "string" || password.length < 8) throw new Error("Use uma senha com pelo menos 8 caracteres.");
    if (await getSetting(db)) throw new Error("A senha local já está ativada.");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(password, salt);
    const records = await getAll(db);
    if (records.some((record) => record.protegido)) throw new Error("Não foi possível proteger os cálculos já salvos.");
    const encryptedRecords = await Promise.all(records.map(async (record) => ({
      id: record.id,
      protegido: true,
      ...(await encryptValue(record.conteudo, key))
    })));
    const desafio = await encryptValue("radar-local-v1", key);
    const transaction = db.transaction([RECORDS, SETTINGS], "readwrite");
    const recordStore = transaction.objectStore(RECORDS);
    recordStore.clear();
    encryptedRecords.forEach((record) => recordStore.put(record));
    transaction.objectStore(SETTINGS).put({ id: "vault", salt: bytesToBase64(salt), desafio });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Não foi possível proteger os cálculos."));
    });
    return { key, records: records.map((record) => record.conteudo) };
  }

  async function unlockPassword(db, password) {
    const setting = await getSetting(db);
    if (!setting) throw new Error("A senha local ainda não foi ativada.");
    let key;
    try {
      key = await deriveKey(password, base64ToBytes(setting.salt));
      if (await decryptValue(setting.desafio, key) !== "radar-local-v1") throw new Error("Senha incorreta.");
      const records = await getAll(db);
      return {
        key,
        records: await Promise.all(records.map(async (record) => ({
          id: record.id,
          conteudo: await decryptValue(record, key)
        })))
      };
    } catch {
      throw new Error("Senha incorreta ou dados locais inválidos.");
    }
  }

  async function saveRecord(db, content, key) {
    const setting = await getSetting(db);
    if (Boolean(setting) !== Boolean(key)) throw new Error("Desbloqueie a carteira antes de salvar.");
    const record = key
      ? { id: content.id, protegido: true, ...(await encryptValue(content, key)) }
      : { id: content.id, protegido: false, conteudo: content };
    const transaction = db.transaction(RECORDS, "readwrite");
    transaction.objectStore(RECORDS).put(record);
    await transactionComplete(transaction);
  }

  async function deleteRecord(db, id) {
    const transaction = db.transaction(RECORDS, "readwrite");
    transaction.objectStore(RECORDS).delete(id);
    await transactionComplete(transaction);
  }

  function transactionComplete(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Não foi possível salvar os dados."));
    });
  }

  async function clearAll(db) {
    const transaction = db.transaction([RECORDS, SETTINGS], "readwrite");
    transaction.objectStore(RECORDS).clear();
    transaction.objectStore(SETTINGS).clear();
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Não foi possível apagar os dados."));
    });
  }

  return {
    addMonths,
    buildRows,
    clearAll,
    deleteRecord,
    enablePassword,
    exportCSV,
    exportICS,
    getAll,
    getSetting,
    listBenefits,
    noFaultRequirement,
    openDatabase,
    parseDate,
    saveRecord,
    statusFor,
    unlockPassword,
    updateRules,
    validateCalculation
  };
});
