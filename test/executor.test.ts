import { appendFileSync, chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  argumentosClaude,
  envDoAgente,
  matarAgentesVivos,
  parsearSaida,
  rodarProcessoAgente,
  type RodarAgente,
  type SaidaAgente,
} from "../src/claude.js";
import { arquivosAlterados, executarTarefa, prepararCopia } from "../src/executor.js";
import { apagarCopia, aplicarSolucao, BASE_COPIAS, DEPS, gitDaCopia, hashDependencias } from "../src/copia.js";
import { PNPM_HOME, PREFIXO_NODE } from "../src/caminhos.js";
import { aoEncerrar, rodarLimpezas } from "../src/encerramento.js";
import { cp, mkdtemp, symlink } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { carregarTarefas, type Tarefa } from "../src/tarefas.js";

const RAIZ = join(import.meta.dirname, "..");
const tarefas = carregarTarefas();
const tarefa = (prefixo: string): Tarefa => tarefas.find((t) => t.id.startsWith(prefixo))!;
const pastas: string[] = [];

afterEach(async () => {
  await Promise.all(pastas.splice(0).map((p) => apagarCopia(p)));
});

/** Guarda a pasta corrigida (para inspecionar) e a apaga no fim do teste. */
function guardarCorrecao() {
  const vistas: string[] = [];
  return {
    correcao: {
      manterEm: (p: string) => {
        vistas.push(p);
        pastas.push(dirname(p));
      },
    },
    vistas,
  };
}

const SAIDA_OK: SaidaAgente = {
  ok: true,
  turnos: 3,
  duracaoMs: 1000,
  custoUsd: 0.01,
  tokensEntrada: 10,
  tokensSaida: 20,
  tokensCache: 30,
};

/** Agente falso: roda `acao` na pasta e devolve uma saída fixa. Guarda as pastas para conferir a limpeza. */
function agenteFalso(acao: (pasta: string) => Promise<void> | void, saida: SaidaAgente = SAIDA_OK) {
  const vistas: string[] = [];
  const rodar: RodarAgente = async ({ pasta }) => {
    vistas.push(pasta);
    await acao(pasta);
    return saida;
  };
  return { rodar, vistas };
}

describe("prepararCopia (via executor)", () => {
  it("A sem CLAUDE.md, B com o da variante, e nada alterado numa cópia nova", async () => {
    const a = await prepararCopia("a");
    const b = await prepararCopia("b");
    pastas.push(a, b);
    expect(existsSync(join(a, "CLAUDE.md"))).toBe(false);
    expect(readFileSync(join(b, "CLAUDE.md"), "utf8")).toBe(
      readFileSync(join(RAIZ, "variantes", "b", "CLAUDE.md"), "utf8"),
    );
    expect(await arquivosAlterados(a)).toEqual([]);
    expect(await arquivosAlterados(b)).toEqual([]);
  });
});

