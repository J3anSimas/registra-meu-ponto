import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTimeEntry, deleteTimeEntry, getAllTimeEntries, TimeEntry } from '@/src/db';

export const TIME_ENTRIES_QUERY_KEY = ['time-entries'] as const;

export function useTimeEntries() {
    return useQuery({
        queryKey: TIME_ENTRIES_QUERY_KEY,
        queryFn: getAllTimeEntries,
    });
}

export function useTimeEntriesByDate(date: string) {
    return useQuery({
        queryKey: TIME_ENTRIES_QUERY_KEY,
        queryFn: getAllTimeEntries,
        select: (entries: TimeEntry[]) =>
            entries
                .filter((e) => e.date === date)
                .sort((a, b) => a.hour.localeCompare(b.hour)),
    });
}

export function useCreateTimeEntry() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (entry: TimeEntry) => createTimeEntry(entry),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: TIME_ENTRIES_QUERY_KEY });
        },
    });
}

export function useDeleteTimeEntry() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteTimeEntry(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: TIME_ENTRIES_QUERY_KEY });
        },
    });
}
