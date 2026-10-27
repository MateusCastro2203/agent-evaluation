import { spawn } from "node:child_process";
import { leituraRestrita, RAIZ } from "./caminhos.js";
import { aoEncerrar } from "./encerramento.js";

export interface SaidaAgente {
  ok: boolean;
  erro?: string;
  turnos: number;
  duracaoMs: number;
  custoUsd: number;
  tokensEntrada: number;
  tokensSaida: number;
  tokensCache: number;
}

export type RodarAgente = (args: {
  pasta: string;
  prompt: string;
  modelo: string;
  maxTurnos: number;
  timeoutMs: number;
}) => Promise<SaidaAgente>;

/**
 * Liberadas sem pergunta (o resto é negado: `--permission-mode dontAsk`). Leitura e escrita só
 * dentro da cópia (`./` é o cwd; `Edit` cobre Edit e Write; Glob e Grep seguem as regras de `Read`)
 * e Bash só para os testes do lab e para comandos de leitura (ls, cat, grep, head, wc).
 */
const PERMITIDAS = [
  "Read(./**)",
  "Edit(./**)",
  "Bash(pnpm test:*)",
  "Bash(pnpm vitest:*)",
  // exploração só leitura (Glob e Grep não existem neste build); as regras Read de negação e o
  // sandbox continuam valendo para os alvos desses comandos
  "Bash(ls:*)",
  "Bash(cat:*)",
  "Bash(grep:*)",
  "Bash(head:*)",
  "Bash(wc:*)",
];

/**
 * Negadas mesmo se algo liberar: web (run offline, mesmo acesso para as duas variantes), as deps do
 * lab, a config do Claude Code dentro da cópia (`.claude/`: o agente não pode se dar permissão nem
 * criar hook ou skill no meio do run; `Edit` cobre Edit e Write), o projeto (testes ocultos e
 * soluções) e a config do Claude Code do usuário.
 */
function bloqueadas(): string[] {
  return [
    "WebFetch",
    "WebSearch",
    "Edit(./node_modules/**)",
    "Edit(./.claude/**)",
    `Read(/${RAIZ}/**)`,
    "Read(~/.claude/**)",
    "Read(~/.claude.json)",
  ];
}

/**
 * Sandbox do SO (Seatbelt no macOS) para todo comando Bash, inclusive o código que `pnpm test` roda:
 * - escrita: só o cwd (a cópia) e o $TMPDIR, o padrão do Claude Code. As cópias ficam fora do $TMPDIR.
 * - leitura: o home inteiro (projeto, testes ocultos, ~/.claude) e as outras cópias bloqueados;
 *   liberados a própria cópia, `.lab-deps`, o node e o pnpm (`leituraRestrita`).
 * - rede: nenhum domínio.
 * - sem auto-aprovar comando por estar no sandbox e sem a saída "rodar fora do sandbox".
 */
export function configuracaoSandbox(pasta: string): object {
  return {
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
      autoAllowBashIfSandboxed: false,
      allowUnsandboxedCommands: false,
      network: { allowedDomains: [] },
      filesystem: leituraRestrita(pasta),
    },
  };
}

/**
 * Argumentos do `claude` headless (conferidos em `claude --help`, Claude Code 2.1.310, e na doc de
 * permissions/sandboxing). O prompt vem logo depois de `-p`: `--allowedTools`/`--disallowedTools`
 * são variádicas e engoliriam um argumento posicional que viesse depois delas.
 * `--setting-sources project` deixa de fora ~/.claude (CLAUDE.md do usuário, hooks, plugins, skills e MCP)
 * e mantém o CLAUDE.md da pasta (variante B). `--strict-mcp-config` (sem `--mcp-config`) deixa de fora os
 * conectores MCP da conta claude.ai, que `--setting-sources` não controla (medido na Task 7: 47
 * servidores sem ele). `--settings` (linha de comando) vale mesmo assim.
 */
export function argumentosClaude(prompt: string, modelo: string, maxTurnos: number, pasta: string = process.cwd()): string[] {
  return [
    "-p",
    prompt,
    "--output-format",
    "json",
    "--model",
    modelo,
    "--max-turns",
    String(maxTurnos),
    "--permission-mode",
    "dontAsk",
    "--allowedTools",
    ...PERMITIDAS,
    "--disallowedTools",
    ...bloqueadas(),
    "--settings",
    JSON.stringify(configuracaoSandbox(pasta)),
    "--setting-sources",
    "project",
    "--strict-mcp-config", // sem --mcp-config: zero servidores MCP (os conectores da conta claude.ai entrariam senão)
    "--no-session-persistence",
  ];
}

/**
 * Env do agente: o do processo, sem as variáveis de uma sessão do Claude Code que esteja rodando o
 * experimento (`CLAUDECODE`, `CLAUDE_CODE_*`, `CLAUDE_PID`, `CLAUDE_EFFORT`). O login vem do
 * keychain, não dessas variáveis. `verify-deps-before-run=false`: o `pnpm test` do agente não tenta
 * instalar nada antes de rodar.
 */