describe("executarTarefa", () => {
  it("agente que aplica a solução da 03 → passou, e a pasta temporária some", async () => {
    const t = tarefa("03");
    const { rodar, vistas } = agenteFalso((pasta) => aplicarSolucao(pasta, t));
    const r = await executarTarefa(t, "b", { rodarAgente: rodar });
    expect(r).toMatchObject({ tarefa: t.id, variante: "b", desfecho: "passou", testePassou: true, foraDoEscopo: [] });
    expect(r.alterados).toEqual(["src/inscricoes.ts"]);
    expect(r.agente).toEqual(SAIDA_OK);
    expect(existsSync(vistas[0]!)).toBe(false);
  }, 60_000);

  it("passa ao agente o prompt da tarefa e os defaults (modelo, 30 turnos, 10 min)", async () => {
    const t = tarefa("01");
    let recebido: Parameters<RodarAgente>[0] | undefined;
    const rodar: RodarAgente = async (args) => {
      recebido = args;
      return SAIDA_OK;
    };
    await executarTarefa(t, "a", { rodarAgente: rodar });
    expect(recebido).toMatchObject({
      prompt: t.prompt,
      modelo: process.env.AGENTE_MODELO ?? "sonnet",
      maxTurnos: 30,
      timeoutMs: 600_000,
    });
  }, 60_000);

  it("agente que não faz nada → falhou", async () => {
    const t = tarefa("01");
    const r = await executarTarefa(t, "a", { rodarAgente: agenteFalso(() => {}).rodar });
    expect(r.desfecho).toBe("falhou");
    expect(r.testePassou).toBe(false);
    expect(r.alterados).toEqual([]);
  }, 60_000);

  it("solução da 06 + edição em src/legado/relatorio.ts → fora_do_escopo", async () => {
    const t = tarefa("06");
    const { rodar } = agenteFalso(async (pasta) => {
      await aplicarSolucao(pasta, t);
      appendFileSync(join(pasta, "src", "legado", "relatorio.ts"), "\n// mexi aqui\n");
    });
    const r = await executarTarefa(t, "a", { rodarAgente: rodar });
    expect(r.desfecho).toBe("fora_do_escopo");
    expect(r.foraDoEscopo).toContain("src/legado/relatorio.ts");
  }, 60_000);

  it("agente que planta test/oculto.test.ts vazio e não resolve → falhou (o oculto sobrescreve)", async () => {
    const t = tarefa("01");
    const { rodar } = agenteFalso((pasta) => {
      writeFileSync(join(pasta, "test", "oculto.test.ts"), 'import { it } from "vitest";\nit("ok", () => {});\n');
    });
    const r = await executarTarefa(t, "a", { rodarAgente: rodar });
    expect(r.desfecho).toBe("falhou");
    expect(r.testePassou).toBe(false);
  }, 60_000);

  it("agente que devolve ok:false (timeout) → erro_agente, sem exceção", async () => {
    const t = tarefa("01");
    const falha: SaidaAgente = { ...SAIDA_OK, ok: false, erro: "timeout" };
    const r = await executarTarefa(t, "a", { rodarAgente: agenteFalso(() => {}, falha).rodar });
    expect(r.desfecho).toBe("erro_agente");
    expect(r.agente.erro).toBe("timeout");
  }, 60_000);

  it("agente que lança exceção → erro_agente, sem exceção", async () => {
    const t = tarefa("01");
    const rodar: RodarAgente = async () => {
      throw new Error("explodiu");
    };
    const r = await executarTarefa(t, "a", { rodarAgente: rodar });
    expect(r.desfecho).toBe("erro_agente");
    expect(r.agente.ok).toBe(false);
    expect(r.agente.erro).toContain("explodiu");
  }, 60_000);

  it("erro_agente vence fora_do_escopo; manterPasta deixa a cópia", async () => {
    const t = tarefa("01");
    const { rodar, vistas } = agenteFalso(
      (pasta) => writeFileSync(join(pasta, "src", "inscricoes.ts"), "// mexi\n"),
      { ...SAIDA_OK, ok: false, erro: "error_max_turns" },
    );
    const r = await executarTarefa(t, "a", { rodarAgente: rodar, manterPasta: true });
    pastas.push(vistas[0]!);
    expect(r.desfecho).toBe("erro_agente");
    expect(r.foraDoEscopo).toEqual(["src/inscricoes.ts"]);
    expect(existsSync(vistas[0]!)).toBe(true);
  }, 60_000);
});

