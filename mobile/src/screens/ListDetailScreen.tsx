import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { fetchList, removeFromList } from '../api/client';
import { ProblemCard } from '../components/ProblemCard/ProblemCard';
import { useUser } from '../context/UserContext';
import { colors } from '../theme';
import { ClimbSummary } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ListDetail'>;

export const ListDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { listId } = route.params;
  const { angle } = useUser();
  const queryClient = useQueryClient();

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: route.params.listName });
  }, [navigation, route.params.listName]);

  const listQuery = useQuery({
    queryKey: ['list-detail', listId, angle],
    queryFn: () => fetchList(listId, angle),
  });

  const removeMutation = useMutation({
    mutationFn: (climbUUID: string) => removeFromList(listId, climbUUID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-detail', listId] });
      queryClient.invalidateQueries({ queryKey: ['user-lists'] });
    },
  });

  const handleRemove = (item: ClimbSummary) => {
    Alert.alert(
      'Remove from List',
      `Remove "${item.name}" from this list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMutation.mutate(item.uuid),
        },
      ],
    );
  };

  if (listQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const items = listQuery.data?.items ?? [];

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.uuid}
        renderItem={({ item }) => (
          <ProblemCard
            climb={item}
            onPress={() => navigation.navigate('ProblemDetail', { uuid: item.uuid })}
            onLongPress={() => handleRemove(item)}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>This list is empty</Text>
            <Text style={styles.emptySubtext}>
              Add climbs from the problem detail screen
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: colors.pageBg },
  list: { paddingVertical: 8 },
  emptyText: { color: colors.textMuted, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  emptySubtext: { color: colors.textDisabled, fontSize: 14 },
});
