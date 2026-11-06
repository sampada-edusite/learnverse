import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { StatusTheme } from '../theme/tokens';
import {
  AppBar, Button, Card, EmptyState, ErrorState, FadeIn, LoadingState, ProgressBar, Row, Screen, StatusPill, Tabs, Type,
} from '../ui';
import { Assignment, StudentApi, errorMessage } from '../config/platformApi';

interface Props {
  studentId: string;
  onBack: () => void;
  onOpen: (a: Assignment) => void;
}

const KIND = { lesson: { icon: '📚', verb: 'Practise' }, quiz: { icon: '📝', verb: 'Take quiz' }, game: { icon: '🎮', verb: 'Play' } };

export const AssignmentsScreen: React.FC<Props> = ({ studentId, onBack, onOpen }) => {
  const [items, setItems] = useState<Assignment[] | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'todo' | 'done'>('todo');

  const load = useCallback(async () => {
    setError('');
    try {
      setItems((await StudentApi.assignments(studentId)).assignments);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const todo = (items || []).filter((a) => a.status !== 'completed');
  const done = (items || []).filter((a) => a.status === 'completed');
  const shown = tab === 'todo' ? todo : done;

  return (
    <Screen header={<AppBar title="📋 Homework" subtitle="Tasks from your teacher" onBack={onBack} />} onRefresh={load}>
      <Tabs value={tab} onChange={(k) => setTab(k as any)}
        tabs={[{ key: 'todo', label: 'To do', badge: todo.length }, { key: 'done', label: `Done (${done.length})` }]} />
      {!items && !error ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : shown.length === 0 ? (
        <EmptyState emoji={tab === 'todo' ? '🎉' : '📭'} title={tab === 'todo' ? 'Nothing to do right now!' : 'No finished tasks yet'}
          message={tab === 'todo' ? 'When your teacher gives you homework it will appear here.' : 'Finish a task and it will show up here.'} />
      ) : (
        <View style={{ gap: 12 }}>
          {shown.map((a, i) => (
            <FadeIn key={a.assignment_id} delay={i * 40}>
              <Card style={{ gap: 10 }} accent={StatusTheme[a.status].color}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 30 }}>{KIND[a.kind].icon}</Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={Type.h3}>{a.title}</Text>
                    <Text style={Type.small}>{a.ref_title}{a.kind === 'game' && a.level ? ` · Level ${a.level}` : ''}</Text>
                    {a.due_date ? <Text style={Type.small}>Due {a.due_date}</Text> : null}
                  </View>
                  <StatusPill status={a.status} />
                </Row>
                {a.instructions ? <Text style={Type.body}>“{a.instructions}”</Text> : null}
                <ProgressBar value={a.progress} color={StatusTheme[a.status].color} height={6} />
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={Type.small}>{a.detail}</Text>
                  <Button title={a.status === 'completed' ? 'Do again' : KIND[a.kind].verb} size="sm"
                    variant={a.status === 'completed' ? 'secondary' : 'primary'}
                    icon={<ArrowRight size={14} color={a.status === 'completed' ? Colors.primary : '#FFF'} />}
                    onPress={() => onOpen(a)} />
                </Row>
              </Card>
            </FadeIn>
          ))}
        </View>
      )}
    </Screen>
  );
};

export default AssignmentsScreen;
