import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  barColor?: string;
  height?: number;
}

const LABEL_HEIGHT = 18;
const VALUE_HEIGHT = 16;
const BAR_GAP = 4;

export const BarChart: React.FC<BarChartProps> = ({
  data,
  barColor = '#42A5F5',
  height = 160,
}) => {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const barAreaHeight = height - LABEL_HEIGHT - VALUE_HEIGHT;
  const barWidth = Math.max(
    8,
    Math.min(36, (300 - BAR_GAP * (data.length - 1)) / data.length),
  );
  const totalWidth = data.length * barWidth + (data.length - 1) * BAR_GAP;

  return (
    <View style={styles.container}>
      <Svg width={totalWidth} height={height} viewBox={`0 0 ${totalWidth} ${height}`}>
        {data.map((d, i) => {
          const x = i * (barWidth + BAR_GAP);
          const barH = (d.value / maxValue) * barAreaHeight;
          const barY = VALUE_HEIGHT + (barAreaHeight - barH);

          return (
            <React.Fragment key={i}>
              <SvgText
                x={x + barWidth / 2}
                y={VALUE_HEIGHT - 4}
                fill="#aaa"
                fontSize={10}
                fontWeight="600"
                textAnchor="middle"
              >
                {d.value}
              </SvgText>
              <Rect
                x={x}
                y={barY}
                width={barWidth}
                height={Math.max(barH, 1)}
                rx={3}
                fill={barColor}
                opacity={0.85}
              />
              <SvgText
                x={x + barWidth / 2}
                y={height - 2}
                fill="#888"
                fontSize={9}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});
