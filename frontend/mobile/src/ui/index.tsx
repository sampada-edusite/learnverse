/**
 * LearnVerse UI kit — shared, themed building blocks used by every new screen.
 */
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { ArrowLeft, RefreshCw } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Colors } from '../theme/colors';
import { MAX_CONTENT_WIDTH, Radius, Shadow, ShadowSoft, Space, StatusTheme, Type } from '../theme/tokens';
import { useReducedMotion } from '../hooks/useReducedMotion';

const IS_WEB = Platform.OS === 'web';

// ------------------------------------------------------------------ decoration

let gradientSeq = 0;
/** Fills its (relatively positioned, overflow-hidden) parent with a soft diagonal gradient. */
export const GradientFill: React.FC<{ colors: [string, string]; angle?: number }> = ({ colors, angle = 135 }) => {
  const id = useRef(`lvg${++gradientSeq}`).current;
  if (IS_WEB) {
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundImage: `linear-gradient(${angle}deg, ${colors[0]}, ${colors[1]})` } as any]}
      />
    );
  }
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors[0]} />
          <Stop offset="1" stopColor={colors[1]} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
};

export type CardTone = 'pink' | 'sky' | 'lavender';
const TONES: Record<CardTone, [string, string]> = {
  pink: Colors.gradientPink,
  sky: Colors.gradientSky,
  lavender: Colors.gradientLavender,
};

const BUBBLES = [
  { size: 180, top: '-4%', left: '-8%', color: Colors.lavender, dur: 9000 },
  { size: 120, top: '12%', left: '82%', color: Colors.pink, dur: 7000 },
  { size: 90, top: '58%', left: '-5%', color: Colors.sky, dur: 8000 },
  { size: 150, top: '74%', left: '78%', color: Colors.lavender, dur: 10000 },
  { size: 60, top: '38%', left: '90%', color: Colors.sky, dur: 6500 },
  { size: 70, top: '88%', left: '30%', color: Colors.pink, dur: 7500 },
] as const;

// react-native-web only compiles animationKeyframes inside StyleSheet.create, so the web
// animations live in this static sheet (created on web only; native uses Animated).
const webAnim: any = IS_WEB ? StyleSheet.create({
  float: {
    animationKeyframes: [{ '0%': { transform: [{ translateY: 0 }] }, '50%': { transform: [{ translateY: -18 }] }, '100%': { transform: [{ translateY: 0 }] } }],
    animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out',
  },
  enter: {
    animationKeyframes: [{ '0%': { opacity: 0, transform: [{ translateY: 14 }, { scale: 0.98 }] }, '100%': { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] } }],
    animationDuration: '420ms', animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)', animationFillMode: 'both',
  },
  slideForward: {
    flex: 1,
    animationKeyframes: [{ '0%': { opacity: 0, transform: [{ translateX: 24 }] }, '100%': { opacity: 1, transform: [{ translateX: 0 }] } }],
    animationDuration: '300ms', animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)', animationFillMode: 'both',
  },
  slideBack: {
    flex: 1,
    animationKeyframes: [{ '0%': { opacity: 0, transform: [{ translateX: -24 }] }, '100%': { opacity: 1, transform: [{ translateX: 0 }] } }],
    animationDuration: '300ms', animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)', animationFillMode: 'both',
  },
} as any) : {};

const NativeBubble: React.FC<{ b: (typeof BUBBLES)[number]; reduce: boolean }> = ({ b, reduce }) => {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -18, duration: b.dur / 2, useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: b.dur / 2, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [b.dur, reduce, y]);
  return <Animated.View style={[styles.bubble, { width: b.size, height: b.size, borderRadius: b.size / 2, top: b.top as any, left: b.left as any, backgroundColor: b.color, transform: [{ translateY: y }] }]} />;
};