describe("integridade e escopo fixo", () => {
  it("deps adulteradas → erro_agente dependencias_adulteradas, e o teste oculto não roda", async () => {
    const t = tarefa("03");
    const { rodar } = agenteFalso((pasta) => aplicarSolucao(pasta, t));
    const r = await executarTarefa(t, "a", { rodarAgente: rodar, verificarDependencias: async () => false });
    expect(r.desfecho).toBe("erro_agente");
    expect(r.agente.erro).toBe("dependencias_adulteradas");
    expect(r.testePassou).toBe(false);
  }, 60_000);

  it("deps do lab estão intactas depois de uma execução normal", async () => {
    const t = tarefa("01");
    const r = await executarTarefa(t, "a", { rodarAgente: agenteFalso((p) => aplicarSolucao(p, t)).rodar });
    expect(r.desfecho).toBe("passou");
  }, 60_000);

  it("hashDependencias muda quando um arquivo ou uma permissão muda", async () => {
    const dir = await mkdtemp(join(tmpdir(), "medindo-hash-"));
    pastas.push(dir);
    await cp(join(RAIZ, "tarefas", "01-proximos-eventos"), dir, { recursive: true });
    const antes = await hashDependencias(dir);
    expect(await hashDependencias(dir)).toBe(antes);
    appendFileSync(join(dir, "oculto.test.ts"), "// mudou\n");
    const depoisDoConteudo = await hashDependencias(dir);
    expect(depoisDoConteudo).not.toBe(antes);
    chmodSync(join(dir, "solucao"), 0o555);
    expect(await hashDependencias(dir)).not.toBe(depoisDoConteudo); // só a permissão mudou
    chmodSync(join(dir, "solucao"), 0o755);
  });

  it("package.json alterado → fora_do_escopo", async () => {
    const t = tarefa("01");
    const { rodar } = agenteFalso(async (pasta) => {
      await aplicarSolucao(pasta, t);
      appendFileSync(join(pasta, "package.json"), "\n");
    });
    const r = await executarTarefa(t, "a", { rodarAgente: rodar });
    expect(r.desfecho).toBe("fora_do_escopo");
    expect(r.foraDoEscopo).toEqual(["package.json"]);
  }, 60_000);

  it("vitest.config/vite.config fora do escopo mesmo dentro de pasta permitida (test/**)", async () => {
    const t = tarefa("01");
    const { rodar } = agenteFalso(async (pasta) => {
      await aplicarSolucao(pasta, t);
      writeFileSync(join(pasta, "test", "vitest.config.ts"), "export default {};\n");
      writeFileSync(join(pasta, "test", "vite.config.mjs"), "export default {};\n");
    });
    const r = await executarTarefa(t, "a", { rodarAgente: rodar });
    expect(r.desfecho).toBe("fora_do_escopo");
    expect(r.foraDoEscopo).toEqual(["test/vite.config.mjs", "test/vitest.config.ts"]);
  }, 60_000);

  it("agente que troca o node_modules da cópia: a correção usa o nosso", async () => {
    const t = tarefa("01");
    const { rodar } = agenteFalso(async (pasta) => {
      await aplicarSolucao(pasta, t);
      await rm(join(pasta, "node_modules"), { recursive: true, force: true });
      await cp(join(RAIZ, "tarefas"), join(pasta, "node_modules"), { recursive: true }); // lixo no lugar
    });
    const { correcao, vistas } = guardarCorrecao();
    const r = await executarTarefa(t, "a", { rodarAgente: rodar, correcao });
    expect(r.desfecho).toBe("passou");
    expect(realpathSync(join(vistas[0]!, "node_modules", "vitest"))).toBe(realpathSync(join(DEPS, "node_modules", "vitest")));
    expect(existsSync(join(vistas[0]!, "node_modules", "01-proximos-eventos"))).toBe(false);
  }, 60_000);
});

