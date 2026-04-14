import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Button, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { ThemedTextInput } from '@/src/components/themed-text-input';
import { ThemedView } from '@/src/components/themed-view';
import { AiLoadingOverlay } from '@/src/components/ai-loading-overlay';
import { useThemeColor } from '@/src/hooks/use-theme-color';
import { Asset } from "expo-asset";
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Directory, File, Paths } from "expo-file-system";

import { v4 } from '@/src/common/uuid';
import { useRef, useState } from 'react';
import { useCreateTimeEntry } from '@/src/hooks/use-time-entries';
import MlkitOcr, { MlkitOcrResult } from 'react-native-mlkit-ocr';
import { getOpenAISettings } from '@/src/services/settings';
import { extractFromImageWithOpenAI } from '@/src/services/openai';


const USE_MOCK = false;
// const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK_CAMERA === "true";

function fixHourFormat(rawText: string) {
    const horaRegex = /(\d{2})\s*[:.]\s*(\d{2})/;
    const match = rawText.match(horaRegex);
    if (match) {
        return `${match[1]}:${match[2]}`;
    }
    return null;
}

function fixDateFormat(rawText: string) {
    const dataRegex = /(\d{1,2})[^\d](\d{1,2})[^\d](\d{2,4})/;
    const match = rawText.match(dataRegex);
    if (match) {
        return `${match[1]}/${match[2]}/${match[3]}`;
    }
    return null;
}

function isValidDate(date: string): boolean {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return false;
    const [day, month, year] = date.split('/').map(Number);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const daysInMonth = new Date(year, month, 0).getDate();
    return day <= daysInMonth;
}

