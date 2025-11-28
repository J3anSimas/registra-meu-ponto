import { Ionicons } from '@expo/vector-icons';
import { Button, Image, Pressable, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';


import { ThemedText } from '@/src/components/themed-text';
import { ThemedView } from '@/src/components/themed-view';
import { Asset } from "expo-asset";
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File, Paths } from "expo-file-system";

import { useRef, useState } from 'react';
import MlkitOcr, { MlkitOcrResult } from 'react-native-mlkit-ocr';


const USE_MOCK = true;
// const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK_CAMERA === "true";

function fixHourFormat(rawText: string) {
    const horaRegex = /(\d{2})[\.\:](\d{2})/;
    const match = rawText.match(horaRegex);

    if (match) {
        const horaCorrigida = `${match[1]}:${match[2]}`;
        return horaCorrigida;
    }
    return null;
}
function fixDateFormat(rawText: string) {
    const dataRegex = /(\d{1,2})[^\d](\d{1,2})[^\d](\d{2,4})/;
    const match = rawText.match(dataRegex);

    if (match) {
        const dataCorrigida = `${match[1]}/${match[2]}/${match[3]}`;
        return dataCorrigida;
    }
    return null;
}
async function mockTakePicture() {
    try {
        const asset = Asset.fromModule(require("../../src/assets/mock/sample.jpg"));

        await asset.downloadAsync();

        const output = new File(Paths.cache, "mock-photo.jpg");
        try {
            output.delete()
        } catch (error) {

        }
        const source = new File(asset.localUri!);
        await source.copy(output);
        console.log('Usando imagem mock')
        return {
            uri: output.uri,
            width: asset.width ?? 1080,
            height: asset.height ?? 1920,
        };
    } catch (error) {
        console.log(error)
    }
}


export default function HomeScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView | null>(null);
    const [data, setData] = useState('');
    const [hour, setHour] = useState('');
    const [uri, setUri] = useState('');
    const [result, setResult] = useState<MlkitOcrResult | undefined>();

    function resetData() {
        setUri('');
        setResult(undefined);
        setData('');
        setHour('');
    }

    async function processImage(uri: string,) {
        const resultFromUri = await MlkitOcr.detectFromUri(uri);
        setResult(resultFromUri);
        const joinedLines = resultFromUri.map(block =>
            block.lines.map(line => line.text).join('')
        ).join('')

        const formattedDate = fixDateFormat(joinedLines);
        if (formattedDate) {
            setData(formattedDate);
        }
        const formattedHour = fixHourFormat(joinedLines);
        if (formattedHour) {
            setHour(formattedHour);
        }
    }
    if (!permission) {
        return <ThemedView />;
    }

    if (!permission.granted) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText>Precisamos de permissão para usar a câmera</ThemedText>
                <Button onPress={requestPermission} title="Permitir" />
            </ThemedView>
        );
    }
    async function handleTakePicture() {
        if (cameraRef.current) {
            if (USE_MOCK) {
                const photo = await mockTakePicture();
                if (!photo) return
                setUri(photo.uri);
                await processImage(photo.uri)
            } else {
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 1,
                });

                setUri(photo.uri);
                await processImage(photo.uri)
            }
        }
    }


    return (
        result ? (
            <ThemedView style={styles.pictureTakenContainer}>
                <View style={styles.imageContainer}>
                    <Pressable style={styles.resetButton} onPress={resetData} >
                        <Ionicons name="refresh-outline" size={24} color="black" />
                    </Pressable>
                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                </View>
                <ThemedView style={styles.form}>
                    <ThemedView style={styles.formGroup}>
                        <ThemedText>Data:</ThemedText>
                        <TextInput style={styles.input} value={data} onChangeText={setData} />
                    </ThemedView>
                    <ThemedView style={styles.formGroup}>
                        <ThemedText>Hora:</ThemedText>
                        <TextInput style={styles.input} value={hour} onChangeText={setHour} />
                    </ThemedView>
                    <Pressable style={styles.button} onPress={resetData}>
                        <ThemedText style={styles.buttonText}>Salvar</ThemedText>
                    </Pressable>
                </ThemedView>
            </ThemedView>
        ) : (
            <ThemedView style={styles.container}>

                <CameraView style={styles.camera} facing="back" ref={cameraRef} />
                <ThemedView style={styles.buttonContainer}>
                    <TouchableOpacity style={styles.button} onPress={handleTakePicture}>
                        <ThemedText style={styles.text}>Tirar foto</ThemedText>
                    </TouchableOpacity>
                </ThemedView>
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
        // width: '100%',
        margin: 12,
        borderWidth: 1,
        padding: 10,
        borderRadius: 5
    },
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    camera: {
        width: 300,
        height: 300,
    },
    buttonContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginBottom: 20,
    },
    button: {
        width: '100%',
        alignItems: 'center',
        backgroundColor: 'blue',
        padding: 10,
        borderRadius: 5,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    text: {
        color: 'red'
    },
    message: {
        color: 'red'
    }
})

