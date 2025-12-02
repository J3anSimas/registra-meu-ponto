import { v4 as uuidv4 } from "uuid"

// Polyfill para crypto.getRandomValues() que é necessário para o uuid funcionar no React Native
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.getRandomValues) {
    // Tenta usar expo-crypto se disponível
    let expoCrypto: { getRandomValues: (buffer: Uint8Array) => void } | null = null

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        expoCrypto = require("expo-crypto")
    } catch {
        // expo-crypto não disponível, será usado fallback
    }

    // Cria polyfill para crypto.getRandomValues
    if (!globalThis.crypto) {
        (globalThis as any).crypto = {} as Crypto
    }

    if (!globalThis.crypto.getRandomValues) {
        globalThis.crypto.getRandomValues = <T extends ArrayBufferView>(array: T): T => {
            if (expoCrypto && array instanceof Uint8Array) {
                try {
                    expoCrypto.getRandomValues(array)
                    return array
                } catch {
                    // Se falhar, usa fallback
                }
            }

            // Fallback: usa Math.random (menos seguro, mas funciona)
            const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
            for (let i = 0; i < view.length; i++) {
                view[i] = Math.floor(Math.random() * 256)
            }
            return array
        }
    }
}

export const v4 = () => {
    return uuidv4()
}