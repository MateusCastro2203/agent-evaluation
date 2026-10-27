import type { ResultadoExecucao, Variante } from "./executor.js";

export interface Intervalo {
  p: number;
  inf: number;
  sup: number;
}

/** Intervalo de Wilson (padrão 95%, z = 1,96). Com n = 0 não há dado: tudo é possível (0 a 100%). */
export function wilson(sucessos: number, n: number, z = 1.96): Intervalo {
  if (n <= 0) return { p: 0, inf: 0, sup: 1 };
  const p = sucessos / n;
  const z2 = z * z;
  const denominador = 1 + z2 / n;
  const centro = (p + z2 / (2 * n)) / denominador;
  const margem = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominador;
  return { p, inf: Math.max(0, centro - margem), sup: Math.min(1, centro + margem) };
}

export function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const o = [...xs].sort((a, b) => a - b);
  const meio = Math.floor(o.length / 2);
  return o.length % 2 === 1 ? o[meio]! : (o[meio - 1]! + o[meio]!) / 2;
}

export interface ResumoVariante {
  variante: Variante;
  /** Execuções sem `erro_agente`: a base da taxa. */
  n: number;
  passou: number;
  taxa: Intervalo;
  /**
   * Tarefas que passaram em todas as k repetições (k = máximo de repetições vistas por tarefa no run).
   * Conservador: uma repetição com `erro_agente` conta como não passou, e tarefa com menos de k
   * repetições (run parcial) não conta.
   */
  passK: number;
  /** k: repetições por tarefa (máximo visto no run). */
  k: number;
  tarefasTotal: number;
  foraDoEscopo: number;
  erros: number;
  /** Tokens de entrada + saída (sem cache) das execuções sem erro do agente. */
  medianaTokens: number | null;
  /** Tokens de cache (leitura + criação) das execuções sem erro do agente. */
  medianaTokensCache: number | null;
  medianaTurnos: number | null;
  medianaDuracaoMs: number | null;
  /** Soma de todas as execuções, inclusive as com erro: é o que o run gastou (custo estimado, preço de lista). */
  custoTotalUsd: number;
  porTarefa: Record<string, { passou: number; n: number }>;
}

export function resumir(resultados: ResultadoExecucao[], variante: Variante): ResumoVariante {
  const todos = resultados.filter((r) => r.variante === variante);
  const validos = todos.filter((r) => r.desfecho !== "erro_agente");
  const passou = validos.filter((r) => r.desfecho === "passou").length;

  const porTarefa: Record<string, { passou: number; n: number }> = {};
  const reps = new Map<string, { total: number; passaram: number }>();
  for (const r of todos) {
    const ok = r.desfecho === "passou";
    const c = reps.get(r.tarefa) ?? { total: 0, passaram: 0 };
    c.total += 1;
    if (ok) c.passaram += 1;
    reps.set(r.tarefa, c);
    const t = (porTarefa[r.tarefa] ??= { passou: 0, n: 0 });
    if (r.desfecho !== "erro_agente") {
      t.n += 1;
      if (ok) t.passou += 1;
    }
  }

  const k = Math.max(0, ...[...reps.values()].map((c) => c.total));
  return {
    variante,
    n: validos.length,
    passou,
    taxa: wilson(passou, validos.length),
    passK: [...reps.values()].filter((c) => c.total === k && c.passaram === k).length,
    k,
    tarefasTotal: reps.size,
    foraDoEscopo: validos.filter((r) => r.desfecho === "fora_do_escopo").length,
    erros: todos.length - validos.length,
    medianaTokens: mediana(validos.map((r) => r.agente.tokensEntrada + r.agente.tokensSaida)),
    medianaTokensCache: mediana(validos.map((r) => r.agente.tokensCache)),
    medianaTurnos: mediana(validos.map((r) => r.agente.turnos)),
    medianaDuracaoMs: mediana(validos.map((r) => r.agente.duracaoMs)),
    custoTotalUsd: todos.reduce((s, r) => s + r.agente.custoUsd, 0),
    porTarefa,
  };
}
