import { describe, expect, it } from "vitest";
import Agente from "../evals/agente.js";
import type { RodarAgente } from "../src/claude.js";

const falso: RodarAgente = async () => ({
  ok: true,
  turnos: 1,
  duracaoMs: 1,
  custoUsd: 0,
  tokensEntrada: 0,
  tokensSaida: 0,
  tokensCache: 0,
});

describe("provider do promptfoo", () => {
  it("devolve o desfecho e o resultado da variante", async () => {
    const agente = new Agente({ config: { variante: "b", modelo: "haiku", rodarAgente: falso } });
    expect(agente.id()).toBe("claude-code-b");
    const r = await agente.callApi("", { vars: { tarefa: "03-evento-lotado" } });
    // agente falso não muda nada: o app intacto reprova o teste oculto
    expect(r.output).toBe("falhou");
    expect(r.metadata?.resultado.variante).toBe("b");
    expect(r.metadata?.resultado.tarefa).toBe("03-evento-lotado");
    expect(r.metadata?.resultado.modelo).toBe("haiku");
  }, 120_000);

  it("erro do agente fica visível em metadata, como erro_agente", async () => {
    const quebrado: RodarAgente = async () => {
      throw new Error("sem login");
    };
    const r = await new Agente({ config: { variante: "a", rodarAgente: quebrado } }).callApi("", { vars: { tarefa: "01-proximos-eventos" } });
    expect(r.output).toBe("erro_agente");
    expect(r.metadata?.resultado.agente.erro).toBe("sem login");
  }, 120_000);

  it("tarefa desconhecida vira { error }", async () => {
    const r = await new Agente({ config: { variante: "a", rodarAgente: falso } }).callApi("", { vars: { tarefa: "99-nada" } });
    expect(r.error).toMatch(/não encontrada/);
  });

  it("recusa variante inválida", () => {
    expect(() => new Agente({ config: { variante: "c" as never } })).toThrow();
  });
});
