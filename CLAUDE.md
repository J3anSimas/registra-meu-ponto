# CLAUDE.md — registra-meu-ponto

## Visão Geral

Aplicativo mobile para registro de ponto eletrônico. O usuário fotografa o display do relógio de ponto, o OCR extrai a data e hora automaticamente, e o registro é salvo localmente no dispositivo.

- **Plataformas:** Android, iOS, Web
- **Linguagem:** TypeScript (strict mode)
- **Framework:** React Native + Expo

---

## Stack Tecnológica

| Camada | Biblioteca | Versão |
|---|---|---|
| Core | React | 19.1.0 |
| Core | React Native | 0.81.5 |
| Runtime | Expo | 54.0.25 |
| Linguagem | TypeScript | 5.9.2 |
| Navegação | Expo Router | ~6.0.15 |
| Navegação | React Navigation | 7.1.8 |
| Navegação | Bottom Tabs | 7.4.0 |
| Câmera | expo-camera | ~17.0.9 |
| OCR | react-native-mlkit-ocr | ^0.3.0 |
| Banco de Dados | react-native-sqlite-storage | ^6.0.1 |
| Banco de Dados | expo-sqlite | ~16.0.9 |
| Arquivos | expo-file-system | ^19.0.19 |
| Compartilhamento | expo-sharing | ~14.0.8 |
| Animações | react-native-reanimated | ~4.1.1 |
| Gestos | react-native-gesture-handler | ~2.28.0 |
| Ícones | @expo/vector-icons | ^15.0.3 |
| IDs | uuid | ^13.0.0 |
| Criptografia | expo-crypto | ~15.0.7 |
| Haptic | expo-haptics | ~15.0.7 |
| Web | react-native-web | ~0.21.0 |
| Linter | ESLint | 9.25.0 |

---

## Estrutura de Diretórios

```
registra-meu-ponto/
├── app/                          # Expo Router — rotas baseadas em arquivo
│   ├── _layout.tsx               # Root layout: ThemeProvider + StatusBar
│   └── (tabs)/                   # Grupo de abas (bottom tabs)
│       ├── _layout.tsx           # Configuração das abas
│       ├── index.tsx             # Tela Home: câmera + OCR + formulário
│       └── list/                 # Seção de listagem
│           ├── _layout.tsx       # Stack navigator da lista
│           ├── index.tsx         # ListScreen: entradas agrupadas por data
│           └── [date]/           # Rota dinâmica por data
│               ├── _layout.tsx   # Stack navigator do detalhe
│               ├── index.tsx     # DateDetailScreen: entradas de uma data
│               └── [id].tsx      # ImageViewerScreen: visualizar/compartilhar imagem
├── src/
│   ├── assets/
│   │   ├── images/               # Ícones e splash screen
│   │   └── mock/                 # sample.jpg para testes com USE_MOCK=true
│   ├── common/
│   │   └── uuid.ts               # Geração de UUID v4 com polyfill expo-crypto
│   ├── components/
│   │   ├── themed-text.tsx       # Text com suporte a tema
│   │   ├── themed-view.tsx       # View com cor de fundo temática
│   │   ├── themed-text-input.tsx # TextInput com suporte a tema
│   │   ├── time-entry-card.tsx   # Card de registro (thumbnail + data/hora + delete)
│   │   ├── haptic-tab.tsx        # Botão de aba com feedback haptic (iOS)
│   │   ├── external-link.tsx     # Link externo
│   │   ├── parallax-scroll-view.tsx
│   │   └── ui/
│   │       ├── icon-symbol.tsx   # Ícones cross-platform (SF Symbols → Material)
│   │       └── collapsible.tsx
│   ├── constants/
│   │   └── theme.ts              # Paleta de cores light/dark e fontes por plataforma
│   ├── db/
│   │   ├── index.ts              # CRUD SQLite: setupDatabase, create, getAll, update, delete
│   │   └── models/
│   │       └── time-entries.ts   # Tipo TimeEntry
│   └── hooks/
│       ├── use-color-scheme.ts   # Re-export de useColorScheme do RN
│       ├── use-color-scheme.web.ts
│       └── use-theme-color.ts    # Retorna cor temática com override por componente
├── scripts/
│   └── reset-project.js
├── app.json                      # Configuração Expo (plugins, permissões, features)
├── package.json
├── tsconfig.json                 # Strict mode + alias @/* → ./*
└── eslint.config.js
```

