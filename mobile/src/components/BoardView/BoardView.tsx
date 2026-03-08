import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import { PlacementFull, HoldColor, ClimbPlacement, ROLE_COLORS } from '../../types';
import { colors } from '../../theme';
import { HoldMarker } from '../HoldMarker/HoldMarker';

interface BoardViewProps {
  placements: PlacementFull[];
  climbPlacements?: ClimbPlacement[];
  selectedHolds?: Map<number, HoldColor>;
  onHoldPress?: (placementId: number) => void;
  interactive?: boolean;
}

export const BoardView: React.FC<BoardViewProps> = ({
  placements,
  climbPlacements,
  selectedHolds,
  onHoldPress,
  interactive = false,
}) => {
  const screenWidth = Dimensions.get('window').width;

  const { viewBox, holdRadius, svgHeight, vbParts, flipY } = useMemo(() => {
    if (placements.length === 0) {
      return {
        viewBox: '0 0 100 100',
        holdRadius: 5,
        svgHeight: 100,
        vbParts: [0, 0, 100, 100],
        flipY: (y: number) => y,
      };
    }

    // Use the full bounding box of the main body of the board (the densest rows)
    // to establish a consistent rectangular frame.
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    // Count holds per row to find the board's "full width" rows
    const rowCounts = new Map<number, { minX: number; maxX: number; count: number }>();
    for (const p of placements) {
      const row = rowCounts.get(p.y);
      if (row) {
        row.minX = Math.min(row.minX, p.x);
        row.maxX = Math.max(row.maxX, p.x);
        row.count++;
      } else {
        rowCounts.set(p.y, { minX: p.x, maxX: p.x, count: 1 });
      }
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    // Use the widest rows to define the board's X extent
    for (const row of rowCounts.values()) {
      if (row.count >= 15) {
        if (row.minX < minX) minX = row.minX;
        if (row.maxX > maxX) maxX = row.maxX;
      }
    }
    // Fallback if no wide rows
    if (!isFinite(minX)) {
      for (const p of placements) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
      }
    }

    // Compute hold spacing from sorted unique X values in a dense row
    const sortedX = [...new Set(placements.map(p => p.x))].sort((a, b) => a - b);
    let minGap = Infinity;
    for (let i = 1; i < sortedX.length; i++) {
      const gap = sortedX[i] - sortedX[i - 1];
      if (gap > 0 && gap < minGap) minGap = gap;
    }
    if (!isFinite(minGap)) minGap = 8;

    const radius = minGap * 0.45;
    const pad = minGap * 1.5;
    const width = maxX - minX + pad * 2;
    const height = maxY - minY + pad * 2;
    const h = screenWidth * (height / width);
    const parts = [minX - pad, minY - pad, width, height];
    const maxYCoord = parts[1] + height;

    return {
      viewBox: `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`,
      holdRadius: radius,
      svgHeight: h,
      vbParts: parts,
      flipY: (y: number) => maxYCoord - (y - parts[1]),
    };
  }, [placements, screenWidth]);

  const climbPlacementMap = useMemo(() => {
    const map = new Map<number, HoldColor>();
    if (climbPlacements) {
      for (const cp of climbPlacements) {
        map.set(cp.placement_id, ROLE_COLORS[cp.role_id] ?? null);
      }
    }
    return map;
  }, [climbPlacements]);

  const getColor = (placementId: number): HoldColor => {
    if (selectedHolds) {
      return selectedHolds.get(placementId) ?? null;
    }
    return climbPlacementMap.get(placementId) ?? null;
  };

  return (
    <View style={[styles.container, { height: svgHeight }]}>
      <Svg
        width={screenWidth}
        height={svgHeight}
        viewBox={viewBox}
      >
        <Rect
          x={vbParts[0]}
          y={vbParts[1]}
          width={vbParts[2]}
          height={vbParts[3]}
          fill={colors.boardBg}
        />
        {placements.map((p) => (
          <HoldMarker
            key={p.id}
            cx={p.x}
            cy={flipY(p.y)}
            radius={holdRadius}
            color={getColor(p.id)}
            onPress={() => onHoldPress?.(p.id)}
            interactive={interactive}
          />
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.boardBg,
    overflow: 'hidden',
  },
});
