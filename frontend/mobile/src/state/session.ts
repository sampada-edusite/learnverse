import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Student, Teacher } from '../config/platformApi';

const KEY = '@learnverse_session_v2';

export type Session =
  | { role: 'student'; student: Student }
  | { role: 'teacher'; token: string; teacher: Teacher };

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(session));
    if (session.role === 'student') {
      // Keep the legacy key used by existing screens in sync.
      const s = session.student;
      await AsyncStorage.setItem('@samsukh_student', JSON.stringify({
        name: s.name, avatar: s.nickname || s.name, studentClass: String(s.student_class), studentId: s.student_id,
      }));
    }
  } catch (e) {
    console.warn('Could not persist session', e);
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEY, '@samsukh_student']);
  } catch {}
}
