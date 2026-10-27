export type Centavos = number;

export function formatarCentavos(c: Centavos): string {
  const reais = Math.floor(c / 100);
  const resto = String(c % 100).padStart(2, "0");
  return `R$ ${reais},${resto}`;
}