describe("correção em sandbox", () => {
  it("código do agente que roda na correção não escreve fora da cópia, não mexe nas deps e não usa rede", async () => {
    const t = tarefa("01");
    const fora = join(homedir(), "medindo-probe-y");
    const sonda = `
import { writeFileSync, chmodSync, readFileSync } from "node:fs";
const r: Record<string, string> = {};
const tenta = async (nome: string, f: () => unknown) => {
  try { await f(); r[nome] = "OK"; } catch (e) { r[nome] = String((e as { code?: string }).code ?? (e as Error).message); }
};
await tenta("home", () => writeFileSync(${JSON.stringify(fora)}, "x"));
await tenta("deps", () => writeFileSync(${JSON.stringify(join(DEPS, "node_modules", "vitest", "x"))}, "x"));
await tenta("chmod", () => chmodSync(${JSON.stringify(join(DEPS, "node_modules", "vitest"))}, 0o755));
await tenta("rede", async () => { await (await fetch("https://example.com")).text(); });
await tenta("ler projeto", () => readFileSync(${JSON.stringify(join(RAIZ, "package.json"))}));
writeFileSync("resultado-correcao.json", JSON.stringify(r));
`;
    const { rodar } = agenteFalso(async (pasta) => {
      await aplicarSolucao(pasta, t);
      appendFileSync(join(pasta, "src", "eventos.ts"), sonda);
    });
    const { correcao, vistas } = guardarCorrecao();
    const r = await executarTarefa(t, "a", { rodarAgente: rodar, correcao });
    const res = JSON.parse(readFileSync(join(vistas[0]!, "resultado-correcao.json"), "utf8"));
    expect(res.home).toBe("EPERM");
    expect(res.deps).toMatch(/EPERM|EACCES/);
    expect(res.chmod).toMatch(/EPERM|EACCES/);
    expect(res.rede).not.toBe("OK");
    expect(res["ler projeto"]).not.toBe("OK");
    expect(existsSync(fora)).toBe(false);
    expect(r.desfecho).toBe("passou"); // a solução normal continua passando
  }, 60_000);

  it("link simbólico para fora da cópia → fora_do_escopo, mesmo em pasta permitida", async () => {
    const t = tarefa("01");
    const { rodar } = agenteFalso(async (pasta) => {
      await aplicarSolucao(pasta, t);
      await symlink(join(RAIZ, "tarefas", "03-evento-lotado", "oculto.test.ts"), join(pasta, "test", "espiao.ts"));
      await symlink(join(homedir(), ".zshrc-que-nao-existe"), join(pasta, "test", "quebrado"));
      await symlink("../src/eventos.ts", join(pasta, "test", "dentro.ts")); // dentro da cópia: a correção só aceita arquivo comum
    });
    const r = await executarTarefa(t, "a", { rodarAgente: rodar });
    expect(r.desfecho).toBe("fora_do_escopo");
    expect(r.testePassou).toBe(false);
    expect(r.foraDoEscopo).toEqual(["test/dentro.ts", "test/espiao.ts", "test/quebrado"]);
  }, 60_000);

  it("test/oculto.test.ts → arquivo de fora: não corrige, e o alvo fica intacto", async () => {
    const t = tarefa("01");
    const fora = await mkdtemp(join(tmpdir(), "medindo-alvo-"));
    const alvo = join(fora, "alvo.ts");
    writeFileSync(alvo, "original\n");
    try {
      const { rodar } = agenteFalso(async (pasta) => {
        await aplicarSolucao(pasta, t);
        await rm(join(pasta, "test", "oculto.test.ts"), { force: true });
        await symlink(alvo, join(pasta, "test", "oculto.test.ts"));
      });
      const r = await executarTarefa(t, "a", { rodarAgente: rodar });
      expect(r.desfecho).toBe("fora_do_escopo");
      expect(r.testePassou).toBe(false);
      expect(r.foraDoEscopo).toContain("test/oculto.test.ts");
      expect(readFileSync(alvo, "utf8")).toBe("original\n");
    } finally {
      await rm(fora, { recursive: true, force: true });
    }
  }, 60_000);

  it("test/ → pasta de fora: não corrige, e nada é criado na pasta de fora", async () => {
    const t = tarefa("01");
    const fora = await mkdtemp(join(tmpdir(), "medindo-alvo-"));
    try {
      const { rodar } = agenteFalso(async (pasta) => {
        await aplicarSolucao(pasta, t);
        await rm(join(pasta, "test"), { recursive: true, force: true });
        await symlink(fora, join(pasta, "test"));
      });
      const r = await executarTarefa(t, "a", { rodarAgente: rodar });
      expect(r.desfecho).toBe("fora_do_escopo");
      expect(r.testePassou).toBe(false);
      expect(r.foraDoEscopo).toContain("test");
      expect(readdirSync(fora)).toEqual([]);
    } finally {
      await rm(fora, { recursive: true, force: true });
    }
  }, 60_000);

  it(".git plantado (link para outro repo, arquivo gitdir:, pasta em subpasta) → fora_do_escopo, sem corrigir", async () => {
    const t = tarefa("01");
    const outro = await mkdtemp(join(tmpdir(), "medindo-outro-repo-"));
    try {
      const { rodar } = agenteFalso(async (pasta) => {
        await aplicarSolucao(pasta, t);
        await symlink(join(outro, ".git"), join(pasta, ".git"));
        writeFileSync(join(pasta, "test", ".git"), `gitdir: ${join(outro, ".git")}\n`);
        mkdirSync(join(pasta, "src", ".git"));
        writeFileSync(join(pasta, "src", ".git", "config"), "[core]\n");
      });
      const r = await executarTarefa(t, "a", { rodarAgente: rodar });
      expect(r.desfecho).toBe("fora_do_escopo");
      expect(r.testePassou).toBe(false);
      expect(r.foraDoEscopo).toEqual([".git", "src/.git", "test/.git"]);
      expect(r.alterados).toEqual(["src/eventos.ts"]); // o git do host enxerga a cópia normalmente
    } finally {
      await rm(outro, { recursive: true, force: true });
    }
  }, 60_000);

  it("FIFO deixado pelo agente → fora_do_escopo, e a correção não trava lendo", async () => {
    const t = tarefa("01");
    const { rodar } = agenteFalso(async (pasta) => {
      await aplicarSolucao(pasta, t);
      const { execFileSync } = await import("node:child_process");
      execFileSync("mkfifo", [join(pasta, "src", "cano.ts")]);
    });
    const r = await executarTarefa(t, "a", { rodarAgente: rodar });
    expect(r.desfecho).toBe("fora_do_escopo");
    expect(r.foraDoEscopo).toEqual(["src/cano.ts"]);
  }, 60_000);

  it("processo do agente que sobrou reescrevendo a cópia não alcança a correção (pasta nova)", async () => {
    const t = tarefa("01");
    const trapaca = 'import { it } from "vitest";\nit("ok", () => {});\n';
    let pid = 0;
    const { rodar, vistas: copias } = agenteFalso(async (pasta) => {
      // não resolve; deixa um processo solto (fora do grupo) reescrevendo test/oculto.test.ts
      const alvo = join(pasta, "test", "oculto.test.ts");
      const script = `const fs = require("fs"); setInterval(() => { try { fs.writeFileSync(${JSON.stringify(alvo)}, ${JSON.stringify(trapaca)}); } catch {} }, 1);`;
      const { spawn } = await import("node:child_process");
      const filho = spawn(process.execPath, ["-e", script], { detached: true, stdio: "ignore" });
      filho.unref();
      pid = filho.pid!;
      await new Promise((r) => setTimeout(r, 100));
    });
    const { correcao, vistas } = guardarCorrecao();
    try {
      const r = await executarTarefa(t, "a", { rodarAgente: rodar, manterPasta: true, correcao });
      expect(readFileSync(join(copias[0]!, "test", "oculto.test.ts"), "utf8")).toBe(trapaca); // ainda escrevendo
      expect(r.desfecho).toBe("falhou");
      expect(r.testePassou).toBe(false);
      expect(readFileSync(join(vistas[0]!, "test", "oculto.test.ts"), "utf8")).toBe(
        readFileSync(join(t.pasta, "oculto.test.ts"), "utf8"),
      );
    } finally {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // já morreu
      }
      if (copias[0]) pastas.push(copias[0]);
    }
  }, 60_000);

  it("deps adulteradas durante a correção → erro_agente (checagem depois da correção)", async () => {
    const t = tarefa("01");
    let chamadas = 0;
    const r = await executarTarefa(t, "a", {
      rodarAgente: agenteFalso((p) => aplicarSolucao(p, t)).rodar,
      verificarDependencias: async () => ++chamadas === 1, // ok antes, adulterada depois
    });
    expect(chamadas).toBe(2);
    expect(r.desfecho).toBe("erro_agente");
    expect(r.agente.erro).toBe("dependencias_adulteradas");
    expect(r.testePassou).toBe(false);
  }, 60_000);
});

