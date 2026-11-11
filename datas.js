(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.Datas = api;
  }
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;

  function makeUTCDate(year, month, day) {
    if (!Number.isInteger(year) || year < 1 || year > 9999) {
      throw new RangeError("A data deve estar entre os anos 0001 e 9999.");
    }
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new RangeError("Data inválida.");
    }
    return date;
  }

  function parseDate(value) {
    if (typeof value !== "string") {
      throw new TypeError("A data deve estar em DD/MM/AAAA, DDMMAAAA ou AAAA-MM-DD.");
    }

    let parts;
    let match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (match) {
      parts = [Number(match[3]), Number(match[2]), Number(match[1])];
    } else {
      match = /^(\d{2})(\d{2})(\d{4})$/.exec(value);
      if (match) {
        parts = [Number(match[3]), Number(match[2]), Number(match[1])];
      } else {
        match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      }
      if (!match) {
        throw new RangeError("Data inválida: use DD/MM/AAAA, DDMMAAAA ou AAAA-MM-DD.");
      }
      if (match[1].length === 4) {
        parts = [Number(match[1]), Number(match[2]), Number(match[3])];
      }
    }
    if (parts[0] < 1) {
      throw new RangeError("Data inválida.");
    }
    return makeUTCDate(parts[0], parts[1], parts[2]);
  }

  function asUTCDate(value) {
    if (value instanceof Date) {
      if (!Number.isFinite(value.getTime())) {
        throw new RangeError("Data inválida.");
      }
      return makeUTCDate(
        value.getUTCFullYear(),
        value.getUTCMonth() + 1,
        value.getUTCDate()
      );
    }
    return parseDate(value);
  }

  function formatDateISO(value) {
    const date = asUTCDate(value);
    return [
      String(date.getUTCFullYear()).padStart(4, "0"),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0")
    ].join("-");
  }

  function formatDateBR(value) {
    const date = asUTCDate(value);
    return [
      String(date.getUTCDate()).padStart(2, "0"),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCFullYear()).padStart(4, "0")
    ].join("/");
  }

  function formatDate(value, formato) {
    if (formato === undefined || formato === "iso") {
      return formatDateISO(value);
    }
    if (formato === "br") {
      return formatDateBR(value);
    }
    throw new RangeError("Formato inválido: use 'iso' ou 'br'.");
  }

  function validateDuration(pena) {
    if (!pena || typeof pena !== "object" || Array.isArray(pena)) {
      throw new TypeError("A pena deve informar anos, meses e dias.");
    }
    const duration = {};
    for (const field of ["anos", "meses", "dias"]) {
      const value = pena[field] === undefined ? 0 : pena[field];
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError(`A pena em ${field} deve ser um inteiro não negativo.`);
      }
      duration[field] = value;
    }
    return duration;
  }

  function normalizeDuration(pena) {
    const duration = validateDuration(pena);
    const totalMonths = duration.meses + Math.floor(duration.dias / 30);
    return {
      anos: duration.anos + Math.floor(totalMonths / 12),
      meses: totalMonths % 12,
      dias: duration.dias % 30
    };
  }

  function addMonths(date, amount) {
    const monthIndex = date.getUTCFullYear() * 12 + date.getUTCMonth() + amount;
    const year = Math.floor(monthIndex / 12);
    const month = monthIndex - year * 12 + 1;
    if (year < 1 || year > 9999) {
      throw new RangeError("A data calculada está fora do intervalo permitido.");
    }
    const lastDay = new Date(0);
    lastDay.setUTCHours(0, 0, 0, 0);
    lastDay.setUTCFullYear(year, month, 0);
    const day = date.getUTCDate();
    if (day > lastDay.getUTCDate()) {
      const nextMonthIndex = year * 12 + month;
      const nextYear = Math.floor(nextMonthIndex / 12);
      const nextMonth = nextMonthIndex - nextYear * 12 + 1;
      return makeUTCDate(nextYear, nextMonth, 1);
    }
    return makeUTCDate(year, month, day);
  }

  function addDays(value, days) {
    if (!Number.isSafeInteger(days)) {
      throw new RangeError("A quantidade de dias deve ser um inteiro.");
    }
    const date = asUTCDate(value);
    const result = new Date(date.getTime() + days * DAY_MS);
    if (
      !Number.isFinite(result.getTime()) ||
      result.getUTCFullYear() < 1 ||
      result.getUTCFullYear() > 9999
    ) {
      throw new RangeError("A data calculada está fora do intervalo permitido.");
    }
    return formatDateISO(result);
  }

  function addDuration(value, pena) {
    const date = asUTCDate(value);
    const duration = validateDuration(pena);
    const withYears = addMonths(date, duration.anos * 12);
    const withMonths = addMonths(withYears, duration.meses);
    return addDays(withMonths, duration.dias);
  }

  function differenceDays(inicio, fim) {
    return (asUTCDate(fim).getTime() - asUTCDate(inicio).getTime()) / DAY_MS;
  }

  function differenceYMD(inicio, fim) {
    const start = asUTCDate(inicio);
    const end = asUTCDate(fim);
    if (end < start) {
      throw new RangeError("A data final deve ser igual ou posterior à inicial.");
    }

    let anos = end.getUTCFullYear() - start.getUTCFullYear();
    while (anos > 0 && asUTCDate(addDuration(start, { anos })).getTime() > end.getTime()) {
      anos -= 1;
    }
    let cursor = asUTCDate(addDuration(start, { anos }));
    let meses =
      (end.getUTCFullYear() - cursor.getUTCFullYear()) * 12 +
      end.getUTCMonth() -
      cursor.getUTCMonth();
    while (meses > 0 && asUTCDate(addDuration(cursor, { meses })).getTime() > end.getTime()) {
      meses -= 1;
    }
    cursor = asUTCDate(addDuration(cursor, { meses }));
    return {
      anos,
      meses,
      dias: differenceDays(cursor, end)
    };
  }

  function terminationDate(inicio, pena) {
    return addDays(addDuration(inicio, pena), -1);
  }

  function penaltyDays(inicio, pena, convencao) {
    const duration = validateDuration(pena);
    const convention = convencao === undefined ? "calendario" : String(convencao);
    if (convention === "calendario") {
      return differenceDays(inicio, addDuration(inicio, duration));
    }
    if (convention === "365") {
      return duration.anos * 365 + duration.meses * 30 + duration.dias;
    }
    if (convention === "360") {
      return duration.anos * 360 + duration.meses * 30 + duration.dias;
    }
    throw new RangeError("Convenção inválida: use 'calendario', '365' ou '360'.");
  }

  function roundDays(days, mode) {
    if (!Number.isFinite(days)) {
      throw new TypeError("A quantidade de dias deve ser um número finito.");
    }
    const rounding = mode === undefined ? "cima" : mode;
    if (rounding === "cima") {
      return Math.ceil(days);
    }
    if (rounding === "baixo") {
      return Math.floor(days);
    }
    if (rounding === "manter") {
      return days;
    }
    throw new RangeError("Arredondamento inválido: use 'cima', 'baixo' ou 'manter'.");
  }

  function benefitDate(dataBase, dias, opcoes) {
    const options = opcoes || {};
    let adjustedDays = roundDays(dias, options.arredondamento);
    if (options.menos1Beneficio === true) {
      adjustedDays -= 1;
    } else if (
      options.menos1Beneficio !== undefined &&
      options.menos1Beneficio !== false
    ) {
      throw new TypeError("menos1Beneficio deve ser verdadeiro ou falso.");
    }
    return addDays(dataBase, Math.ceil(adjustedDays));
  }

  return {
    parseDate,
    formatDate,
    formatDateISO,
    formatDateBR,
    validateDuration,
    normalizeDuration,
    addDays,
    addDuration,
    differenceDays,
    differenceYMD,
    terminationDate,
    penaltyDays,
    roundDays,
    benefitDate
  };
});
