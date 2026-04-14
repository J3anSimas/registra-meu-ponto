import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  OPENAI_ENABLED: 'openai_enabled',
  OPENAI_MODEL: 'openai_model',
  OPENAI_API_KEY: 'openai_api_key',
  OPENAI_IMAGE_QUALITY: 'openai_image_quality',
} as const;

export const OPENAI_MODELS = [
  { label: 'GPT-4o Mini (recomendado)', value: 'gpt-4o-mini' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-4.1 Mini', value: 'gpt-4.1-mini' },
  { label: 'GPT-4.1', value: 'gpt-4.1' },
] as const;

export type OpenAIModel = (typeof OPENAI_MODELS)[number]['value'];

export const IMAGE_QUALITY_OPTIONS = [
  { label: '50% — Menor tamanho', value: 0.5 },
  { label: '70% — Balanceado', value: 0.7 },
  { label: '80% — Recomendado', value: 0.8 },
  { label: '90% — Alta qualidade', value: 0.9 },
  { label: '100% — Máxima qualidade', value: 1.0 },
] as const;

export type ImageQuality = (typeof IMAGE_QUALITY_OPTIONS)[number]['value'];

export type OpenAISettings = {
  enabled: boolean;
  model: OpenAIModel;
  apiKey: string;
  imageQuality: ImageQuality;
};

export async function getOpenAISettings(): Promise<OpenAISettings> {
  const [enabled, model, apiKey, imageQuality] = await Promise.all([
    AsyncStorage.getItem(KEYS.OPENAI_ENABLED),
    AsyncStorage.getItem(KEYS.OPENAI_MODEL),
    SecureStore.getItemAsync(KEYS.OPENAI_API_KEY),
    AsyncStorage.getItem(KEYS.OPENAI_IMAGE_QUALITY),
  ]);

  return {
    enabled: enabled === 'true',
    model: (model as OpenAIModel) ?? 'gpt-4o-mini',
    apiKey: apiKey ?? '',
    imageQuality: (imageQuality ? parseFloat(imageQuality) : 0.8) as ImageQuality,
  };
}

export async function saveOpenAISettings(settings: OpenAISettings): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.OPENAI_ENABLED, String(settings.enabled)),
    AsyncStorage.setItem(KEYS.OPENAI_MODEL, settings.model),
    SecureStore.setItemAsync(KEYS.OPENAI_API_KEY, settings.apiKey),
    AsyncStorage.setItem(KEYS.OPENAI_IMAGE_QUALITY, String(settings.imageQuality)),
  ]);
}
