import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { initApiUrl } from './src/config/api';
import { Assignment, Student, StudentApi, Teacher, TeacherAuthApi } from './src/config/platformApi';
import { Session, clearSession, loadSession, saveSession } from './src/state/session';
import { Colors } from './src/theme/colors';
import { Button, EmptyState, LoadingState } from './src/ui';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LearnScreen } from './src/screens/LearnScreen';
import { SubjectScreen } from './src/screens/SubjectScreen';
import { GamesHubScreen } from './src/screens/GamesHubScreen';
import { GamePlayScreen } from './src/screens/GamePlayScreen';
import { AssignmentsScreen } from './src/screens/AssignmentsScreen';
import { QuizScreen } from './src/screens/QuizScreen';
import { TeacherAuthScreen } from './src/screens/teacher/TeacherAuthScreen';
import { TeacherDashboardScreen } from './src/screens/teacher/TeacherDashboardScreen';
import { ServerSettingsModal } from './src/components/ServerSettingsModal';

type Route =
  | { name: 'welcome' }
  | { name: 'register' }
  | { name: 'dashboard' }
  | { name: 'english' }
  | { name: 'subject'; subject: 'Mathematics' | 'Marathi'; lessonId?: string }
  | { name: 'games'; subject?: string }
  | { name: 'play'; gameId: string; level: number }
  | { name: 'assignments' }
  | { name: 'quiz'; quizId: number }
  | { name: 'teacherAuth' }
  | { name: 'teacher' };

class ErrorBoundary extends React.Component<{ children: React.ReactNode; onReset: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('Screen crashed:', error); }
  render() {
    if (this.state.error) {
      return (
        <EmptyState emoji="🙈" title="Oops, this screen had a problem" message={this.state.error.message}
          action={<Button title="Go back" onPress={() => { this.setState({ error: null }); this.props.onReset(); }} />} />
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [stack, setStack] = useState<Route[]>([{ name: 'welcome' }]);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const route = stack[stack.length - 1];
  const push = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const pop = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const reset = useCallback((r: Route) => setStack([r]), []);
  const openSettings = () => setSettingsVisible(true);

  // Restore a saved session and refresh it from the server when possible.
  useEffect(() => {
    (async () => {
      await initApiUrl();
      const saved = await loadSession();
      if (saved?.role === 'student') {
        setSession(saved);
        reset({ name: 'dashboard' });
        try {
          const fresh = await StudentApi.profile(saved.student.student_id);
          const next: Session = { role: 'student', student: fresh.student };
          setSession(next);
          saveSession(next);
        } catch (e: any) {
          if (e?.status === 404) { await clearSession(); setSession(null); reset({ name: 'welcome' }); }
        }
      } else if (saved?.role === 'teacher') {
        setSession(saved);
        reset({ name: 'teacher' });
        try {
          const me = await TeacherAuthApi.me(saved.token);
          const next: Session = { role: 'teacher', token: saved.token, teacher: me.teacher };
          setSession(next);
          saveSession(next);
        } catch (e: any) {
          if (e?.status === 401) { await clearSession(); setSession(null); reset({ name: 'teacherAuth' }); }
        }
      }
      setReady(true);
    })();
  }, [reset]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (settingsVisible) { setSettingsVisible(false); return true; }
      if (stack.length > 1) { pop(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, settingsVisible, pop]);

  const studentSignedIn = (student: Student) => {
    const s: Session = { role: 'student', student };
    setSession(s);
    saveSession(s);
    reset({ name: 'dashboard' });
  };

  const teacherSignedIn = (token: string, teacher: Teacher) => {
    const s: Session = { role: 'teacher', token, teacher };
    setSession(s);
    saveSession(s);
    reset({ name: 'teacher' });
  };

  const logout = async () => {
    if (session?.role === 'teacher') TeacherAuthApi.logout(session.token).catch(() => {});
    await clearSession();
    setSession(null);
    reset({ name: 'welcome' });
  };

  const openSubject = (subject: string) => {
    if (subject === 'English') push({ name: 'english' });
    else push({ name: 'subject', subject: subject as 'Mathematics' | 'Marathi' });
  };

  const openAssignment = (a: Assignment) => {
    if (a.kind === 'quiz') push({ name: 'quiz', quizId: Number(a.ref_id) });
    else if (a.kind === 'game') push({ name: 'play', gameId: a.ref_id, level: a.level || 1 });
    else if (/^\d/.test(a.ref_id)) push({ name: 'english' });
    else push({ name: 'subject', subject: a.ref_id.startsWith('MR') ? 'Marathi' : 'Mathematics', lessonId: a.ref_id });
  };

  const student = session?.role === 'student' ? session.student : null;
  let content: React.ReactNode = null;

  if (!ready) {
    content = <LoadingState label="Opening LearnVerse…" />;
  } else if (route.name === 'welcome') {
    content = <WelcomeScreen onStart={() => push({ name: 'register' })} onOpenSettings={openSettings} onTeacher={() => push({ name: 'teacherAuth' })} />;
  } else if (route.name === 'register') {
    content = <RegisterScreen onBack={pop} onSubmit={studentSignedIn} onOpenSettings={openSettings} />;
  } else if (route.name === 'teacherAuth') {
    content = <TeacherAuthScreen onBack={pop} onAuthenticated={teacherSignedIn} onOpenSettings={openSettings} />;
  } else if (route.name === 'teacher' && session?.role === 'teacher') {
    content = (
      <TeacherDashboardScreen token={session.token} teacher={session.teacher} onLogout={logout} onOpenSettings={openSettings}
        onSessionExpired={() => { clearSession(); setSession(null); reset({ name: 'teacherAuth' }); }} />
    );
  } else if (student) {
    switch (route.name) {
      case 'dashboard':
        content = (
          <DashboardScreen student={student} onOpenSubject={openSubject} onOpenGames={() => push({ name: 'games' })}
            onOpenAssignments={() => push({ name: 'assignments' })} onOpenAssignment={openAssignment}
            onOpenSettings={openSettings} onLogout={logout} />
        );
        break;
      case 'english':
        content = <LearnScreen studentId={student.student_id} studentName={student.name} onBackToDashboard={pop} />;
        break;
      case 'subject':
        content = (
          <SubjectScreen key={`${route.subject}-${route.lessonId || ''}`} studentId={student.student_id} studentClass={student.student_class}
            subject={route.subject} initialLessonId={route.lessonId} onBack={pop}
            onPlayGame={(gameId, level) => push({ name: 'play', gameId, level: level || 1 })} />
        );
        break;
      case 'games':
        content = <GamesHubScreen studentId={student.student_id} initialSubject={route.subject} onBack={pop}
          onPlay={(gameId, level) => push({ name: 'play', gameId, level })} />;
        break;
      case 'play':
        content = <GamePlayScreen key={`${route.gameId}-${route.level}`} studentId={student.student_id} gameId={route.gameId} level={route.level} onExit={pop} />;
        break;
      case 'assignments':
        content = <AssignmentsScreen studentId={student.student_id} onBack={pop} onOpen={openAssignment} />;
        break;
      case 'quiz':
        content = <QuizScreen studentId={student.student_id} quizId={route.quizId} onBack={pop} />;
        break;
      default:
        content = null;
    }
  }

  if (ready && !content) {
    // Route requires a session we no longer have.
    content = <WelcomeScreen onStart={() => reset({ name: 'register' })} onOpenSettings={openSettings} onTeacher={() => reset({ name: 'teacherAuth' })} />;
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <ErrorBoundary key={stack.length} onReset={pop}>{content}</ErrorBoundary>
      <ServerSettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
});
