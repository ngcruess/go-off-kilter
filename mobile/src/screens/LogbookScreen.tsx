import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { fetchUserAscents } from '../api/client';
import { useUser } from '../context/UserContext';
import { colors } from '../theme';
import { AscentSummary } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Logbook'>;

export const LogbookScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useUser();
  const [page, setPage] = useState(1);
  const [sendsOnly, setSendsOnly] = useState(true);

  const ascentsQuery = useQuery({
    queryKey: ['user-ascents', user?.id, page, sendsOnly],
    queryFn: () => fetchUserAscents(user!.id, page, 30, sendsOnly),
    enabled: !!user,
  });

  const ascents = ascentsQuery.data?.ascents ?? [];
  const total = ascentsQuery.data?.total ?? 0;

  const renderItem = ({ item }: { item: AscentSummary }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ProblemDetail', { uuid: item.climb_uuid })}
    >
      <View style={styles.cardTop}>
        <Text style={styles.climbName} numberOfLines={1}>{item.climb_name}</Text>
        <View style={[styles.typeBadge, item.is_send ? styles.sendBadge : styles.attemptBadge]}>
          <Text style={styles.typeBadgeText}>{item.is_send ? 'Send' : 'Attempt'}</Text>
        </View>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.cardMeta}>{item.angle}{'\u00B0'}</Text>
        {item.grade ? <Text style={styles.cardMeta}>{item.grade}</Text> : null}
        {item.quality ? (
          <Text style={styles.cardMeta}>{'\u2605'.repeat(item.quality)}</Text>
        ) : null}
        <Text style={styles.cardDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      {item.comment ? (
        <Text style={styles.cardComment} numberOfLines={2}>{item.comment}</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.filterToggle}>
          <TouchableOpacity
            style={[styles.filterBtn, sendsOnly && styles.filterBtnActive]}
            onPress={() => { setSendsOnly(true); setPage(1); }}
          >
            <Text style={[styles.filterText, sendsOnly && styles.filterTextActive]}>Sends</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, !sendsOnly && styles.filterBtnActive]}
            onPress={() => { setSendsOnly(false); setPage(1); }}
          >
            <Text style={[styles.filterText, !sendsOnly && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.totalLabel}>
          {total} {sendsOnly ? 'send' : 'ascent'}{total !== 1 ? 's' : ''}
        </Text>
      </View>

      {ascentsQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : ascents.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {sendsOnly ? 'No sends logged yet.' : 'No ascents logged yet.'}
          </Text>
          <Text style={styles.emptySubtext}>
            Browse problems and log your attempts and sends!
          </Text>
        </View>
      ) : (
        <FlatList
          data={ascents}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}

      {total > 30 && (
        <View style={styles.pagination}>
          <TouchableOpacity
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <Text style={[styles.pageLink, page <= 1 && styles.pageLinkDisabled]}>
              {'\u2190'} Prev
            </Text>
          </TouchableOpacity>
          <Text style={styles.pageInfo}>
            {page} / {Math.ceil(total / 30)}
          </Text>
          <TouchableOpacity
            onPress={() => setPage((p) => p + 1)}
            disabled={page * 30 >= total}
          >
            <Text style={[styles.pageLink, page * 30 >= total && styles.pageLinkDisabled]}>
              Next {'\u2192'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  filterToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: 10,
    padding: 3,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  filterBtnActive: { backgroundColor: colors.chip },
  filterText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: colors.textPrimary },
  totalLabel: { color: colors.textSecondary, fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 16, marginBottom: 8 },
  emptySubtext: { color: colors.textDisabled, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  list: { padding: 12 },
  card: {
    backgroundColor: colors.surfaceRaised, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.borderCard,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  climbName: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', flex: 1, marginRight: 10 },
  typeBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  sendBadge: { backgroundColor: colors.sendBadge },
  attemptBadge: { backgroundColor: colors.textDisabled },
  typeBadgeText: { color: colors.textPrimary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  cardBottom: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardMeta: { color: colors.textTertiary, fontSize: 13 },
  cardDate: { color: colors.textMuted, fontSize: 12, marginLeft: 'auto' },
  cardComment: { color: colors.textSecondary, fontSize: 13, marginTop: 6, fontStyle: 'italic' },
  pagination: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderTopWidth: 1, borderTopColor: colors.borderSubtle,
  },
  pageLink: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  pageLinkDisabled: { color: colors.borderMedium },
  pageInfo: { color: colors.textSecondary, fontSize: 13 },
});
