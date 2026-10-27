// Um caso por tarefa. Gera os `tests` do promptfoo (config: `tests: file://casos.ts`).
import { carregarTarefas } from "../src/tarefas.js";

export default function casos() {
  return carregarTarefas().map((t) => ({
    description: t.titulo,
    vars: { tarefa: t.id },
    assert: [{ type: "javascript", value: 'output === "passou"' }],
  }));
}