function isValidHour(hour: string): boolean {
    if (!/^\d{2}:\d{2}$/.test(hour)) return false;
    const [h, m] = hour.split(':').map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function formatDateInput(text: string): string {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatHourInput(text: string): string {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

async function mockTakePicture() {
    try {
        const asset = Asset.fromModule(require("../../src/assets/mock/sample.jpg"));
        await asset.downloadAsync();
        const output = new File(Paths.cache, "mock-photo.jpg");
        try { output.delete(); } catch { }
        const source = new File(asset.localUri!);
        await source.copy(output);
        return { uri: output.uri, width: asset.width ?? 1080, height: asset.height ?? 1920 };
    } catch (error) {
        console.log(error);
    }
}

type StepStatus = 'pending' | 'active' | 'done';
type Step = { label: string; status: StepStatus };

const AI_STEP_LABELS = [
    'Preparando imagem...',
    'Enviando para análise...',
    'Processando resultado...',
];

function makeSteps(activeIndex: number): Step[] {
    return AI_STEP_LABELS.map((label, i) => ({
        label,
        status: i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending',
    }));
}

function getConfiancaColor(confianca: number): string {
    if (confianca >= 80) return '#22c55e';
    if (confianca >= 50) return '#f59e0b';
    return '#ef4444';
}

export default function HomeScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView | null>(null);
    const [date, setDate] = useState('');
    const [hour, setHour] = useState('');
    const [uri, setUri] = useState('');
    const [result, setResult] = useState<MlkitOcrResult | undefined>();
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [cameraKey, setCameraKey] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [showAiLoading, setShowAiLoading] = useState(false);
    const [aiSteps, setAiSteps] = useState<Step[]>(makeSteps(0));
    const [aiConfianca, setAiConfianca] = useState<number | null>(null);
    const [fallbackNote, setFallbackNote] = useState<string | null>(null);

    const createEntryMutation = useCreateTimeEntry();
    const isSaving = createEntryMutation.isPending;
    const tintColor = useThemeColor({}, 'tint');
    const borderColor = useThemeColor({}, 'icon');

    function resetData() {
        setUri('');
        setResult(undefined);
        setShowConfirmation(false);
        setDate('');
        setHour('');
        setCameraKey(prev => prev + 1);
        setIsLoading(false);
        setShowAiLoading(false);
        setAiConfianca(null);
        setFallbackNote(null);
    }

    async function processImageWithOcr(imageUri: string) {
        const ocrResult = await MlkitOcr.detectFromUri(imageUri);
        setResult(ocrResult);
        const joinedLines = ocrResult.map(block =>
            block.lines.map(line => line.text).join('')
        ).join('');
        console.log(joinedLines);
        const formattedDate = fixDateFormat(joinedLines);
        if (formattedDate) setDate(formattedDate);
        const formattedHour = fixHourFormat(joinedLines);
        if (formattedHour) setHour(formattedHour);
    }

    if (!permission) {
        return <ThemedView />;
    }

    if (!permission.granted) {
        return (
            <ThemedView style={styles.takePictureContainer}>
                <ThemedText>Precisamos de permissão para usar a câmera</ThemedText>
                <Button onPress={requestPermission} title="Permitir" />
            </ThemedView>
        );
    }

    async function handleTakePicture() {
        if (cameraRef.current && !isLoading) {
            setIsLoading(true);
            try {
                let photoUri: string;

                if (USE_MOCK) {
                    const photo = await mockTakePicture();
                    if (!photo) { setIsLoading(false); return; }
                    photoUri = photo.uri;
                    setUri(photoUri);
                    setDate('27/11/2025');
                    setHour('13:01');
                    setShowConfirmation(true);
                    return;
                }

                const photo = await cameraRef.current.takePictureAsync({
                    quality: 1,
                    shutterSound: false,
                });
                photoUri = photo.uri;
                setUri(photoUri);

                const settings = await getOpenAISettings();

                if (settings.enabled && settings.apiKey) {
                    setShowAiLoading(true);
                    setAiSteps(makeSteps(0));
                    try {
                        const aiResult = await extractFromImageWithOpenAI(
                            photoUri,
                            settings.apiKey,
                            settings.model,
                            settings.imageQuality,
                            (step) => setAiSteps(makeSteps(step))
                        );
                        setShowAiLoading(false);
                        if (aiResult.data) setDate(aiResult.data);
                        if (aiResult.hora) setHour(aiResult.hora);
                        setAiConfianca(aiResult.confianca ?? null);
                        setShowConfirmation(true);
                    } catch (aiError: any) {
                        console.error('OpenAI falhou:', aiError);
                        setShowAiLoading(false);
                        const errorMsg = aiError?.message ?? String(aiError);
                        setFallbackNote(`IA indisponível (${errorMsg.slice(0, 80)}). Usando OCR local.`);
                        await processImageWithOcr(photoUri);
                        setShowConfirmation(true);
                    }
                } else {
                    await processImageWithOcr(photoUri);
                    setShowConfirmation(true);
                }
            } catch (error) {
                console.error('Erro ao processar foto:', error);
            } finally {
                setIsLoading(false);
            }
        }
    }

    async function handleSave() {
        if (!date || !hour) {
            Alert.alert('Erro', 'Data e hora são obrigatórias');
            return;
        }
        if (!isValidDate(date)) {
            Alert.alert('Data inválida', 'Informe a data no formato DD/MM/AAAA com valores válidos.');
            return;
        }
        if (!isValidHour(hour)) {
            Alert.alert('Hora inválida', 'Informe a hora no formato HH:MM com valores válidos.');
            return;
        }
        if (!uri) {
            Alert.alert('Erro', 'Imagem é obrigatória');
            return;
        }
        if (isSaving) return;

        try {
            const id = v4();
            const folder = new Directory(Paths.document, 'time_entries');
            if (!folder.exists) {
                await folder.create({ intermediates: true, idempotent: true });
            }
            const destinationFile = new File(folder, `${id}.jpg`);
            if (destinationFile.exists) {
                await destinationFile.delete();
            }
            const sourceFile = new File(uri);
            if (!sourceFile.exists) {
                throw new Error('A imagem capturada não pôde ser localizada.');
            }
            await sourceFile.copy(destinationFile);

            const timeEntry = await createEntryMutation.mutateAsync({
                id,
                date,
                hour,
                file_path: destinationFile.uri,
                created_at: new Date(),
            });
            console.log(timeEntry);
            resetData();
            Alert.alert('Sucesso', 'Registro salvo com sucesso!');
        } catch (error: any) {
            console.error('Erro ao salvar:', error);
            Alert.alert('Erro', error?.message ?? 'Erro desconhecido ao salvar');
        }
    }

    return (
        showConfirmation ? (
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
            >
                <ThemedView style={styles.pictureTakenContainer}>
                    <View style={styles.imageContainer}>
                        <Pressable style={[styles.resetButton, { backgroundColor: 'rgba(255,255,255,0.85)' }]} onPress={resetData}>
                            <Ionicons name="refresh-outline" size={24} color="black" />
                        </Pressable>
                        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                    </View>

                    {aiConfianca !== null && (
                        <View style={[styles.confiancaBadge, { backgroundColor: getConfiancaColor(aiConfianca) + '22', borderColor: getConfiancaColor(aiConfianca) }]}>
                            <ThemedText style={[styles.confiancaText, { color: getConfiancaColor(aiConfianca) }]}>
                                Confiança da IA: {aiConfianca}%
                            </ThemedText>
                        </View>
                    )}

                    {fallbackNote && (
                        <View style={[styles.fallbackBanner, { borderColor: '#f59e0b', backgroundColor: '#f59e0b22' }]}>
                            <Ionicons name="warning-outline" size={14} color="#f59e0b" />
                            <ThemedText style={[styles.fallbackText, { color: '#f59e0b' }]}>
                                {fallbackNote}
                            </ThemedText>
                        </View>
                    )}

                    <ThemedView style={[styles.form, { borderColor }]}>
                        <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.label}>Data:</ThemedText>
                            <ThemedTextInput
                                style={styles.input}
                                value={date}
                                onChangeText={(text) => setDate(formatDateInput(text))}
                                keyboardType="numeric"
                                maxLength={10}
                            />
                        </ThemedView>
                        <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.label}>Hora:</ThemedText>
                            <ThemedTextInput
                                style={styles.input}
                                value={hour}
                                onChangeText={(text) => setHour(formatHourInput(text))}
                                keyboardType="numeric"
                                maxLength={5}
                            />
                        </ThemedView>
                        <Pressable
                            style={[styles.button, { backgroundColor: tintColor }, isSaving && styles.buttonDisabled]}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <ThemedText style={styles.buttonText}>Salvar</ThemedText>
                            )}
                        </Pressable>
                    </ThemedView>
                </ThemedView>
            </KeyboardAvoidingView>
        ) : (
            <ThemedView style={styles.takePictureContainer}>
                <CameraView
                    key={cameraKey}
                    style={styles.camera}
                    facing="back"
                    ref={cameraRef}
                    mute={true}
                />
                {isLoading && !showAiLoading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#0a7ea4" />
                        <ThemedText style={styles.loadingText}>Processando imagem...</ThemedText>
                    </View>
                )}
                {showAiLoading && <AiLoadingOverlay steps={aiSteps} />}
                <Pressable
                    style={[styles.cameraButton, { backgroundColor: tintColor }, isLoading && styles.cameraButtonDisabled]}
                    onPress={handleTakePicture}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Ionicons name="camera" size={32} color="white" />
                    )}
                </Pressable>
            </ThemedView>
        )
    );
}

