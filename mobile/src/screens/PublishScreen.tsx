import React, { useState } from 'react';
import { colors } from '../theme';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { publishClimb, fetchGrades } from '../api/client';
import { ANGLES, DifficultyGrade, extractGrade } from '../types';
import { useUser } from '../context/UserContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Publish'>;

export const PublishScreen: React.FC<Props> = ({ route, navigation }) => {
  const { uuid } = route.params;
  const { angle: sessionAngle, gradeSystem } = useUser();
  const [name, setName] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<number | null>(null);
  const [angle, setAngle] = useState(sessionAngle);
  const [publishing, setPublishing] = useState(false);

  const gradesQuery = useQuery({
    queryKey: ['grades'],
    queryFn: fetchGrades,
    staleTime: Infinity,
  });

  const grades = gradesQuery.data ?? [];
  const selectedGrade = grades.find((g: DifficultyGrade) => g.difficulty === selectedDifficulty);

  const handlePublish = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your problem a name.');
      return;
    }
    if (selectedDifficulty === null) {
      Alert.alert('Grade required', 'Select a proposed grade.');
      return;
    }

    setPublishing(true);
    try {
      await publishClimb(uuid, {
        name: name.trim(),
        difficulty: selectedDifficulty,
        angle,
      });
      Alert.alert('Published', 'Your problem is now public.', [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Problem Name</Text>
      <TextInput
        style={styles.nameInput}
        placeholder="Give it a name..."
        placeholderTextColor={colors.textDisabled}
        value={name}
        onChangeText={setName}
        autoFocus
        maxLength={100}
      />

      <Text style={styles.sectionTitle}>Proposed Grade</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeScroll}>
        {grades.map((g: DifficultyGrade) => (
          <TouchableOpacity
            key={g.difficulty}
            style={[styles.gradeChip, selectedDifficulty === g.difficulty && styles.gradeChipActive]}
            onPress={() => setSelectedDifficulty(g.difficulty)}
          >
            <Text
              style={[styles.gradeChipText, selectedDifficulty === g.difficulty && styles.gradeChipTextActive]}
            >
              {extractGrade(g.boulder_name, gradeSystem)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Angle (degrees)</Text>
      <View style={styles.angleGrid}>
        {ANGLES.map((a) => (
          <TouchableOpacity
            key={a}
            style={[styles.angleChip, angle === a && styles.angleChipActive]}
            onPress={() => setAngle(a)}
          >
            <Text style={[styles.angleChipText, angle === a && styles.angleChipTextActive]}>
              {a}°
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {name || '(untitled)'} · {selectedGrade ? extractGrade(selectedGrade.boulder_name, gradeSystem) : '??'} @ {angle}°
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.publishButton, (publishing || selectedDifficulty === null) && styles.publishButtonDisabled]}
        onPress={handlePublish}
        disabled={publishing || selectedDifficulty === null}
      >
        {publishing ? (
          <ActivityIndicator size="small" color={colors.textPrimary} />
        ) : (
          <Text style={styles.publishButtonText}>Publish</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 20,
  },
  nameInput: {
    backgroundColor: colors.surfaceInput,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 17,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gradeScroll: {
    marginBottom: 4,
  },
  gradeChip: {
    backgroundColor: colors.surfaceInput,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 52,
    alignItems: 'center',
    marginRight: 8,
  },
  gradeChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  gradeChipText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  gradeChipTextActive: {
    color: colors.textPrimary,
  },
  angleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  angleChip: {
    backgroundColor: colors.surfaceInput,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 48,
    alignItems: 'center',
  },
  angleChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  angleChipText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  angleChipTextActive: {
    color: colors.textPrimary,
  },
  summary: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 10,
    padding: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.borderCard,
    alignItems: 'center',
  },
  summaryText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  publishButton: {
    marginTop: 20,
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    color: colors.textOnAccent,
    fontSize: 17,
    fontWeight: '800',
  },
});
