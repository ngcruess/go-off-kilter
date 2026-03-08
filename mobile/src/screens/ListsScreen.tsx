import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { fetchUserLists, createList } from '../api/client';
import { useUser } from '../context/UserContext';
import { colors } from '../theme';
import { ClimbList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Lists'>;

export const ListsScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(colors.accent);

  const listsQuery = useQuery({
    queryKey: ['user-lists', user?.id],
    queryFn: () => fetchUserLists(user!.id),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      createList(user!.id, name, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-lists'] });
      setShowCreate(false);
      setNewName('');
      setNewColor(colors.accent);
    },
  });

  const handleCreate = () => {
    setShowCreate(true);
  };

  const handleSubmitCreate = () => {
    const trimmed = newName.trim();
    if (trimmed) createMutation.mutate({ name: trimmed, color: newColor });
  };

  const renderItem = ({ item }: { item: ClimbList }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ListDetail', { listId: item.id, listName: item.name })}
    >
      <View style={[styles.colorDot, { backgroundColor: item.color || colors.accent }]} />
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardMeta}>
          {item.item_count} {item.item_count === 1 ? 'climb' : 'climbs'}
        </Text>
      </View>
      <Text style={styles.chevron}>{'\u203A'}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {listsQuery.isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}

      {!listsQuery.isLoading && (
        <FlatList
          data={listsQuery.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No lists yet</Text>
              <Text style={styles.emptySubtext}>
                Create a list to save your favorite climbs
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={handleCreate}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCreate(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New List</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="List name..."
              placeholderTextColor={colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoCapitalize="none"
              autoFocus
            />
            <View style={styles.colorRow}>
              {colors.listPalette.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorSwatch, { backgroundColor: c }, newColor === c && styles.colorSwatchActive]}
                  onPress={() => setNewColor(c)}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowCreate(false); setNewName(''); setNewColor(colors.accent); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, !newName.trim() && { opacity: 0.4 }]}
                onPress={handleSubmitCreate}
                disabled={!newName.trim() || createMutation.isPending}
              >
                <Text style={styles.modalSubmitText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  list: { paddingVertical: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceRaised, marginHorizontal: 12, marginVertical: 4,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.borderCard,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  cardBody: { flex: 1 },
  cardName: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardMeta: { color: colors.textSecondary, fontSize: 13 },
  chevron: { color: colors.textDisabled, fontSize: 24, fontWeight: '300' },
  emptyText: { color: colors.textMuted, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  emptySubtext: { color: colors.textDisabled, fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: colors.accent, justifyContent: 'center',
    alignItems: 'center', elevation: 4, shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  fabText: { color: colors.textPrimary, fontSize: 28, fontWeight: '300', marginTop: -2 },
  modalOverlay: {
    flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center',
  },
  modalContent: { backgroundColor: colors.surfaceRaised, borderRadius: 16, padding: 20, width: 300 },
  modalTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  modalInput: {
    backgroundColor: colors.chip, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    color: colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: colors.borderMedium, marginBottom: 16,
  },
  colorRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16,
  },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchActive: { borderWidth: 3, borderColor: colors.textPrimary },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancel: {
    flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.border,
  },
  modalCancelText: { color: colors.textTertiary, fontSize: 15, fontWeight: '600' },
  modalSubmit: {
    flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.accent,
  },
  modalSubmitText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
});
