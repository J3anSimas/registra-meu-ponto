import { Stack } from 'expo-router';

export default function ListLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen
                name="[date]"
                options={{
                    title: 'Registros do dia',
                    headerBackTitle: 'Voltar',
                }}
            />
        </Stack>
    );
}
