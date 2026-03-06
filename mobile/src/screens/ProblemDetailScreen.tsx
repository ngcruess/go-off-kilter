import React, { useState } from 'react';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import {
  fetchClimb,
  fetchBoardLayout,
  sendToBoard,
  logAscent,
  fetchUserClimbSummary,
  fetchGrades,
} from '../api/client';
import { BoardView } from '../components/BoardView/BoardView';
import { useUser } from '../context/UserContext';
import { DifficultyGrade } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProblemDetail'>;

export const ProblemDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { uuid } = route.params;
  const { user, angle } = useUser();
  const queryClient = useQueryClient();

  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [logging, setLogging] = useState(false);

  const climbQuery = useQuery({
    queryKey: ['climb', uuid],
    queryFn: () => fetchClimb(uuid),
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

  React.useEffect(() => {
    if (climbQuery.data?.name) {
      navigation.setOptions({ title: climbQuery.data.name });
    }
  }, [climbQuery.data?.name, navigation]);

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
        <ActivityIndicator size="large" color="#42A5F5" />
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
  const stars = climb.stats?.quality_average
    ? '\u2605'.repeat(Math.round(climb.stats.quality_average))
    : '';
  const summary = summaryQuery.data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {layoutQuery.data && (
        <BoardView
          placements={layoutQuery.data.placements}
          climbPlacements={climb.placements}
        />
      )}

      {layoutQuery.isLoading && (
        <View style={styles.boardPlaceholder}>
          <ActivityIndicator size="large" color="#42A5F5" />
        </View>
      )}

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{climb.name || 'Untitled'}</Text>
          <Text style={styles.grade}>{grade}</Text>
        </View>

        {climb.setter_username ? (
          <Text style={styles.setter}>Set by {climb.setter_username}</Text>
        ) : null}

        <View style={styles.statsRow}>
          {climb.stats?.angle ? (
            <StatBadge label="Angle" value={`${climb.stats.angle}\u00B0`} />
          ) : null}
          {climb.stats?.ascensionist_count ? (
            <StatBadge label="Sends" value={String(climb.stats.ascensionist_count)} />
          ) : null}
          {stars ? <StatBadge label="Quality" value={stars} /> : null}
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
      </View>

      <TouchableOpacity style={styles.sendButton} onPress={handleSendToBoard}>
        <Text style={styles.sendButtonText}>Send to Board</Text>
      </TouchableOpacity>

      <View style={styles.logRow}>
        <TouchableOpacity
          style={[styles.logButton, styles.logAttemptButton]}
          onPress={handleLogAttempt}
          disabled={logging}
        >
          <Text style={styles.logButtonText}>Log Attempt</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.logButton, styles.logSendButton]}
          onPress={openSendModal}
          disabled={logging}
        >
          <Text style={styles.logButtonText}>Log Send</Text>
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
                    {g.boulder_name}
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
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  errorText: { color: '#ff6b6b', fontSize: 16 },
  boardPlaceholder: { height: 300, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  info: { padding: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { color: '#ffffff', fontSize: 22, fontWeight: '700', flex: 1, marginRight: 12 },
  grade: { color: '#42A5F5', fontSize: 22, fontWeight: '800' },
  setter: { color: '#888', fontSize: 14, marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statBadge: {
    backgroundColor: '#1e1e1e', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  statLabel: { color: '#888', fontSize: 11, textTransform: 'uppercase', marginBottom: 2 },
  statValue: { color: '#fff', fontSize: 15, fontWeight: '600' },
  noMatchBadge: {
    backgroundColor: '#2a1a1a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#3a2a2a',
  },
  noMatchText: { color: '#e57373', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  yourStatsRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
    backgroundColor: '#1a2a1a', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#2a3a2a',
  },
  yourStatsLabel: { color: '#6a6', fontSize: 13, marginRight: 8 },
  yourStatsValue: { color: '#8c8', fontSize: 14, fontWeight: '600' },
  description: { color: '#aaa', fontSize: 14, lineHeight: 20 },
  sendButton: {
    marginHorizontal: 16, marginTop: 8, backgroundColor: '#42A5F5',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  sendButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  logRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 10 },
  logButton: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logAttemptButton: { backgroundColor: '#333' },
  logSendButton: { backgroundColor: '#2e7d32' },
  logButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Modal styles
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
  gradeChipActive: { backgroundColor: '#42A5F5', borderColor: '#42A5F5' },
  gradeChipText: { color: '#aaa', fontSize: 13 },
  gradeChipTextActive: { color: '#fff' },
  qualityRow: { flexDirection: 'row', gap: 10 },
  qualityButton: {
    backgroundColor: '#2a2a2a', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: '#444',
  },
  qualityButtonActive: { backgroundColor: '#42A5F5', borderColor: '#42A5F5' },
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
    backgroundColor: '#2e7d32',
  },
  modalSubmitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