describe("encerramento", () => {
  it("Ctrl+C/SIGTERM no meio da execução apaga a cópia em andamento", async () => {
    const t = tarefa("01");
    let existiaAntes = false;
    let existeDepois = true;
    const rodar: RodarAgente = async ({ pasta }) => {
      existiaAntes = existsSync(pasta);
      rodarLimpezas(); // o que os ganchos de SIGINT/SIGTERM/exit fazem
      existeDepois = existsSync(pasta);
      return { ...SAIDA_OK, ok: false, erro: "interrompido" };
    };
    let gitAntes = false;
    let gitDepois = true;
    const rodar2: RodarAgente = async (args) => {
      gitAntes = existsSync(gitDaCopia(args.pasta));
      const s = await rodar(args);
      gitDepois = existsSync(gitDaCopia(args.pasta));
      return s;
    };
    await executarTarefa(t, "a", { rodarAgente: rodar2 }).catch(() => {});
    expect(existiaAntes).toBe(true);
    expect(existeDepois).toBe(false);
    expect(gitAntes).toBe(true);
    expect(gitDepois).toBe(false);
  }, 60_000);

  it("aoEncerrar devolve o desregistro", () => {
    let n = 0;
    const tirar = aoEncerrar(() => n++);
    rodarLimpezas();
    tirar();
    rodarLimpezas();
    expect(n).toBe(1);
  });
});

