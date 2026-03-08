import React from 'react';
import { colors } from '../theme';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { getUser, fetchUserStats, fetchUserSetClimbs, checkIsFollowing, followUser, unfollowUser } from '../api/client';
import { useUser } from '../context/UserContext';
import { BarChart, BarDatum } from '../components/BarChart/BarChart';
import { ClimbSummary } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

export const UserProfileScreen: React.FC<Props> = ({ route, navigation }) => {
  const { userId } = route.params;
  const { user: currentUser, angle } = useUser();
  const queryClient = useQueryClient();

  const userQuery = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId),
  });

  const statsQuery = useQuery({
    queryKey: ['user-stats', userId],
    queryFn: () => fetchUserStats(userId),
  });

  const setClimbsQuery = useQuery({
    queryKey: ['user-set-climbs', userId, angle],
    queryFn: () => fetchUserSetClimbs(userId, angle, 10),
  });

  const isFollowingQuery = useQuery({
    queryKey: ['is-following', currentUser?.id, userId],
    queryFn: () => checkIsFollowing(currentUser!.id, userId),
    enabled: !!currentUser && currentUser.id !== userId,
  });

  const followMutation = useMutation({
    mutationFn: () => followUser(currentUser!.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['is-following', currentUser?.id, userId] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: () => unfollowUser(currentUser!.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['is-following', currentUser?.id, userId] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });

  if (userQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const profile = userQuery.data;
  if (!profile) return null;

  const stats = statsQuery.data;
  const isFollowing = isFollowingQuery.data ?? false;
  const isOwnProfile = currentUser?.id === userId;

  const initials = profile.username
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
      })
    : '';

  const gradeChartData: BarDatum[] = (() => {
    const countByHueco = new Map<string, number>();
    for (const g of stats?.sends_by_grade ?? []) {
      const hueco = g.grade.split('/').pop() || g.grade;
      countByHueco.set(hueco, (countByHueco.get(hueco) ?? 0) + g.count);
    }
    return Array.from({ length: 15 }, (_, i) => ({
      label: `V${i}`,
      value: countByHueco.get(`V${i}`) ?? 0,
    }));
  })();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.titleInfo}>
          <Text style={styles.username}>{profile.username}</Text>
          {memberSince ? (
            <Text style={styles.memberSince}>Member since {memberSince}</Text>
          ) : null}
        </View>
      </View>

      {!isOwnProfile && (
        <TouchableOpacity
          style={[styles.followButton, isFollowing && styles.followButtonActive]}
          onPress={() =>
            isFollowing ? unfollowMutation.mutate() : followMutation.mutate()
          }
          disabled={followMutation.isPending || unfollowMutation.isPending}
        >
          <Text style={[styles.followText, isFollowing && styles.followTextActive]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      )}

      {statsQuery.isLoading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginVertical: 24 }} />
      ) : stats ? (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statBadge}>
              <Text style={styles.statValue}>{stats.highest_grade || '--'}</Text>
              <Text style={styles.statLabel}>Highest Grade</Text>
            </View>
            <View style={styles.statBadge}>
              <Text style={styles.statValue}>{stats.total_sends}</Text>
              <Text style={styles.statLabel}>Total Sends</Text>
            </View>
            <View style={styles.statBadge}>
              <Text style={styles.statValue}>{stats.total_ascents}</Text>
              <Text style={styles.statLabel}>Total Ascents</Text>
            </View>
          </View>

          {stats.total_sends > 0 && (
            <View style={styles.chartSection}>
              <Text style={styles.chartTitle}>Sends by Grade</Text>
              <BarChart data={gradeChartData} barColor={colors.accent} height={140} />
            </View>
          )}
        </>
      ) : null}

      <View style={styles.climbsSection}>
        <Text style={styles.sectionTitle}>Climbs Set</Text>
        {setClimbsQuery.isLoading ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 12 }} />
        ) : (setClimbsQuery.data ?? []).length === 0 ? (
          <Text style={styles.emptyText}>No climbs set.</Text>
        ) : (
          (setClimbsQuery.data ?? []).map((climb: ClimbSummary) => (
            <TouchableOpacity
              key={climb.uuid}
              style={styles.climbCard}
              onPress={() => navigation.navigate('ProblemDetail', { uuid: climb.uuid })}
            >
              <View style={styles.climbCardTop}>
                <Text style={styles.climbName} numberOfLines={1}>{climb.name}</Text>
                {climb.grade ? <Text style={styles.climbGrade}>{climb.grade}</Text> : null}
              </View>
              <View style={styles.climbCardBottom}>
                {climb.ascensionist_count != null && (
                  <Text style={styles.climbMeta}>{climb.ascensionist_count} sends</Text>
                )}
                {climb.quality_average != null && climb.quality_average > 0 && (
                  <Text style={styles.climbMeta}>
                    {'\u2605'.repeat(Math.round(climb.quality_average))}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.pageBg },
  titleCard: {
    flexDirection: 'row', alignItems: 'center', padding: 20,
    borderBottomWidth: 1, borderBottomColor: colors.surfaceRaised,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.chip, justifyContent: 'center', alignItems: 'center',
    marginRight: 16,
  },
  avatarText: { color: colors.textSecondary, fontSize: 22, fontWeight: '700' },
  titleInfo: { flex: 1 },
  username: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  memberSince: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  followButton: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: colors.accent, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  followButtonActive: {
    backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.borderMedium,
  },
  followText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  followTextActive: { color: colors.textTertiary },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 16, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: colors.surfaceRaised,
  },
  statBadge: { alignItems: 'center' },
  statValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textSecondary, fontSize: 11, textTransform: 'uppercase', marginTop: 4 },
  chartSection: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.surfaceRaised,
  },
  chartTitle: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  climbsSection: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 12 },
  emptyText: { color: colors.textDisabled, fontSize: 14, paddingVertical: 12 },
  climbCard: {
    backgroundColor: colors.surfaceRaised, borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: colors.borderCard,
  },
  climbCardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  climbName: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  climbGrade: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  climbCardBottom: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  climbMeta: { color: colors.textTertiary, fontSize: 12 },
});
