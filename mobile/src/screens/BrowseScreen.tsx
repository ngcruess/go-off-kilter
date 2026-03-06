import React, { useState, useCallback } from 'react';
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
import { useInfiniteQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { fetchClimbs } from '../api/client';
import { ProblemCard } from '../components/ProblemCard/ProblemCard';
import { ClimbSummary, GRADE_LABELS, ANGLES } from '../types';
import { useUser } from '../context/UserContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Browse'>;

export const BrowseScreen: React.FC<Props> = ({ navigation }) => {
  const { user, angle, setAngle } = useUser();
  const [search, setSearch] = useState('');
  const [gradeMin, setGradeMin] = useState<number | undefined>(undefined);
  const [gradeMax, setGradeMax] = useState<number | undefined>(undefined);
  const [noMatch, setNoMatch] = useState<boolean | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [showAnglePicker, setShowAnglePicker] = useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity
            onPress={() => setShowAnglePicker(true)}
            style={{
              backgroundColor: '#2a2a2a', borderRadius: 14,
              paddingHorizontal: 10, paddingVertical: 4,
            }}
          >
            <Text style={{ color: '#42A5F5', fontSize: 14, fontWeight: '700' }}>{angle}{'\u00B0'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: '#2a2a2a', borderRadius: 14,
              paddingHorizontal: 10, paddingVertical: 4,
            }}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: '#444', justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: '#aaa', fontSize: 10, fontWeight: '700' }}>
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={{ color: '#42A5F5', fontSize: 13, fontWeight: '600' }}>
              {user?.username || 'Profile'}
            </Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, angle, user]);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['climbs', search, gradeMin, gradeMax, angle, noMatch],
    queryFn: ({ pageParam }) =>
      fetchClimbs({
        name: search || undefined,
        grade_min: gradeMin,
        grade_max: gradeMax,
        angle,
        no_match: noMatch,
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
          placeholderTextColor="#666"
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
          </Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Grade Range</Text>
          <View style={styles.filterRow}>
            <FilterPicker
              label="Min"
              options={GRADE_LABELS}
              value={gradeMin}
              onSelect={(v) => setGradeMin(v)}
            />
            <FilterPicker
              label="Max"
              options={GRADE_LABELS}
              value={gradeMax}
              onSelect={(v) => setGradeMax(v)}
            />
          </View>

          <Text style={styles.filterLabel}>Matching</Text>
          <View style={styles.matchRow}>
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
        </View>
      )}

      {isLoading && !isFetchingNextPage && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#42A5F5" />
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
              <ActivityIndicator style={{ paddingVertical: 16 }} color="#42A5F5" />
            ) : null
          }
        />
      )}

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
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  searchRow: { flexDirection: 'row', padding: 12, gap: 8 },
  searchInput: {
    flex: 1, backgroundColor: '#1e1e1e', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, color: '#ffffff',
    fontSize: 15, borderWidth: 1, borderColor: '#333',
  },
  filterButton: {
    backgroundColor: '#1e1e1e', borderRadius: 10, paddingHorizontal: 14,
    justifyContent: 'center', borderWidth: 1, borderColor: '#333',
  },
  filterButtonText: { color: '#42A5F5', fontSize: 14, fontWeight: '600' },
  filterSection: { paddingHorizontal: 12, paddingBottom: 8 },
  filterLabel: {
    color: '#999', fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', marginBottom: 6, marginTop: 8,
  },
  filterRow: { flexDirection: 'row', gap: 12 },
  angleModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },
  angleModalContent: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, width: 300 },
  angleModalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  angleGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  angleOption: {
    backgroundColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: '#444', minWidth: 56, alignItems: 'center',
  },
  angleOptionActive: { backgroundColor: '#42A5F5', borderColor: '#42A5F5' },
  angleOptionText: { color: '#aaa', fontSize: 15, fontWeight: '600' },
  angleOptionTextActive: { color: '#fff' },
  pickerContainer: { flex: 1 },
  pickerLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: {
    backgroundColor: '#1e1e1e', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: '#333',
  },
  chipActive: { backgroundColor: '#42A5F5', borderColor: '#42A5F5' },
  chipText: { color: '#888', fontSize: 12 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  matchRow: { flexDirection: 'row', gap: 8 },
  matchChip: {
    backgroundColor: '#1e1e1e', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: '#333',
  },
  matchChipActive: { backgroundColor: '#42A5F5', borderColor: '#42A5F5' },
  matchChipText: { color: '#888', fontSize: 13 },
  matchChipTextActive: { color: '#fff', fontWeight: '600' },
  list: { paddingVertical: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#ff6b6b', fontSize: 16, fontWeight: '600' },
  errorDetail: { color: '#888', fontSize: 13, marginTop: 4 },
  emptyText: { color: '#666', fontSize: 15 },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: '#42A5F5', justifyContent: 'center',
    alignItems: 'center', elevation: 4, shadowColor: '#42A5F5',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
});
