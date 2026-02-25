import { Stack } from 'expo-router';

export default function DateLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen
                name="[id]"
                options={{
                    title: 'Imagem',
                    headerBackTitle: 'Voltar',
                    headerTransparent: true,
                    headerTintColor: '#fff',
                }}
            />
        </Stack>
    );
}