---

## Banco de Dados

**Arquivo:** `timekeeper.db` (SQLite local)
**Módulo:** `react-native-sqlite-storage`
**Operações:** `src/db/index.ts`

### Tabela `time_entries`

```sql
CREATE TABLE time_entries (
  id        TEXT PRIMARY KEY NOT NULL,
  date      TEXT NOT NULL,           -- formato DD/MM/YYYY
  hour      TEXT NOT NULL,           -- formato HH:MM
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  file_path TEXT                     -- caminho absoluto da imagem
)
```

### Tipo TypeScript

```typescript
// src/db/models/time-entries.ts
type TimeEntry = {
  id: string;
  date: string;       // DD/MM/YYYY
  hour: string;       // HH:MM
  created_at: Date;
  file_path: string;  // FileSystem.documentDirectory + time_entries/{id}.jpg
}
```

### Funções disponíveis

```typescript
setupDatabase()                           // Inicializa banco e cria tabela
createTimeEntry(entry: TimeEntry)         // Insere novo registro
getAllTimeEntries(): Promise<TimeEntry[]>  // Retorna todos ordenados por created_at DESC
updateTimeEntry(entry: Partial<TimeEntry> & { id: string })
deleteTimeEntry(id: string)
```

---

## Navegação

Usa **Expo Router** com roteamento baseado em arquivo.

```
/           → app/(tabs)/index.tsx      (Home)
/list       → app/(tabs)/list/index.tsx (Lista por data)
/list/[date]        → DateDetailScreen  (Entradas de uma data)
/list/[date]/[id]   → ImageViewerScreen (Visualizador)
```

- Parâmetros de rota acessados via `useLocalSearchParams()`
- Stack navigation dentro das seções `list/` e `list/[date]/`

---

## Funcionalidades Principais

### Home (app/(tabs)/index.tsx)
1. Captura foto via `CameraView` (expo-camera)
2. Processa imagem com `MlkitOcr.detectFromUri()`
3. Extrai data com regex: `/(\d{1,2})[^\d](\d{1,2})[^\d](\d{2,4})/`
4. Extrai hora com regex: `/(\d{2})\s*[:.]\s*(\d{2})/`
5. Formulário editável para correção manual
6. Salva imagem em `Documents/time_entries/{id}.jpg`
7. Persiste `TimeEntry` no SQLite

### Lista (app/(tabs)/list/)
- Entradas agrupadas por data com contagem
- Busca por data
- Navegação em cascata: data → entradas → imagem
- Delete via `deleteTimeEntry(id)` com atualização de estado local

---

## Padrões de Código

- **Componentes:** funcionais com hooks, nunca class components
- **Estado:** local por tela com `useState`/`useEffect` — sem Redux, Zustand ou Context global
- **Temas:** sempre usar `useThemeColor` ou componentes `Themed*` em vez de cores hardcoded
- **Banco:** singleton `dbInstance` em `src/db/index.ts`
- **IDs:** UUID v4 via `src/common/uuid.ts`
- **Imports:** alias `@/` para raiz do projeto (ex: `@/src/db`, `@/src/components/...`)
- **Async:** Promises com try/catch; alertas ao usuário em caso de erro
- **Ícones:** `IconSymbol` para cross-platform, `Ionicons` direto quando específico

---

## Tema de Cores

Definido em `src/constants/theme.ts`:

| Token | Light | Dark |
|---|---|---|
| text | `#11181C` | `#ECEDEE` |
| background | `#ffffff` | `#151718` |
| tint (primária) | `#0a7ea4` | `#ffffff` |
| icon | `#687076` | `#9BA1A6` |

---

## Scripts

```bash
npm start          # Expo dev server
npm run android    # Build/run Android
npm run ios        # Build/run iOS
npm run web        # Build/run Web
npm run lint       # ESLint
npm run reset-project  # Reset para template limpo
```

---

## Configurações Relevantes (app.json)

- `newArchEnabled: true` — Nova arquitetura React Native ativa
- `experiments.typedRoutes: true` — Rotas tipadas com Expo Router
- `experiments.reactCompiler: true` — React Compiler ativo
- `expo-sqlite`: FTS e SQLCipher habilitados para iOS
- Permissão Android: `CAMERA`