const styles = StyleSheet.create({
    pictureTakenContainer: {
        flexDirection: 'column',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 12
    },
    imageContainer: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: '50%',
        gap: 12
    },
    resetButton: {
        position: 'absolute',
        top: 5,
        right: 5,
        borderWidth: 1,
        borderRadius: 5,
        padding: 12,
        zIndex: 1000,
        backgroundColor: 'white'
    },
    confiancaBadge: {
        alignSelf: 'stretch',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        alignItems: 'center',
    },
    confiancaText: {
        fontSize: 13,
        fontWeight: '600',
    },
    fallbackBanner: {
        alignSelf: 'stretch',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    fallbackText: {
        fontSize: 12,
        flex: 1,
    },
    form: {
        borderWidth: 1,
        borderRadius: 5,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 6,
        width: '100%',
        padding: 12
    },
    formGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 6,
        width: '100%',
    },
    input: {
        height: 40,
        flex: 1,
        borderWidth: 1,
        padding: 10,
        borderRadius: 5
    },
    takePictureContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: '100%',
        height: '100%',
    },
    camera: {
        width: '100%',
        height: '100%',
    },
    label: {
        minWidth: 48,
    },
    button: {
        width: '100%',
        alignItems: 'center',
        padding: 10,
        borderRadius: 5,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    cameraButton: {
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
        borderRadius: 35,
        width: 70,
        height: 70,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
    },
    cameraButtonDisabled: {
        opacity: 0.5,
    },
});
