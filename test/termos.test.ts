import { describe, expect, it } from "vitest";
import { codigoDaChecagem, termosNaLinha } from "../src/termos.js";

describe("termosNaLinha", () => {
  it("borda de palavra: termo não casa dentro de outra palavra, e não diferencia maiúsculas", () => {
    expect(termosNaLinha("ganhei na loteria", ["Lote"])).toEqual([]);
    expect(termosNaLinha("o lote caiu.", ["Lote"])).toEqual(["Lote"]);
    expect(termosNaLinha("ticket ABC-130", ["ABC-13"])).toEqual([]);
    expect(termosNaLinha("ticket ABC-13 aberto", ["ABC-13"])).toEqual(["ABC-13"]);
  });

  it("palavra liberada só esconde a ocorrência que cabe inteira nela", () => {
    expect(termosNaLinha("no Banco Alfa", ["Alfa"], ["Banco Alfa"])).toEqual([]);
    // termo que contém a palavra liberada, ou vai além dela, continua aparecendo
    expect(termosNaLinha("Banco Alfa Interno", ["Banco Alfa Interno"], ["Banco Alfa"])).toEqual(["Banco Alfa Interno"]);
    // outra ocorrência do termo na mesma linha, fora da palavra liberada, aparece
    expect(termosNaLinha("Banco Alfa e Alfa", ["Alfa"], ["Banco Alfa"])).toEqual(["Alfa"]);
  });
});

describe("codigoDaChecagem", () => {
  it("termo achado → 1; PDF/PPTX ilegível → 2, ou 0 com CHECAR_SEM_PDF; nada → 0", () => {
    expect(codigoDaChecagem(1, 1, false)).toBe(1);
    expect(codigoDaChecagem(0, 1, false)).toBe(2);
    expect(codigoDaChecagem(0, 1, true)).toBe(0);
    expect(codigoDaChecagem(0, 0, false)).toBe(0);
  });
});
