import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { useThemeColor } from '@/src/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
    lightColor?: string;
    darkColor?: string;
    type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
    style,
    lightColor,
    darkColor,
    type = 'default',
    ...rest
}: ThemedTextProps) {
    const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

    // Remove a propriedade 'color' dos estilos customizados para garantir que o tema sempre seja aplicado
    // Exceto para o tipo 'link' que tem uma cor específica, ou quando há cores explícitas via props
    const hasExplicitColor = !!(lightColor || darkColor);
    const shouldRemoveColorFromStyle = type !== 'link' && !hasExplicitColor;
    
    const customStyle = shouldRemoveColorFromStyle && style
        ? (Array.isArray(style) 
            ? style.map(s => {
                if (s && typeof s === 'object') {
                    const { color: _, ...restStyle } = s as TextStyle;
                    return restStyle;
                }
                return s;
            })
            : (() => {
                const { color: _, ...restStyle } = style as TextStyle;
                return restStyle;
            })())
        : style;

    return (
        <Text
            style={[
                type === 'default' ? styles.default : undefined,
                type === 'title' ? styles.title : undefined,
                type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
                type === 'subtitle' ? styles.subtitle : undefined,
                type === 'link' ? styles.link : undefined,
                customStyle,
                shouldRemoveColorFromStyle ? { color } : undefined,
            ]}
            {...rest}
        />
    );
}

const styles = StyleSheet.create({
    default: {
        fontSize: 16,
        lineHeight: 24,
    },
    defaultSemiBold: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '600',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        lineHeight: 32,
    },
    subtitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    link: {
        lineHeight: 30,
        fontSize: 16,
        color: '#0a7ea4',
    },
});
