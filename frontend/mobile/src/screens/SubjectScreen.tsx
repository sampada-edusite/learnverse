import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BookOpenCheck, Gamepad2 } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Radius, SubjectTheme } from '../theme/tokens';
import {
  AppBar, Button, Card, ErrorState, FadeIn, Grid, LoadingState, ProgressBar, Row, Screen, SectionHeader, StatusPill,
  Tabs, Type,
} from '../ui';
import { GameApi, GameInfo, LessonProgress, StudentApi, errorMessage } from '../config/platformApi';
import { ChapterPractice } from '../components/ChapterPractice';

interface Props {
  studentId: string;
  studentClass: number;
  subject: 'Mathematics' | 'Marathi';
  initialLessonId?: string;
  onBack: () => void;
  onPlayGame: (gameId: string, level?: number) => void;
}

export const SubjectScreen: React.FC<Props> = ({ studentId, studentClass, subject, initialLessonId, onBack, onPlayGame }) => {
  const theme = SubjectTheme[subject];
  const lessonClass = initialLessonId ? Number((initialLessonId.match(/^(?:MR|M)(\d+)\./) || [])[1]) : NaN;
  const initialClass = lessonClass || Math.min(Math.max(studentClass, 1), 2);
  const [classLevel, setClassLevel] = useState<number>(initialClass);
  const [lessons, setLessons] = useState<LessonProgress[] | null>(null);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [error, setError] = useState('');
  const [openLesson, setOpenLesson] = useState<LessonProgress | null>(null);
  const [practising, setPractising] = useState<LessonProgress | null>(null);
  const [pendingInitial, setPendingInitial] = useState(initialLessonId);

  const load = useCallback(async () => {
    setError('');
    try {
      const [p, g] = await Promise.all([
        StudentApi.progress(studentId, subject, classLevel),
        GameApi.list(studentId, subject),
      ]);
      setLessons(p.lessons);
      setGames(g.games);
      if (pendingInitial) {
        const target = p.lessons.find((l) => l.lesson_id === pendingInitial);
        if (target) setPractising(target);
        setPendingInitial(undefined);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [studentId, subject, classLevel, pendingInitial]);

  useEffect(() => { setLessons(null); load(); }, [classLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  const gamesFor = (lessonId: string) => games.filter((g) => g.lesson_id === lessonId);

  if (practising) {
    return (
      <ChapterPractice
        studentId={studentId}
        lesson={practising}
        relatedGames={gamesFor(practising.lesson_id)}
        onClose={() => { setPractising(null); setOpenLesson(null); load(); }}
        onPlayGame={(id) => onPlayGame(id)}
      />
    );
  }

  const totalConcepts = lessons?.reduce((n, l) => n + l.concept_count, 0) || 0;
  const mastered = lessons?.reduce((n, l) => n + l.mastered_concepts, 0) || 0;

  return (
    <Screen
      header={<AppBar title={`${theme.icon} ${subject === 'Marathi' ? 'मराठी' : 'Mathematics'}`}
        subtitle={`${subject === 'Marathi' ? 'Marathi' : 'गणित'} · Maharashtra State Board (Balbharati)`} onBack={onBack} />}
    >
      <Tabs value={String(classLevel)} onChange={(k) => { setOpenLesson(null); setClassLevel(Number(k)); }}
        tabs={[{ key: '1', label: 'Std 1 · इयत्ता पहिली' }, { key: '2', label: 'Std 2 · इयत्ता दुसरी' }]} />

      {!lessons && !error ? <LoadingState label="Loading chapters…" /> : error ? <ErrorState message={error} onRetry={load} /> : (
        <>
          <FadeIn>
            <Card style={{ gap: 10, backgroundColor: theme.light, borderColor: theme.light }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={Type.h3}>Your progress in Std {classLevel}</Text>
                <Text style={[Type.h3, { color: theme.color }]}>{mastered}/{totalConcepts} skills</Text>
              </Row>
              <ProgressBar value={totalConcepts ? mastered / totalConcepts : 0} color={theme.color} track="#FFFFFF" />
              <Text style={Type.small}>Each chapter has practice questions that adapt to you, plus matching games.</Text>
            </Card>
          </FadeIn>

          {openLesson ? (
            <FadeIn key={openLesson.lesson_id}>
              <Card accent={theme.color} style={{ gap: 14 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={Type.tiny}>CHAPTER {openLesson.chapter_no}</Text>
                    <Text style={Type.h2}>{openLesson.lesson_name}</Text>
                    {openLesson.lesson_name_local ? <Text style={Type.small}>{openLesson.lesson_name_local}</Text> : null}
                  </View>
                  <Button title="All chapters" variant="ghost" size="sm" onPress={() => setOpenLesson(null)} />
                </Row>
                {openLesson.description ? <Text style={Type.body}>{openLesson.description}</Text> : null}
                <View style={{ gap: 10 }}>
                  {openLesson.concepts.map((c) => (
                    <Row key={c.concept_id} style={styles.conceptRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={Type.h3}>{c.name}</Text>
                        <Text style={Type.small}>{c.attempts ? `${c.accuracy}% correct · ${c.attempts} tries` : `${c.question_count} questions`}</Text>
                      </View>
                      <StatusPill status={c.status} />
                    </Row>
                  ))}
                </View>
                <Row wrap>
                  <Button title="Start practice" color={theme.color} icon={<BookOpenCheck size={16} color="#FFF" />}
                    onPress={() => setPractising(openLesson)} />
                  {gamesFor(openLesson.lesson_id).map((g) => (
                    <Button key={g.game_id} title={`Play ${g.title}`} variant="secondary" color={theme.color}
                      icon={<Text>{g.icon}</Text>} onPress={() => onPlayGame(g.game_id)} />
                  ))}
                </Row>
              </Card>
            </FadeIn>
          ) : null}

          <SectionHeader title="Chapters" subtitle={`${lessons!.length} chapters · tap one to see its skills`} />
          <Grid>
            {lessons!.map((l, i) => (
              <FadeIn key={l.lesson_id} delay={Math.min(i, 8) * 40}>
                <Card onPress={() => setOpenLesson(l)} style={{ gap: 10 }} accessibilityLabel={`Open chapter ${l.lesson_name}`}>
                  <Row>
                    <View style={[styles.num, { backgroundColor: theme.color }]}><Text style={styles.numText}>{l.chapter_no}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={Type.h3} numberOfLines={1}>{l.lesson_name}</Text>
                      <Text style={Type.small} numberOfLines={1}>{l.lesson_name_local || l.description}</Text>
                    </View>
                    {gamesFor(l.lesson_id).length ? <Gamepad2 size={18} color={theme.color} /> : null}
                  </Row>
                  <ProgressBar value={l.progress} color={theme.color} height={6} />
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={Type.small}>{l.mastered_concepts}/{l.concept_count} skills mastered</Text>
                    <Text style={[Type.small, { color: theme.color }]}>{l.attempts ? `${l.accuracy}%` : 'New'}</Text>
                  </Row>
                </Card>
              </FadeIn>
            ))}
          </Grid>
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  num: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numText: { color: '#FFF', fontWeight: '900', fontSize: 16 },
  conceptRow: { backgroundColor: '#FBF5F8', borderRadius: Radius.md, padding: 12 },
});

export default SubjectScreen;
