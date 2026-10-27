/**
 * Limpeza ao encerrar o processo (exit, Ctrl+C, SIGTERM do promptfoo): mata agentes vivos e apaga
 * cópias em andamento. Cada limpeza é síncrona; roda na ordem em que foi registrada.
 */
const limpezas = new Set<() => void>();
let instalado = false;

function limparTudo(): void {
  for (const f of limpezas) {
    try {
      f();
    } catch {
      // segue para a próxima
    }
  }
}

function instalar(): void {
  if (instalado) return;
  instalado = true;
  process.on("exit", limparTudo);
  for (const sinal of ["SIGINT", "SIGTERM"] as const) {
    process.once(sinal, () => {
      limparTudo();
      // sem outro ouvinte, refaz o comportamento padrão (sair pelo sinal)
      if (process.listenerCount(sinal) === 0) process.kill(process.pid, sinal);
    });
  }
}

/** Registra uma limpeza; devolve a função que a desregistra. */
export function aoEncerrar(f: () => void): () => void {
  instalar();
  limpezas.add(f);
  return () => limpezas.delete(f);
}

/** Para testes: roda as limpezas registradas agora. */
export function rodarLimpezas(): void {
  limparTudo();
}
