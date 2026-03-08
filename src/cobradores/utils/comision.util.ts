export const normalizeComisionPorcentaje = (porcentaje: number): number => {
  if (!Number.isFinite(porcentaje)) {
    return 0;
  }

  if (porcentaje > 1) {
    return porcentaje / 100;
  }

  return porcentaje;
};
