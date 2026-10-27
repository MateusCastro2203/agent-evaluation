import { beforeEach, expect, it, vi } from "vitest";
import { criarEvento, resetarDados } from "../src/eventos.js";
import { cancelarInscricao, contarInscritos, inscrever } from "../src/inscricoes.js";
import { relogio } from "../src/relogio.js";

beforeEach(() => {
  resetarDados();
  vi.spyOn(relogio, "agora").mockReturnValue(new Date("2099-01-01T12:00:00Z"));
});

function evento() {
  return criarEvento({ nome: "Meetup", data: new Date("2099-02-01T19:00:00Z"), capacidade: 10, preco: 0 });
}

it("conta só os inscritos do evento pedido, sem os cancelados", () => {
  const a = evento();
  const b = evento();
  expect(contarInscritos(a.id)).toBe(0);
  inscrever(a.id, { nome: "Ana", email: "ana@exemplo.com" });
  inscrever(a.id, { nome: "Bia", email: "bia@exemplo.com" });
  inscrever(b.id, { nome: "Caio", email: "caio@exemplo.com" });
  expect(contarInscritos(a.id)).toBe(2);
  expect(contarInscritos(b.id)).toBe(1);
  cancelarInscricao(a.id, "ana@exemplo.com");
  expect(contarInscritos(a.id)).toBe(1);
});
