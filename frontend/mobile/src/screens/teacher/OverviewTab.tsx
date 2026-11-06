import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Activity, Gamepad2, Target, Users } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { Radius, SubjectTheme } from '../../theme/tokens';
import { Button, Card, EmptyState, Grid, ProgressBar, Row, SectionHeader, StatTile, Type } from '../../ui';

const fmtDate = (d?: string | null) => (d ? d.slice(0, 10) : 'Never');

/** Single-series bar chart of class practice per day (attempts + game rounds). */
const ActivityChart: React.FC<{ days: { date: string; attempts: number; games: number }[] }> = ({ days }) => {
  const [active, setActive] = useState<number | null>(null);
  const totals = days.map((d) => d.attempts + d.games);
  const max = Math.max(1, ...totals);
  const shown = active !== null ? active : totals.length - 1;
  return (
    <View style={{ gap: 8 }}>
      <Text style={Type.small}>
        {new Date(days[shown].date).toDateString().slice(4, 10)}: {totals[shown]} activities
        ({days[shown].attempts} questions, {days[shown].games} game rounds)
      </Text>
      <View style={styles.chart} accessibilityLabel="Class activity over the last 14 days">
        {days.map((d, i) => {
          const h = Math.round((totals[i] / max) * 100);
          return (
            <Pressable key={d.date} style={styles.barHit} onPress={() => setActive(i)} onHoverIn={() => setActive(i)}
              accessibilityLabel={`${d.date}: ${totals[i]} activities`}>
              <View style={[styles.bar, { height: `${Math.max(h, totals[i] ? 4 : 0)}%` as any,
                backgroundColor: i === shown ? Colors.primary : '#B794C9' }]} />
            </Pressable>
          );
        })}
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={Type.tiny}>{days[0].date.slice(5)}</Text>
        <Text style={Type.tiny}>Today</Text>
      </Row>
    </View>
  );
};

