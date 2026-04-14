import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/src/components/themed-text';
import { ThemedTextInput } from '@/src/components/themed-text-input';
import { ThemedView } from '@/src/components/themed-view';
import { useThemeColor } from '@/src/hooks/use-theme-color';
import {
  IMAGE_QUALITY_OPTIONS,
  ImageQuality,
  OPENAI_MODELS,
  OpenAIModel,
  getOpenAISettings,
  saveOpenAISettings,
} from '@/src/services/settings';

export default function SettingsScreen() {
  const tint = useThemeColor({}, 'tint');
  const icon = useThemeColor({}, 'icon');
  const background = useThemeColor({}, 'background');

  const [enabled, setEnabled] = useState(false);
  const [model, setModel] = useState<OpenAIModel>('gpt-4o-mini');
  const [apiKey, setApiKey] = useState('');
  const [imageQuality, setImageQuality] = useState<ImageQuality>(0.8);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getOpenAISettings().then((s) => {
        setEnabled(s.enabled);
        setModel(s.model);
        setApiKey(s.apiKey);
        setImageQuality(s.imageQuality);
      });
    }, [])
  );

  async function handleSave() {
    if (enabled && !apiKey.trim()) {
      Alert.alert('Chave obrigatória', 'Insira sua chave da API OpenAI para habilitar a funcionalidade.');
      return;
    }
    setSaving(true);
    try {
      await saveOpenAISettings({ enabled, model, apiKey: apiKey.trim(), imageQuality });
      Alert.alert('Configurações salvas', 'As configurações foram salvas com sucesso.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as configurações.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedText style={styles.header}>Configurações</ThemedText>

        {/* Seção OpenAI */}
        <ThemedText style={styles.sectionTitle}>Reconhecimento por IA (OpenAI)</ThemedText>

        <View style={[styles.card, { borderColor: icon + '33' }]}>
          {/* Toggle habilitar */}
          <View style={styles.row}>
            <View style={styles.rowText}>
              <ThemedText style={styles.label}>Habilitar análise por IA</ThemedText>
              <ThemedText style={[styles.hint, { color: icon }]}>
                Usa a API da OpenAI para extrair data e hora da foto
              </ThemedText>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ true: tint }}
              thumbColor="#fff"
            />
          </View>

          {enabled && (
            <>
              <View style={[styles.divider, { backgroundColor: icon + '22' }]} />

              {/* Seleção de modelo */}
              <ThemedText style={styles.label}>Modelo</ThemedText>
              <View style={styles.modelList}>
                {OPENAI_MODELS.map((m) => (
                  <TouchableOpacity
                    key={m.value}
                    style={[
                      styles.modelOption,
                      { borderColor: model === m.value ? tint : icon + '44' },
                      model === m.value && { backgroundColor: tint + '18' },
                    ]}
                    onPress={() => setModel(m.value)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modelRadio}>
                      <View
                        style={[
                          styles.radioOuter,
                          { borderColor: model === m.value ? tint : icon },
                        ]}
                      >
                        {model === m.value && (
                          <View style={[styles.radioInner, { backgroundColor: tint }]} />
                        )}
                      </View>
                    </View>
                    <ThemedText
                      style={[
                        styles.modelLabel,
                        model === m.value && { color: tint, fontWeight: '600' },
                      ]}
                    >
                      {m.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.divider, { backgroundColor: icon + '22' }]} />

              {/* Qualidade da imagem */}
              <ThemedText style={styles.label}>Qualidade da imagem</ThemedText>
              <ThemedText style={[styles.hint, { color: icon }]}>
                Imagens maiores melhoram o reconhecimento, mas aumentam o tempo e o custo
              </ThemedText>
              <View style={styles.modelList}>
                {IMAGE_QUALITY_OPTIONS.map((q) => (
                  <TouchableOpacity
                    key={q.value}
                    style={[
                      styles.modelOption,
                      { borderColor: imageQuality === q.value ? tint : icon + '44' },
                      imageQuality === q.value && { backgroundColor: tint + '18' },
                    ]}
                    onPress={() => setImageQuality(q.value)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modelRadio}>
                      <View style={[styles.radioOuter, { borderColor: imageQuality === q.value ? tint : icon }]}>
                        {imageQuality === q.value && (
                          <View style={[styles.radioInner, { backgroundColor: tint }]} />
                        )}
                      </View>
                    </View>
                    <ThemedText
                      style={[
                        styles.modelLabel,
                        imageQuality === q.value && { color: tint, fontWeight: '600' },
                      ]}
                    >
                      {q.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.divider, { backgroundColor: icon + '22' }]} />

              {/* Chave da API */}
              <ThemedText style={styles.label}>Chave da API</ThemedText>
              <ThemedText style={[styles.hint, { color: icon }]}>
                Armazenada de forma segura no dispositivo
              </ThemedText>
              <ThemedTextInput
                style={styles.input}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="sk-..."
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          )}
        </View>

        {/* Botão salvar */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: tint }, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.saveButtonText}>
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    paddingTop: 60,
    gap: 12,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.5,
    marginTop: 8,
    marginBottom: 4,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    opacity: 0.8,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  modelList: {
    gap: 8,
    marginTop: 4,
  },
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  modelRadio: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modelLabel: {
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  saveButton: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
