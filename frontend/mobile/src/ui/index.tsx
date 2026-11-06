/**
 * LearnVerse UI kit — shared, themed building blocks used by every new screen.
 */
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { Colors } from '../theme/colors';
import { MAX_CONTENT_WIDTH, Radius, Shadow, ShadowSoft, Space, StatusTheme, Type } from '../theme/tokens';
import { useReducedMotion } from '../hooks/useReducedMotion';

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
      {header ? <View style={styles.headerWrap}><View style={styles.headerInner}>{header}</View></View> : null}
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
}> = ({ children, onPress, disabled, style, accessibilityLabel }) => {
  const reduce = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => {
    if (reduce) return;
    Animated.spring(scale, { toValue: v, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 6 }).start();
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ hovered }: any) => [hovered && !disabled ? { opacity: 0.94 } : null]}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
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
}> = ({ children, onPress, style, accent, soft, accessibilityLabel }) => {
  const body = (
    <View style={[styles.card, soft ? ShadowSoft : Shadow, accent ? { borderTopWidth: 4, borderTopColor: accent } : null, style]}>
      {children}
    </View>
  );
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
  return (
    <PressableScale onPress={off ? undefined : onPress} disabled={off} accessibilityLabel={title} style={full ? { alignSelf: 'stretch' } : undefined}>
      <View style={[styles.button, { backgroundColor: p.bg, borderColor: p.border, paddingVertical: pad, opacity: off ? 0.55 : 1 },
        full ? { alignSelf: 'stretch' } : null, style]}>
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
        placeholderTextColor="#A08A9A"
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
  value, color = Colors.primary, height = 8, track = '#F1E4EC',
}) => {
  const reduce = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;
  const v = Math.max(0, Math.min(1, value || 0));
  useEffect(() => {
    Animated.timing(anim, { toValue: v, duration: reduce ? 0 : 600, useNativeDriver: false }).start();
  }, [v, anim, reduce]);
  return (
    <View style={{ height, backgroundColor: track, borderRadius: Radius.pill, overflow: 'hidden' }}>
      <Animated.View style={{ height, borderRadius: Radius.pill, backgroundColor: color,
        width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
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

export const Stars: React.FC<{ count: number; max?: number; size?: number }> = ({ count, max = 3, size = 16 }) => (
  <Text style={{ fontSize: size, letterSpacing: 1, color: '#F59E0B' }} accessibilityLabel={`${count} of ${max} stars`}>
    {Array.from({ length: max }, (_, i) => (i < count ? '★' : '☆')).join('')}
  </Text>
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
        {footer ? <View style={{ paddingTop: Space.sm, borderTopWidth: 1, borderTopColor: '#F3E3EA' }}>{footer}</View> : null}
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
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Space.md, borderWidth: 1, borderColor: '#F3E3EA' },
  appBar: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: Space.sm, marginBottom: -Space.xs },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderRadius: Radius.md, borderWidth: 1.5 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F0DCE5' },
  iconBadge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#E11D48', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  iconBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  fieldLabel: { fontSize: 13, fontWeight: '800', color: Colors.textMuted },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#E9CFDC', borderRadius: Radius.md, backgroundColor: '#FFFFFF', paddingHorizontal: 14 },
  fieldInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: Colors.text, fontWeight: '600' },
  fieldError: { color: '#BE123C', fontSize: 12, fontWeight: '700' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: '#E9CFDC', backgroundColor: '#FFF' },
  chipText: { fontSize: 13, fontWeight: '800' },
  tabs: { gap: 6, padding: 4, backgroundColor: '#F6E6EE', borderRadius: Radius.pill },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.pill },
  tabActive: { backgroundColor: '#FFFFFF', ...(ShadowSoft as object) },
  tabText: { fontSize: 14, fontWeight: '800', color: Colors.textLight },
  tabTextActive: { color: Colors.primary },
  tabBadge: { backgroundColor: '#E11D48', borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  stat: { flex: 1, minWidth: 140, backgroundColor: '#FFFFFF', borderRadius: Radius.lg, padding: Space.md, gap: 6, borderWidth: 1, borderColor: '#F3E3EA' },
  statValue: { fontSize: 26, fontWeight: '900' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '800' },
  center: { alignItems: 'center', justifyContent: 'center', padding: Space.xl, minHeight: 220 },
  banner: { padding: Space.sm, borderRadius: Radius.md },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(25,0,25,0.4)', alignItems: 'center', justifyContent: 'center', padding: Space.md },
  sheet: { width: '100%', maxHeight: '92%', backgroundColor: Colors.background, borderRadius: Radius.xl, padding: Space.lg },
});
