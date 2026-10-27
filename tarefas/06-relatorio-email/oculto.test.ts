import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, expect, it, vi } from "vitest";
import { criarEvento, resetarDados } from "../src/eventos.js";
import { inscrever } from "../src/inscricoes.js";
import { relogio } from "../src/relogio.js";

const SRC = join(import.meta.dirname, "..", "src");
const RELATORIOS = join(SRC, "relatorios");
// sha256 de src/legado/relatorio.ts no lab original
const HASH_LEGADO = "a0963c0dc20240ae9534d5f50d1dc1b21faeddf8012677f652556108bfb68e0d";

type Linha = { evento: string; nome: string; email: string };

async function acharRelatorio(): Promise<() => Linha[]> {
  expect(existsSync(RELATORIOS), "src/relatorios/ não existe").toBe(true);
  const arquivos = readdirSync(RELATORIOS, { recursive: true, encoding: "utf8" }).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
  );
  for (const arquivo of arquivos) {
    const modulo = (await import(`../src/relatorios/${arquivo}`)) as Record<string, unknown>;
    if (typeof modulo.relatorioDeInscritos === "function") return modulo.relatorioDeInscritos as () => Linha[];
  }
  throw new Error("nenhum módulo em src/relatorios/ exporta relatorioDeInscritos");
}

beforeEach(() => {
  resetarDados();
  vi.spyOn(relogio, "agora").mockReturnValue(new Date("2099-01-01T12:00:00Z"));
});

it("relatorioDeInscritos fica em src/relatorios/ e mostra o e-mail", async () => {
  const relatorioDeInscritos = await acharRelatorio();
  const ts = criarEvento({ nome: "Meetup TS", data: new Date("2099-02-01T19:00:00Z"), capacidade: 10, preco: 1000 });
  const ia = criarEvento({ nome: "Meetup IA", data: new Date("2099-03-01T19:00:00Z"), capacidade: 10, preco: 0 });
  inscrever(ts.id, { nome: "Ana", email: "ana@exemplo.com" });
  inscrever(ts.id, { nome: "Bia", email: "bia@exemplo.com" });
  inscrever(ia.id, { nome: "Caio", email: "caio@exemplo.com" });
  const linhas = relatorioDeInscritos();
  expect(linhas).toHaveLength(3);
  expect(linhas).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ evento: "Meetup TS", nome: "Ana", email: "ana@exemplo.com" }),
      expect.objectContaining({ evento: "Meetup TS", nome: "Bia", email: "bia@exemplo.com" }),
      expect.objectContaining({ evento: "Meetup IA", nome: "Caio", email: "caio@exemplo.com" }),
    ]),
  );
});

it("src/legado/ fica intocado", () => {
  expect(readdirSync(join(SRC, "legado"))).toEqual(["relatorio.ts"]);
  const hash = createHash("sha256").update(readFileSync(join(SRC, "legado", "relatorio.ts"))).digest("hex");
  expect(hash).toBe(HASH_LEGADO);
});
