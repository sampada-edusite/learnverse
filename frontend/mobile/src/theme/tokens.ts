import { Platform } from 'react-native';
import { Colors } from './colors';

/** LearnVerse design tokens — one source of truth for spacing, radii, type and elevation. */
export const Space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48 } as const;

export const Radius = { sm: 12, md: 16, lg: 22, xl: 30, pill: 999 } as const;

export const Type = {
  display: { fontSize: 32, fontWeight: '900' as const, letterSpacing: -0.5, color: Colors.primary },
  h1: { fontSize: 26, fontWeight: '900' as const, letterSpacing: -0.3, color: Colors.primary },
  h2: { fontSize: 20, fontWeight: '800' as const, color: Colors.primary },
  h3: { fontSize: 16, fontWeight: '800' as const, color: Colors.text },
  body: { fontSize: 15, fontWeight: '500' as const, color: Colors.text, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '600' as const, color: Colors.textMuted },
  tiny: { fontSize: 11, fontWeight: '700' as const, color: Colors.textLight, letterSpacing: 0.4 },
};

export const Shadow = Platform.select({
  web: { boxShadow: '0 10px 28px rgba(108, 76, 241, 0.12)' } as any,
  default: {
    shadowColor: '#6C4CF1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
});

export const ShadowSoft = Platform.select({
  web: { boxShadow: '0 4px 14px rgba(108, 76, 241, 0.08)' } as any,
  default: {
    shadowColor: '#6C4CF1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
});

/** Accent colours per subject, used consistently on cards, chips and progress bars. */
export const SubjectTheme: Record<string, { color: string; light: string; icon: string; local: string }> = {
  English: { color: '#6C5CE7', light: '#EFEBFF', icon: '📖', local: 'इंग्रजी' },
  Mathematics: { color: '#0EA5E9', light: '#E0F4FD', icon: '🔢', local: 'गणित' },
  Marathi: { color: '#F97316', light: '#FFF1E6', icon: '🪔', local: 'मराठी' },
};

export const StatusTheme: Record<string, { color: string; light: string; label: string }> = {
  Mastered: { color: '#059669', light: '#DCFCE7', label: 'Mastered' },
  Learning: { color: '#B45309', light: '#FEF3C7', label: 'Learning' },
  'Needs Practice': { color: '#BE123C', light: '#FFE4E6', label: 'Needs practice' },
  'No Practice': { color: '#64748B', light: '#F1F5F9', label: 'Not started' },
  completed: { color: '#059669', light: '#DCFCE7', label: 'Completed' },
  pending: { color: '#B45309', light: '#FEF3C7', label: 'Pending' },
  overdue: { color: '#BE123C', light: '#FFE4E6', label: 'Overdue' },
};

export const MAX_CONTENT_WIDTH = 1040;
