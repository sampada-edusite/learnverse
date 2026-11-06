import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { LogOut, Server } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { ErrorState, FadeIn, IconButton, LoadingState, Row, Screen, Tabs, Type } from '../../ui';
import { Teacher, TeacherApi, errorMessage } from '../../config/platformApi';
import { OverviewTab } from './OverviewTab';
import { StudentsTab } from './StudentsTab';
import { AssignmentsTab } from './AssignmentsTab';
import { QuizzesTab } from './QuizzesTab';
import { StudentDetailSheet } from './StudentDetailSheet';

interface Props {
  token: string;
  teacher: Teacher;
  onLogout: () => void;
  onOpenSettings: () => void;
  onSessionExpired: () => void;
}

export const TeacherDashboardScreen: React.FC<Props> = ({ token, teacher, onLogout, onOpenSettings, onSessionExpired }) => {
  const [tab, setTab] = useState('overview');
  const [analytics, setAnalytics] = useState<any>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setError('');
    try {
      setAnalytics((await TeacherApi.overview(token)).analytics);
    } catch (e: any) {
      if (e?.status === 401) onSessionExpired();
      setError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [token, onSessionExpired]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const header = (
    <View style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={Type.small}>Teacher dashboard</Text>
          <Text style={Type.h1} numberOfLines={1}>{teacher.name}</Text>
          {teacher.school ? <Text style={Type.small} numberOfLines={1}>{teacher.school}</Text> : null}
        </View>
        <Row gap={8}>
          <IconButton label="Server settings" onPress={onOpenSettings} icon={<Server size={18} color={Colors.primary} />} />
          <IconButton label="Log out" onPress={onLogout} icon={<LogOut size={18} color="#BE123C" />} />
        </Row>
      </Row>
      <Tabs value={tab} onChange={(k) => { setTab(k); if (k === 'overview') loadOverview(); }}
        tabs={[{ key: 'overview', label: '📊 Overview' }, { key: 'students', label: '🧑‍🎓 Students' },
          { key: 'assignments', label: '📋 Homework' }, { key: 'quizzes', label: '📝 Quizzes' }]} />
    </View>
  );

  return (
    <>
      <Screen header={header} refreshing={refreshing} onRefresh={tab === 'overview' ? () => { setRefreshing(true); loadOverview(); } : undefined}>
        <FadeIn key={tab}>
          {tab === 'overview' ? (
            !analytics && !error ? <LoadingState label="Crunching your class numbers…" /> : !analytics ? (
              <ErrorState message={error} onRetry={loadOverview} />
            ) : (
              <OverviewTab analytics={analytics} classCode={teacher.class_code} onOpenStudent={setStudentId} onGoStudents={() => setTab('students')} />
            )
          ) : tab === 'students' ? (
            <StudentsTab token={token} onOpenStudent={setStudentId} onChanged={loadOverview} />
          ) : tab === 'assignments' ? (
            <AssignmentsTab token={token} />
          ) : (
            <QuizzesTab token={token} />
          )}
        </FadeIn>
      </Screen>
      <StudentDetailSheet token={token} studentId={studentId} onClose={() => setStudentId(null)} />
    </>
  );
};

export default TeacherDashboardScreen;
