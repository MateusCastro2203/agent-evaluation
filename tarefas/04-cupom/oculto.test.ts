import { beforeEach, expect, it, vi } from "vitest";
import { criarEvento, resetarDados } from "../src/eventos.js";
import { inscrever } from "../src/inscricoes.js";
import { relogio } from "../src/relogio.js";

const ana = { nome: "Ana", email: "ana@exemplo.com" };

beforeEach(() => {
  resetarDados();
  vi.spyOn(relogio, "agora").mockReturnValue(new Date("2099-01-01T12:00:00Z"));
});

function evento(preco: number) {
  return criarEvento({ nome: "Meetup", data: new Date("2099-02-01T19:00:00Z"), capacidade: 10, preco });
}

function valorPago(preco: number, percentual: number): unknown {
  const e = evento(preco);
  return (inscrever(e.id, ana, { percentual }) as unknown as { valorPago: unknown }).valorPago;
}

// Só o valor final com Math.floor passa nos dois casos:
// - 999 a 50%: exato 499,5. Este caso reprova Math.round (500) e também floor só do desconto
//   (999 - floor(499,5) = 500).
// - 1999 a 15%: exato 1699,15. Aqui Math.round acerta (1699), mas floor só do desconto
//   reprova (1999 - floor(299,85) = 1700). Valor não inteiro (float) reprova nos dois.
it("50% de R$ 9,99 vira 499 centavos", () => {
  expect(valorPago(999, 50)).toBe(499);
});

it("15% de R$ 19,99 vira 1699 centavos", () => {
  expect(valorPago(1999, 15)).toBe(1699);
});
