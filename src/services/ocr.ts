import MlkitOcr from 'react-native-mlkit-ocr';

export type OcrExtractionResult = {
  data: string | null;
  hora: string | null;
  confianca: number;
  rawText: string;
};

/**
 * Valida uma data em DD/MM/YYYY: usada tanto na validação do formulário quanto para
 * descartar leituras absurdas do OCR (ex.: "00/00/1400") na autodetecção.
 *
 * @example isValidDate('30/06/2026') // true
 */
export function isValidDate(date: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return false;
  const [day, month, year] = date.split('/').map(Number);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

const DATE_STRICT = /(\d{2}\/\d{2}\/\d{4})/;
const DATE_LOOSE = /(\d{1,2})[^\d](\d{1,2})[^\d](\d{2,4})/;
const HOUR_STRICT = /(\d{2}:\d{2})/;
const HOUR_LOOSE = /(\d{2})\s*[:.]\s*(\d{2})/;

function extractDate(text: string): string | null {
  // No comprovante impresso o ano costuma quebrar de linha ("DATA:30/06/20\n26 HORA:..."),
  // o que faria o regex ler 2020 em vez de 2026. Compactar o whitespace remonta "30/06/2026"
  // e só então tentamos o casamento estrito (apenas a data tem barras, então é seguro).
  const compactStrict = text.replace(/\s+/g, '').match(DATE_STRICT);
  if (compactStrict) return compactStrict[1];
  const strict = text.match(DATE_STRICT);
  if (strict) return strict[1];
  const loose = text.match(DATE_LOOSE);
  if (loose) {
    const [, d, m, y] = loose;
    const year = y.length === 2 ? `20${y}` : y.padStart(4, '0');
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${year}`;
  }
  return null;
}

function extractHour(text: string): string | null {
  const strict = text.match(HOUR_STRICT);
  if (strict) return strict[1];
  const loose = text.match(HOUR_LOOSE);
  if (loose) return `${loose[1]}:${loose[2]}`;
  return null;
}

function computeConfidence(hasDate: boolean, hasHour: boolean, matchedStrict: boolean): number {
  if (hasDate && hasHour) return matchedStrict ? 95 : 75;
  if (hasDate || hasHour) return 50;
  return 0;
}

export async function extractFromImageLocally(
  preprocessedUri: string
): Promise<OcrExtractionResult> {
  const ocrResult = await MlkitOcr.detectFromUri(preprocessedUri);

  const rawText = ocrResult
    .map((block) => block.lines.map((line) => line.text).join('\n'))
    .join('\n');

  const data = extractDate(rawText);
  const hora = extractHour(rawText);
  const matchedStrict = DATE_STRICT.test(rawText) && HOUR_STRICT.test(rawText);
  const confianca = computeConfidence(!!data, !!hora, matchedStrict);

  return { data, hora, confianca, rawText };
}