/** Soft pastel circles drifting slowly behind screen content (decorative, not focusable). */
export const FloatingBubbles: React.FC = () => {
  const reduce = useReducedMotion();
  return (
    <View pointerEvents="none" style={styles.bubbleLayer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {BUBBLES.map((b, i) =>
        IS_WEB ? (
          <View
            key={i}
            style={[styles.bubble, reduce ? null : webAnim.float, {
              width: b.size, height: b.size, borderRadius: b.size / 2, top: b.top as any, left: b.left as any, backgroundColor: b.color,
              ...(reduce ? {} : { animationDuration: `${b.dur}ms` }),
            } as any]}
          />
        ) : (
          <NativeBubble key={i} b={b} reduce={reduce} />
        )
      )}
    </View>
  );
};

/** Gentle entrance (fade + rise) for cards; CSS on web, native driver on mobile. */
const webEnter = (delay = 0) => [webAnim.enter, { animationDelay: `${delay}ms` }];

/** Page transition: new screens slide/fade in (forward from the right, back from the left). */
export const ScreenTransition: React.FC<{ children: React.ReactNode; direction?: 'forward' | 'back' }> = ({ children, direction = 'forward' }) => {
  const reduce = useReducedMotion();
  const anim = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const dx = direction === 'back' ? -24 : 24;
  useEffect(() => {
    if (reduce || IS_WEB) return;
    Animated.timing(anim, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anim, reduce]);
  if (reduce) return <View style={{ flex: 1 }}>{children}</View>;
  if (IS_WEB) {
    return (
      <View style={direction === 'back' ? webAnim.slideBack : webAnim.slideForward}>
        {children}
      </View>
    );
  }
  return (
    <Animated.View style={{ flex: 1, opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) }] }}>
      {children}
    </Animated.View>
  );
};

/** Springy pop used for rewards (stars, badges, coins). */
export const PopIn: React.FC<{ children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }> = ({ children, delay = 0, style }) => {
  const reduce = useReducedMotion();
  const s = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(s, { toValue: 1, friction: 4, tension: 140, useNativeDriver: !IS_WEB }),
    ]).start();
  }, [delay, reduce, s]);
  return <Animated.View style={[style, { opacity: s.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }), transform: [{ scale: s }] }]}>{children}</Animated.View>;
};

// ------------------------------------------------------------------ layout

export const useResponsive = () => {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  return { width, isWide, columns: width >= 1000 ? 3 : isWide ? 2 : 1 };
};

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
}

export const Screen: React.FC<ScreenProps> = ({
  children, scroll = true, refreshing, onRefresh, header, footer, background, contentStyle,
}) => {
  const inner = <View style={[styles.content, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView style={[styles.screen, background ? { backgroundColor: background } : null]}>
      <FloatingBubbles />
      {header ?<View style={styles.headerWrap}><View style={styles.headerInner}>{header}</View></View> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          ) : undefined}
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{inner}</View>
      )}
      {footer}
    </SafeAreaView>
  );
};

export const Row: React.FC<{ children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }> = ({
  children, gap = Space.sm, style, wrap,
}) => <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;

/** Responsive grid: 1 column on phones, 2–3 on tablets/laptops. */
export const Grid: React.FC<{ children: React.ReactNode; min?: number; gap?: number }> = ({ children, min = 1, gap = Space.md }) => {
  const { columns } = useResponsive();
  const cols = Math.max(min, columns);
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2 }}>
      {items.map((child, i) => (
        <View key={i} style={{ width: `${100 / cols}%` as any, paddingHorizontal: gap / 2, paddingBottom: gap }}>
          {child}
        </View>
      ))}
    </View>
  );
};

// ------------------------------------------------------------------ motion