describe("argumentosClaude", () => {
  const args = argumentosClaude("x", "haiku", 5);
  const depois = (flag: string) => args[args.indexOf(flag) + 1];

  it("isola config do usuário e pede JSON", () => {
    expect(depois("--setting-sources")).toBe("project");
    expect(args).toContain("--strict-mcp-config");
    expect(args).not.toContain("--mcp-config");
    expect(depois("--output-format")).toBe("json");
  });

  it("prompt logo depois de -p, modelo, turnos e modo de permissão", () => {
    expect(args.slice(0, 2)).toEqual(["-p", "x"]);
    expect(depois("--model")).toBe("haiku");
    expect(depois("--max-turns")).toBe("5");
    expect(depois("--permission-mode")).toBe("dontAsk");
  });

  it("libera leitura e escrita só dentro da cópia e os testes; web, deps, .claude da cópia, projeto e ~/.claude bloqueados", () => {
    const i = args.indexOf("--allowedTools");
    expect(args.slice(i + 1, i + 10)).toEqual([
      "Read(./**)",
      "Edit(./**)",
      "Bash(pnpm test:*)",
      "Bash(pnpm vitest:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(grep:*)",
      "Bash(head:*)",
      "Bash(wc:*)",
    ]);
    expect(args[i + 10]!.startsWith("--")).toBe(true);
    for (const perigoso of ["find", "xargs", "sed", "node", "npx", "rm"]) {
      expect(args.some((a) => a.startsWith(`Bash(${perigoso}`))).toBe(false);
    }
    const j = args.indexOf("--disallowedTools");
    expect(args.slice(j + 1, j + 8)).toEqual([
      "WebFetch",
      "WebSearch",
      "Edit(./node_modules/**)",
      "Edit(./.claude/**)",
      `Read(/${RAIZ}/**)`,
      "Read(~/.claude/**)",
      "Read(~/.claude.json)",
    ]);
    expect(args[j + 8]!.startsWith("--")).toBe(true);
    expect(args).not.toContain("acceptEdits");
  });

  it("sandbox do SO ligado: sem rede, sem fuga, sem ler o projeto nem as outras cópias", () => {
    const pasta = join(BASE_COPIAS, "a-xyz");
    const a = argumentosClaude("x", "haiku", 5, pasta);
    const settings = JSON.parse(a[a.indexOf("--settings") + 1]!);
    expect(settings.sandbox).toEqual({
      enabled: true,
      failIfUnavailable: true,
      autoAllowBashIfSandboxed: false,
      allowUnsandboxedCommands: false,
      network: { allowedDomains: [] },
      filesystem: {
        denyRead: [homedir(), RAIZ, BASE_COPIAS],
        allowRead: [DEPS, pasta, PREFIXO_NODE, PNPM_HOME],
      },
    });
  });
});

describe("parsearSaida", () => {
  it("lê os campos do JSON de sucesso", () => {
    const json = JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      num_turns: 6,
      duration_ms: 12445,
      total_cost_usd: 0.0089,
      usage: { input_tokens: 2, output_tokens: 119, cache_read_input_tokens: 13057, cache_creation_input_tokens: 6684 },
    });
    expect(parsearSaida(json, 999)).toEqual({
      ok: true,
      turnos: 6,
      duracaoMs: 12445,
      custoUsd: 0.0089,
      tokensEntrada: 2,
      tokensSaida: 119,
      tokensCache: 13057 + 6684,
    });
  });

  it("is_error (max turns) vira ok:false com o subtype como erro", () => {
    const json = JSON.stringify({
      type: "result",
      subtype: "error_max_turns",
      is_error: true,
      num_turns: 2,
      duration_ms: 4925,
      total_cost_usd: 0.0016,
      errors: ["Reached maximum number of turns (1)"],
    });
    const s = parsearSaida(json, 999);
    expect(s.ok).toBe(false);
    expect(s.erro).toContain("error_max_turns");
    expect(s.turnos).toBe(2);
    expect(s.tokensEntrada).toBe(0);
  });

  it("JSON inválido ou sem is_error → saida_invalida, com a duração medida", () => {
    expect(parsearSaida("Error: not logged in", 777)).toMatchObject({ ok: false, erro: "saida_invalida", duracaoMs: 777 });
    expect(parsearSaida("{}", 777)).toMatchObject({ ok: false, erro: "saida_invalida" });
  });
});

