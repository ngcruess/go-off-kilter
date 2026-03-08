import React, { useState, useCallback, useMemo, useRef } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import {
  View,
  FlatList,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { fetchClimbs, fetchGrades } from '../api/client';
import { ProblemCard } from '../components/ProblemCard/ProblemCard';
import { ClimbSummary, ANGLES, extractGrade } from '../types';
import { useUser } from '../context/UserContext';

type UserFilter = 'attempted' | 'sent' | 'not_sent' | undefined;
type SortKey = 'ascents' | 'date' | 'rating' | 'name';
type SortOrder = 'asc' | 'desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'ascents', label: 'Ascents' },
  { key: 'date', label: 'Set Date' },
  { key: 'rating', label: 'Rating' },
  { key: 'name', label: 'Name' },
];

const CHIP_WIDTH = 54;

type Props = NativeStackScreenProps<RootStackParamList, 'Browse'>;

export const BrowseScreen: React.FC<Props> = ({ navigation }) => {
  const { user, angle, setAngle, gradeSystem, boardConnected, setBoardConnected } = useUser();
  const [search, setSearch] = useState('');
  const [setter, setSetter] = useState('');
  const [gradeMinDiff, setGradeMinDiff] = useState<number | undefined>(undefined);
  const [gradeMaxDiff, setGradeMaxDiff] = useState<number | undefined>(undefined);
  const [setAngleFilter, setSetAngleFilter] = useState<number | undefined>(undefined);
  const [noMatch, setNoMatch] = useState<boolean | undefined>(undefined);
  const [userFilter, setUserFilter] = useState<UserFilter>(undefined);
  const [sortKey, setSortKey] = useState<SortKey>('ascents');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [showAnglePicker, setShowAnglePicker] = useState(false);

  const minScrollRef = useRef<ScrollView>(null);
  const maxScrollRef = useRef<ScrollView>(null);

  const gradesQuery = useQuery({
    queryKey: ['grades'],
    queryFn: fetchGrades,
    staleTime: Infinity,
  });

  const gradeFilterOptions = useMemo(() => {
    if (!gradesQuery.data) return [];
    const seen = new Map<string, { label: string; min: number; max: number }>();
    for (const g of gradesQuery.data) {
      const label = extractGrade(g.boulder_name, gradeSystem);
      const existing = seen.get(label);
      if (!existing) {
        seen.set(label, { label, min: g.difficulty, max: g.difficulty });
      } else {
        existing.min = Math.min(existing.min, g.difficulty);
        existing.max = Math.max(existing.max, g.difficulty);
      }
    }
    return Array.from(seen.values());
  }, [gradesQuery.data, gradeSystem]);

  const gradeMinIdx = useMemo(() => {
    if (gradeMinDiff === undefined) return -1;
    const exact = gradeFilterOptions.findIndex(g => g.min === gradeMinDiff);
    if (exact !== -1) return exact;
    let best = 0, bestDist = Infinity;
    gradeFilterOptions.forEach((g, i) => {
      const d = Math.abs(g.min - gradeMinDiff);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  }, [gradeMinDiff, gradeFilterOptions]);

  const gradeMaxIdx = useMemo(() => {
    if (gradeMaxDiff === undefined) return -1;
    const exact = gradeFilterOptions.findIndex(g => g.max === gradeMaxDiff);
    if (exact !== -1) return exact;
    let best = 0, bestDist = Infinity;
    gradeFilterOptions.forEach((g, i) => {
      const d = Math.abs(g.max - gradeMaxDiff);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  }, [gradeMaxDiff, gradeFilterOptions]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (setter) count++;
    if (gradeMinDiff !== undefined) count++;
    if (gradeMaxDiff !== undefined) count++;
    if (setAngleFilter !== undefined) count++;
    if (noMatch !== undefined) count++;
    if (userFilter) count++;
    return count;
  }, [setter, gradeMinDiff, gradeMaxDiff, setAngleFilter, noMatch, userFilter]);

  const clearFilters = useCallback(() => {
    setSetter('');
    setGradeMinDiff(undefined);
    setGradeMaxDiff(undefined);
    setSetAngleFilter(undefined);
    setNoMatch(undefined);
    setUserFilter(undefined);
  }, []);

  const scrollToSelected = useCallback(() => {
    setTimeout(() => {
      if (gradeMinIdx >= 0 && minScrollRef.current) {
        minScrollRef.current.scrollTo({ x: (gradeMinIdx + 1) * (CHIP_WIDTH + 6) - 40, animated: false });
      }
      if (gradeMaxIdx >= 0 && maxScrollRef.current) {
        maxScrollRef.current.scrollTo({ x: (gradeMaxIdx + 1) * (CHIP_WIDTH + 6) - 40, animated: false });
      }
    }, 50);
  }, [gradeMinIdx, gradeMaxIdx]);

  const openFilters = useCallback(() => {
    setShowFilters(true);
    scrollToSelected();
  }, [scrollToSelected]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity
            onPress={() => setBoardConnected(!boardConnected)}
            style={{
              backgroundColor: colors.chip, borderRadius: 14,
              paddingHorizontal: 10, paddingVertical: 4,
            }}
          >
            <MaterialCommunityIcons name="bluetooth" size={18} color={boardConnected ? colors.accent : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowAnglePicker(true)}
            style={{
              backgroundColor: colors.chip, borderRadius: 14,
              paddingHorizontal: 10, paddingVertical: 4,
            }}
          >
            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700' }}>{angle}{'\u00B0'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: colors.chip, borderRadius: 14,
              paddingHorizontal: 10, paddingVertical: 4,
            }}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: colors.borderMedium, justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '700' }}>
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
              {user?.username || 'Profile'}
            </Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, angle, user, boardConnected]);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['climbs', search, setter, gradeMinDiff, gradeMaxDiff, angle, setAngleFilter, noMatch, userFilter, user?.id, sortKey, sortOrder, gradeSystem],
    queryFn: ({ pageParam }) =>
      fetchClimbs({
        name: search || undefined,
        setter: setter || undefined,
        grade_min: gradeMinDiff,
        grade_max: gradeMaxDiff,
        angle,
        set_angle: setAngleFilter,
        no_match: noMatch,
        user_id: userFilter ? user?.id : undefined,
        user_filter: userFilter,
        sort: sortKey,
        order: sortOrder,
        cursor: pageParam,
        limit: 20,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
  }, []);

  const allClimbs: ClimbSummary[] = data?.pages.flatMap((p) => p.climbs ?? []) ?? [];

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const gradeLabel = (idx: number | undefined) =>
    idx !== undefined && gradeFilterOptions[idx] ? gradeFilterOptions[idx].label : 'Any';

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search problems..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={openFilters}
        >
          <MaterialCommunityIcons name="tune-variant" size={18} color={activeFilterCount > 0 ? colors.textPrimary : colors.accent} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.sortChip, sortKey === opt.key && styles.sortChipActive]}
            onPress={() => {
              if (sortKey === opt.key) {
                setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
              } else {
                setSortKey(opt.key);
                setSortOrder(opt.key === 'name' ? 'asc' : 'desc');
              }
            }}
          >
            <Text style={[styles.sortChipText, sortKey === opt.key && styles.sortChipTextActive]}>
              {opt.label}
              {sortKey === opt.key ? (sortOrder === 'desc' ? ' \u2193' : ' \u2191') : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.listContainer}>
        {isLoading && !isFetchingNextPage && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        )}

        {error && (
          <View style={styles.center}>
            <Text style={styles.errorText}>Failed to load problems</Text>
            <Text style={styles.errorDetail}>{(error as Error).message}</Text>
          </View>
        )}

        {!isLoading && (
          <FlatList
            data={allClimbs}
            keyExtractor={(item) => item.uuid}
            renderItem={({ item }) => (
              <ProblemCard
                climb={item}
                onPress={() => navigation.navigate('ProblemDetail', { uuid: item.uuid })}
              />
            )}
            contentContainerStyle={styles.list}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>No problems found</Text>
              </View>
            }
            ListFooterComponent={
              isFetchingNextPage ? (
                <ActivityIndicator style={{ paddingVertical: 16 }} color={colors.accent} />
              ) : null
            }
          />
        )}
      </View>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Create', { layoutId: 1 })}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.filterOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filters</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {activeFilterCount > 0 && (
                  <TouchableOpacity onPress={clearFilters}>
                    <Text style={styles.clearText}>Clear All</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowFilters(false)}>
                  <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.filterLabel}>Setter</Text>
              <TextInput
                style={styles.setterInput}
                placeholder="Setter name..."
                placeholderTextColor={colors.textMuted}
                value={setter}
                onChangeText={setSetter}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.filterLabel}>Min Grade</Text>
              <ScrollView
                ref={minScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.gradeStrip}
              >
                <TouchableOpacity
                  style={[styles.gradeChip, gradeMinDiff === undefined && styles.gradeChipActive]}
                  onPress={() => setGradeMinDiff(undefined)}
                >
                  <Text style={[styles.gradeChipText, gradeMinDiff === undefined && styles.gradeChipTextActive]}>Any</Text>
                </TouchableOpacity>
                {gradeFilterOptions.map((g, idx) => (
                  <TouchableOpacity
                    key={g.label}
                    style={[styles.gradeChip, gradeMinIdx === idx && styles.gradeChipActive]}
                    onPress={() => setGradeMinDiff(g.min)}
                  >
                    <Text style={[styles.gradeChipText, gradeMinIdx === idx && styles.gradeChipTextActive]}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.filterLabel}>Max Grade</Text>
              <ScrollView
                ref={maxScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.gradeStrip}
              >
                <TouchableOpacity
                  style={[styles.gradeChip, gradeMaxDiff === undefined && styles.gradeChipActive]}
                  onPress={() => setGradeMaxDiff(undefined)}
                >
                  <Text style={[styles.gradeChipText, gradeMaxDiff === undefined && styles.gradeChipTextActive]}>Any</Text>
                </TouchableOpacity>
                {gradeFilterOptions.map((g, idx) => (
                  <TouchableOpacity
                    key={g.label}
                    style={[styles.gradeChip, gradeMaxIdx === idx && styles.gradeChipActive]}
                    onPress={() => setGradeMaxDiff(g.max)}
                  >
                    <Text style={[styles.gradeChipText, gradeMaxIdx === idx && styles.gradeChipTextActive]}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.filterLabel}>Set Angle</Text>
              <View style={styles.angleFilterGrid}>
                <TouchableOpacity
                  style={[styles.angleFilterChip, setAngleFilter === undefined && styles.angleFilterChipActive]}
                  onPress={() => setSetAngleFilter(undefined)}
                >
                  <Text style={[styles.angleFilterText, setAngleFilter === undefined && styles.angleFilterTextActive]}>Any</Text>
                </TouchableOpacity>
                {ANGLES.map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.angleFilterChip, setAngleFilter === a && styles.angleFilterChipActive]}
                    onPress={() => setSetAngleFilter(setAngleFilter === a ? undefined : a)}
                  >
                    <Text style={[styles.angleFilterText, setAngleFilter === a && styles.angleFilterTextActive]}>
                      {a}{'\u00B0'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>My Activity</Text>
              <View style={styles.optionRow}>
                {([
                  { label: 'All', value: undefined as UserFilter },
                  { label: 'Attempted', value: 'attempted' as UserFilter },
                  { label: 'Sent', value: 'sent' as UserFilter },
                  { label: 'Not Sent', value: 'not_sent' as UserFilter },
                ]).map((opt) => (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[styles.optionChip, userFilter === opt.value && styles.optionChipActive]}
                    onPress={() => setUserFilter(opt.value)}
                  >
                    <Text style={[styles.optionChipText, userFilter === opt.value && styles.optionChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>Matching</Text>
              <View style={styles.optionRow}>
                {([
                  { label: 'All', value: undefined as boolean | undefined },
                  { label: 'Match OK', value: false },
                  { label: 'No Match', value: true },
                ]).map((opt) => (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[styles.optionChip, noMatch === opt.value && styles.optionChipActive]}
                    onPress={() => setNoMatch(opt.value)}
                  >
                    <Text style={[styles.optionChipText, noMatch === opt.value && styles.optionChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>
                Apply{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Board Angle Picker Modal */}
      <Modal
        visible={showAnglePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAnglePicker(false)}
      >
        <TouchableOpacity
          style={styles.angleModalOverlay}
          activeOpacity={1}
          onPress={() => setShowAnglePicker(false)}
        >
          <View style={styles.angleModalContent}>
            <Text style={styles.angleModalTitle}>Board Angle</Text>
            <ScrollView contentContainerStyle={styles.angleGrid}>
              {ANGLES.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={[styles.angleOption, angle === a && styles.angleOptionActive]}
                  onPress={() => { setAngle(a); setShowAnglePicker(false); }}
                >
                  <Text style={[styles.angleOptionText, angle === a && styles.angleOptionTextActive]}>
                    {a}{'\u00B0'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  searchRow: { flexDirection: 'row', padding: 12, gap: 8 },
  searchInput: {
    flex: 1, backgroundColor: colors.surfaceInput, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary,
    fontSize: 15, borderWidth: 1, borderColor: colors.border,
  },
  filterButton: {
    backgroundColor: colors.surfaceInput, borderRadius: 10, paddingHorizontal: 12,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', gap: 4,
  },
  filterButtonActive: { borderColor: colors.accent },
  filterBadge: {
    backgroundColor: colors.accent, borderRadius: 8, minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  filterBadgeText: { color: colors.textOnAccent, fontSize: 10, fontWeight: '700' },
  sortRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 6,
  },
  sortChip: {
    backgroundColor: colors.surfaceInput, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  sortChipActive: { backgroundColor: colors.chip, borderColor: colors.accent },
  sortChipText: { color: colors.textSecondary, fontSize: 13 },
  sortChipTextActive: { color: colors.accent, fontWeight: '600' },

  // Filter modal
  filterOverlay: {
    flex: 1, backgroundColor: colors.overlayDark, justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: colors.surfaceRaised, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, maxHeight: '85%',
  },
  filterHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  filterTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  clearText: { color: colors.error, fontSize: 14, fontWeight: '600' },
  filterLabel: {
    color: colors.textSecondary, fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', marginBottom: 8, marginTop: 16,
  },
  setterInput: {
    backgroundColor: colors.surface, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary,
    fontSize: 14,
  },

  // Grade strip chips
  gradeStrip: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  gradeChip: {
    backgroundColor: colors.surface, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, minWidth: CHIP_WIDTH, alignItems: 'center',
  },
  gradeChipActive: { backgroundColor: colors.accent },
  gradeChipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
  gradeChipTextActive: { color: colors.textOnAccent, fontWeight: '700' },

  // Angle filter grid (4 columns)
  angleFilterGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  angleFilterChip: {
    backgroundColor: colors.surface, borderRadius: 10,
    paddingVertical: 10, minWidth: 68, alignItems: 'center',
  },
  angleFilterChipActive: { backgroundColor: colors.accent },
  angleFilterText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  angleFilterTextActive: { color: colors.textOnAccent, fontWeight: '700' },

  // Activity / matching chips
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    backgroundColor: colors.surface, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  optionChipActive: { backgroundColor: colors.accent },
  optionChipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
  optionChipTextActive: { color: colors.textOnAccent, fontWeight: '700' },

  // Apply button
  applyButton: {
    backgroundColor: colors.accent, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 12,
  },
  applyButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '700' },

  listContainer: { flex: 1 },

  // Board angle picker modal (unchanged)
  angleModalOverlay: {
    flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center',
  },
  angleModalContent: { backgroundColor: colors.surfaceRaised, borderRadius: 16, padding: 20, width: 300 },
  angleModalTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  angleGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  angleOption: {
    backgroundColor: colors.chip, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.borderMedium, minWidth: 56, alignItems: 'center',
  },
  angleOptionActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  angleOptionText: { color: colors.textTertiary, fontSize: 15, fontWeight: '600' },
  angleOptionTextActive: { color: colors.textPrimary },

  list: { paddingVertical: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: colors.error, fontSize: 16, fontWeight: '600' },
  errorDetail: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: colors.accent, justifyContent: 'center',
    alignItems: 'center', elevation: 4, shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  fabText: { color: colors.textPrimary, fontSize: 28, fontWeight: '300', marginTop: -2 },
});
