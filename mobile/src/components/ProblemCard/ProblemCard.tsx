import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ClimbSummary } from '../../types';

interface ProblemCardProps {
  climb: ClimbSummary;
  onPress: () => void;
  onLongPress?: () => void;
}

export const ProblemCard: React.FC<ProblemCardProps> = ({ climb, onPress, onLongPress }) => {
  const grade = climb.grade || '??';

  const stars = climb.quality_average
    ? '★'.repeat(Math.round(climb.quality_average))
    : '';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {climb.name || 'Untitled'}
        </Text>
        <Text style={styles.grade}>{grade}</Text>
      </View>
      <View style={styles.meta}>
        {climb.setter_username ? (
          <Text style={styles.setter}>{climb.setter_username}</Text>
        ) : null}
        {climb.angle ? (
          <Text style={styles.angle}>{climb.angle}{'\u00B0'}</Text>
        ) : null}
        {stars ? <Text style={styles.stars}>{stars}</Text> : null}
        {climb.ascensionist_count ? (
          <Text style={styles.ascents}>
            {climb.ascensionist_count} send{climb.ascensionist_count !== 1 ? 's' : ''}
          </Text>
        ) : null}
        {climb.is_no_match ? (
          <Text style={styles.noMatch}>No Match</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  grade: {
    color: '#42A5F5',
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  setter: {
    color: '#888888',
    fontSize: 13,
  },
  angle: {
    color: '#888888',
    fontSize: 13,
  },
  stars: {
    color: '#FFD700',
    fontSize: 13,
  },
  ascents: {
    color: '#666666',
    fontSize: 12,
  },
  noMatch: {
    color: '#e57373',
    fontSize: 11,
    fontWeight: '600',
  },
});
