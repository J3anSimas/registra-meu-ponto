export const TimeEntrySchema = {
    name: 'time_entries',
    properties: {
        id: 'string',
        date: 'string',
        hour: 'string',
        created_at: 'date',
        file_path: 'string',
    },
    primaryKey: 'id',
}