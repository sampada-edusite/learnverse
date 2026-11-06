import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SubjectTheme } from '../../theme/tokens';
import {
  Avatar, ErrorState, LoadingState, Pill, ProgressBar, Row, SectionHeader, Sheet, StatTile, Stars, StatusPill, Type,
} from '../../ui';
import { TeacherApi, errorMessage } from '../../config/platformApi';

export const StudentDetailSheet: React.FC<{ token: string; studentId: string | null; onClose: () => void }> = ({ token, studentId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!studentId) return;
    setData(null);
    setError('');
    TeacherApi.studentProgress(token, studentId).then(setData).catch((e) => setError(errorMessage(e)));
  }, [token, studentId]);

  return (
    <Sheet visible={!!studentId} title={data ? data.student.name : 'Student report'} onClose={onClose} wide>
      {!data && !error ? <LoadingState /> : error ? <ErrorState message={error} /> : (
        <>
          <Row>
            <Avatar name={data.student.name} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={Type.h2}>{data.student.name}{data.student.nickname ? ` (${data.student.nickname})` : ''}</Text>
              <Text style={Type.small}>Std {data.student.student_class}{data.student.roll_no ? ` · Roll ${data.student.roll_no}` : ''} · Parent {data.student.parent_mobile}</Text>
            </View>
            <Pill label={`🔥 ${data.streak_days} days`} color="#BE123C" light="#FFE4E6" />
          </Row>
          <Row wrap gap={10}>
            <StatTile label="Accuracy" value={`${data.summary.accuracy}%`} />
            <StatTile label="Answers" value={data.summary.attempts} color="#0EA5E9" />
            <StatTile label="Skills mastered" value={data.summary.mastered_concepts} color="#059669" />
            <StatTile label="Game stars" value={data.summary.game_stars} color="#F97316" />
          </Row>

          <SectionHeader title="Subjects" />
          {data.subjects.map((s: any) => (
            <View key={s.subject} style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={Type.h3}>{SubjectTheme[s.subject].icon} {s.subject}</Text>
                <Text style={Type.small}>{s.mastered_concepts}/{s.concepts} skills · {s.attempts ? `${s.accuracy}%` : 'not started'}</Text>
              </Row>
              <ProgressBar value={s.progress} color={SubjectTheme[s.subject].color} />
            </View>
          ))}

          <SectionHeader title="Needs practice" />
          {data.weak_concepts.length ? data.weak_concepts.map((w: any) => (
            <Row key={w.concept_id}>
              <Text style={[Type.body, { flex: 1 }]} numberOfLines={1}>{w.concept_name}</Text>
              <Text style={Type.small}>{w.correct_attempts}/{w.total_attempts}</Text>
              <StatusPill status={w.status} />
            </Row>
          )) : <Text style={Type.small}>No weak skills detected.</Text>}

          <SectionHeader title="Homework" />
          {data.assignments.length ? data.assignments.map((a: any) => (
            <Row key={a.assignment_id}>
              <Text style={[Type.body, { flex: 1 }]} numberOfLines={1}>{a.title} — {a.detail}</Text>
              <StatusPill status={a.status} />
            </Row>
          )) : <Text style={Type.small}>No assignments.</Text>}

          <SectionHeader title="Quiz results" />
          {data.quiz_results.length ? data.quiz_results.map((q: any) => (
            <Row key={`${q.quiz_id}-${q.submitted_at}`}>
              <Text style={[Type.body, { flex: 1 }]}>{q.title}</Text>
              <Text style={Type.h3}>{q.score}/{q.max_score}</Text>
              <Text style={Type.small}>{q.submitted_at.slice(0, 10)}</Text>
            </Row>
          )) : <Text style={Type.small}>No quizzes taken.</Text>}

          <SectionHeader title="Games" />
          {data.games.length ? data.games.map((g: any) => (
            <Row key={g.game_id}>
              <Text style={{ fontSize: 20 }}>{g.icon}</Text>
              <Text style={[Type.body, { flex: 1 }]}>{g.title}</Text>
              <Text style={Type.small}>Level {g.highest_unlocked} unlocked</Text>
              <Stars count={Math.min(3, Math.round(g.total_stars / 5))} size={12} />
              <Text style={Type.small}>{g.total_stars}★</Text>
            </Row>
          )) : <Text style={Type.small}>No games played.</Text>}

          <SectionHeader title="Recent answers" />
          {data.recent_attempts.length ? data.recent_attempts.map((r: any, i: number) => (
            <Row key={i} style={{ alignItems: 'flex-start' }}>
              <Text>{r.is_correct ? '✅' : '❌'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={Type.body} numberOfLines={2}>{r.question}</Text>
                <Text style={Type.small}>{r.concept_name} · answered “{r.student_answer}” · {r.attempt_time.slice(0, 16)}</Text>
              </View>
            </Row>
          )) : <Text style={Type.small}>No answers yet.</Text>}
        </>
      )}
    </Sheet>
  );
};
