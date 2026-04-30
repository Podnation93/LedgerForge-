export function redactSensitiveText(input: string): string {
  return input
    .replace(/\b\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/g, '[ABN]')
    .replace(/\b\d{3}-?\d{3}\b/g, '[BSB]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
    .replace(/\b(?:\+?61|0)4\d{2}\s?\d{3}\s?\d{3}\b/g, '[PHONE]')
}
