import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import type { OpenAIModel } from './settings';

export type OpenAIExtractionResult = {
  data: string | null;
  hora: string | null;
  confianca: number;
};

const PROMPT =
  'You are analyzing a time clock display photo from a Brazilian workplace. ' +
  'Extract the date and time shown on the display. ' +
  'Return ONLY a valid JSON object with these exact keys: ' +
  '"data" (format DD/MM/YYYY), "hora" (format HH:MM), ' +
  '"confianca" (integer 0-100 representing your confidence in the extraction). ' +
  'If you cannot determine a value, use null for that field.';

async function compressImageToBase64(uri: string): Promise<string> {
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
  );
  const file = new File(compressed.uri);
  return file.base64();
}

export async function extractFromImageWithOpenAI(
  imageUri: string,
  apiKey: string,
  model: OpenAIModel,
  onStep?: (step: number) => void
): Promise<OpenAIExtractionResult> {
  onStep?.(0);
  const base64 = await compressImageToBase64(imageUri);

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
  const outputText: string = json.output_text ?? '';

  const jsonMatch = outputText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Resposta da OpenAI não contém JSON válido');
  }

  const parsed = JSON.parse(jsonMatch[0]) as OpenAIExtractionResult;
  return parsed;
}
