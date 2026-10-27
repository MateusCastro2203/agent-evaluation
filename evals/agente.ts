// Provider do promptfoo: roda UMA tarefa × UMA variante pelo executor (Claude Code de verdade).
// config.variante: "a" ou "b". O desfecho vira `output`; o resultado completo vai em `metadata.resultado`.
import { executarTarefa, type Desfecho, type ResultadoExecucao } from "../src/executor.js";
import type { RodarAgente } from "../src/claude.js";
import type { Variante } from "../src/copia.js";
import { carregarTarefas } from "../src/tarefas.js";

interface OpcoesAgente {
  config?: {
    variante?: Variante;
    /** Modelo do `claude -p` (alias): vem do config, para o run ao vivo não depender do ambiente. */
    modelo?: string;
    /** Só para testes: troca o `claude -p` por um agente falso. */
    rodarAgente?: RodarAgente;
  };
}

export interface RespostaAgente {
  output?: Desfecho;
  error?: string;
  metadata?: { resultado: ResultadoExecucao & { modelo: string } };
}

export default class Agente {
  private variante: Variante;
  private modelo: string;
  private rodarAgente?: RodarAgente;
  private tarefas = carregarTarefas();

  constructor(opcoes: OpcoesAgente = {}) {
    const variante = opcoes.config?.variante;
    if (variante !== "a" && variante !== "b") throw new Error(`config.variante deve ser "a" ou "b" (veio ${String(variante)})`);
    this.variante = variante;
    this.modelo = opcoes.config?.modelo ?? process.env.AGENTE_MODELO ?? "sonnet";
    this.rodarAgente = opcoes.config?.rodarAgente;
  }

  id = () => `claude-code-${this.variante}`;

  callApi = async (_prompt: string, contexto: { vars: Record<string, unknown> }): Promise<RespostaAgente> => {
    const id = String(contexto.vars.tarefa);
    const tarefa = this.tarefas.find((t) => t.id === id);
    if (!tarefa) return { error: `tarefa ${id} não encontrada` };
    try {
      const resultado = await executarTarefa(tarefa, this.variante, {
        modelo: this.modelo,
        ...(this.rodarAgente ? { rodarAgente: this.rodarAgente } : {}),
      });
      // erro_agente vira output normal (conta à parte no relatório); o motivo fica visível em metadata
      return { output: resultado.desfecho, metadata: { resultado: { ...resultado, modelo: this.modelo } } };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  };
}
