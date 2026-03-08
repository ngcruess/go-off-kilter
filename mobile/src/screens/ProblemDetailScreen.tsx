import React, { useState, useRef, useEffect } from 'react';
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

type Props = NativeStackScreenProps<RootStackParamList, 'ProblemDetail'>;

export const ProblemDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { uuid } = route.params;
  const { user, angle, setAngle, gradeSystem, boardConnected } = useUser();
  const autoSentRef = useRef(false);
  const queryClient = useQueryClient();
  const [showAnglePicker, setShowAnglePicker] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);
  const [newListName, setNewListName] = useState('');

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
    mutationFn: (name: string) => createList(user!.id, name),
    onSuccess: async (newList) => {
      await addToList(newList.id, uuid);
      setNewListName('');
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
      title: climbQuery.data?.name || 'Problem',
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {boardConnected && (
            <TouchableOpacity
              onPress={handleSendToBoard}
              style={{
                backgroundColor: '#2a2a2a', borderRadius: 14,
                paddingHorizontal: 10, paddingVertical: 4,
              }}
            >
              <MaterialCommunityIcons name="bluetooth" size={18} color="#00E5FF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowAnglePicker(true)}
            style={{
              backgroundColor: '#2a2a2a', borderRadius: 14,
              paddingHorizontal: 10, paddingVertical: 4,
            }}
          >
            <Text style={{ color: '#00E5FF', fontSize: 14, fontWeight: '700' }}>{angle}{'\u00B0'}</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [climbQuery.data?.name, navigation, angle, boardConnected]);

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
    if (communityDifficulty && gradesQuery.data) {
      const rounded = Math.round(communityDifficulty);
      const match = gradesQuery.data.find((g) => g.difficulty === rounded);
      if (match) setSelectedGrade(match.difficulty);
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
        <ActivityIndicator size="large" color="#00E5FF" />
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
          <ActivityIndicator size="large" color="#00E5FF" />
        </View>
      )}

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{climb.name || 'Untitled'}</Text>
          <Text style={styles.grade}>{grade}</Text>
        </View>

        {climb.setter_username ? (
          <Text style={styles.setter}>
            Set by {climb.setter_username}
            {climb.set_angle != null ? ` at ${climb.set_angle}\u00B0` : ''}
          </Text>
        ) : null}

        <View style={styles.statsRow}>
          <StatBadge label="Angle" value={`${angle}\u00B0`} />
          {climb.stats?.ascensionist_count ? (
            <StatBadge label="Sends" value={String(climb.stats.ascensionist_count)} />
          ) : null}
          {qualityAvg ? <StatBadge label="Quality" value={`\u2605 ${Math.round(qualityAvg)}`} /> : null}
          {climb.is_no_match ? (
            <View style={styles.noMatchBadge}>
              <Text style={styles.noMatchText}>No Match</Text>
            </View>
          ) : null}
        </View>

        {summary && (summary.attempts > 0 || summary.sends > 0) ? (
          <View style={styles.yourStatsRow}>
            <Text style={styles.yourStatsLabel}>Your progress:</Text>
            <Text style={styles.yourStatsValue}>
              {summary.sends} send{summary.sends !== 1 ? 's' : ''},{' '}
              {summary.attempts} attempt{summary.attempts !== 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}

        {climb.description ? (
          <Text style={styles.description}>{climb.description}</Text>
        ) : null}
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeScroll}>
              {(gradesQuery.data ?? []).map((g: DifficultyGrade) => (
                <TouchableOpacity
                  key={g.difficulty}
                  style={[styles.gradeChip, selectedGrade === g.difficulty && styles.gradeChipActive]}
                  onPress={() => setSelectedGrade(g.difficulty)}
                >
                  <Text style={[styles.gradeChipText, selectedGrade === g.difficulty && styles.gradeChipTextActive]}>
                    {extractGrade(g.boulder_name, gradeSystem)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

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
              placeholderTextColor="#666"
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
                  <ActivityIndicator color="#fff" />
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
            <ActivityIndicator color="#00E5FF" style={{ marginVertical: 20 }} />
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
                  <Text style={styles.listRowText}>{m.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.newListRow}>
            <TextInput
              style={styles.newListInput}
              placeholder="New list name..."
              placeholderTextColor="#666"
              value={newListName}
              onChangeText={setNewListName}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.newListButton, !newListName.trim() && { opacity: 0.4 }]}
              onPress={() => newListName.trim() && createNewList.mutate(newListName.trim())}
              disabled={!newListName.trim() || createNewList.isPending}
            >
              <Text style={styles.newListButtonText}>Create</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.modalCancel} onPress={() => setShowListPicker(false)}>
            <Text style={styles.modalCancelText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </>
  );
};

const StatBadge: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.statBadge}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  errorText: { color: '#ff6b6b', fontSize: 16 },
  boardPlaceholder: { height: 300, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  info: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { color: '#ffffff', fontSize: 24, fontWeight: '700', flex: 1, marginRight: 12 },
  grade: { color: '#00E5FF', fontSize: 24, fontWeight: '800', fontStyle: 'italic' },
  setter: { color: '#888', fontSize: 14, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statBadge: {
    backgroundColor: '#111', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 0.5, borderColor: '#333',
  },
  statLabel: { color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  statValue: { color: '#fff', fontSize: 15, fontWeight: '600' },
  noMatchBadge: {
    backgroundColor: '#2a1a1a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#3a2a2a', justifyContent: 'center',
  },
  noMatchText: { color: '#e57373', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  yourStatsRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    backgroundColor: '#163028', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 0.5, borderColor: '#4dba8a',
  },
  yourStatsLabel: { color: '#4dba8a', fontSize: 13, marginRight: 6 },
  yourStatsValue: { color: '#4dba8a', fontSize: 14, fontWeight: '600' },
  description: { color: '#aaa', fontSize: 14, lineHeight: 20, marginBottom: 4 },
  logRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  logButton: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 0.5 },
  logAttemptButton: { backgroundColor: '#111', borderColor: '#333' },
  logSendButton: { backgroundColor: '#163028', borderColor: '#4dba8a' },
  logAttemptText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  logSendText: { color: '#4dba8a', fontSize: 15, fontWeight: '700' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, maxHeight: '80%',
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  modalLabel: { color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  gradeScroll: { flexGrow: 0, marginBottom: 4 },
  gradeChip: {
    backgroundColor: '#2a2a2a', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
    marginRight: 6, borderWidth: 1, borderColor: '#444',
  },
  gradeChipActive: { backgroundColor: '#00E5FF', borderColor: '#00E5FF' },
  gradeChipText: { color: '#aaa', fontSize: 13 },
  gradeChipTextActive: { color: '#000' },
  qualityRow: { flexDirection: 'row', gap: 10 },
  qualityButton: {
    backgroundColor: '#2a2a2a', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: '#444',
  },
  qualityButtonActive: { backgroundColor: '#00E5FF', borderColor: '#00E5FF' },
  qualityText: { color: '#FFD700', fontSize: 16 },
  commentInput: {
    backgroundColor: '#2a2a2a', borderRadius: 10, padding: 12, color: '#fff',
    fontSize: 14, minHeight: 60, textAlignVertical: 'top', borderWidth: 1, borderColor: '#444',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancel: {
    flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#333',
  },
  modalCancelText: { color: '#aaa', fontSize: 15, fontWeight: '600' },
  modalSubmit: {
    flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#1a3a2a',
  },
  modalSubmitText: { color: '#00E5FF', fontSize: 15, fontWeight: '700' },
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
  angleOptionActive: { backgroundColor: '#00E5FF', borderColor: '#00E5FF' },
  angleOptionText: { color: '#aaa', fontSize: 15, fontWeight: '600' },
  angleOptionTextActive: { color: '#000' },
  listButton: {
    marginTop: 8, backgroundColor: '#111',
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    borderWidth: 0.5, borderColor: '#333',
  },
  listButtonText: { color: '#00E5FF', fontSize: 15, fontWeight: '700' },
  listModalContent: {
    backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, maxHeight: '70%',
  },
  listScroll: { marginBottom: 12 },
  listEmptyText: { color: '#666', fontSize: 14, textAlign: 'center', marginVertical: 20 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
  },
  listCheckbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#555',
    marginRight: 12, justifyContent: 'center', alignItems: 'center',
  },
  listCheckboxActive: { backgroundColor: '#00E5FF', borderColor: '#00E5FF' },
  listCheckmark: { color: '#000', fontSize: 14, fontWeight: '700' },
  listRowText: { color: '#fff', fontSize: 15 },
  newListRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  newListInput: {
    flex: 1, backgroundColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 8, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#444',
  },
  newListButton: {
    backgroundColor: '#00E5FF', borderRadius: 10, paddingHorizontal: 16,
    justifyContent: 'center',
  },
  newListButtonText: { color: '#000', fontSize: 14, fontWeight: '700' },
});
