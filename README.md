# Registra Meu Ponto

> Aplicativo mobile para registro de ponto eletrônico com reconhecimento automático via câmera.

![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-54-000020?logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-local-003B57?logo=sqlite&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-Vision-412991?logo=openai&logoColor=white)

---

## O problema

Trabalhadores precisam registrar manualmente a data e hora exibidas no display do relógio de ponto — um processo sujeito a erros e esquecimentos. Este app automatiza esse fluxo: o usuário fotografa o comprovante e o app extrai os dados automaticamente.

---

## Funcionalidades

- **Captura via câmera** com `expo-camera`, sem sons de obturador
- **Reconhecimento automático** de data e hora do comprovante de ponto
- **Dois modos de OCR** — on-device com ML Kit ou via OpenAI Vision (configurável)
- **Pré-processamento de imagem** com Skia: escala de cinza + boost de contraste para melhorar a precisão do OCR
- **Indicador de confiança** (0–100%) colorido por faixa para cada leitura
- **Edição manual** antes de confirmar, com formatação automática dos campos
- **Armazenamento local** em SQLite — funciona 100% offline
- **Histórico agrupado por data** com busca e pull-to-refresh
- **Visualização e compartilhamento** da imagem original de cada registro
- **Suporte a tema** claro e escuro

---

## Pipeline de OCR

O app implementa dois caminhos de reconhecimento, selecionáveis nas configurações:

### Modo local (padrão — sem custo, sem internet)

```
Foto → Pré-processamento Skia → ML Kit OCR → Extração por regex → Formulário
```

1. **Pré-processamento com Skia** (`src/services/image-preprocess.ts`): a imagem é convertida para escala de cinza e tem o contraste aumentado em 60% via matrizes de cor aplicadas em uma superfície offscreen. Se a imagem for menor que 1500px na maior dimensão, é ampliada 2×.
2. **ML Kit OCR** (`react-native-mlkit-ocr`): reconhecimento on-device, sem envio de dados para servidores externos.
3. **Extração por regex**: padrões strict e loose para datas (`DD/MM/YYYY`) e horas (`HH:MM`), com cálculo de confiança baseado no tipo de match obtido.

### Modo OpenAI Vision (maior precisão)

```
Foto → Pré-processamento Skia → Compressão JPEG → GPT-4o/4.1 → JSON estruturado → Formulário
```

1. O mesmo pré-processamento Skia é aplicado antes do envio.
2. A imagem é comprimida para JPEG (qualidade configurável de 50% a 100%) e codificada em base64.
3. Um prompt especializado instrui o modelo a lidar com quebras de linha do display matricial do relógio de ponto — onde o ano pode ser dividido entre duas linhas (ex.: `"20"` + `"26"`).
4. A resposta é parseada como JSON estruturado com `data`, `hora` e `confianca`.
5. A chave da API é armazenada com `expo-secure-store` (Keychain/Keystore nativo).

---

## Stack Tecnológica

| Camada | Tecnologia | Detalhe |
|---|---|---|
| Framework | React Native 0.81 + Expo 54 | Nova Arquitetura ativa (`newArchEnabled: true`) |
| Linguagem | TypeScript 5.9 | Strict mode |
| Navegação | Expo Router 6 | Rotas tipadas, file-based routing |
| Compilador | React Compiler | `experiments.reactCompiler: true` |
| Dados | TanStack Query v5 | Cache, invalidação e pull-to-refresh |
| Banco | expo-sqlite | SQLite local, FTS e SQLCipher habilitados |
| Gráficos/Imagem | React Native Skia | Pré-processamento de imagem offscreen |
| OCR local | react-native-mlkit-ocr | Google ML Kit, on-device |
| OCR em nuvem | OpenAI API (GPT-4o/4.1) | Vision com prompt estruturado |
| Segurança | expo-secure-store | API key no Keychain/Keystore nativo |
| Animações | react-native-reanimated 4 | Worklets nativos |

---

## Arquitetura

O projeto segue uma estrutura de camadas clara, sem gerenciamento de estado global — cada tela gerencia seu próprio estado local via hooks:

```
app/                    → Rotas (Expo Router, file-based)
src/
  components/           → Componentes reutilizáveis com suporte a tema
  db/                   → Camada de acesso ao SQLite (CRUD + tipos)
  hooks/                → React Query hooks por entidade
  services/             → Lógica de negócio desacoplada da UI
    image-preprocess.ts → Pipeline Skia
    ocr.ts              → ML Kit + extração por regex
    openai.ts           → Integração OpenAI Vision
    settings.ts         → Persistência de configurações
  constants/            → Tema de cores e fontes
  common/               → Utilitários (UUID com polyfill expo-crypto)
```

**Decisões de design:**
- `TanStack Query` gerencia o cache do SQLite, eliminando re-fetches desnecessários e entregando pull-to-refresh sem boilerplate
- `expo-secure-store` garante que a chave da OpenAI nunca fique em `AsyncStorage` plano
- O pré-processamento com Skia acontece antes de qualquer OCR — tanto local quanto em nuvem — centralizando a lógica de preparação de imagem em um único serviço
- Rotas tipadas com Expo Router eliminam erros de navegação em tempo de compilação

---

## Como rodar

```bash
# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento
npm start

# Rodar no Android (requer Android Studio)
npm run android

# Rodar no iOS (requer Xcode, apenas macOS)
npm run ios
```

> **Nota:** `react-native-mlkit-ocr` e `@shopify/react-native-skia` requerem build nativo — não funcionam no Expo Go. Use o `expo-dev-client` (já incluso nas dependências).

### Configurando o OCR com OpenAI

Nas configurações do app, habilite o modo OpenAI e informe sua chave de API. A chave é armazenada com segurança no Keychain (iOS) ou Keystore (Android).

Modelos suportados: `gpt-4o-mini` (recomendado), `gpt-4o`, `gpt-4.1-mini`, `gpt-4.1`.

---

## Banco de Dados

```sql
CREATE TABLE time_entries (
  id         TEXT PRIMARY KEY NOT NULL,
  date       TEXT NOT NULL,        -- DD/MM/YYYY
  hour       TEXT NOT NULL,        -- HH:MM
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  file_path  TEXT                  -- URI absoluta da imagem no dispositivo
)
```

---

## Licença

Projeto pessoal — uso livre para fins de aprendizado e referência.
