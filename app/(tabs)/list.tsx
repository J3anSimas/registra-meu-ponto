import { getAllTimeEntries, TimeEntry } from '@/src/db';
import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';

type TimeEntryListItem = {
    id: string;
    data: string;
    hour: string;
    created_at: Date;
    file_path: string;
};

export default function ListScreen() {
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

    useEffect(() => {
        const loadTimeEntries = async () => {
            const timeEntriesResult = await getAllTimeEntries();
            setTimeEntries(timeEntriesResult)

        };

        loadTimeEntries();
    }, []);

    return (
        <View style={{ flex: 1, padding: 16 }}>
            <FlatList
                data={timeEntries}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={{ marginBottom: 12 }}>
                        <Text>{item.date}</Text>
                        <Text>{item.hour}</Text>
                        <Text>{item.created_at.toString()}</Text>
                    </View>
                )}
            />
        </View>
    );
}