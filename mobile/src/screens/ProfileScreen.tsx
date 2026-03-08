import React, { useState } from 'react';
import { colors } from '../theme';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { fetchUserStats, fetchUserAscents, fetchUserSetClimbs } from '../api/client';
import { useUser } from '../context/UserContext';
import { BarChart, BarDatum } from '../components/BarChart/BarChart';
import { AscentSummary, ClimbSummary, GradeSystem } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

type ChartTab = 'grade' | 'angle' | 'time';

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout, angle, gradeSystem, setGradeSystem } = useUser();
  const [chartTab, setChartTab] = useState<ChartTab>('grade');

  const statsQuery = useQuery({
    queryKey: ['user-stats', user?.id],
    queryFn: () => fetchUserStats(user!.id),
    enabled: !!user,
  });

  const recentSendsQuery = useQuery({
    queryKey: ['user-recent-sends', user?.id],
    queryFn: () => fetchUserAscents(user!.id, 1, 5, true),
    enabled: !!user,
  });

  const setClimbsQuery = useQuery({
    queryKey: ['user-set-climbs', user?.id, angle],
    queryFn: () => fetchUserSetClimbs(user!.id, angle, 5),
    enabled: !!user,
  });

  const handleLogout = () => {
    Alert.alert('Log Out', 'Switch to a different user?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  if (!user) return null;

  const stats = statsQuery.data;
  const recentSends = recentSendsQuery.data?.ascents ?? [];

  const initials = user.username
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
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

  const angleChartData: BarDatum[] = (() => {
    const countByAngle = new Map<number, number>();
    for (const a of stats?.sends_by_angle ?? []) {
      countByAngle.set(a.angle, (countByAngle.get(a.angle) ?? 0) + a.count);
    }
    return Array.from({ length: 15 }, (_, i) => ({
      label: `${i * 5}\u00B0`,
      value: countByAngle.get(i * 5) ?? 0,
    }));
  })();

  const timeChartData: BarDatum[] =
    stats?.sends_by_month.map((m) => {
      const [, month] = m.month.split('-');
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return { label: monthNames[parseInt(month, 10) - 1] || month, value: m.count };
    }) ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.titleInfo}>
          <Text style={styles.username}>{user.username}</Text>
          {memberSince ? (
            <Text style={styles.memberSince}>Member since {memberSince}</Text>
          ) : null}
        </View>
      </View>

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

          <View style={styles.chartSection}>
            <View style={styles.chartToggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, chartTab === 'grade' && styles.toggleBtnActive]}
                onPress={() => setChartTab('grade')}
              >
                <Text style={[styles.toggleText, chartTab === 'grade' && styles.toggleTextActive]}>
                  By Grade
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, chartTab === 'angle' && styles.toggleBtnActive]}
                onPress={() => setChartTab('angle')}
              >
                <Text style={[styles.toggleText, chartTab === 'angle' && styles.toggleTextActive]}>
                  By Angle
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, chartTab === 'time' && styles.toggleBtnActive]}
                onPress={() => setChartTab('time')}
              >
                <Text style={[styles.toggleText, chartTab === 'time' && styles.toggleTextActive]}>
                  Over Time
                </Text>
              </TouchableOpacity>
            </View>

            {chartTab === 'grade' ? (
              stats && stats.total_sends > 0 ? (
                <BarChart data={gradeChartData} barColor={colors.accent} height={160} />
              ) : (
                <Text style={styles.chartEmpty}>No sends yet</Text>
              )
            ) : chartTab === 'angle' ? (
              stats && stats.total_sends > 0 ? (
                <BarChart data={angleChartData} barColor={colors.chartAngle} height={160} />
              ) : (
                <Text style={styles.chartEmpty}>No sends yet</Text>
              )
            ) : timeChartData.length > 0 ? (
              <BarChart data={timeChartData} barColor={colors.chartTime} height={160} />
            ) : (
              <Text style={styles.chartEmpty}>No sends yet</Text>
            )}
          </View>
        </>
      ) : null}

      <TouchableOpacity
        style={styles.myListsButton}
        onPress={() => navigation.navigate('Following')}
      >
        <Text style={styles.myListsText}>Following</Text>
        <Text style={styles.myListsChevron}>{'\u203A'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.myListsButton}
        onPress={() => navigation.navigate('Lists')}
      >
        <Text style={styles.myListsText}>My Lists</Text>
        <Text style={styles.myListsChevron}>{'\u203A'}</Text>
      </TouchableOpacity>

      <View style={styles.sendsSection}>
        <View style={styles.sendsHeader}>
          <Text style={styles.sendsTitle}>Recent Sends</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Logbook')}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {recentSendsQuery.isLoading ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 12 }} />
        ) : recentSends.length === 0 ? (
          <Text style={styles.emptyText}>No sends logged yet.</Text>
        ) : (
          recentSends.map((send: AscentSummary) => (
            <TouchableOpacity
              key={send.id}
              style={styles.sendCard}
              onPress={() => navigation.navigate('ProblemDetail', { uuid: send.climb_uuid })}
            >
              <View style={styles.sendCardTop}>
                <Text style={styles.sendName} numberOfLines={1}>{send.climb_name}</Text>
                {send.grade ? <Text style={styles.sendGrade}>{send.grade}</Text> : null}
              </View>
              <View style={styles.sendCardBottom}>
                <Text style={styles.sendMeta}>{send.angle}{'\u00B0'}</Text>
                {send.quality ? (
                  <Text style={styles.sendMeta}>{'\u2605'.repeat(send.quality)}</Text>
                ) : null}
                <Text style={styles.sendDate}>
                  {new Date(send.created_at).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.sendsSection}>
        <Text style={styles.sendsTitle}>Climbs Set</Text>
        {setClimbsQuery.isLoading ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 12 }} />
        ) : (setClimbsQuery.data ?? []).length === 0 ? (
          <Text style={styles.emptyText}>No climbs set yet.</Text>
        ) : (
          (setClimbsQuery.data ?? []).map((climb: ClimbSummary) => (
            <TouchableOpacity
              key={climb.uuid}
              style={styles.sendCard}
              onPress={() => navigation.navigate('ProblemDetail', { uuid: climb.uuid })}
            >
              <View style={styles.sendCardTop}>
                <Text style={styles.sendName} numberOfLines={1}>{climb.name}</Text>
                {climb.grade ? <Text style={styles.sendGrade}>{climb.grade}</Text> : null}
              </View>
              <View style={styles.sendCardBottom}>
                {climb.ascensionist_count != null && (
                  <Text style={styles.sendMeta}>{climb.ascensionist_count} sends</Text>
                )}
                {climb.quality_average != null && climb.quality_average > 0 && (
                  <Text style={styles.sendMeta}>
                    {'\u2605'.repeat(Math.round(climb.quality_average))}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.prefSection}>
        <Text style={styles.prefTitle}>Grading System</Text>
        <View style={styles.segmented}>
          {(['hueco', 'font'] as GradeSystem[]).map((sys) => (
            <TouchableOpacity
              key={sys}
              style={[styles.segBtn, gradeSystem === sys && styles.segBtnActive]}
              onPress={() => setGradeSystem(sys)}
            >
              <Text style={[styles.segBtnText, gradeSystem === sys && styles.segBtnTextActive]}>
                {sys === 'hueco' ? 'Hueco (V)' : 'Font'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  content: { paddingBottom: 40 },
  titleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.chip,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: { color: colors.textSecondary, fontSize: 22, fontWeight: '700' },
  titleInfo: { flex: 1 },
  username: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  memberSince: { color: colors.textMuted, fontSize: 13, marginTop: 3 },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  statBadge: { alignItems: 'center' },
  statValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textSecondary, fontSize: 11, textTransform: 'uppercase', marginTop: 4 },

  chartSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  chartToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: colors.chip },
  toggleText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: colors.textPrimary },
  chartEmpty: { color: colors.textDisabled, fontSize: 14, textAlign: 'center', paddingVertical: 24 },

  sendsSection: { paddingHorizontal: 16, paddingTop: 16 },
  sendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sendsTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  viewAll: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  emptyText: { color: colors.textDisabled, fontSize: 14, paddingVertical: 12 },

  sendCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.chip,
  },
  sendCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sendName: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  sendGrade: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  sendCardBottom: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  sendMeta: { color: colors.textTertiary, fontSize: 12 },
  sendDate: { color: colors.textMuted, fontSize: 12, marginLeft: 'auto' },

  myListsButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: colors.surfaceRaised, borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: colors.chip,
  },
  myListsText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  myListsChevron: { color: colors.textDisabled, fontSize: 22, fontWeight: '300' },

  prefSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  prefTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.chip,
    overflow: 'hidden',
  },
  segBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: colors.accent,
  },
  segBtnText: { color: colors.textTertiary, fontSize: 14, fontWeight: '600' },
  segBtnTextActive: { color: colors.textPrimary },

  logoutButton: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.chip,
  },
  logoutText: { color: colors.error, fontSize: 15, fontWeight: '600' },
});
