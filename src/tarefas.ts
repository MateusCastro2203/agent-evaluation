import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Tarefa {
  id: string;
  titulo: string;
  prompt: string;
  /** Globs relativos à raiz do lab (`*` não cruza `/`, `**` cruza). */
  permitidos: string[];
  dependeDeConvencao: boolean;
  /** Pasta absoluta da tarefa (tem `tarefa.json`, `oculto.test.ts` e `solucao/`). */
  pasta: string;
}

const RAIZ_TAREFAS = join(import.meta.dirname, "..", "tarefas");

export function carregarTarefas(raiz: string = RAIZ_TAREFAS): Tarefa[] {
  return readdirSync(raiz, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(raiz, d.name, "tarefa.json")))
    .map((d) => d.name)
    .sort()
    .map((id) => lerTarefa(id, join(raiz, id)));
}

function lerTarefa(id: string, pasta: string): Tarefa {
  const json = JSON.parse(readFileSync(join(pasta, "tarefa.json"), "utf8")) as Record<string, unknown>;
  const { titulo, prompt, permitidos, dependeDeConvencao } = json;
  if (
    typeof titulo !== "string" ||
    typeof prompt !== "string" ||
    !Array.isArray(permitidos) ||
    !permitidos.every((p) => typeof p === "string") ||
    typeof dependeDeConvencao !== "boolean"
  ) {
    throw new Error(`tarefa.json inválido em ${id}`);
  }
  if (!existsSync(join(pasta, "oculto.test.ts"))) {
    throw new Error(`${id} não tem oculto.test.ts`);
  }
  return { id, titulo, prompt, permitidos, dependeDeConvencao, pasta };
}

function globParaRegex(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
      if (glob[i + 1] === "/") i++;
    } else if (c === "*") {
      re += "[^/]*";
    } else {
      re += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

export function casaPermitido(arquivo: string, permitidos: string[]): boolean {
  return permitidos.some((glob) => globParaRegex(glob).test(arquivo));
}
