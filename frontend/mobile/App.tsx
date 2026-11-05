import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { initApiUrl } from './src/config/api';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LearnScreen } from './src/screens/LearnScreen';
import { ServerSettingsModal } from './src/components/ServerSettingsModal';
import { Colors } from './src/theme/colors';

type Student = { name: string; avatar: string; studentClass: string; studentId: string };
type Screen = 'WELCOME' | 'REGISTER' | 'DASHBOARD' | 'LEARN';

export default function App() {
  const [screen, setScreen] = useState<Screen>('WELCOME');
  const [student, setStudent] = useState<Student | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);

  useEffect(() => {
    initApiUrl();
  }, []);

  const openSettings = () => setSettingsVisible(true);

  let content: React.ReactNode = null;
  if (screen === 'WELCOME') {
    content = <WelcomeScreen onStart={() => setScreen('REGISTER')} onOpenSettings={openSettings} />;
  } else if (screen === 'REGISTER') {
    content = (
      <RegisterScreen
        onBack={() => setScreen('WELCOME')}
        onSubmit={(s) => {
          setStudent(s);
          setScreen('DASHBOARD');
        }}
      />
    );
  } else if (screen === 'DASHBOARD' && student) {
    content = (
      <DashboardScreen
        student={student}
        onOpenEnglish={() => setScreen('LEARN')}
        onOpenSettings={openSettings}
        onLogout={() => {
          setStudent(null);
          setScreen('WELCOME');
        }}
      />
    );
  } else if (screen === 'LEARN' && student) {
    content = (
      <LearnScreen
        studentId={student.studentId}
        studentName={student.name}
        onBackToDashboard={() => setScreen('DASHBOARD')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      {content}
      <ServerSettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
});
