import { describe, expect, it } from "vitest";
import { decidir, execucoesParaSepararWilson, pisoTesteZ } from "../src/veredito.js";
import { wilson, type ResumoVariante } from "../src/metricas.js";

function resumo(passou: number, n: number): ResumoVariante {
  return {
    variante: "a",
    n,
    passou,
    taxa: wilson(passou, n),
    passK: 0,
    k: 2,
    tarefasTotal: 8,
    foraDoEscopo: 0,
    erros: 0,
    medianaTokens: null,
    medianaTokensCache: null,
    medianaTurnos: null,
    medianaDuracaoMs: null,
    custoTotalUsd: 0,
    porTarefa: {},
  };
}

describe("decidir", () => {
  it("6/16 contra 12/16 é inconclusivo: Wilson pede 27, o teste z dá piso de 24", () => {
    const v = decidir(resumo(6, 16), resumo(12, 16));
    expect(v.tipo).toBe("inconclusivo");
    expect(v.diferenca).toBeCloseTo(0.375, 5);
    expect(v.execucoesNecessariasPorVariante).toBe(27);
    expect(v.pisoTesteZPorVariante).toBe(24);
  });
  it("taxas do ensaio (12/16 × 16/16): critério de Wilson pede 27, o teste z dá piso de 24", () => {
    const v = decidir(resumo(12, 16), resumo(16, 16));
    expect(v.tipo).toBe("inconclusivo");
    expect(v.execucoesNecessariasPorVariante).toBe(27);
    expect(v.pisoTesteZPorVariante).toBe(24);
  });
  it("taxas do primeiro ensaio (13/16 × 16/16): critério de Wilson pede 38, o teste z dá piso de 34", () => {
    const v = decidir(resumo(13, 16), resumo(16, 16));
    expect(v.tipo).toBe("inconclusivo");
    expect(v.pisoTesteZPorVariante).toBe(34);
    expect(v.execucoesNecessariasPorVariante).toBe(38);
    // com 34 (o piso do teste z) os intervalos ainda se sobrepõem; com 37 também; com 38 não
    for (const [n, sobrepoe] of [[34, true], [37, true], [38, false]] as const) {
      const a = wilson((13 / 16) * n, n);
      const b = wilson(n, n);
      expect(b.inf <= a.sup).toBe(sobrepoe);
    }
  });
  it("o critério de Wilson nunca fica abaixo do piso do teste z nesses casos", () => {
    for (const [x, y] of [[0.375, 0.75], [0.625, 0.75], [0.8125, 1], [0.1, 0.5]] as const) {
      expect(execucoesParaSepararWilson(x, y)!).toBeGreaterThanOrEqual(pisoTesteZ(x, y)!);
    }
  });
  it("devolve null quando bate no teto da busca", () => {
    expect(execucoesParaSepararWilson(0.5, 0.501, 1000)).toBeNull();
    expect(execucoesParaSepararWilson(0.5, 0.5)).toBeNull();
  });
  it("1/16 contra 15/16 é b_melhor", () => {
    expect(decidir(resumo(1, 16), resumo(15, 16)).tipo).toBe("b_melhor");
  });
  it("15/16 contra 1/16 é a_melhor", () => {
    expect(decidir(resumo(15, 16), resumo(1, 16)).tipo).toBe("a_melhor");
  });
  it("8/16 contra 8/16 é inconclusivo e sem estimativa", () => {
    const v = decidir(resumo(8, 16), resumo(8, 16));
    expect(v.tipo).toBe("inconclusivo");
    expect(v.execucoesNecessariasPorVariante).toBeNull();
    expect(v.pisoTesteZPorVariante).toBeNull();
  });
  it("variante com n 0 é inconclusivo", () => {
    const v = decidir(resumo(8, 16), resumo(0, 0));
    expect(v.tipo).toBe("inconclusivo");
    expect(v.execucoesNecessariasPorVariante).toBeNull();
  });
});
