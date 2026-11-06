import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Timer, XCircle } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Radius, SubjectTheme } from '../theme/tokens';
import {
  AppBar, Banner, Button, Card, ErrorState, FadeIn, LoadingState, PressableScale, ProgressBar, Row, Screen, Stars, Type,
} from '../ui';
import { Quiz, StudentApi, errorMessage } from '../config/platformApi';
import { playCelebrationFanfare } from '../utils/soundEffects';

interface Props {
  studentId: string;
  quizId: number;
  onBack: () => void;
}

export const QuizScreen: React.FC<Props> = ({ studentId, quizId, onBack }) => {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const submitted = useRef(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const q = await StudentApi.quiz(studentId, quizId);
      setQuiz(q);
      setTimeLeft(q.time_limit_sec || null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [studentId, quizId]);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(async (force = false) => {
    if (!quiz || submitted.current) return;
    if (!force && Object.keys(answers).length < quiz.questions.length) {
      setError(`Please answer all ${quiz.questions.length} questions before submitting.`);
      return;
    }
    submitted.current = true;
    setSubmitting(true);
    setError('');
    try {
      const r = await StudentApi.submitQuiz(studentId, quizId, answers);
      setResult(r);
      if (r.percentage >= 80) playCelebrationFanfare();
    } catch (e) {
      submitted.current = false;
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [quiz, answers, studentId, quizId]);

  useEffect(() => {
    if (timeLeft === null || result) return;
    if (timeLeft <= 0) { submit(true); return; }
    const t = setTimeout(() => setTimeLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, result, submit]);

  const theme = SubjectTheme[quiz?.subject || 'English'];
  const header = <AppBar title={quiz ? `📝 ${quiz.title}` : 'Quiz'} subtitle={quiz ? `${quiz.subject} · Std ${quiz.student_class}` : undefined} onBack={onBack} />;

  if (!quiz) return <Screen header={header}>{error ? <ErrorState message={error} onRetry={load} /> : <LoadingState />}</Screen>;

  if (result) {
    const stars = result.percentage >= 80 ? 3 : result.percentage >= 50 ? 2 : 1;
    return (
      <Screen header={header}>
        <FadeIn>
          <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }} accent={theme.color}>
            <Text style={{ fontSize: 56 }}>{stars === 3 ? '🏆' : stars === 2 ? '🌟' : '💪'}</Text>
            <Text style={Type.display}>{result.score} / {result.max_score}</Text>
            <Stars count={stars} size={30} />
            <Text style={Type.body}>{result.percentage}% · +{result.score} coins 🪙</Text>
          </Card>
        </FadeIn>
        {result.results.map((r: any, i: number) => (
          <Card key={r.id} soft style={{ gap: 6 }}>
            <Row style={{ alignItems: 'flex-start' }}>
              {r.is_correct ? <CheckCircle2 size={20} color="#059669" /> : <XCircle size={20} color="#BE123C" />}
              <Text style={[Type.h3, { flex: 1 }]}>{i + 1}. {r.question}</Text>
            </Row>
            <Text style={Type.small}>Your answer: {r.your_answer || '—'}</Text>
            {!r.is_correct ? <Text style={[Type.small, { color: '#047857' }]}>Correct answer: {r.correct_answer}</Text> : null}
          </Card>
        ))}
        <Button title="Done" full onPress={onBack} />
      </Screen>
    );
  }

  const answered = Object.keys(answers).length;
  return (
    <Screen header={header}>
      <Card soft style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={Type.h3}>{answered}/{quiz.questions.length} answered</Text>
          {timeLeft !== null ? (
            <Row gap={6}><Timer size={16} color={timeLeft < 30 ? '#BE123C' : Colors.textMuted} />
              <Text style={[Type.h3, timeLeft < 30 ? { color: '#BE123C' } : null]}>{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</Text></Row>
          ) : null}
        </Row>
        <ProgressBar value={answered / quiz.questions.length} color={theme.color} />
        {quiz.last_score ? <Text style={Type.small}>Last time you scored {quiz.last_score.score}/{quiz.last_score.max_score}.</Text> : null}
      </Card>
      {quiz.questions.map((q, i) => (
        <FadeIn key={q.id} delay={Math.min(i, 6) * 40}>
          <Card style={{ gap: 12 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={[Type.h3, { flex: 1, fontSize: 18 }]}>{i + 1}. {q.question}</Text>
              <Text style={Type.small}>{q.points} pt{q.points > 1 ? 's' : ''}</Text>
            </Row>
            <View style={styles.options}>
              {q.options.map((o) => {
                const sel = answers[String(q.id)] === o;
                return (
                  <View key={o} style={styles.optWrap}>
                    <PressableScale onPress={() => setAnswers((a) => ({ ...a, [String(q.id)]: o }))} accessibilityLabel={o}>
                      <View style={[styles.opt, sel ? { borderColor: theme.color, backgroundColor: theme.light } : null]}>
                        <View style={[styles.radio, sel ? { borderColor: theme.color, backgroundColor: theme.color } : null]} />
                        <Text style={styles.optText}>{o}</Text>
                      </View>
                    </PressableScale>
                  </View>
                );
              })}
            </View>
          </Card>
        </FadeIn>
      ))}
      {error ? <Banner tone="danger" text={error} /> : null}
      <Button title="Submit quiz" size="lg" full loading={submitting} color={theme.color} onPress={() => submit(false)} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  options: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  optWrap: { width: '50%', padding: 5, minWidth: 160 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: '#EAD7E1', borderRadius: Radius.md, padding: 12, backgroundColor: '#FFF' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#CBB2C1' },
  optText: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.text },
});

export default QuizScreen;
