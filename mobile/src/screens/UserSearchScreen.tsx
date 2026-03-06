import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { searchUsers, followUser, unfollowUser, fetchFollowing } from '../api/client';
import { useUser } from '../context/UserContext';
import { User } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'UserSearch'>;

export const UserSearchScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');

  const searchQuery = useQuery({
    queryKey: ['user-search', query],
    queryFn: () => searchUsers(query),
    enabled: query.length >= 2,
  });

  const followingQuery = useQuery({
    queryKey: ['following', user?.id],
    queryFn: () => fetchFollowing(user!.id),
    enabled: !!user,
  });

  const followedIds = new Set((followingQuery.data ?? []).map((u) => u.id));

  const followMutation = useMutation({
    mutationFn: (followedId: number) => followUser(user!.id, followedId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: (followedId: number) => unfollowUser(user!.id, followedId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });

  const handleToggle = useCallback((targetId: number) => {
    if (followedIds.has(targetId)) {
      unfollowMutation.mutate(targetId);
    } else {
      followMutation.mutate(targetId);
    }
  }, [followedIds, followMutation, unfollowMutation]);

  const initials = (name: string) =>
    name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const results = (searchQuery.data ?? []).filter((u) => u.id !== user?.id);

  const renderItem = ({ item }: { item: User }) => {
    const isFollowed = followedIds.has(item.id);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(item.username)}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{item.username}</Text>
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, isFollowed && styles.actionBtnActive]}
          onPress={() => handleToggle(item.id)}
        >
          <Text style={[styles.actionText, isFollowed && styles.actionTextActive]}>
            {isFollowed ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search by username..."
        placeholderTextColor="#666"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />

      {searchQuery.isLoading && query.length >= 2 && (
        <ActivityIndicator size="small" color="#42A5F5" style={{ marginTop: 20 }} />
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          query.length >= 2 && !searchQuery.isLoading ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          ) : query.length < 2 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>Type at least 2 characters to search</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { paddingVertical: 40, alignItems: 'center' },
  list: { paddingVertical: 8 },
  searchInput: {
    margin: 12, backgroundColor: '#1e1e1e', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, color: '#fff',
    fontSize: 15, borderWidth: 1, borderColor: '#333',
  },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', marginHorizontal: 12, marginVertical: 4,
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#2a2a2a',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#888', fontSize: 14, fontWeight: '700' },
  cardBody: { flex: 1 },
  cardName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  actionBtn: {
    backgroundColor: '#42A5F5', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  actionBtnActive: { backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#444' },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actionTextActive: { color: '#aaa', fontWeight: '600' },
  emptyText: { color: '#666', fontSize: 15 },
});
