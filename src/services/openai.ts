import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import type { OpenAIModel } from './settings';

export type OpenAIExtractionResult = {
  data: string | null;
  hora: string | null;
  confianca: number;
};

const PROMPT =
  'You are analyzing a Brazilian worker time clock receipt ("Comprovante de Registro de Ponto do Trabalhador"). ' +
  'Extract the values of the labeled fields "DATA" and "HORA". ' +
  'CRITICAL RULE — line wrapping: the receipt printer wraps text mid-word and mid-number. ' +
  'The date year is 4 digits (e.g. 2026) but the printer may break it across two lines, printing "20" at the end of one line and "26" at the start of the next. ' +
  'You MUST read across line breaks to reconstruct the full value. ' +
  'For example, if you see "DATA:08/04/20" on one line and "26 HORA:..." on the next, the date is 08/04/2026, NOT 08/04/2020. ' +
  'Never assume a 2-digit year — always look at the next line to complete it to 4 digits if needed. ' +
  'Also ignore all other numbers on the receipt (NSR, PIS, CNPJ, CEI, NREP, AD codes, etc.). ' +
  'Return ONLY a valid JSON object with exactly these keys: ' +
  '"data" (string DD/MM/YYYY or null), "hora" (string HH:MM or null), ' +
  '"confianca" (integer 0-100 representing your confidence). ' +
  'Example: {"data":"08/04/2026","hora":"12:57","confianca":98}';

async function compressImageToBase64(uri: string, quality: number): Promise<string> {
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );
  const file = new File(compressed.uri);
  return file.base64();
}

export async function extractFromImageWithOpenAI(
  imageUri: string,
  apiKey: string,
  model: OpenAIModel,
  imageQuality: number,
  onStep?: (step: number) => void
): Promise<OpenAIExtractionResult> {
  onStep?.(0);
  const base64 = await compressImageToBase64(imageUri, imageQuality);

  onStep?.(1);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: PROMPT,
            },
            {
              type: 'input_image',
              image_url: `data:image/jpeg;base64,${base64}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
  }

  onStep?.(2);
  const json = await response.json();

  // output_text é um atalho no top-level; fallback para output[].content[].text
  const outputText: string =
    json.output_text ??
    json.output?.[0]?.content?.[0]?.text ??
    '';

  if (!outputText) {
    throw new Error(`Resposta vazia da OpenAI. Estrutura recebida: ${JSON.stringify(json).slice(0, 200)}`);
  }

  const jsonMatch = outputText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`JSON não encontrado na resposta: "${outputText.slice(0, 200)}"`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as OpenAIExtractionResult;
  return parsed;
}
