import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Text } from 'react-native';
import Svg, {
  Circle,
  Path,
  G,
  Rect,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { Colors } from '../theme/colors';

interface StickerProps {
  name: 'pencil.png' | 'rocket.png' | 'abc.png' | 'owl.png' | 'apple-books.png' | 'hero-reading.png' | string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export const Sticker: React.FC<StickerProps> = ({ name, size = 60, style }) => {
  if (name === 'hero-reading.png') {
    return (
      <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
        <Svg width={size} height={size} viewBox="0 0 240 240" fill="none">
          <Defs>
            <LinearGradient id="heroGrad" x1="0" y1="0" x2="240" y2="240" gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor="#854F6C" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#2B124C" stopOpacity="0.8" />
            </LinearGradient>
            <LinearGradient id="bookGrad" x1="0" y1="0" x2="100" y2="60" gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor="#DFB6B2" />
              <Stop offset="100%" stopColor="#FBE4D8" />
            </LinearGradient>
          </Defs>

          {/* Soft Background Glow Aura */}
          <Circle cx="120" cy="120" r="105" fill="url(#heroGrad)" />
          <Circle cx="120" cy="120" r="85" fill="#522B5B" opacity="0.6" />

          {/* Sparkles / Magic Stars floating around */}
          <G transform="translate(45, 40)">
            <Path d="M10 0L13 7L20 10L13 13L10 20L7 13L0 10L7 7Z" fill="#FBE4D8" />
          </G>
          <G transform="translate(175, 45)">
            <Path d="M8 0L10 5L15 8L10 11L8 16L6 11L1 8L6 5Z" fill="#DFB6B2" />
          </G>
          <G transform="translate(185, 145)">
            <Path d="M6 0L8 4L12 6L8 8L6 12L4 8L0 6L4 4Z" fill="#FBE4D8" />
          </G>

          {/* Cute Learner Character Silhouette & Details */}
          {/* Head & Hair */}
          <Circle cx="120" cy="95" r="32" fill="#FBE4D8" />
          {/* Hair Pigtails */}
          <Circle cx="88" cy="92" r="14" fill="#2B124C" />
          <Circle cx="152" cy="92" r="14" fill="#2B124C" />
          <Path d="M92 80 C 100 65, 140 65, 148 80 C 140 72, 100 72, 92 80 Z" fill="#2B124C" />

          {/* Face Expression */}
          <Circle cx="110" cy="95" r="3" fill="#190019" />
          <Circle cx="130" cy="95" r="3" fill="#190019" />
          {/* Smile */}
          <Path d="M112 105 Q 120 113 128 105" stroke="#190019" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Rosy Cheeks */}
          <Circle cx="104" cy="101" r="4" fill="#DFB6B2" opacity="0.8" />
          <Circle cx="136" cy="101" r="4" fill="#DFB6B2" opacity="0.8" />

          {/* Body / Sweater */}
          <Path d="M92 127 C 92 118, 148 118, 148 127 L 158 175 C 158 180, 82 180, 82 175 Z" fill="#854F6C" />
          {/* Collar */}
          <Path d="M108 127 L 120 135 L 132 127" stroke="#FBE4D8" strokeWidth="3" fill="none" />

          {/* Open Book in Hands */}
          <G transform="translate(70, 142)">
            {/* Left Page */}
            <Path d="M50 35 Q 25 25 2 30 L 2 5 Q 25 0 50 12 Z" fill="#FBE4D8" stroke="#DFB6B2" strokeWidth="1.5" />
            {/* Right Page */}
            <Path d="M50 35 Q 75 25 98 30 L 98 5 Q 75 0 50 12 Z" fill="#FFFFFF" stroke="#DFB6B2" strokeWidth="1.5" />
            {/* Book Cover Shadow */}
            <Path d="M0 31 Q 25 26 50 36 Q 75 26 100 31 L 98 33 Q 75 28 50 38 Q 25 28 2 33 Z" fill="#2B124C" />
            {/* Book Lines / Magic Text */}
            <Path d="M12 14 H 40 M12 20 H 35 M12 26 H 38" stroke="#854F6C" strokeWidth="2" strokeLinecap="round" />
            <Path d="M60 14 H 88 M60 20 H 83 M60 26 H 86" stroke="#2B124C" strokeWidth="2" strokeLinecap="round" />
          </G>
        </Svg>
      </View>
    );
  }

  if (name === 'pencil.png') {
    return (
      <View style={[styles.stickerBadge, { width: size, height: size, backgroundColor: Colors.primaryLight }, style]}>
        <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke={Colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" fill="#DFB6B2" opacity="0.3" />
          <Path d="m15 5 4 4" />
        </Svg>
      </View>
    );
  }

  if (name === 'rocket.png') {
    return (
      <View style={[styles.stickerBadge, { width: size, height: size, backgroundColor: Colors.primaryLight }, style]}>
        <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke={Colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.71.79-1.81.2-2.55L4.5 16.5Z" />
          <Path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" fill="#DFB6B2" opacity="0.4" />
          <Path d="M9 18c-4.51 2-5-2-7-2" />
        </Svg>
      </View>
    );
  }

  if (name === 'abc.png') {
    return (
      <View style={[styles.stickerBadge, { width: size, height: size, backgroundColor: Colors.primaryLight }, style]}>
        <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 32 32" fill="none">
          <Rect x="2" y="6" width="12" height="12" rx="3" fill="#2B124C" />
          <SvgText x="8" y="15" fill="#FBE4D8" fontSize="9" fontWeight="bold" textAnchor="middle">A</SvgText>
          <Rect x="17" y="14" width="12" height="12" rx="3" fill="#854F6C" />
          <SvgText x="23" y="23" fill="#FBE4D8" fontSize="9" fontWeight="bold" textAnchor="middle">B</SvgText>
        </Svg>
      </View>
    );
  }

  if (name === 'owl.png') {
    return (
      <View style={[styles.stickerBadge, { width: size, height: size, backgroundColor: Colors.primaryLight }, style]}>
        <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke={Colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 2C6.5 2 2 6.5 2 12c0 4 2.5 7.5 6 9 1 0 2-.5 2-1.5V18" />
          <Circle cx="9" cy="9" r="2" fill="#854F6C" />
          <Circle cx="15" cy="9" r="2" fill="#854F6C" />
          <Path d="M16 18c0 1 1 1.5 2 1.5 3.5-1.5 6-5 6-9 0-5.5-4.5-10-10-10" />
          <Path d="M10 13a2 2 0 0 0 4 0" />
        </Svg>
      </View>
    );
  }

  // Default fallback (apple-books / general study badge)
  return (
    <View style={[styles.stickerBadge, { width: size, height: size, backgroundColor: Colors.primaryLight }, style]}>
      <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke={Colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" fill="#DFB6B2" opacity="0.3" />
        <Path d="M6 6h10" />
        <Path d="M6 10h8" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  stickerBadge: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
});

