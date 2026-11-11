"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CalculadoraDetracaoCautelar = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DIA_MS = 86400000;
  const HORA_MS = 60 * 60 * 1000;
  const FERIADOS_FIXOS = [
    { mes: 1, dia: 1, nome: "Confraternização Universal", fonte: "Lei federal 662/1949" },
    { mes: 4, dia: 21, nome: "Tiradentes", fonte: "Lei federal 662/1949" },
    { mes: 5, dia: 1, nome: "Dia do Trabalho", fonte: "Lei federal 662/1949" },
    { mes: 7, dia: 9, nome: "Data Magna do Estado de São Paulo", fonte: "Lei estadual 9.497/1997" },
    { mes: 9, dia: 7, nome: "Independência do Brasil", fonte: "Lei federal 662/1949" },
    { mes: 10, dia: 12, nome: "Nossa Senhora Aparecida", fonte: "Lei federal 6.802/1980" },
    { mes: 11, dia: 2, nome: "Finados", fonte: "Lei federal 662/1949" },
    { mes: 11, dia: 15, nome: "Proclamação da República", fonte: "Lei federal 662/1949" },
    { mes: 11, dia: 20, nome: "Dia Nacional de Zumbi e da Consciência Negra", fonte: "Lei federal 14.759/2023" },
    { mes: 12, dia: 25, nome: "Natal", fonte: "Lei federal 662/1949" }
  ];

  function dataUTC(valor) {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
    const data = new Date(`${valor}T00:00:00.000Z`);
    return Number.isNaN(data.getTime()) || serializarData(data) !== valor ? null : data;
  }

  function serializarData(data) {
    return `${String(data.getUTCFullYear()).padStart(4, "0")}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
  }

  function feriadosNoPeriodo(inicio, fim) {
    const feriados = new Map();
    for (let ano = inicio.getUTCFullYear(); ano <= fim.getUTCFullYear(); ano += 1) {
      FERIADOS_FIXOS.forEach((feriado) => {
        const data = new Date(0);
        data.setUTCHours(0, 0, 0, 0);
        data.setUTCFullYear(ano, feriado.mes - 1, feriado.dia);
        if (data < inicio || data > fim) return;
        const chave = serializarData(data);
        const existente = feriados.get(chave);
        if (existente) existente.nome += ` / ${feriado.nome}`;
        else feriados.set(chave, { data: chave, nome: feriado.nome, fonte: feriado.fonte });
      });
    }
    return [...feriados.values()];
  }

  function erro(campo, mensagem) {
    return { campo, mensagem };
  }

  function instante(periodo, campo) {
    const valor = periodo && periodo[campo];
    if (typeof valor !== "string") return NaN;
    const partes = valor.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/);
    if (!partes) return NaN;
    const [ano, mes, dia, hora, minuto] = partes.slice(1, 6).map(Number);
    const calendario = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto));
    if (calendario.getUTCFullYear() !== ano || calendario.getUTCMonth() !== mes - 1 ||
        calendario.getUTCDate() !== dia || calendario.getUTCHours() !== hora ||
        calendario.getUTCMinutes() !== minuto) return NaN;
    return Date.parse(valor);
  }

  function calcularPeriodos(periodos) {
    if (!Array.isArray(periodos) || periodos.length === 0) {
      return { erros: [erro("periodos", "Informe ao menos um período completo.")] };
    }
    const intervalos = [];
    for (const [indice, periodo] of periodos.entries()) {
      const inicio = instante(periodo, "inicio");
      const fim = instante(periodo, "fim");
      if (!Number.isFinite(inicio) || !Number.isFinite(fim) ||
          fim <= inicio || (fim - inicio) % HORA_MS !== 0) {
        return { erros: [erro("periodos", `Confira o início e o fim do período ${indice + 1}; use datas válidas e horas completas.`)] };
      }
      intervalos.push({ inicio, fim });
    }
    intervalos.sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);
    let inicioAtual = intervalos[0].inicio;
    let fimAtual = intervalos[0].fim;
    let horasTotais = 0;
    for (const intervalo of intervalos.slice(1)) {
      if (intervalo.inicio <= fimAtual) {
        fimAtual = Math.max(fimAtual, intervalo.fim);
      } else {
        horasTotais += (fimAtual - inicioAtual) / HORA_MS;
        inicioAtual = intervalo.inicio;
        fimAtual = intervalo.fim;
      }
    }
    horasTotais += (fimAtual - inicioAtual) / HORA_MS;
    if (!Number.isSafeInteger(horasTotais)) {
      return { erros: [erro("horasTotais", "A soma das horas é muito grande. Confira os períodos informados.")] };
    }
    const horasInformadas = intervalos.reduce((total, item) =>
      total + (item.fim - item.inicio) / HORA_MS, 0);
    return {
      inicio: new Date(intervalos[0].inicio).toISOString().slice(0, 10),
      fim: new Date(intervalos.reduce((fim, item) => Math.max(fim, item.fim), 0)).toISOString().slice(0, 10),
      horasTotais,
      dias: Math.floor(horasTotais / 24),
      horasRemanescentes: horasTotais % 24,
      sobreposicoesRemovidas: horasInformadas - horasTotais
    };
  }

  function calcularLegado(entrada) {
    const campos = ["horasNoturnas", "horasFolga"];
    const erros = [];
    campos.forEach((campo) => {
      if (!Number.isSafeInteger(entrada[campo]) || entrada[campo] < 0) {
        erros.push(erro(campo, "Informe um número inteiro de horas igual ou maior que zero."));
      }
    });
    if (erros.length) return { erros };
    if (entrada.horasNoturnas > Number.MAX_SAFE_INTEGER - entrada.horasFolga) {
      return { erros: [erro("horasTotais", "A soma das horas é muito grande. Confira os valores informados.")] };
    }
    const horasTotais = entrada.horasNoturnas + entrada.horasFolga;
    return { horasTotais, dias: Math.floor(horasTotais / 24), horasRemanescentes: horasTotais % 24 };
  }

  function calcularDetracaoCautelar(entrada) {
    if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) entrada = {};
    if (entrada.periodos !== undefined) return calcularPeriodos(entrada.periodos);
    if (!entrada.inicio && !entrada.fim) return calcularLegado(entrada);

    const erros = [];
    const inicio = dataUTC(entrada.inicio);
    const fim = dataUTC(entrada.fim);
    if (!inicio) erros.push(erro("inicio", "Informe uma data inicial válida."));
    if (!fim) erros.push(erro("fim", "Informe uma data final válida."));
    if (inicio && fim && fim < inicio) erros.push(erro("fim", "A data final não pode anteceder a inicial."));
    const horasPorDia = {};
    [["horasDiaUtil", 12], ["horasSabado", 24], ["horasDomingo", 24]].forEach(([campo, padrao]) => {
      const horas = entrada[campo] == null ? padrao : entrada[campo];
      if (!Number.isSafeInteger(horas) || horas < 0 || horas > 24) {
        erros.push(erro(campo, "Informe um número inteiro de 0 a 24."));
      } else {
        horasPorDia[campo] = horas;
      }
    });
    if (erros.length) return { erros };

    const diasNoPeriodo = Math.floor((fim - inicio) / DIA_MS) + 1;
    if (diasNoPeriodo > 36525) {
      return { erros: [erro("fim", "O período não pode ultrapassar 100 anos.")] };
    }

    const feriadosAutomaticos = feriadosNoPeriodo(inicio, fim);
    const feriadosExcluidos = new Set(Array.isArray(entrada.feriadosExcluidos) ? entrada.feriadosExcluidos : []);
    const feriados = new Map(feriadosAutomaticos
      .filter((feriado) => !feriadosExcluidos.has(feriado.data))
      .map((feriado) => [feriado.data, feriado]));
    const feriadosMunicipais = Array.isArray(entrada.feriadosMunicipais) ? entrada.feriadosMunicipais : [];
    feriadosMunicipais.forEach((feriado, indice) => {
      const data = feriado && dataUTC(feriado.data);
      if (!data || typeof feriado.nome !== "string" || !feriado.nome.trim()) {
        erros.push(erro(`feriadosMunicipais[${indice}]`, "Informe a data e o nome do feriado municipal."));
      } else if (data >= inicio && data <= fim) {
        const chave = serializarData(data);
        if (!feriados.has(chave)) {
          feriados.set(chave, { data: chave, nome: feriado.nome.trim(), fonte: "Informado pelo usuário" });
        }
      }
    });

    const exclusoes = Array.isArray(entrada.exclusoes) ? entrada.exclusoes : [];
    const diasExcluidos = new Set();
    const motivosExclusao = new Map();
    exclusoes.forEach((intervalo, indice) => {
      const dataInicio = intervalo && dataUTC(intervalo.inicio);
      const dataFim = intervalo && dataUTC(intervalo.fim || intervalo.inicio);
      if (!dataInicio || !dataFim || dataFim < dataInicio) {
        erros.push(erro(`exclusoes[${indice}]`, "Informe um intervalo de exclusão válido."));
        return;
      }
      const primeiroDia = dataInicio < inicio ? inicio : dataInicio;
      const ultimoDia = dataFim > fim ? fim : dataFim;
      for (let data = primeiroDia.getTime(); data <= ultimoDia.getTime(); data += DIA_MS) {
        const chave = serializarData(new Date(data));
        diasExcluidos.add(chave);
        const motivo = typeof intervalo.motivo === "string" ? intervalo.motivo.trim() : "";
        if (motivo) {
          const motivos = motivosExclusao.get(chave) || [];
          if (!motivos.includes(motivo)) motivos.push(motivo);
          motivosExclusao.set(chave, motivos);
        }
      }
    });
    if (erros.length) return { erros };

    let horasTotais = 0;
    let diasIntegrais = 0;
    const diasHoras = [];
    const feriadosUsados = [...feriados.values()]
      .filter((feriado) => !diasExcluidos.has(feriado.data))
      .sort((a, b) => a.data.localeCompare(b.data));
    for (let numeroDia = 0; numeroDia < diasNoPeriodo; numeroDia += 1) {
      const data = new Date(inicio.getTime() + numeroDia * DIA_MS);
      const chave = serializarData(data);
      if (diasExcluidos.has(chave)) continue;
      const diaSemana = data.getUTCDay();
      const horas = feriados.has(chave) ? 24
        : diaSemana === 6 ? horasPorDia.horasSabado
          : diaSemana === 0 ? horasPorDia.horasDomingo
            : horasPorDia.horasDiaUtil;
      if (!horas) continue;
      horasTotais += horas;
      if (horasTotais > Number.MAX_SAFE_INTEGER) {
        return { erros: [erro("horasTotais", "A soma das horas é muito grande. Confira os dados.")] };
      }
      if (horas === 24) diasIntegrais += 1;
      diasHoras.push({ data: chave, horas });
    }
    return {
      inicio: entrada.inicio,
      fim: entrada.fim,
      horasTotais,
      dias: Math.floor(horasTotais / 24),
      horasRemanescentes: horasTotais % 24,
      diasIntegrais,
      datasIntegrais: diasHoras.filter((dia) => dia.horas === 24).map((dia) => dia.data),
      diasHoras,
      feriadosAutomaticos,
      feriadosUsados,
      exclusoes: [...diasExcluidos].sort(),
      exclusoesDetalhadas: [...diasExcluidos].sort().map((data) => ({
        data,
        motivos: motivosExclusao.get(data) || []
      })),
      modo: "calendario"
    };
  }

  return Object.freeze({ calcularDetracaoCautelar, feriadosNoPeriodo });
});
