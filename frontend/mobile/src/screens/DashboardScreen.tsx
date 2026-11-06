import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, ClipboardList, Flame, Gamepad2, LogOut, Server, Target, Trophy, X } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Radius, Shadow, SubjectTheme } from '../theme/tokens';
import { Sticker } from '../components/Sticker';
import {
  Avatar, Banner, Button, Card, EmptyState, ErrorState, FadeIn, Grid, IconButton, LoadingState, Pill, ProgressBar,
  Row, Screen, SectionHeader, StatTile, StatusPill, Type,
} from '../ui';
import { Assignment, Badge, Student, StudentApi, errorMessage } from '../config/platformApi';

export const subjectForLesson = (lessonId?: string | null) => {
  if (!lessonId) return 'English';
  if (lessonId.startsWith('MR')) return 'Marathi';
  if (lessonId.startsWith('M')) return 'Mathematics';
  return 'English';
};

interface DashboardScreenProps {
  student: Student;
  onOpenSubject: (subject: string) => void;
  onOpenGames: () => void;
  onOpenAssignments: () => void;
  onOpenAssignment: (a: Assignment) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  student, onOpenSubject, onOpenGames, onOpenAssignments, onOpenAssignment, onOpenSettings, onLogout,
}) => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [drawer, setDrawer] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setData(await StudentApi.dashboard(student.student_id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [student.student_id]);

  useEffect(() => { load(); }, [load]);

  const header = (
    <Row style={{ justifyContent: 'space-between' }}>
      <View style={{ flex: 1 }}>
        <Text style={Type.small}>Namaste 👋</Text>
        <Text style={Type.h1} numberOfLines={1}>{student.name}!</Text>
      </View>
      <Row gap={8}>
        <IconButton label="Server settings" onPress={onOpenSettings} icon={<Server size={18} color={Colors.primary} />} />
        <IconButton label="My assignments" onPress={onOpenAssignments} badge={data?.pending_assignments?.length || 0}
          icon={<ClipboardList size={18} color={Colors.primary} />} />
        <Pressable onPress={() => setDrawer(true)} accessibilityRole="button" accessibilityLabel="Open my account">
          <Avatar name={student.nickname || student.name} />
        </Pressable>
      </Row>
    </Row>
  );

  if (!data && !error) return <Screen header={header}><LoadingState label="Getting your learning space ready…" /></Screen>;
  if (!data) {
    return (
      <Screen header={header}>
        <ErrorState message={error} onRetry={load} extra={<Button title="Settings" variant="ghost" size="sm" onPress={onOpenSettings} />} />
      </Screen>
    );
  }

  const next = data.next_activity;
  const nextSubject = subjectForLesson(next?.question?.lesson_id);
  const subjects: any[] = data.subjects || [];
  const badges: Badge[] = data.badges || [];

  return (
    <>
      <Screen header={header} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
        <FadeIn>
          <Row wrap gap={8}>
            <Pill label={`Class ${student.student_class}`} />
            <Pill label={`${data.coins ?? 0} coins`} icon={<Text>🪙</Text>} color="#92400E" light="#FEF3C7" />
            <Pill label={`${data.streak_days ?? 0}-day streak`} icon={<Flame size={12} color="#E11D48" />} color="#BE123C" light="#FFE4E6" />
            {student.teacher ? <Pill label={`Teacher: ${student.teacher.name}`} color="#047857" light="#DCFCE7" /> : null}
          </Row>
        </FadeIn>

        <FadeIn delay={60}>
          <View style={[styles.hero, Shadow]}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.heroEyebrow}>
                {next?.activity_type === 'introduce' ? 'START HERE' : next?.activity_type === 'practice' ? 'PRACTISE NEXT' : 'KEEP GOING'}
              </Text>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {next?.concept_name ? `${SubjectTheme[nextSubject]?.icon} ${next.concept_name}` : 'Pick a subject to begin'}
              </Text>
              {next?.concept_name ? <Text style={styles.heroEyebrow}>{nextSubject.toUpperCase()}</Text> : null}
              <Text style={styles.heroText} numberOfLines={2}>{next?.reason || 'Choose a subject below to begin.'}</Text>
              <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                <Button title={`Continue ${nextSubject}`} variant="secondary" onPress={() => onOpenSubject(nextSubject)}
                  icon={<ArrowRight size={16} color={Colors.primary} />} />
              </View>
            </View>
            <Sticker name="owl.png" size={92} />
          </View>
        </FadeIn>

        <FadeIn delay={120}>
          <Row wrap gap={12}>
            <StatTile label="Accuracy" value={data.total_attempts ? `${data.overall_accuracy}%` : "—"} icon={<Target size={14} color={Colors.textLight} />} />
            <StatTile label="Questions" value={data.total_attempts} icon={<Text>✏️</Text>} color="#0EA5E9" />
            <StatTile label="Games" value={data.games_played} icon={<Gamepad2 size={14} color={Colors.textLight} />} color="#F97316" />
            <StatTile label="Badges" value={badges.length} icon={<Trophy size={14} color={Colors.textLight} />} color="#059669" />
          </Row>
        </FadeIn>

        <SectionHeader title="Subjects" subtitle="Maharashtra State Board · Balbharati aligned" />
        <Grid>
          {subjects.map((s, i) => {
            const t = SubjectTheme[s.subject];
            return (
              <FadeIn key={s.subject} delay={150 + i * 60}>
                <Card accent={t.color} onPress={() => onOpenSubject(s.subject)} accessibilityLabel={`Open ${s.subject}`} style={{ gap: 10 }}>
                  <Row>
                    <View style={[styles.subjectIcon, { backgroundColor: t.light }]}><Text style={{ fontSize: 26 }}>{t.icon}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={Type.h3}>{s.subject}</Text>
                      <Text style={Type.small}>{t.local} · {s.lessons} chapters</Text>
                    </View>
                    <ArrowRight size={18} color={t.color} />
                  </Row>
                  <ProgressBar value={s.progress} color={t.color} />
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={Type.small}>{s.mastered_concepts}/{s.concepts} skills mastered</Text>
                    <Text style={[Type.small, { color: t.color }]}>{s.attempts ? `${s.accuracy}% correct` : 'Not started'}</Text>
                  </Row>
                </Card>
              </FadeIn>
            );
          })}
        </Grid>

        <Grid>
          <Card onPress={onOpenGames} style={[styles.gamesCard]} accessibilityLabel="Open games">
            <Row>
              <Text style={{ fontSize: 40 }}>🎮</Text>
              <View style={{ flex: 1 }}>
                <Text style={[Type.h2, { color: '#FFFFFF' }]}>Play & Learn</Text>
                <Text style={{ color: '#EDE9FE', fontWeight: '600' }}>12 Maths & Marathi games · 5 levels each</Text>
              </View>
              <ArrowRight size={20} color="#FFFFFF" />
            </Row>
          </Card>
          <Card onPress={onOpenAssignments} accessibilityLabel="Open assignments">
            <Row>
              <View style={[styles.subjectIcon, { backgroundColor: '#FEF3C7' }]}><ClipboardList size={24} color="#B45309" /></View>
              <View style={{ flex: 1 }}>
                <Text style={Type.h3}>Homework</Text>
                <Text style={Type.small}>
                  {data.pending_assignments?.length ? `${data.pending_assignments.length} task(s) to do` : 'All caught up!'}
                </Text>
              </View>
              <ArrowRight size={18} color={Colors.primary} />
            </Row>
          </Card>
        </Grid>

        {data.pending_assignments?.length ? (
          <View style={{ gap: 10 }}>
            <SectionHeader title="To do" action={<Button title="See all" variant="ghost" size="sm" onPress={onOpenAssignments} />} />
            {data.pending_assignments.slice(0, 3).map((a: Assignment) => (
              <Card key={a.assignment_id} soft onPress={() => onOpenAssignment(a)}>
                <Row>
                  <Text style={{ fontSize: 24 }}>{a.kind === 'quiz' ? '📝' : a.kind === 'game' ? '🎮' : '📚'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={Type.h3} numberOfLines={1}>{a.title}</Text>
                    <Text style={Type.small} numberOfLines={1}>{a.ref_title}{a.due_date ? ` · due ${a.due_date}` : ''}</Text>
                  </View>
                  <StatusPill status={a.status} />
                </Row>
              </Card>
            ))}
          </View>
        ) : null}

        <SectionHeader title="Practise these next" subtitle="Skills where a little more practice will help" />
        {data.weak_concepts?.length ? (
          <Card soft style={{ gap: 12 }}>
            {data.weak_concepts.map((w: any) => (
              <Row key={w.concept_id}>
                <View style={{ flex: 1 }}>
                  <Text style={Type.h3} numberOfLines={1}>{w.concept_name}</Text>
                  <Text style={Type.small}>{w.correct_attempts}/{w.total_attempts} correct</Text>
                </View>
                <StatusPill status={w.status} />
              </Row>
            ))}
          </Card>
        ) : (
          <Card soft><EmptyState emoji="🌟" title="No weak spots yet" message="Keep practising — we will show skills that need attention here." /></Card>
        )}

        {badges.length ? (
          <View style={{ gap: 10 }}>
            <SectionHeader title="My badges" />
            <Row wrap gap={10}>
              {badges.map((b) => (
                <View key={b.badge_id} style={styles.badge}>
                  <Text style={{ fontSize: 28 }}>{b.icon}</Text>
                  <Text style={styles.badgeTitle} numberOfLines={1}>{b.title}</Text>
                </View>
              ))}
            </Row>
          </View>
        ) : null}
      </Screen>

      <Modal visible={drawer} transparent animationType="fade" onRequestClose={() => setDrawer(false)}>
        <Pressable style={styles.overlay} onPress={() => setDrawer(false)}>
          <Pressable style={[styles.drawer, Shadow]} onPress={() => {}}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={Type.h2}>My account</Text>
              <Pressable onPress={() => setDrawer(false)} accessibilityLabel="Close"><X size={22} color={Colors.text} /></Pressable>
            </Row>
            <ScrollView contentContainerStyle={{ gap: 14, paddingTop: 12 }}>
              <Row>
                <Avatar name={student.nickname || student.name} size={60} />
                <View style={{ flex: 1 }}>
                  <Text style={Type.h2}>{student.name}</Text>
                  {student.nickname ? <Text style={Type.small}>Nick name: {student.nickname}</Text> : null}
                  <Text style={Type.small}>Class {student.student_class} · Parent {student.parent_mobile_masked || ''}</Text>
                </View>
              </Row>
              <Card soft style={{ gap: 6 }}>
                <Row><Flame size={20} color="#E11D48" /><Text style={Type.h3}>{data.streak_days} day streak</Text></Row>
                <Text style={Type.small}>Practise or play every day to grow your streak.</Text>
              </Card>
              <Card soft style={{ gap: 6 }}>
                <Text style={Type.h3}>Learner ID</Text>
                <Text selectable style={Type.small}>{student.student_id}</Text>
                <Text style={Type.small}>
                  {student.teacher ? `In ${student.teacher.name}'s class${student.teacher.school ? ` · ${student.teacher.school}` : ''}` :
                    'Not linked to a teacher yet. Ask your teacher for a class code.'}
                </Text>
              </Card>
              {error ? <Banner tone="warning" text={error} /> : null}
              <Button title="Log out" variant="danger" full icon={<LogOut size={16} color="#BE123C" />}
                onPress={() => { setDrawer(false); onLogout(); }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.primary, borderRadius: Radius.xl,
    padding: 20, overflow: 'hidden',
  },
  heroEyebrow: { color: '#DFB6B2', fontWeight: '900', fontSize: 12, letterSpacing: 1.2 },
  heroTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 24 },
  heroText: { color: '#F5E8F0', fontWeight: '600', fontSize: 14, lineHeight: 20 },
  subjectIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  gamesCard: { backgroundColor: '#6C5CE7', borderColor: '#6C5CE7' },
  badge: { width: 96, alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', borderRadius: Radius.md, padding: 10, borderWidth: 1, borderColor: '#F3E3EA' },
  badgeTitle: { fontSize: 11, fontWeight: '800', color: Colors.textMuted, textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(25,0,25,0.35)', alignItems: 'flex-end' },
  drawer: { width: '100%', maxWidth: 400, height: '100%', backgroundColor: Colors.background, padding: 20 },
});
