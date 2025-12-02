import SQLite from 'react-native-sqlite-storage';

// Nome da Tabela e do DB
const TIME_ENTRY_TABLE = 'time_entries';
const DB_NAME = 'timekeeper.db';

// Tipagem baseada no seu TimeEntrySchema
export type TimeEntry = {
    id: string;
    date: string; // Nome da coluna ajustado
    hour: string;
    created_at: Date;
    file_path: string;
}

// Variável para reutilizar a instância do DB
let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * 1. Abre o banco de dados.
 */
const getDB = (): Promise<SQLite.SQLiteDatabase> => {
    return new Promise((resolve, reject) => {
        SQLite.openDatabase(
            { name: DB_NAME, location: 'default' },
            (db) => resolve(db),
            (error) => reject(error)
        );
    });
};

/**
 * 2. Inicializa a tabela (CREATE TABLE IF NOT EXISTS).
 */
const initDB = async (db: SQLite.SQLiteDatabase) => {
    // Tipos SQLite: TEXT (para string), DATETIME (para created_at)
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${TIME_ENTRY_TABLE} (
            id TEXT PRIMARY KEY NOT NULL,
            date TEXT NOT NULL,
            hour TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            file_path TEXT
        );
    `;

    return new Promise<void>((resolve, reject) => {
        db.transaction((tx) => {
            tx.executeSql(
                createTableQuery,
                [],
                () => resolve(),
                (_, error) => {
                    console.error("Erro ao criar a tabela", error);
                    reject(error);
                    return true;
                }
            );
        });
    });
};

/**
 * Configura o DB: Abre e inicializa a tabela (chamado uma vez).
 */
export const setupDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
    if (!dbInstance) {
        dbInstance = await getDB();
        await initDB(dbInstance);
    }
    return dbInstance;
};

// --- Funções CRUD ---

/**
 * 1. CREATE: Insere uma nova entrada.
 */
export const createTimeEntry = async (entry: TimeEntry): Promise<TimeEntry> => {
    const db = await setupDatabase();

    const insertQuery = `
        INSERT INTO ${TIME_ENTRY_TABLE} (id, date, hour, created_at, file_path)
        VALUES (?, ?, ?, ?, ?);
    `;
    const params = [
        entry.id,
        entry.date,
        entry.hour,
        entry.created_at.toISOString(), // Salva a data como string ISO
        entry.file_path
    ];

    return new Promise((resolve, reject) => {
        db.transaction((tx) => {
            tx.executeSql(
                insertQuery,
                params,
                () => resolve(entry),
                (_, error) => {
                    console.error("Erro ao criar TimeEntry", error);
                    reject(error);
                    return true;
                }
            );
        });
    });
}

/**
 * 2. READ: Busca todas as entradas.
 */
export const getAllTimeEntries = async (): Promise<TimeEntry[]> => {
    const db = await setupDatabase();

    const selectQuery = `SELECT * FROM ${TIME_ENTRY_TABLE} ORDER BY created_at DESC;`;

    return new Promise((resolve, reject) => {
        db.transaction((tx) => {
            tx.executeSql(
                selectQuery,
                [],
                (tx, results) => {
                    const entries: TimeEntry[] = [];
                    for (let i = 0; i < results.rows.length; i++) {
                        const row = results.rows.item(i);
                        // Converte a string DATETIME de volta para objeto Date
                        entries.push({
                            ...row,
                            created_at: new Date(row.created_at)
                        } as TimeEntry);
                    }
                    resolve(entries);
                },
                (_, error) => {
                    console.error("Erro ao buscar todas as TimeEntries", error);
                    reject(error);
                    return true;
                }
            );
        });
    });
}

/**
 * 3. UPDATE: Atualiza uma entrada existente pelo ID.
 */
export const updateTimeEntry = async (entry: Partial<TimeEntry> & { id: string }): Promise<void> => {
    const db = await setupDatabase();

    // Filtra apenas os campos que foram passados para atualização (exceto o id)
    const fieldsToUpdate: string[] = [];
    const updateParams: (string | Date)[] = [];

    if (entry.date !== undefined) { fieldsToUpdate.push('date = ?'); updateParams.push(entry.date); }
    if (entry.hour !== undefined) { fieldsToUpdate.push('hour = ?'); updateParams.push(entry.hour); }
    if (entry.file_path !== undefined) { fieldsToUpdate.push('file_path = ?'); updateParams.push(entry.file_path); }
    // created_at é geralmente atualizado pelo sistema, mas se precisar, seria assim:
    if (entry.created_at !== undefined) { fieldsToUpdate.push('created_at = ?'); updateParams.push(entry.created_at.toISOString()); }

    if (fieldsToUpdate.length === 0) {
        return Promise.resolve(); // Nada para atualizar
    }

    const updateQuery = `
        UPDATE ${TIME_ENTRY_TABLE} SET ${fieldsToUpdate.join(', ')} WHERE id = ?;
    `;

    updateParams.push(entry.id); // Adiciona o ID como último parâmetro

    return new Promise((resolve, reject) => {
        db.transaction((tx) => {
            tx.executeSql(
                updateQuery,
                updateParams,
                () => resolve(),
                (_, error) => {
                    console.error(`Erro ao atualizar TimeEntry ${entry.id}`, error);
                    reject(error);
                    return true;
                }
            );
        });
    });
}

/**
 * 4. DELETE: Deleta uma entrada pelo ID.
 */
export const deleteTimeEntry = async (id: string): Promise<void> => {
    const db = await setupDatabase();

    const deleteQuery = `DELETE FROM ${TIME_ENTRY_TABLE} WHERE id = ?;`;

    return new Promise((resolve, reject) => {
        db.transaction((tx) => {
            tx.executeSql(
                deleteQuery,
                [id],
                () => resolve(),
                (_, error) => {
                    console.error(`Erro ao deletar TimeEntry ${id}`, error);
                    reject(error);
                    return true;
                }
            );
        });
    });
}