import React, { useState, useCallback } from 'react';
import { colors } from '../theme';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { fetchBoardLayout, createClimb } from '../api/client';
import { BoardView } from '../components/BoardView/BoardView';
import { HoldColor, COLOR_TO_ROLE, COLOR_HEX } from '../types';
import { useUser } from '../context/UserContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Create'>;

const COLOR_CYCLE: (HoldColor)[] = [null, 'yellow', 'green', 'blue', 'pink'];

export const CreateScreen: React.FC<Props> = ({ route, navigation }) => {
  const { layoutId } = route.params;
  const { user } = useUser();
  const [selectedHolds, setSelectedHolds] = useState<Map<number, HoldColor>>(new Map());
  const [saving, setSaving] = useState(false);

  const layoutQuery = useQuery({
    queryKey: ['layout', layoutId],
    queryFn: () => fetchBoardLayout(layoutId),
  });

  const handleHoldPress = useCallback((placementId: number) => {
    setSelectedHolds((prev) => {
      const next = new Map(prev);
      const current = next.get(placementId) ?? null;
      const currentIdx = COLOR_CYCLE.indexOf(current);
      const nextColor = COLOR_CYCLE[(currentIdx + 1) % COLOR_CYCLE.length];
      if (nextColor === null) {
        next.delete(placementId);
      } else {
        next.set(placementId, nextColor);
      }
      return next;
    });
  }, []);

  const buildFrames = (): string => {
    const parts: string[] = [];
    selectedHolds.forEach((color, placementId) => {
      if (color) {
        const roleId = COLOR_TO_ROLE[color];
        parts.push(`p${placementId}r${roleId}`);
      }
    });
    return parts.join('');
  };

  const handleNext = async () => {
    if (selectedHolds.size === 0) {
      Alert.alert('No holds selected', 'Tap holds on the board to select them.');
      return;
    }

    setSaving(true);
    try {
      const frames = buildFrames();
      const climb = await createClimb({
        layout_id: layoutId,
        setter_id: user?.id ?? 0,
        name: '',
        frames,
      });
      navigation.replace('Publish', {
        uuid: climb.uuid,
        frames,
        layoutId,
      });
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setSelectedHolds(new Map());
  };

  if (layoutQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (layoutQuery.error || !layoutQuery.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load board layout</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Tap holds to cycle colors</Text>
        <View style={styles.legendRow}>
          {(['yellow', 'green', 'blue', 'pink'] as const).map((color) => (
            <View key={color} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLOR_HEX[color] }]} />
              <Text style={styles.legendLabel}>{color}</Text>
            </View>
          ))}
        </View>
      </View>

      <BoardView
        placements={layoutQuery.data.placements}
        selectedHolds={selectedHolds}
        onHoldPress={handleHoldPress}
        interactive
      />

      <View style={styles.selectedCount}>
        <Text style={styles.selectedCountText}>
          {selectedHolds.size} hold{selectedHolds.size !== 1 ? 's' : ''} selected
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.clearButtonText}>Clear All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, saving && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <Text style={styles.nextButtonText}>Next →</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.pageBg,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
  },
  legend: {
    padding: 12,
  },
  legendTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    color: colors.textTertiary,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  selectedCount: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  selectedCountText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  clearButton: {
    flex: 1,
    backgroundColor: colors.surfaceInput,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearButtonText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
