import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  OPENAI_ENABLED: 'openai_enabled',
  OPENAI_MODEL: 'openai_model',
  OPENAI_API_KEY: 'openai_api_key',
} as const;

export const OPENAI_MODELS = [
  { label: 'GPT-4o Mini (recomendado)', value: 'gpt-4o-mini' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-4.1 Mini', value: 'gpt-4.1-mini' },
  { label: 'GPT-4.1', value: 'gpt-4.1' },
] as const;

export type OpenAIModel = (typeof OPENAI_MODELS)[number]['value'];

export type OpenAISettings = {
  enabled: boolean;
  model: OpenAIModel;
  apiKey: string;
};

export async function getOpenAISettings(): Promise<OpenAISettings> {
  const [enabled, model, apiKey] = await Promise.all([
    AsyncStorage.getItem(KEYS.OPENAI_ENABLED),
    AsyncStorage.getItem(KEYS.OPENAI_MODEL),
    SecureStore.getItemAsync(KEYS.OPENAI_API_KEY),
  ]);

  return {
    enabled: enabled === 'true',
    model: (model as OpenAIModel) ?? 'gpt-4o-mini',
    apiKey: apiKey ?? '',
  };
}

export async function saveOpenAISettings(settings: OpenAISettings): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.OPENAI_ENABLED, String(settings.enabled)),
    AsyncStorage.setItem(KEYS.OPENAI_MODEL, settings.model),
    SecureStore.setItemAsync(KEYS.OPENAI_API_KEY, settings.apiKey),
  ]);
}