export function envDoAgente(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = Object.fromEntries(
    Object.entries(base).filter(
      ([k]) => k !== "CLAUDECODE" && !k.startsWith("CLAUDE_CODE_") && k !== "CLAUDE_PID" && k !== "CLAUDE_EFFORT",
    ),
  );
  return { ...env, npm_config_verify_deps_before_run: "false" };
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function zerada(erro: string, duracaoMs: number): SaidaAgente {
  return { ok: false, erro, turnos: 0, duracaoMs, custoUsd: 0, tokensEntrada: 0, tokensSaida: 0, tokensCache: 0 };
}

/** Lê o JSON de `--output-format json`. `is_error` decide o `ok`; campo ausente vira 0. */
export function parsearSaida(stdout: string, duracaoMedidaMs: number): SaidaAgente {
  let json: Record<string, unknown>;
  try {
    const bruto: unknown = JSON.parse(stdout.trim());
    if (typeof bruto !== "object" || bruto === null || typeof (bruto as Record<string, unknown>).is_error !== "boolean") {
      return zerada("saida_invalida", duracaoMedidaMs);
    }
    json = bruto as Record<string, unknown>;
  } catch {
    return zerada("saida_invalida", duracaoMedidaMs);
  }
  const usage = (typeof json.usage === "object" && json.usage !== null ? json.usage : {}) as Record<string, unknown>;
  const saida: SaidaAgente = {
    ok: json.is_error === false,
    turnos: num(json.num_turns),
    duracaoMs: typeof json.duration_ms === "number" ? json.duration_ms : duracaoMedidaMs,
    custoUsd: num(json.total_cost_usd),
    tokensEntrada: num(usage.input_tokens),
    tokensSaida: num(usage.output_tokens),
    tokensCache: num(usage.cache_read_input_tokens) + num(usage.cache_creation_input_tokens),
  };
  if (!saida.ok) {
    const detalhes = Array.isArray(json.errors) ? json.errors.filter((e) => typeof e === "string") : [];
    saida.erro = [typeof json.subtype === "string" ? json.subtype : "is_error", ...detalhes].join(": ");
  }
  return saida;
}

/** Grupos de processo de agentes ainda vivos: mortos se este processo for interrompido. */
const vivos = new Set<number>();

function matarGrupo(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // grupo já acabou
  }
}

/** Mata todos os agentes em andamento (Ctrl+C no run, promptfoo encerrando etc.). */
export function matarAgentesVivos(): void {
  for (const pid of vivos) matarGrupo(pid);
  vivos.clear();
}

// Registrado no carregamento do módulo, antes de qualquer cópia (o executor importa este módulo
// primeiro): no Ctrl+C os agentes morrem antes de as cópias serem apagadas.
aoEncerrar(matarAgentesVivos);

/** Depois do SIGKILL no timeout, espera o `close` até este tanto antes de devolver. */
const ESPERA_CLOSE_MS = 2_000;

/**
 * Roda o processo do agente com cwd = pasta, stdin fechado e `envDoAgente()`, num grupo de processo
 * próprio. No timeout mata o grupo inteiro (o agente tem filhos: pnpm, vitest) e espera o `close`
 * (até 2 s). Código de saída ≠ 0 com JSON no stdout ainda é lido (`is_error` decide).
 */
export function rodarProcessoAgente(
  comando: string,
  args: string[],
  pasta: string,
  timeoutMs: number,
): Promise<SaidaAgente> {
  const inicio = Date.now();
  return new Promise((resolve) => {
    let stdout = "";
    let terminou = false;
    let estourou = false;
    const fim = (s: SaidaAgente) => {
      if (terminou) return;
      terminou = true;
      clearTimeout(relogio);
      if (filho.pid !== undefined) vivos.delete(filho.pid);
      resolve(s);
    };
    const filho = spawn(comando, args, {
      cwd: pasta,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      env: envDoAgente(),
    });
    if (filho.pid !== undefined) vivos.add(filho.pid);
    const relogio = setTimeout(() => {
      estourou = true;
      if (filho.pid !== undefined) matarGrupo(filho.pid);
      setTimeout(() => fim(zerada("timeout", Date.now() - inicio)), ESPERA_CLOSE_MS).unref();
    }, timeoutMs);
    filho.stdout.setEncoding("utf8").on("data", (c: string) => (stdout += c));
    filho.stderr.resume(); // descarta, mas sem travar o processo com o pipe cheio
    filho.on("error", (e) => fim(zerada(`spawn: ${e.message}`, Date.now() - inicio)));
    filho.on("close", () => {
      if (filho.pid !== undefined) matarGrupo(filho.pid); // netos que sobraram no grupo
      fim(estourou ? zerada("timeout", Date.now() - inicio) : parsearSaida(stdout, Date.now() - inicio));
    });
  });
}

export const rodarClaude: RodarAgente = ({ pasta, prompt, modelo, maxTurnos, timeoutMs }) =>
  rodarProcessoAgente("claude", argumentosClaude(prompt, modelo, maxTurnos, pasta), pasta, timeoutMs);
