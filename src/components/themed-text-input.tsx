import { TextInput, type TextInputProps, type TextStyle } from 'react-native';

import { useThemeColor } from '@/src/hooks/use-theme-color';

export type ThemedTextInputProps = TextInputProps & {
    lightTextColor?: string;
    darkTextColor?: string;
    lightBackgroundColor?: string;
    darkBackgroundColor?: string;
    lightBorderColor?: string;
    darkBorderColor?: string;
    lightPlaceholderColor?: string;
    darkPlaceholderColor?: string;
};

export function ThemedTextInput({
    style,
    lightTextColor,
    darkTextColor,
    lightBackgroundColor,
    darkBackgroundColor,
    lightBorderColor,
    darkBorderColor,
    lightPlaceholderColor,
    darkPlaceholderColor,
    placeholderTextColor,
    ...rest
}: ThemedTextInputProps) {
    const textColor = useThemeColor({ light: lightTextColor, dark: darkTextColor }, 'text');
    const backgroundColor = useThemeColor({ light: lightBackgroundColor, dark: darkBackgroundColor }, 'background');
    const borderColor = useThemeColor({ light: lightBorderColor, dark: darkBorderColor }, 'icon');
    const defaultPlaceholderColor = useThemeColor({ light: lightPlaceholderColor, dark: darkPlaceholderColor }, 'icon');

    // Remove propriedades de cor dos estilos customizados para garantir que o tema sempre seja aplicado
    const hasExplicitTextColor = !!(lightTextColor || darkTextColor);
    const hasExplicitBackgroundColor = !!(lightBackgroundColor || darkBackgroundColor);
    const hasExplicitBorderColor = !!(lightBorderColor || darkBorderColor);

    const customStyle = style
        ? (Array.isArray(style)
            ? style.map(s => {
                if (s && typeof s === 'object') {
                    const {
                        color: _,
                        backgroundColor: __,
                        borderColor: ___,
                        ...restStyle
                    } = s as TextStyle;
                    return restStyle;
                }
                return s;
            })
            : (() => {
                const {
                    color: _,
                    backgroundColor: __,
                    borderColor: ___,
                    ...restStyle
                } = style as TextStyle;
                return restStyle;
            })())
        : style;

    return (
        <TextInput
            style={[
                customStyle,
                !hasExplicitTextColor ? { color: textColor } : undefined,
                !hasExplicitBackgroundColor ? { backgroundColor } : undefined,
                !hasExplicitBorderColor ? { borderColor } : undefined,
            ]}
            placeholderTextColor={placeholderTextColor || defaultPlaceholderColor}
            {...rest}
        />
    );
}

