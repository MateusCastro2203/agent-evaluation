import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { apagarCopia, aplicarSolucao, arquivosAlterados, prepararCopia, rodarSuiteVisivel, rodarTesteOculto } from "../src/copia.js";
import { carregarTarefas, casaPermitido } from "../src/tarefas.js";

const tarefas = carregarTarefas();
const RAIZ = join(import.meta.dirname, "..");
const exec = promisify(execFile);

/** tsc na cópia (lab + solução + teste oculto), com as opções do tsconfig da raiz. */
async function checarTipos(pasta: string): Promise<string> {
  const { compilerOptions } = JSON.parse(readFileSync(join(RAIZ, "tsconfig.json"), "utf8"));
  await writeFile(join(pasta, "tsconfig.json"), JSON.stringify({ compilerOptions, include: ["src", "test"] }));
  try {
    await exec(join(RAIZ, "node_modules", ".bin", "tsc"), ["-p", pasta]);
    return "";
  } catch (e) {
    return String((e as { stdout?: string }).stdout ?? e);
  }
}

describe("carregarTarefas", () => {
  it("carrega as 8 tarefas em ordem", () => {
    expect(tarefas.map((t) => t.id)).toEqual([
      "01-proximos-eventos",
      "02-contar-inscritos",
      "03-evento-lotado",
      "04-cupom",
      "05-evento-passado",
      "06-relatorio-email",
      "07-lista-espera",
      "08-csv-aspas",
    ]);
    for (const t of tarefas) {
      expect(t.titulo.length).toBeGreaterThan(0);
      expect(t.prompt.trim().length).toBeGreaterThan(0);
      expect(t.permitidos.length).toBeGreaterThan(0);
    }
    expect(tarefas.filter((t) => t.dependeDeConvencao).map((t) => t.id)).toEqual([
      "03-evento-lotado",
      "04-cupom",
      "05-evento-passado",
      "06-relatorio-email",
      "07-lista-espera",
    ]);
  });

  it("nenhum prompt entrega a convenção", () => {
    const termos = /ErroDominio|relogio|Math\.floor|arredond|registrarAuditoria|auditoria|src\/relatorios|legado|CLAUDE\.md/i;
    for (const t of tarefas) expect(t.prompt, t.id).not.toMatch(termos);
  });
});

describe("casaPermitido", () => {
  it("aceita caminho exato, * e **", () => {
    expect(casaPermitido("src/inscricoes.ts", ["src/inscricoes.ts"])).toBe(true);
    expect(casaPermitido("src/relatorios/a/b.ts", ["src/relatorios/**"])).toBe(true);
    expect(casaPermitido("test/x.test.ts", ["test/*.test.ts"])).toBe(true);
    expect(casaPermitido("src/legado/relatorio.ts", ["src/relatorios/**", "test/**"])).toBe(false);
    expect(casaPermitido("src/inscricoes.tsx", ["src/inscricoes.ts"])).toBe(false);
  });
});

describe.concurrent("cada tarefa: teste oculto falha no lab intacto e passa com a solução", () => {
  it.each(tarefas)("$id", { timeout: 120_000 }, async (tarefa) => {
    const pasta = await prepararCopia("a");
    try {
      expect(await rodarTesteOculto(pasta, tarefa), "passa no lab intacto").toBe(false);
      await aplicarSolucao(pasta, tarefa);
      const alterados = await arquivosAlterados(pasta);
      expect(alterados.length).toBeGreaterThan(0);
      for (const arquivo of alterados) {
        expect(casaPermitido(arquivo, tarefa.permitidos), `${arquivo} fora de permitidos`).toBe(true);
      }
      expect(await rodarTesteOculto(pasta, tarefa), "falha com a solução").toBe(true);
      expect(await rodarSuiteVisivel(pasta), "a solução quebra a suíte visível").toBe(true);
      expect(await checarTipos(pasta)).toBe("");
    } finally {
      await apagarCopia(pasta);
    }
  });
});