export const FadeIn: React.FC<{ children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }> = ({
  children, delay = 0, style,
}) => {
  const reduce = useReducedMotion();
  const anim = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.timing(anim, { toValue: 1, duration: 320, delay, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [anim, delay, reduce]);
  return (
    <Animated.View
      style={[style, {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
};

export const PressableScale: React.FC<{
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  hoverLift?: boolean;
}> = ({ children, onPress, disabled, style, accessibilityLabel, hoverLift = true }) => {
  const reduce = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => {
    if (reduce) return;
    Animated.spring(scale, { toValue: v, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 8 }).start();
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(0.96)}
      onPressOut={() => to(1)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {({ hovered }: any) => (
        <Animated.View style={[style, IS_WEB ? (styles.webHoverable as any) : null,
          hovered && !disabled && hoverLift && !reduce ? (styles.webHovered as any) : null,
          { transform: [{ scale }] }]}>
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
};

// ------------------------------------------------------------------ surfaces

export const Card: React.FC<{
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accent?: string;
  soft?: boolean;
  accessibilityLabel?: string;
  /** Pastel gradient background. */
  tone?: CardTone;
  /** Entrance animation delay in ms (cards animate in on mount). */
  enterDelay?: number;
}> = ({ children, onPress, style, accent, soft, accessibilityLabel, tone, enterDelay = 0 }) => {
  const reduce = useReducedMotion();
  const inner = (
    <View style={[styles.card, soft ? ShadowSoft : Shadow, tone ? styles.cardToned : null,
      accent ? { borderTopWidth: 4, borderTopColor: accent } : null, style]}>
      {tone ? <GradientFill colors={TONES[tone]} /> : null}
      {children}
    </View>
  );
  const body = reduce ? inner : IS_WEB
    ? <View style={webEnter(enterDelay) as any}>{inner}</View>
    : <FadeIn delay={enterDelay}>{inner}</FadeIn>;
  return onPress ? <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel}>{body}</PressableScale> : body;
};

export const AppBar: React.FC<{ title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }> = ({
  title, subtitle, onBack, right,
}) => (
  <View style={styles.appBar}>
    {onBack ? (
      <IconButton onPress={onBack} label="Go back" icon={<ArrowLeft size={20} color={Colors.primary} />} />
    ) : null}
    <View style={{ flex: 1 }}>
      <Text style={Type.h1} numberOfLines={1}>{title}</Text>
      {subtitle ? <Text style={[Type.small, { marginTop: 2 }]} numberOfLines={2}>{subtitle}</Text> : null}
    </View>
    {right}
  </View>
);

export const SectionHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <View style={styles.sectionHeader}>
    <View style={{ flex: 1 }}>
      <Text style={Type.h2}>{title}</Text>
      {subtitle ? <Text style={[Type.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
    </View>
    {action}
  </View>
);

// ------------------------------------------------------------------ controls

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export const Button: React.FC<{
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ title, onPress, variant = 'primary', size = 'md', icon, loading, disabled, full, color, style }) => {
  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: color || Colors.primary, fg: '#FFFFFF', border: color || Colors.primary },
    secondary: { bg: '#FFFFFF', fg: color || Colors.primary, border: color || Colors.primaryLight },
    ghost: { bg: 'transparent', fg: color || Colors.primary, border: 'transparent' },
    danger: { bg: '#FFF1F2', fg: '#BE123C', border: '#FECDD3' },
    success: { bg: '#059669', fg: '#FFFFFF', border: '#059669' },
  };
  const p = palette[variant];
  const pad = size === 'lg' ? 16 : size === 'sm' ? 8 : 12;
  const fs = size === 'lg' ? 17 : size === 'sm' ? 13 : 15;
  const off = disabled || loading;
  const gradient = variant === 'primary' && !color;
  return (
    <PressableScale onPress={off ? undefined : onPress} disabled={off} accessibilityLabel={title} style={full ? { alignSelf: 'stretch' } : undefined}>
      <View style={[styles.button, { backgroundColor: p.bg, borderColor: gradient ? 'transparent' : p.border, paddingVertical: pad, opacity: off ? 0.55 : 1 },
        variant === 'primary' ? styles.buttonRaised : null, full ? { alignSelf: 'stretch' } : null, style]}>
        {gradient ? <GradientFill colors={Colors.gradientPrimary} /> : null}
        {loading ? <ActivityIndicator size="small" color={p.fg} /> : icon}
        <Text style={{ color: p.fg, fontSize: fs, fontWeight: '800' }}>{title}</Text>
      </View>
    </PressableScale>
  );
};

export const IconButton: React.FC<{ icon: React.ReactNode; onPress?: () => void; label: string; badge?: number }> = ({
  icon, onPress, label, badge,
}) => (
  <PressableScale onPress={onPress} accessibilityLabel={label}>
    <View style={styles.iconButton}>
      {icon}
      {badge ? (
        <View style={styles.iconBadge}><Text style={styles.iconBadgeText}>{badge > 9 ? '9+' : badge}</Text></View>
      ) : null}
    </View>
  </PressableScale>
);

export const TextField: React.FC<TextInputProps & { label: string; error?: string; helper?: string; icon?: React.ReactNode }> = ({
  label, error, helper, icon, style, ...props
}) => (
  <View style={{ gap: 6 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={[styles.field, error ? { borderColor: '#BE123C' } : null]}>
      {icon}
      <TextInput
        placeholderTextColor={Colors.textLight}
        style={[styles.fieldInput, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null, style]}
        {...props}
      />
    </View>
    {error ? <Text style={styles.fieldError}>{error}</Text> : helper ? <Text style={Type.small}>{helper}</Text> : null}
  </View>
);

export const Chip: React.FC<{ label: string; selected?: boolean; onPress?: () => void; color?: string }> = ({
  label, selected, onPress, color = Colors.primary,
}) => (
  <PressableScale onPress={onPress} accessibilityLabel={label}>
    <View style={[styles.chip, selected ? { backgroundColor: color, borderColor: color } : null]}>
      <Text style={[styles.chipText, selected ? { color: '#FFF' } : { color }]}>{label}</Text>
    </View>
  </PressableScale>
);

export const Tabs: React.FC<{ tabs: { key: string; label: string; badge?: number }[]; value: string; onChange: (k: string) => void }> = ({
  tabs, value, onChange,
}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
    {tabs.map((t) => {
      const active = t.key === value;
      return (
        <Pressable key={t.key} onPress={() => onChange(t.key)} accessibilityRole="tab" accessibilityState={{ selected: active }}
          style={[styles.tab, active ? styles.tabActive : null]}>
          <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{t.label}</Text>
          {t.badge ? <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{t.badge}</Text></View> : null}
        </Pressable>
      );
    })}
  </ScrollView>
);

// ------------------------------------------------------------------ data display

export const ProgressBar: React.FC<{ value: number; color?: string; height?: number; track?: string }> = ({
  value, color = Colors.primary, height = 8, track = Colors.primaryUltraLight,
}) => {
  const reduce = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;
  const v = Math.max(0, Math.min(1, value || 0));
  useEffect(() => {
    Animated.timing(anim, { toValue: v, duration: reduce ? 0 : 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [v, anim, reduce]);
  return (
    <View style={{ height, backgroundColor: track, borderRadius: Radius.pill, overflow: 'hidden' }}
      accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}>
      <Animated.View style={[{ height, borderRadius: Radius.pill, backgroundColor: color, overflow: 'hidden',
        width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        IS_WEB && color === Colors.primary ? ({ backgroundImage: `linear-gradient(90deg, ${Colors.gradientPrimary[0]}, ${Colors.gradientPrimary[1]})` } as any) : null]} />
    </View>
  );
};

export const StatTile: React.FC<{ label: string; value: string | number; icon?: React.ReactNode; color?: string; hint?: string }> = ({
  label, value, icon, color = Colors.primary, hint,
}) => (
  <View style={[styles.stat, ShadowSoft]}>
    <Row gap={8}>
      {icon}
      <Text style={[Type.tiny, { textTransform: 'uppercase' }]} numberOfLines={1}>{label}</Text>
    </Row>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    {hint ? <Text style={Type.small} numberOfLines={1}>{hint}</Text> : null}
  </View>
);

export const Pill: React.FC<{ label: string; color?: string; light?: string; icon?: React.ReactNode }> = ({
  label, color = Colors.primary, light = Colors.primaryUltraLight, icon,
}) => (
  <View style={[styles.pill, { backgroundColor: light }]}>
    {icon}
    <Text style={[styles.pillText, { color }]} numberOfLines={1}>{label}</Text>
  </View>
);

export const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const t = StatusTheme[status] || StatusTheme['No Practice'];
  return <Pill label={t.label} color={t.color} light={t.light} />;
};

/** Star rating; earned stars pop in one after another. */
export const Stars: React.FC<{ count: number; max?: number; size?: number }> = ({ count, max = 3, size = 16 }) => (
  <View style={{ flexDirection: 'row', gap: 1 }} accessible accessibilityLabel={`${count} of ${max} stars`}>
    {Array.from({ length: max }, (_, i) => (
      i < count ? (
        <PopIn key={i} delay={120 * i}><Text style={{ fontSize: size, color: '#F59E0B' }}>★</Text></PopIn>
      ) : (
        <Text key={i} style={{ fontSize: size, color: '#F59E0B' }}>☆</Text>
      )
    ))}
  </View>
);

// ------------------------------------------------------------------ states

export const LoadingState: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <View style={styles.center}>
    <ActivityIndicator size="large" color={Colors.primary} />
    <Text style={[Type.small, { marginTop: 12 }]}>{label}</Text>
  </View>
);

export const EmptyState: React.FC<{ emoji?: string; title: string; message?: string; action?: React.ReactNode }> = ({
  emoji = '🌱', title, message, action,
}) => (
  <View style={styles.center}>
    <Text style={{ fontSize: 44 }}>{emoji}</Text>
    <Text style={[Type.h3, { marginTop: 8, textAlign: 'center' }]}>{title}</Text>
    {message ? <Text style={[Type.small, { textAlign: 'center', marginTop: 4, maxWidth: 360 }]}>{message}</Text> : null}
    {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
  </View>
);

export const ErrorState: React.FC<{ message: string; onRetry?: () => void; extra?: React.ReactNode }> = ({ message, onRetry, extra }) => (
  <View style={styles.center}>
    <Text style={{ fontSize: 40 }}>🔌</Text>
    <Text style={[Type.h3, { marginTop: 8, textAlign: 'center' }]}>Something went wrong</Text>
    <Text style={[Type.small, { textAlign: 'center', marginTop: 4, maxWidth: 380 }]}>{message}</Text>
    <Row style={{ marginTop: 14 }}>
      {onRetry ? <Button title="Try again" variant="secondary" size="sm" onPress={onRetry} icon={<RefreshCw size={14} color={Colors.primary} />} /> : null}
      {extra}
    </Row>
  </View>
);

export const Banner: React.FC<{ text: string; tone?: 'info' | 'success' | 'warning' | 'danger' }> = ({ text, tone = 'info' }) => {
  const t = { info: ['#EFEBFF', '#4338CA'], success: ['#DCFCE7', '#047857'], warning: ['#FEF3C7', '#92400E'], danger: ['#FFE4E6', '#BE123C'] }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t[0] }]}>
      <Text style={{ color: t[1], fontWeight: '700', fontSize: 13, lineHeight: 19 }}>{text}</Text>
    </View>
  );
};

export const Avatar: React.FC<{ name: string; size?: number; color?: string }> = ({ name, size = 44, color = Colors.primary }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: size * 0.42 }}>{(name || '?').trim().charAt(0).toUpperCase()}</Text>
  </View>
);

/** Centered modal sheet with title, scrollable body and optional footer actions. */
export const Sheet: React.FC<{ visible: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }> = ({
  visible, title, onClose, children, footer, wide,
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, Shadow, { maxWidth: wide ? 820 : 560 }]}>
        <Row style={{ justifyContent: 'space-between', marginBottom: Space.sm }}>
          <Text style={[Type.h2, { flex: 1 }]} numberOfLines={1}>{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"><Text style={{ fontSize: 22, color: Colors.textMuted }}>✕</Text></Pressable>
        </Row>
        <ScrollView contentContainerStyle={{ gap: Space.md, paddingBottom: Space.sm }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View style={{ paddingTop: Space.sm, borderTopWidth: 1, borderTopColor: Colors.cardBorder }}>{footer}</View> : null}
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

export { Space, Radius, Type };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  headerWrap: { paddingHorizontal: Space.md, paddingTop: Space.sm, paddingBottom: Space.xs },
  headerInner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  scrollContent: { flexGrow: 1, paddingBottom: Space.xxxl },
  content: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: Space.md, paddingTop: Space.sm, gap: Space.lg },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Space.md, borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden' },
  cardToned: { borderColor: 'rgba(255,255,255,0.7)' },
  buttonRaised: { overflow: 'hidden', ...(IS_WEB ? ({ boxShadow: '0 8px 18px rgba(108, 76, 241, 0.28)' } as any) : { shadowColor: '#6C4CF1', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 }) },
  webHoverable: IS_WEB ? ({ transitionProperty: 'transform, box-shadow, filter', transitionDuration: '180ms', transitionTimingFunction: 'ease-out' } as any) : {},
  webHovered: IS_WEB ? ({ transform: [{ translateY: -3 }], filter: 'brightness(1.03)' } as any) : {},
  bubbleLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  bubble: { position: 'absolute', opacity: 0.35 },
  appBar: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: Space.sm, marginBottom: -Space.xs },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderRadius: Radius.md, borderWidth: 1.5 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  iconBadge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#E11D48', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  iconBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  fieldLabel: { fontSize: 13, fontWeight: '800', color: Colors.textMuted },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: '#FFFFFF', paddingHorizontal: 14 },
  fieldInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: Colors.text, fontWeight: '600' },
  fieldError: { color: '#BE123C', fontSize: 12, fontWeight: '700' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#FFF' },
  chipText: { fontSize: 13, fontWeight: '800' },
  tabs: { gap: 6, padding: 4, backgroundColor: Colors.primaryUltraLight, borderRadius: Radius.pill },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.pill },
  tabActive: { backgroundColor: '#FFFFFF', ...(ShadowSoft as object) },
  tabText: { fontSize: 14, fontWeight: '800', color: Colors.textLight },
  tabTextActive: { color: Colors.primary },
  tabBadge: { backgroundColor: '#E11D48', borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  stat: { flex: 1, minWidth: 140, backgroundColor: '#FFFFFF', borderRadius: Radius.lg, padding: Space.md, gap: 6, borderWidth: 1, borderColor: Colors.cardBorder },
  statValue: { fontSize: 26, fontWeight: '900' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '800' },
  center: { alignItems: 'center', justifyContent: 'center', padding: Space.xl, minHeight: 220 },
  banner: { padding: Space.sm, borderRadius: Radius.md },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(42,27,92,0.38)', alignItems: 'center', justifyContent: 'center', padding: Space.md },
  sheet: { width: '100%', maxHeight: '92%', backgroundColor: Colors.background, borderRadius: Radius.xl, padding: Space.lg },
});
