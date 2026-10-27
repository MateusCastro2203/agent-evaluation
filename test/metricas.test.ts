import { describe, expect, it } from "vitest";
import { mediana, resumir, wilson } from "../src/metricas.js";
import type { Desfecho, ResultadoExecucao } from "../src/executor.js";

function exec(tarefa: string, desfecho: Desfecho, extra: { tokens?: number; turnos?: number; ms?: number; custo?: number } = {}): ResultadoExecucao {
  return {
    tarefa,
    variante: "a",
    desfecho,
    testePassou: desfecho === "passou",
    foraDoEscopo: [],
    alterados: [],
    agente: {
      ok: desfecho !== "erro_agente",
      turnos: extra.turnos ?? 5,
      duracaoMs: extra.ms ?? 1000,
      custoUsd: extra.custo ?? 0.01,
      tokensEntrada: extra.tokens ?? 10,
      tokensSaida: 0,
      tokensCache: 0,
    },
  };
}

describe("wilson", () => {
  it("8 de 16 dá cerca de 28% a 72%", () => {
    const w = wilson(8, 16);
    expect(w.p).toBeCloseTo(0.5, 2);
    expect(w.inf).toBeCloseTo(0.28, 2);
    expect(w.sup).toBeCloseTo(0.72, 2);
  });
  it("n 0 devolve 0, 0, 1", () => {
    expect(wilson(0, 0)).toEqual({ p: 0, inf: 0, sup: 1 });
  });
  it("16 de 16 não fica com largura zero", () => {
    const w = wilson(16, 16);
    expect(w.inf).toBeLessThan(1);
    expect(w.sup).toBeLessThanOrEqual(1);
  });
});

describe("mediana", () => {
  it("ordena antes de escolher", () => expect(mediana([3, 1, 2])).toBe(2));
  it("média dos dois do meio quando par", () => expect(mediana([1, 2, 3, 4])).toBe(2.5));
  it("lista vazia é null", () => expect(mediana([])).toBeNull());
});

describe("resumir", () => {
  const dados = [
    exec("X", "passou"),
    exec("X", "passou"),
    exec("Y", "passou"),
    exec("Y", "falhou"),
  ];
  it("conta passou e passK", () => {
    const r = resumir(dados, "a");
    expect(r.n).toBe(4);
    expect(r.passou).toBe(3);
    expect(r.passK).toBe(1);
    expect(r.tarefasTotal).toBe(2);
    expect(r.porTarefa).toEqual({ X: { passou: 2, n: 2 }, Y: { passou: 1, n: 2 } });
    expect(r.taxa.p).toBeCloseTo(0.75, 5);
  });
  it("erro_agente não entra no n e conta em erros", () => {
    const r = resumir([...dados, exec("Z", "erro_agente", { custo: 0.5 })], "a");
    expect(r.n).toBe(4);
    expect(r.erros).toBe(1);
    expect(r.custoTotalUsd).toBeCloseTo(0.54, 5);
    expect(r.passK).toBe(1);
  });
  it("fora_do_escopo conta à parte e entra no n como não passou", () => {
    const r = resumir([exec("X", "passou"), exec("X", "fora_do_escopo")], "a");
    expect(r.n).toBe(2);
    expect(r.foraDoEscopo).toBe(1);
    expect(r.passK).toBe(0);
  });
  it("só olha a variante pedida", () => {
    const b = { ...exec("X", "passou"), variante: "b" as const };
    expect(resumir([...dados, b], "b").n).toBe(1);
  });
  it("medianas ignoram erros do agente", () => {
    const r = resumir([exec("X", "passou", { turnos: 4, tokens: 100 }), exec("X", "passou", { turnos: 8, tokens: 300 }), exec("X", "erro_agente", { turnos: 0, tokens: 0 })], "a");
    expect(r.medianaTurnos).toBe(6);
    expect(r.medianaTokens).toBe(200);
  });
  it("run parcial: tarefa com menos de k repetições não conta no passK", () => {
    const r = resumir([exec("X", "passou"), exec("X", "passou"), exec("Y", "passou")], "a");
    expect(r.k).toBe(2);
    expect(r.passK).toBe(1);
  });
  it("erro_agente numa repetição derruba o passK da tarefa", () => {
    const r = resumir([exec("X", "passou"), exec("X", "erro_agente")], "a");
    expect(r.passK).toBe(0);
  });
  it("tokens separados de cache", () => {
    const r = resumir([{ ...exec("X", "passou", { tokens: 100 }), agente: { ...exec("X", "passou", { tokens: 100 }).agente, tokensSaida: 50, tokensCache: 9000 } }], "a");
    expect(r.medianaTokens).toBe(150);
    expect(r.medianaTokensCache).toBe(9000);
  });
  it("lista vazia: n 0, sem exceção", () => {
    const r = resumir([], "a");
    expect(r.n).toBe(0);
    expect(r.taxa).toEqual({ p: 0, inf: 0, sup: 1 });
    expect(r.medianaTokens).toBeNull();
    expect(r.k).toBe(0);
    expect(r.passK).toBe(0);
  });
});
