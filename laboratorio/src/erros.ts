export class ErroDominio extends Error {
  codigo: string;

  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.name = "ErroDominio";
    this.codigo = codigo;
  }
}
