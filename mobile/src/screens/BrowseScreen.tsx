import React, { useState, useCallback, useMemo } from 'react';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Browse'>;

export const BrowseScreen: React.FC<Props> = ({ navigation }) => {
  const { user, angle, setAngle, gradeSystem, boardConnected, setBoardConnected } = useUser();
  const [search, setSearch] = useState('');
  const [setter, setSetter] = useState('');
  const [gradeMin, setGradeMin] = useState<number | undefined>(undefined);
  const [gradeMax, setGradeMax] = useState<number | undefined>(undefined);
  const [setAngleFilter, setSetAngleFilter] = useState<number | undefined>(undefined);
  const [noMatch, setNoMatch] = useState<boolean | undefined>(undefined);
  const [userFilter, setUserFilter] = useState<UserFilter>(undefined);
  const [sortKey, setSortKey] = useState<SortKey>('ascents');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [showAnglePicker, setShowAnglePicker] = useState(false);

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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (setter) count++;
    if (gradeMin !== undefined) count++;
    if (gradeMax !== undefined) count++;
    if (setAngleFilter !== undefined) count++;
    if (noMatch !== undefined) count++;
    if (userFilter) count++;
    return count;
  }, [setter, gradeMin, gradeMax, setAngleFilter, noMatch, userFilter]);

  const clearFilters = useCallback(() => {
    setSetter('');
    setGradeMin(undefined);
    setGradeMax(undefined);
    setSetAngleFilter(undefined);
    setNoMatch(undefined);
    setUserFilter(undefined);
  }, []);

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
    queryKey: ['climbs', search, setter, gradeMin, gradeMax, angle, setAngleFilter, noMatch, userFilter, user?.id, sortKey, sortOrder, gradeSystem],
    queryFn: ({ pageParam }) =>
      fetchClimbs({
        name: search || undefined,
        setter: setter || undefined,
        grade_min: gradeMin !== undefined ? gradeFilterOptions[gradeMin]?.min : undefined,
        grade_max: gradeMax !== undefined ? gradeFilterOptions[gradeMax]?.max : undefined,
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
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={styles.filterButtonText}>
            {showFilters ? 'Hide' : 'Filters'}
            {!showFilters && activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
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

      {showFilters && (
        <ScrollView style={styles.filterScroll} contentContainerStyle={styles.filterSection}>
          <TextInput
            style={styles.setterInput}
            placeholder="Setter name..."
            placeholderTextColor={colors.textMuted}
            value={setter}
            onChangeText={setSetter}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.filterLabel}>Grade Range</Text>
          <View style={styles.filterRow}>
            <FilterPicker
              label="Min"
              options={gradeFilterOptions.map((g) => g.label)}
              value={gradeMin}
              onSelect={setGradeMin}
            />
            <FilterPicker
              label="Max"
              options={gradeFilterOptions.map((g) => g.label)}
              value={gradeMax}
              onSelect={setGradeMax}
            />
          </View>

          <Text style={styles.filterLabel}>Set Angle</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, setAngleFilter === undefined && styles.chipActive]}
              onPress={() => setSetAngleFilter(undefined)}
            >
              <Text style={[styles.chipText, setAngleFilter === undefined && styles.chipTextActive]}>Any</Text>
            </TouchableOpacity>
            {ANGLES.map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.chip, setAngleFilter === a && styles.chipActive]}
                onPress={() => setSetAngleFilter(setAngleFilter === a ? undefined : a)}
              >
                <Text style={[styles.chipText, setAngleFilter === a && styles.chipTextActive]}>
                  {a}{'\u00B0'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterLabel}>My Activity</Text>
          <View style={styles.chipRow}>
            {([
              { label: 'All', value: undefined as UserFilter },
              { label: 'Attempted', value: 'attempted' as UserFilter },
              { label: 'Sent', value: 'sent' as UserFilter },
              { label: 'Not Sent', value: 'not_sent' as UserFilter },
            ]).map((opt) => (
              <TouchableOpacity
                key={String(opt.value)}
                style={[styles.matchChip, userFilter === opt.value && styles.matchChipActive]}
                onPress={() => setUserFilter(opt.value)}
              >
                <Text style={[styles.matchChipText, userFilter === opt.value && styles.matchChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterLabel}>Matching</Text>
          <View style={styles.chipRow}>
            {([
              { label: 'All', value: undefined as boolean | undefined },
              { label: 'Match OK', value: false },
              { label: 'No Match', value: true },
            ]).map((opt) => (
              <TouchableOpacity
                key={String(opt.value)}
                style={[styles.matchChip, noMatch === opt.value && styles.matchChipActive]}
                onPress={() => setNoMatch(opt.value)}
              >
                <Text style={[styles.matchChipText, noMatch === opt.value && styles.matchChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeFilterCount > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>Clear All Filters</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

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

interface FilterPickerProps {
  label: string;
  options: string[];
  value: number | undefined;
  onSelect: (value: number | undefined) => void;
}

const FilterPicker: React.FC<FilterPickerProps> = ({ label, options, value, onSelect }) => {
  return (
    <View style={styles.pickerContainer}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, value === undefined && styles.chipActive]}
          onPress={() => onSelect(undefined)}
        >
          <Text style={[styles.chipText, value === undefined && styles.chipTextActive]}>
            Any
          </Text>
        </TouchableOpacity>
        {options.map((opt, idx) => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, value === idx && styles.chipActive]}
            onPress={() => onSelect(idx)}
          >
            <Text style={[styles.chipText, value === idx && styles.chipTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
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
    backgroundColor: colors.surfaceInput, borderRadius: 10, paddingHorizontal: 14,
    justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  filterButtonText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
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
  filterScroll: { maxHeight: 320 },
  filterSection: { paddingHorizontal: 12, paddingBottom: 12 },
  filterLabel: {
    color: colors.textSecondary, fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', marginBottom: 6, marginTop: 12,
  },
  filterRow: { flexDirection: 'row', gap: 12 },
  setterInput: {
    backgroundColor: colors.surfaceInput, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, color: colors.textPrimary,
    fontSize: 14, borderWidth: 1, borderColor: colors.border, marginTop: 4,
  },
  clearButton: {
    alignSelf: 'center', marginTop: 14,
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: colors.error,
  },
  clearButtonText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  listContainer: { flex: 1 },
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
  pickerContainer: { flex: 1 },
  pickerLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: {
    backgroundColor: colors.surfaceInput, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontSize: 12 },
  chipTextActive: { color: colors.textPrimary, fontWeight: '600' },
  matchChip: {
    backgroundColor: colors.surfaceInput, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  matchChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  matchChipText: { color: colors.textSecondary, fontSize: 13 },
  matchChipTextActive: { color: colors.textPrimary, fontWeight: '600' },
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
