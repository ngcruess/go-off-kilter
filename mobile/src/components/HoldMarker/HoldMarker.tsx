import React from 'react';
import { Circle, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { HoldColor, COLOR_HEX } from '../../types';

interface HoldMarkerProps {
  cx: number;
  cy: number;
  radius: number;
  color: HoldColor;
  onPress?: () => void;
  interactive?: boolean;
}

export const HoldMarker: React.FC<HoldMarkerProps> = ({
  cx,
  cy,
  radius,
  color,
  onPress,
  interactive = false,
}) => {
  if (color) {
    const hex = COLOR_HEX[color];
    const gradId = `g-${cx}-${cy}`;
    return (
      <G onPress={interactive ? onPress : undefined}>
        <Defs>
          <RadialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={hex} stopOpacity={0.6} />
            <Stop offset="70%" stopColor={hex} stopOpacity={0.15} />
            <Stop offset="100%" stopColor={hex} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cy} r={radius * 1.6} fill={`url(#${gradId})`} />
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="#1a1a1a"
          stroke={hex}
          strokeWidth={radius * 0.25}
        />
        <Circle
          cx={cx}
          cy={cy}
          r={radius * 0.35}
          fill={hex}
          fillOpacity={0.9}
        />
      </G>
    );
  }

  return (
    <G onPress={interactive ? onPress : undefined}>
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="#222222"
        stroke="#333333"
        strokeWidth={radius * 0.1}
      />
    </G>
  );
};