export const OverviewTab: React.FC<{ analytics: any; classCode: string; onOpenStudent: (id: string) => void; onGoStudents: () => void }> = ({
  analytics: a, classCode, onOpenStudent, onGoStudents,
}) => {
  const share = () => Share.share({
    message: `Join my class on LearnVerse! Open the app, tap "Let's Start" and enter class code ${classCode}.`,
  }).catch(() => {});

  return (
    <View style={{ gap: 20 }}>
      <Row wrap gap={12}>
        <StatTile label="Students" value={a.total_students} icon={<Users size={14} color={Colors.textLight} />} />
        <StatTile label="Active this week" value={a.active_this_week} icon={<Activity size={14} color={Colors.textLight} />} color="#0EA5E9" />
        <StatTile label="Avg accuracy" value={a.average_accuracy !== null ? `${a.average_accuracy}%` : '—'} icon={<Target size={14} color={Colors.textLight} />} color="#059669" />
        <StatTile label="Quiz average" value={a.quiz_average !== null ? `${a.quiz_average}%` : '—'} icon={<Text>📝</Text>} color="#B45309" />
        <StatTile label="Game rounds" value={a.games_played} icon={<Gamepad2 size={14} color={Colors.textLight} />} color="#F97316" />
      </Row>

      <Card style={[styles.codeCard]}>
        <Row wrap style={{ justifyContent: 'space-between' }}>
          <View style={{ gap: 4, flexShrink: 1 }}>
            <Text style={[Type.tiny, { color: '#DFB6B2' }]}>CLASS CODE</Text>
            <Text selectable style={styles.code}>{classCode}</Text>
            <Text style={{ color: '#F5E8F0', fontWeight: '600' }}>Students enter this code when they sign up to join your class.</Text>
          </View>
          <Button title="Share code" variant="secondary" onPress={share} />
        </Row>
      </Card>

      {a.total_students === 0 ? (
        <Card><EmptyState emoji="🧑‍🎓" title="No students yet" message="Add students yourself, or share your class code so they can join."
          action={<Button title="Add students" onPress={onGoStudents} />} /></Card>
      ) : (
        <>
          <Grid>
            <Card style={{ gap: 12 }}>
              <SectionHeader title="Class activity" subtitle="Questions answered + game rounds, last 14 days" />
              {a.daily_activity?.some((d: any) => d.attempts + d.games > 0) ? <ActivityChart days={a.daily_activity} />
                : <Text style={Type.small}>No practice or games in the last 14 days yet.</Text>}
            </Card>
            <Card style={{ gap: 12 }}>
              <SectionHeader title="Accuracy by subject" subtitle="Share of practice answers that were correct" />
              {a.subjects.length ? a.subjects.map((s: any) => (
                <View key={s.subject} style={{ gap: 6 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={Type.h3}>{SubjectTheme[s.subject]?.icon} {s.subject}</Text>
                    <Text style={Type.small}>{s.accuracy}% · {s.attempts} answers · {s.learners} learners</Text>
                  </Row>
                  <ProgressBar value={s.accuracy / 100} color={SubjectTheme[s.subject]?.color || Colors.primary} />
                </View>
              )) : <Text style={Type.small}>No practice yet.</Text>}
            </Card>
          </Grid>

          <Card style={{ gap: 12 }}>
            <SectionHeader title="Skills that need attention" subtitle="Concepts where students are below 80% accuracy" />
            {a.struggling_concepts.length ? a.struggling_concepts.map((c: any) => (
              <Row key={c.concept_id} style={styles.rowItem}>
                <Text style={{ fontSize: 20 }}>{SubjectTheme[c.subject]?.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={Type.h3} numberOfLines={1}>{c.concept_name}</Text>
                  <Text style={Type.small} numberOfLines={1}>{c.lesson_name} · {c.struggling_students} of {c.learners} students below 50%</Text>
                </View>
                <Text style={[Type.h3, { color: c.accuracy < 50 ? '#BE123C' : '#B45309' }]}>{c.accuracy}%</Text>
              </Row>
            )) : <Text style={Type.small}>Great news — no struggling skills right now.</Text>}
          </Card>

          <Card style={{ gap: 4 }}>
            <SectionHeader title="Student progress" subtitle="Tap a student for the full report" />
            <Row style={[styles.tableHead]}>
              <Text style={[styles.th, { flex: 2 }]}>Student</Text>
              <Text style={styles.th}>Accuracy</Text>
              <Text style={styles.th}>Answers</Text>
              <Text style={styles.th}>Mastered</Text>
              <Text style={[styles.th, { flex: 1.3 }]}>Last active</Text>
            </Row>
            {a.students.map((s: any) => (
              <Pressable key={s.student_id} onPress={() => onOpenStudent(s.student_id)} accessibilityRole="button"
                style={({ hovered }: any) => [styles.tr, hovered ? { backgroundColor: '#FBF5F8' } : null]}>
                <Text style={[styles.td, { flex: 2, fontWeight: '800' }]} numberOfLines={1}>{s.roll_no ? `${s.roll_no}. ` : ''}{s.name}</Text>
                <Text style={[styles.td, { color: s.attempts ? (s.accuracy >= 80 ? '#047857' : s.accuracy >= 50 ? '#B45309' : '#BE123C') : Colors.textLight }]}>
                  {s.attempts ? `${s.accuracy}%` : '—'}
                </Text>
                <Text style={styles.td}>{s.attempts}</Text>
                <Text style={styles.td}>{s.mastered_concepts}</Text>
                <Text style={[styles.td, { flex: 1.3 }]} numberOfLines={1}>{fmtDate(s.last_active)}</Text>
              </Pressable>
            ))}
          </Card>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  chart: { height: 140, flexDirection: 'row', alignItems: 'flex-end', gap: 4, borderBottomWidth: 1, borderBottomColor: '#EAD7E1' },
  barHit: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 0 },
  codeCard: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  code: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', letterSpacing: 6 },
  rowItem: { backgroundColor: '#FBF5F8', borderRadius: Radius.md, padding: 12 },
  tableHead: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3E3EA' },
  th: { flex: 1, fontSize: 11, fontWeight: '900', color: Colors.textLight, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8EDF2', borderRadius: 8 },
  td: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
});
