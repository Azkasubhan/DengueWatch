export function cleanSimulationText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/\s*\(?Simulasi\)?/gi, "")
    .replace(/\s*·\s*Data\s+simulasi/gi, "")
    .replace(/\s*-\s*Data\s+simulasi/gi, "")
    .trim();
}
