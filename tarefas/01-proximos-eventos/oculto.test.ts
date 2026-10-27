import { beforeEach, expect, it, vi } from "vitest";
import { criarEvento, listarProximos, resetarDados } from "../src/eventos.js";
import { relogio } from "../src/relogio.js";

beforeEach(() => {
  resetarDados();
  vi.spyOn(relogio, "agora").mockReturnValue(new Date("2099-01-01T12:00:00Z"));
});

function evento(nome: string, data: string) {
  return criarEvento({ nome, data: new Date(data), capacidade: 10, preco: 0 });
}

it("devolve exatamente `limite` eventos, os mais próximos primeiro", () => {
  evento("C", "2099-03-01T19:00:00Z");
  evento("A", "2099-01-10T19:00:00Z");
  evento("B", "2099-02-01T19:00:00Z");
  expect(listarProximos(2).map((e) => e.nome)).toEqual(["A", "B"]);
  expect(listarProximos(1).map((e) => e.nome)).toEqual(["A"]);
});

it("limite maior que o total devolve todos", () => {
  evento("A", "2099-01-10T19:00:00Z");
  evento("B", "2099-02-01T19:00:00Z");
  expect(listarProximos(5)).toHaveLength(2);
});