describe("envDoAgente", () => {
  it("tira as variáveis de sessão do Claude Code e desliga o install antes do pnpm test", () => {
    const env = envDoAgente({
      PATH: "/bin",
      HOME: "/h",
      CLAUDECODE: "1",
      CLAUDE_CODE_SESSION_ID: "s",
      CLAUDE_CODE_ENTRYPOINT: "cli",
      CLAUDE_PID: "1",
      CLAUDE_EFFORT: "max",
    });
    expect(env).toEqual({ PATH: "/bin", HOME: "/h", npm_config_verify_deps_before_run: "false" });
  });
});

describe("rodarProcessoAgente", () => {
  it("estoura o timeout: mata o processo e devolve ok:false timeout", async () => {
    const inicio = Date.now();
    const s = await rodarProcessoAgente(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], RAIZ, 500);
    expect(s).toMatchObject({ ok: false, erro: "timeout" });
    expect(Date.now() - inicio).toBeLessThan(10_000);
  });

  it("saída não-JSON → saida_invalida; código de saída ≠ 0 com JSON ainda é lido", async () => {
    const lixo = await rodarProcessoAgente(process.execPath, ["-e", "console.log('oi')"], RAIZ, 10_000);
    expect(lixo).toMatchObject({ ok: false, erro: "saida_invalida" });
    const json = JSON.stringify({ type: "result", subtype: "success", is_error: false, num_turns: 1, duration_ms: 5 });
    const s = await rodarProcessoAgente(
      process.execPath,
      ["-e", `process.stdout.write(${JSON.stringify(json)}); process.exit(1)`],
      RAIZ,
      10_000,
    );
    expect(s).toMatchObject({ ok: true, turnos: 1, duracaoMs: 5 });
  });

  it("roda com cwd na pasta e stdin fechado", async () => {
    const pasta = await prepararCopia("a");
    pastas.push(pasta);
    const script =
      "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{require('fs').writeFileSync('marca.txt','');process.stdout.write(JSON.stringify({is_error:false,num_turns:d.length,duration_ms:1}))})";
    const s = await rodarProcessoAgente(process.execPath, ["-e", script], pasta, 10_000);
    expect(s).toMatchObject({ ok: true, turnos: 0 });
    expect(existsSync(join(pasta, "marca.txt"))).toBe(true);
  });

  it("timeout mata o grupo inteiro, inclusive o neto", async () => {
    const dir = await mkdtemp(join(tmpdir(), "medindo-neto-"));
    pastas.push(dir);
    const neto = "setInterval(() => {}, 1000)";
    const script = `const c = require("child_process").spawn(process.execPath, ["-e", ${JSON.stringify(neto)}], { stdio: "ignore" }); require("fs").writeFileSync("neto.pid", String(c.pid)); setInterval(() => {}, 1000);`;
    const s = await rodarProcessoAgente(process.execPath, ["-e", script], dir, 1_000);
    expect(s).toMatchObject({ ok: false, erro: "timeout" });
    const pid = Number(readFileSync(join(dir, "neto.pid"), "utf8"));
    await new Promise((r) => setTimeout(r, 200));
    expect(() => process.kill(pid, 0)).toThrow(/ESRCH/);
  }, 15_000);

  it("matarAgentesVivos encerra os agentes em andamento", async () => {
    const corrida = rodarProcessoAgente(process.execPath, ["-e", "setInterval(() => {}, 1000)"], RAIZ, 60_000);
    await new Promise((r) => setTimeout(r, 300));
    matarAgentesVivos();
    const s = await corrida;
    expect(s.ok).toBe(false);
  }, 15_000);

  it("comando inexistente → ok:false, sem exceção", async () => {
    const s = await rodarProcessoAgente("comando-que-nao-existe-xyz", [], RAIZ, 10_000);
    expect(s.ok).toBe(false);
    expect(s.erro).toMatch(/ENOENT|spawn/);
  });
});
