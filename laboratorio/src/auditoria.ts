type Registro = { acao: string; dados: object };

const registros: Registro[] = [];

export function registrarAuditoria(acao: string, dados: object): void {
  registros.push({ acao, dados });
}

export function lerAuditoria(): Registro[] {
  return [...registros];
}

export function limparAuditoria(): void {
  registros.length = 0;
}
