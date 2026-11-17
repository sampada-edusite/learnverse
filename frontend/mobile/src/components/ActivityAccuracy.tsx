/**
 * Activity-wise accuracy (Homework, Quiz, Test, Practice) with an optional Overall view.
 * Accuracy = correct answers / total questions x 100. Used on the Student dashboard and in the
 * Teacher's student report.
 */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import { Card, Chip, Pill, ProgressBar, Row, Type } from '../ui';
import { ActivityResult, Performance } from '../config/platformApi';

const LABEL: Record<ActivityResult['type'], string> = { practice: '✏️ Practice', homework: '📚 Homework', quiz: '📝 Quiz', test: '🧪 Test' };
const FILTERS: { key: 'all' | ActivityResult['type']; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'practice', label: 'Practice' }, { key: 'homework', label: 'Homework' },
  { key: 'quiz', label: 'Quiz' }, { key: 'test', label: 'Test' },
];

const tone = (acc: number) => (acc >= 80 ? ['#047857', '#DCFCE7'] : acc >= 50 ? ['#B45309', '#FEF3C7'] : ['#BE123C', '#FFE4E6']);

const Numbers: React.FC<{ correct: number; incorrect: number; total: number; marks: { earned: number; possible: number }; accuracy: number }> = (a) => (
  <Row wrap gap={10}>
    <Text style={Type.small}>✅ Correct {a.correct}</Text>
    <Text style={Type.small}>❌ Incorrect {a.incorrect}</Text>
    <Text style={Type.small}>Total {a.total}</Text>
    <Text style={Type.small}>Marks {a.marks.earned}/{a.marks.possible}</Text>
    <Pill label={`Accuracy ${a.accuracy}%`} color={tone(a.accuracy)[0]} light={tone(a.accuracy)[1]} />
  </Row>
);

export const ActivityAccuracy: React.FC<{ data: Performance; showTeacher?: boolean }> = ({ data, showTeacher = true }) => {
  const [filter, setFilter] = useState<'all' | ActivityResult['type']>('all');
  const [showOverall, setShowOverall] = useState(true);
  const items = data.activities.filter((a) => filter === 'all' || a.type === filter);
  const summary = filter === 'all' ? data.overall : data.by_type[filter];

  return (
    <View style={{ gap: 10 }}>
      <Row wrap gap={8}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.key === 'all' ? f.label : `${f.label} (${data.by_type[f.key].activities})`}
            selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
        <Chip label={showOverall ? 'Hide overall' : 'Show overall'} onPress={() => setShowOverall((v) => !v)} />
      </Row>

      {showOverall ? (
        <Card tone="lavender" style={{ gap: 8 }}>
          <Text style={Type.h3}>{filter === 'all' ? 'Overall accuracy (all activities)' : `${FILTERS.find((f) => f.key === filter)?.label} accuracy`}</Text>
          <ProgressBar value={summary.accuracy / 100} color={tone(summary.accuracy)[0]} />
          <Numbers {...summary} />
          <Text style={Type.tiny}>{summary.activities} activit{summary.activities === 1 ? 'y' : 'ies'}</Text>
        </Card>
      ) : null}

      {items.length ? items.map((a) => (
        <Card key={a.activity_id} soft style={{ gap: 6 }}>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={Type.h3} numberOfLines={2}>{a.title}</Text>
              <Text style={Type.small}>
                {LABEL[a.type]} · {a.subject} · {(a.date || '').slice(0, 10)}{showTeacher && a.teacher_name ? ` · ${a.teacher_name}` : ''}
              </Text>
            </View>
          </Row>
          <Numbers {...a} />
        </Card>
      )) : <Text style={[Type.small, { color: Colors.textMuted }]}>No {filter === 'all' ? '' : `${filter} `}activities yet.</Text>}
    </View>
  );
};
