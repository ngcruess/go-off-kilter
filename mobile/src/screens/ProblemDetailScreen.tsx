import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import {
  fetchClimb,
  fetchBoardLayout,
  sendToBoard,
  logAscent,
  fetchUserClimbSummary,
  fetchGrades,
  fetchListsForClimb,
  addToList,
  removeFromList,
  createList,
} from '../api/client';
import { BoardView } from '../components/BoardView/BoardView';
import { useUser } from '../context/UserContext';
import { DifficultyGrade, ANGLES, extractGrade } from '../types';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ProblemDetail'>;

export const ProblemDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { uuid } = route.params;
  const { user, angle, setAngle, gradeSystem, boardConnected } = useUser();
  const autoSentRef = useRef(false);
  const queryClient = useQueryClient();
  const [showAnglePicker, setShowAnglePicker] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState(colors.listPalette[0]);

  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [logging, setLogging] = useState(false);

  const climbQuery = useQuery({
    queryKey: ['climb', uuid, angle],
    queryFn: () => fetchClimb(uuid, angle),
  });

  const gradesQuery = useQuery({
    queryKey: ['grades'],
    queryFn: fetchGrades,
    staleTime: Infinity,
  });

  const gradeOptions = useMemo(() => {
    if (!gradesQuery.data) return [];
    const seen = new Map<string, { label: string; difficulty: number }>();
    for (const g of gradesQuery.data) {
      const label = extractGrade(g.boulder_name, gradeSystem);
      if (!seen.has(label)) {
        seen.set(label, { label, difficulty: g.difficulty });
      }
    }
    return Array.from(seen.values());
  }, [gradesQuery.data, gradeSystem]);

  const layoutQuery = useQuery({
    queryKey: ['layout', climbQuery.data?.layout_id],
    queryFn: () => fetchBoardLayout(climbQuery.data!.layout_id),
    enabled: !!climbQuery.data,
  });

  const summaryQuery = useQuery({
    queryKey: ['user-climb-summary', user?.id, uuid],
    queryFn: () => fetchUserClimbSummary(user!.id, uuid),
    enabled: !!user,
  });

  const listsQuery = useQuery({
    queryKey: ['lists-for-climb', user?.id, uuid],
    queryFn: () => fetchListsForClimb(user!.id, uuid),
    enabled: !!user && showListPicker,
  });

  const toggleListItem = useMutation({
    mutationFn: ({ listId, contains }: { listId: number; contains: boolean }) =>
      contains ? removeFromList(listId, uuid) : addToList(listId, uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists-for-climb', user?.id, uuid] });
      queryClient.invalidateQueries({ queryKey: ['user-lists'] });
    },
  });

  const createNewList = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) => createList(user!.id, name, color),
    onSuccess: async (newList) => {
      await addToList(newList.id, uuid);
      setNewListName('');
      setNewListColor(colors.listPalette[0]);
      queryClient.invalidateQueries({ queryKey: ['lists-for-climb', user?.id, uuid] });
      queryClient.invalidateQueries({ queryKey: ['user-lists'] });
    },
  });

  useEffect(() => {
    if (boardConnected && climbQuery.data && !autoSentRef.current) {
      autoSentRef.current = true;
      sendToBoard(uuid).catch(() => {});
    }
  }, [boardConnected, climbQuery.data, uuid]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerTitle: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            onPress={boardConnected ? handleSendToBoard : undefined}
            style={{
              backgroundColor: colors.chip, borderRadius: 16,
              paddingHorizontal: 12, paddingVertical: 6,
            }}
          >
            <MaterialCommunityIcons
              name="bluetooth"
              size={20}
              color={boardConnected ? colors.accent : colors.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowAnglePicker(true)}
            style={{
              backgroundColor: colors.chip, borderRadius: 16,
              paddingHorizontal: 14, paddingVertical: 6,
            }}
          >
            <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>{angle}{'\u00B0'}</Text>
          </TouchableOpacity>
        </View>
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={{
              backgroundColor: colors.chip, borderRadius: 14,
              padding: 4,
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
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: colors.chip, borderRadius: 14,
              paddingHorizontal: 8, paddingVertical: 4,
            }}
          >
            <MaterialCommunityIcons name="dots-horizontal" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, angle, boardConnected, user?.username]);

  const handleSendToBoard = async () => {
    try {
      await sendToBoard(uuid);
      Alert.alert('Sent', 'Problem sent to board controller.');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  const handleLogAttempt = async () => {
    if (!user) return;
    setLogging(true);
    try {
      await logAscent(uuid, {
        user_id: user.id,
        angle,
        is_send: false,
      });
      queryClient.invalidateQueries({ queryKey: ['user-climb-summary', user.id, uuid] });
      Alert.alert('Logged', 'Attempt recorded.');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setLogging(false);
    }
  };

  const openSendModal = () => {
    const communityDifficulty = climbQuery.data?.stats?.display_difficulty;
    if (communityDifficulty && gradeOptions.length > 0) {
      let closest = gradeOptions[0];
      for (const g of gradeOptions) {
        if (Math.abs(g.difficulty - communityDifficulty) < Math.abs(closest.difficulty - communityDifficulty)) {
          closest = g;
        }
      }
      setSelectedGrade(closest.difficulty);
    }
    setSendModalVisible(true);
  };

  const handleLogSend = async () => {
    if (!user) return;
    if (selectedGrade === null) {
      Alert.alert('Grade Required', 'Please select a proposed grade.');
      return;
    }
    if (selectedQuality === null) {
      Alert.alert('Quality Required', 'Please rate the problem quality.');
      return;
    }
    setLogging(true);
    try {
      await logAscent(uuid, {
        user_id: user.id,
        angle,
        is_send: true,
        proposed_grade: selectedGrade,
        quality: selectedQuality,
        comment: comment.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['user-climb-summary', user.id, uuid] });
      setSendModalVisible(false);
      setSelectedGrade(null);
      setSelectedQuality(null);
      setComment('');
      Alert.alert('Logged', 'Send recorded!');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setLogging(false);
    }
  };

  if (climbQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (climbQuery.error || !climbQuery.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load problem</Text>
      </View>
    );
  }

  const climb = climbQuery.data;
  const grade = climb.stats ? (climb.stats.grade || '??') : '??';
  const qualityAvg = climb.stats?.quality_average;
  const summary = summaryQuery.data;

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {layoutQuery.data && (
        <BoardView
          placements={layoutQuery.data.placements}
          climbPlacements={climb.placements}
        />
      )}

      {layoutQuery.isLoading && (
        <View style={styles.boardPlaceholder}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{climb.name || 'Untitled'}</Text>
          <Text style={styles.grade}>{grade}</Text>
        </View>

        <View style={styles.setterRow}>
          {climb.setter_username ? (
            <Text style={styles.setter}>
              Set by {climb.setter_username}
              {climb.set_angle != null ? ` at ${climb.set_angle}\u00B0` : ''}
            </Text>
          ) : null}
          <View style={[styles.matchBadge, climb.is_no_match ? styles.matchBadgeDanger : styles.matchBadgeSuccess]}>
            <Text style={[styles.matchText, climb.is_no_match ? styles.matchTextDanger : styles.matchTextSuccess]}>
              {climb.is_no_match ? 'No Match' : 'Match OK'}
            </Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statsLeft}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Sends</Text>
              <Text style={styles.statValue}>{climb.stats?.ascensionist_count ?? 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Quality</Text>
              <Text style={styles.statValue}>{qualityAvg ? `\u2605 ${Math.round(qualityAvg)}` : '??'}</Text>
            </View>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsRight}>
            <View style={styles.statItem}>
              <Text style={styles.statLabelGreen}>Your Sends</Text>
              <Text style={styles.statValueGreen}>{summary?.sends ?? 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabelGreen}>Attempts</Text>
              <Text style={styles.statValueGreen}>{summary?.attempts ?? 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.logRow}>
          <TouchableOpacity
            style={[styles.logButton, styles.logAttemptButton]}
            onPress={handleLogAttempt}
            disabled={logging}
          >
            <Text style={styles.logAttemptText}>Log Attempt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.logButton, styles.logSendButton]}
            onPress={openSendModal}
            disabled={logging}
          >
            <Text style={styles.logSendText}>Log Send</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.listButton}
          onPress={() => setShowListPicker(true)}
        >
          <Text style={styles.listButtonText}>Add to List</Text>
        </TouchableOpacity>
      </View>

      {/* Log Send Modal */}
      <Modal
        visible={sendModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSendModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Log Send</Text>

            <Text style={styles.modalLabel}>Proposed Grade</Text>
            <View style={styles.gradeGrid}>
              {gradeOptions.map((g) => (
                <TouchableOpacity
                  key={g.label}
                  style={[styles.gradeChip, selectedGrade === g.difficulty && styles.gradeChipActive]}
                  onPress={() => setSelectedGrade(g.difficulty)}
                >
                  <Text style={[styles.gradeChipText, selectedGrade === g.difficulty && styles.gradeChipTextActive]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Quality</Text>
            <View style={styles.qualityRow}>
              {[1, 2, 3].map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.qualityButton, selectedQuality === q && styles.qualityButtonActive]}
                  onPress={() => setSelectedQuality(q)}
                >
                  <Text style={styles.qualityText}>
                    {'\u2605'.repeat(q)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Comment (optional)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Nice problem!"
              placeholderTextColor={colors.textMuted}
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={500}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setSendModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmit,
                  (logging || selectedGrade === null || selectedQuality === null) && { opacity: 0.5 },
                ]}
                onPress={handleLogSend}
                disabled={logging}
              >
                {logging ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <Text style={styles.modalSubmitText}>Log Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>

    <Modal visible={showAnglePicker} transparent animationType="fade" onRequestClose={() => setShowAnglePicker(false)}>
      <TouchableOpacity style={styles.angleModalOverlay} activeOpacity={1} onPress={() => setShowAnglePicker(false)}>
        <View style={styles.angleModalContent}>
          <Text style={styles.angleModalTitle}>Board Angle</Text>
          <View style={styles.angleGrid}>
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
          </View>
        </View>
      </TouchableOpacity>
    </Modal>

    <Modal visible={showListPicker} transparent animationType="slide" onRequestClose={() => setShowListPicker(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.listModalContent}>
          <Text style={styles.modalTitle}>Add to List</Text>

          {listsQuery.isLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
          ) : (listsQuery.data ?? []).length === 0 ? (
            <Text style={styles.listEmptyText}>No lists yet. Create one below.</Text>
          ) : (
            <ScrollView style={styles.listScroll}>
              {(listsQuery.data ?? []).map((m) => (
                <TouchableOpacity
                  key={m.list_id}
                  style={styles.listRow}
                  onPress={() => toggleListItem.mutate({ listId: m.list_id, contains: m.contains })}
                >
                  <View style={[styles.listCheckbox, m.contains && styles.listCheckboxActive]}>
                    {m.contains && <Text style={styles.listCheckmark}>{'\u2713'}</Text>}
                  </View>
                  <View style={[styles.listColorDot, { backgroundColor: m.color || colors.accent }]} />
                  <Text style={styles.listRowText}>{m.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.newListRow}>
            <TextInput
              style={styles.newListInput}
              placeholder="New list name..."
              placeholderTextColor={colors.textMuted}
              value={newListName}
              onChangeText={setNewListName}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.newListButton, !newListName.trim() && { opacity: 0.4 }]}
              onPress={() => newListName.trim() && createNewList.mutate({ name: newListName.trim(), color: newListColor })}
              disabled={!newListName.trim() || createNewList.isPending}
            >
              <Text style={styles.newListButtonText}>Create</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.colorPickerRow}>
            {colors.listPalette.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setNewListColor(c)}
                style={[
                  styles.colorPickerSwatch,
                  { backgroundColor: c },
                  newListColor === c && styles.colorPickerSwatchActive,
                ]}
              />
            ))}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowListPicker(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSubmit} onPress={() => setShowListPicker(false)}>
              <Text style={styles.modalSubmitText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  content: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.pageBg },
  errorText: { color: colors.error, fontSize: 16 },
  boardPlaceholder: { height: 300, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  info: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', flex: 1, marginRight: 12 },
  grade: { color: colors.accent, fontSize: 24, fontWeight: '800', fontStyle: 'italic' },
  setterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  setter: { color: colors.textSecondary, fontSize: 14 },
  statsContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.25)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  statsLeft: { flex: 1, flexDirection: 'row', gap: 16, justifyContent: 'center' },
  statsDivider: { width: 1, height: 28, backgroundColor: colors.textDisabled },
  statsRight: { flex: 1, flexDirection: 'row', gap: 16, justifyContent: 'center' },
  statItem: { alignItems: 'center' },
  statLabel: { color: colors.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  statValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  statLabelGreen: { color: colors.accentGreen, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  statValueGreen: { color: colors.accentGreen, fontSize: 15, fontWeight: '600' },
  matchBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  matchBadgeDanger: { backgroundColor: colors.error },
  matchBadgeSuccess: { backgroundColor: colors.success },
  matchText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  matchTextDanger: { color: colors.textPrimary },
  matchTextSuccess: { color: colors.textPrimary },
  logRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  logButton: {
    flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  logAttemptButton: { backgroundColor: colors.chip },
  logSendButton: {
    backgroundColor: colors.accentGreenBg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#5a9474',
  },
  logAttemptText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  logSendText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },

  modalOverlay: {
    flex: 1, backgroundColor: colors.overlayDark, justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surfaceRaised, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, maxHeight: '80%',
  },
  modalTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  modalLabel: { color: colors.textSecondary, fontSize: 12, textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  gradeChip: {
    backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
    minWidth: 56, alignItems: 'center',
  },
  gradeChipActive: { backgroundColor: colors.accent },
  gradeChipText: { color: colors.textSecondary, fontSize: 14 },
  gradeChipTextActive: { color: colors.textPrimary, fontWeight: '700' },
  qualityRow: { flexDirection: 'row', gap: 10 },
  qualityButton: {
    backgroundColor: colors.chip, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.borderMedium,
  },
  qualityButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  qualityText: { color: colors.star, fontSize: 16 },
  commentInput: {
    backgroundColor: colors.chip, borderRadius: 10, padding: 12, color: colors.textPrimary,
    fontSize: 14, minHeight: 60, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.borderMedium,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancel: {
    flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    backgroundColor: colors.error,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  modalCancelText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  modalSubmit: {
    flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    backgroundColor: colors.accentGreenBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#5a9474',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  modalSubmitText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
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
  angleOptionTextActive: { color: colors.textOnAccent },
  listButton: {
    marginTop: 8, backgroundColor: colors.chip,
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  listButtonText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  listModalContent: {
    backgroundColor: colors.surfaceRaised, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, maxHeight: '70%',
  },
  listScroll: { marginBottom: 12 },
  listEmptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginVertical: 20 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.borderCard,
  },
  listCheckbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.textDisabled,
    marginRight: 12, justifyContent: 'center', alignItems: 'center',
  },
  listCheckboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  listCheckmark: { color: colors.textOnAccent, fontSize: 14, fontWeight: '700' },
  listColorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  listRowText: { color: colors.textPrimary, fontSize: 15 },
  newListRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  newListInput: {
    flex: 1, backgroundColor: colors.chip, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 8, color: colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: colors.borderMedium,
  },
  newListButton: {
    backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16,
    justifyContent: 'center',
  },
  newListButtonText: { color: colors.textOnAccent, fontSize: 14, fontWeight: '700' },
  colorPickerRow: {
    flexDirection: 'row', gap: 8, marginBottom: 16,
  },
  colorPickerSwatch: {
    width: 24, height: 24, borderRadius: 12,
  },
  colorPickerSwatchActive: {
    borderWidth: 2.5, borderColor: colors.textPrimary,
  },
});
