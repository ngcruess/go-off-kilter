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
import { fetchFollowing, unfollowUser } from '../api/client';
import { useUser } from '../context/UserContext';
import { User } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Following'>;

export const FollowingScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const followingQuery = useQuery({
    queryKey: ['following', user?.id],
    queryFn: () => fetchFollowing(user!.id),
    enabled: !!user,
  });

  const unfollowMutation = useMutation({
    mutationFn: (followedId: number) => unfollowUser(user!.id, followedId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });

  const handleUnfollow = (u: User) => {
    Alert.alert('Unfollow', `Unfollow ${u.username}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unfollow', style: 'destructive', onPress: () => unfollowMutation.mutate(u.id) },
    ]);
  };

  const initials = (name: string) =>
    name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const renderItem = ({ item }: { item: User }) => (
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
      <TouchableOpacity style={styles.unfollowBtn} onPress={() => handleUnfollow(item)}>
        <Text style={styles.unfollowText}>Unfollow</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.findButton}
        onPress={() => navigation.navigate('UserSearch')}
      >
        <Text style={styles.findButtonText}>Find Users</Text>
      </TouchableOpacity>

      {followingQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#42A5F5" />
        </View>
      ) : (
        <FlatList
          data={followingQuery.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Not following anyone yet</Text>
              <Text style={styles.emptySubtext}>
                Find users to follow and see them here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  list: { paddingVertical: 8 },
  findButton: {
    margin: 12, backgroundColor: '#42A5F5', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  findButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
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
  unfollowBtn: {
    backgroundColor: '#2a2a2a', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#444',
  },
  unfollowText: { color: '#ff6b6b', fontSize: 13, fontWeight: '600' },
  emptyText: { color: '#666', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  emptySubtext: { color: '#555', fontSize: 14 },
});
