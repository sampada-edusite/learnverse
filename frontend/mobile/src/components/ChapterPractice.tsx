import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, CheckCircle2, Lightbulb, Volume2, XCircle } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Radius, SubjectTheme } from '../theme/tokens';
import {
  AppBar, Banner, Button, Card, ErrorState, FadeIn, LoadingState, Pill, PressableScale, ProgressBar, Row, Screen,
  Stars, StatusPill, TextField, Type,
} from '../ui';
import { PracticeApi, errorMessage } from '../config/platformApi';
import { speakText } from '../utils/speechHelper';
import { playCelebrationFanfare, playGentleRetrySound, playStarCollectSound } from '../utils/soundEffects';
import { useReducedMotion } from '../hooks/useReducedMotion';

const ROUND_SIZE = 5;

interface Props {
  studentId: string;
  lesson: { lesson_id: string; lesson_name: string; lesson_name_local?: string | null; subject: string };
  relatedGames?: { game_id: string; title: string; icon: string }[];
  onClose: () => void;
  onPlayGame?: (gameId: string) => void;
}

export const ChapterPractice: React.FC<Props> = ({ studentId, lesson, relatedGames = [], onClose, onPlayGame }) => {
  const theme = SubjectTheme[lesson.subject] || SubjectTheme.English;
  const [exclude, setExclude] = useState<string[]>([]);
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [roundCount, setRoundCount] = useState(0);
  const [roundCorrect, setRoundCorrect] = useState(0);
  const [roundDone, setRoundDone] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const reduce = useReducedMotion();

  const loadNext = useCallback(async (ex: string[]) => {
    setLoading(true);
    setError('');
    setResult(null);
    setAnswer('');
    setSelected(null);
    setShowHint(false);
    try {
      setActivity(await PracticeApi.next(studentId, lesson.lesson_id, ex));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [studentId, lesson.lesson_id]);

  useEffect(() => { loadNext([]); }, [loadNext]);

  const q = activity?.question;
  const completed = activity && (activity.activity_type === 'lesson_completed' || !q);

  const doShake = () => {
    if (reduce) return;
    const n = Platform.OS !== 'web';
    Animated.sequence([10, -10, 6, -6, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: n }))).start();
  };

  const submit = async (value: string) => {
    if (!q || submitting || result) return;
    const text = value.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const ex = [...exclude, q.question_id];
      const res = await PracticeApi.answer(studentId, q.question_id, text, lesson.lesson_id, ex);
      setExclude(ex);
      setResult(res);
      setRoundCount((c) => c + 1);
      if (res.is_correct) {
        setRoundCorrect((c) => c + 1);
        playStarCollectSound();
      } else {
        playGentleRetrySound();
        doShake();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (roundCount >= ROUND_SIZE) {
      setRoundDone(true);
      if (roundCorrect >= 3) playCelebrationFanfare();
      return;
    }
    loadNext(exclude);
  };

  const newRound = () => {
    setRoundDone(false);
    setRoundCount(0);
    setRoundCorrect(0);
    loadNext(exclude);
  };

  const header = (
    <AppBar title={lesson.lesson_name} subtitle={`${theme.icon} ${lesson.subject}${lesson.lesson_name_local ? ` · ${lesson.lesson_name_local}` : ''}`}
      onBack={onClose} />
  );

  if (roundDone || completed) {
    const stars = roundCount ? (roundCorrect / roundCount >= 0.8 ? 3 : roundCorrect / roundCount >= 0.5 ? 2 : 1) : 0;
    return (
      <Screen header={header}>
        <FadeIn>
          <Card style={styles.summary} accent={theme.color}>
            <Text style={{ fontSize: 56 }}>{completed && !roundCount ? '🏁' : stars === 3 ? '🏆' : stars === 2 ? '🌟' : '💪'}</Text>
            <Text style={Type.h1}>{completed && !roundCount ? 'Chapter complete!' : 'Round complete!'}</Text>
            {roundCount ? (
              <>
                <Stars count={stars} size={32} />
                <Text style={Type.body}>You got {roundCorrect} of {roundCount} correct.</Text>
              </>
            ) : (
              <Text style={[Type.body, { textAlign: 'center' }]}>You have answered every question in this chapter. Great work!</Text>
            )}
            <Row wrap style={{ justifyContent: 'center', marginTop: 8 }}>
              {!completed ? <Button title="Practise more" onPress={newRound} color={theme.color} /> : null}
              {relatedGames.map((g) => (
                <Button key={g.game_id} title={`Play ${g.title}`} variant="secondary" color={theme.color}
                  icon={<Text>{g.icon}</Text>} onPress={() => onPlayGame?.(g.game_id)} />
              ))}
              <Button title="Back to chapters" variant="ghost" onPress={onClose} />
            </Row>
          </Card>
        </FadeIn>
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      <View style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={Type.small}>Question {Math.min(roundCount + (result ? 0 : 1), ROUND_SIZE)} of {ROUND_SIZE}</Text>
          <Text style={Type.small}>⭐ {roundCorrect}</Text>
        </Row>
        <ProgressBar value={roundCount / ROUND_SIZE} color={theme.color} />
      </View>

      {loading ? <LoadingState label="Choosing the right question for you…" /> : error ? (
        <ErrorState message={error} onRetry={() => loadNext(exclude)} />
      ) : q ? (
        <FadeIn key={q.question_id}>
          <Animated.View style={{ transform: [{ translateX: shake }] }}>
            <Card style={{ gap: 16 }} accent={theme.color}>
              <Row wrap gap={8}>
                {activity.concept_name ? <Pill label={activity.concept_name} color={theme.color} light={theme.light} /> : null}
                <Pill label={q.difficulty} color="#475569" light="#F1F5F9" />
                {activity.activity_type === 'recovery' ? <Pill label="Extra help" color="#B45309" light="#FEF3C7" /> : null}
              </Row>
              <Text style={styles.question}>{q.question}</Text>
              <Row wrap gap={8}>
                {lesson.subject === 'English' ? (
                  <Button title="Read aloud" size="sm" variant="secondary" icon={<Volume2 size={14} color={Colors.primary} />}
                    onPress={() => speakText(q.question)} />
                ) : null}
                {q.hint ? (
                  <Button title={showHint ? 'Hide hint' : 'Hint'} size="sm" variant="secondary" color="#B45309"
                    icon={<Lightbulb size={14} color="#B45309" />} onPress={() => setShowHint((s) => !s)} />
                ) : null}
              </Row>
              {showHint && q.hint ? <Banner tone="warning" text={`💡 ${q.hint}`} /> : null}

              {q.options && q.options.length ? (
                <View style={styles.options}>
                  {q.options.map((opt: string) => {
                    const isSel = selected === opt;
                    const state = result && isSel ? (result.is_correct ? 'right' : 'wrong') : null;
                    return (
                      <View key={opt} style={styles.optionWrap}>
                        <PressableScale disabled={!!result || submitting} onPress={() => { setSelected(opt); submit(opt); }}
                          accessibilityLabel={`Answer ${opt}`}>
                          <View style={[styles.option, isSel ? { borderColor: theme.color, backgroundColor: theme.light } : null,
                            state === 'right' ? styles.optRight : state === 'wrong' ? styles.optWrong : null]}>
                            <Text style={styles.optionText}>{opt}</Text>
                          </View>
                        </PressableScale>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <TextField label="Your answer" value={answer} onChangeText={setAnswer} editable={!result}
                    placeholder={lesson.subject === 'Marathi' ? 'उत्तर लिहा' : 'Type your answer'}
                    onSubmitEditing={() => submit(answer)} returnKeyType="done" />
                  {!result ? <Button title="Check answer" loading={submitting} disabled={!answer.trim()} onPress={() => submit(answer)} color={theme.color} /> : null}
                </View>
              )}

              {result ? (
                <FadeIn>
                  <View style={[styles.feedback, { backgroundColor: result.is_correct ? '#DCFCE7' : '#FFE4E6' }]}>
                    <Row>
                      {result.is_correct ? <CheckCircle2 size={22} color="#059669" /> : <XCircle size={22} color="#BE123C" />}
                      <Text style={[Type.h3, { flex: 1, color: result.is_correct ? '#047857' : '#BE123C' }]}>{result.feedback}</Text>
                    </Row>
                    {result.mastery ? (
                      <Row wrap gap={8}>
                        <Text style={Type.small}>Skill accuracy: {result.mastery.accuracy}%</Text>
                        <StatusPill status={result.mastery.status} />
                      </Row>
                    ) : null}
                    {!result.is_correct && result.next_activity?.hint ? (
                      <Text style={Type.small}>💡 Tip: {result.next_activity.hint}</Text>
                    ) : null}
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <Button title={roundCount >= ROUND_SIZE ? 'See results' : 'Next question'} full color={theme.color}
                      icon={<ArrowRight size={16} color="#FFF" />} onPress={next} />
                  </View>
                </FadeIn>
              ) : null}
            </Card>
          </Animated.View>
        </FadeIn>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  question: { fontSize: 22, fontWeight: '800', color: Colors.text, lineHeight: 32 },
  options: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  optionWrap: { width: '50%', padding: 6 },
  option: { minHeight: 60, borderRadius: Radius.md, borderWidth: 2, borderColor: '#EAD7E1', backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', padding: 12 },
  optionText: { fontSize: 18, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  optRight: { borderColor: '#059669', backgroundColor: '#DCFCE7' },
  optWrong: { borderColor: '#BE123C', backgroundColor: '#FFE4E6' },
  feedback: { borderRadius: Radius.md, padding: 14, gap: 8 },
  summary: { alignItems: 'center', gap: 10, paddingVertical: 28 },
});
