import React, { useState } from 'react';
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { publishClimb } from '../api/client';
import { GRADE_LABELS, ANGLES } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Publish'>;

export const PublishScreen: React.FC<Props> = ({ route, navigation }) => {
  const { uuid } = route.params;
  const [name, setName] = useState('');
  const [gradeIdx, setGradeIdx] = useState(3);
  const [angle, setAngle] = useState(40);
  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your problem a name.');
      return;
    }

    setPublishing(true);
    try {
      await publishClimb(uuid, {
        name: name.trim(),
        grade: gradeIdx,
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
        placeholderTextColor="#555"
        value={name}
        onChangeText={setName}
        autoFocus
        maxLength={100}
      />

      <Text style={styles.sectionTitle}>Proposed Grade</Text>
      <View style={styles.gradeGrid}>
        {GRADE_LABELS.map((label, idx) => (
          <TouchableOpacity
            key={label}
            style={[styles.gradeChip, gradeIdx === idx && styles.gradeChipActive]}
            onPress={() => setGradeIdx(idx)}
          >
            <Text
              style={[styles.gradeChipText, gradeIdx === idx && styles.gradeChipTextActive]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
          {name || '(untitled)'} · {GRADE_LABELS[gradeIdx]} @ {angle}°
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.publishButton, publishing && styles.publishButtonDisabled]}
        onPress={handlePublish}
        disabled={publishing}
      >
        {publishing ? (
          <ActivityIndicator size="small" color="#fff" />
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
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: '#999',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 20,
  },
  nameInput: {
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 17,
    borderWidth: 1,
    borderColor: '#333',
  },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gradeChip: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
    minWidth: 52,
    alignItems: 'center',
  },
  gradeChipActive: {
    backgroundColor: '#42A5F5',
    borderColor: '#42A5F5',
  },
  gradeChipText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
  },
  gradeChipTextActive: {
    color: '#fff',
  },
  angleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  angleChip: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
    minWidth: 48,
    alignItems: 'center',
  },
  angleChipActive: {
    backgroundColor: '#42A5F5',
    borderColor: '#42A5F5',
  },
  angleChipText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
  },
  angleChipTextActive: {
    color: '#fff',
  },
  summary: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
  },
  summaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  publishButton: {
    marginTop: 20,
    backgroundColor: '#00E676',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
  },
});
