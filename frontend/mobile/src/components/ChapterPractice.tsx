import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, CheckCircle2, Lightbulb, MessageCircle, Volume2, XCircle } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Radius, SubjectTheme } from '../theme/tokens';
import {
  AppBar, Banner, Button, Card, ErrorState, FadeIn, LoadingState, Pill, PressableScale, ProgressBar, Row, Screen,
  Stars, StatusPill, TextField, Type,
} from '../ui';
import { PracticeApi, ResumeApi, errorMessage } from '../config/platformApi';
import { speakText, stopSpeech } from '../utils/speechHelper';
import { playCelebrationFanfare, playGentleRetrySound, playStarCollectSound } from '../utils/soundEffects';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { voiceUnavailableReason } from '../utils/speechRecognition';
import { matchSpokenOption, parseVoiceCommand } from '../utils/voiceCommands';
import { VoiceMicButton, VoiceStatus, useVoiceInput } from './VoiceInput';

const ROUND_SIZE = 5;
const AUTO_CHECK_SECONDS = 3;

interface Props {
  studentId: string;
  lesson: { lesson_id: string; lesson_name: string; lesson_name_local?: string | null; subject: string };
  relatedGames?: { game_id: string; title: string; icon: string }[];
  onClose: () => void;
  onPlayGame?: (gameId: string) => void;
}

const SAY = {
  en: {
    correct: 'Correct! Well done.', wrong: 'Not quite. Good try!', next: 'Say next for the next question.',
    chose: (o: string) => `You said ${o}.`, notOption: (t: string) => `I heard ${t}. Please say one of the answers.`,
    answerFirst: 'Answer the question first.', checking: 'Checking your answer.',
  },
  mr: {
    correct: 'बरोबर! छान!', wrong: 'अगदी बरोबर नाही. छान प्रयत्न!', next: 'पुढचा प्रश्न हवा असेल तर पुढे म्हणा.',
    chose: (o: string) => `तुम्ही ${o} म्हणालात.`, notOption: (t: string) => `मी ${t} ऐकले. कृपया एक उत्तर सांगा.`,
    answerFirst: 'आधी प्रश्नाचे उत्तर द्या.', checking: 'उत्तर तपासत आहे.',
  },
};

export const ChapterPractice: React.FC<Props> = ({ studentId, lesson, relatedGames = [], onClose, onPlayGame }) => {
  const theme = SubjectTheme[lesson.subject] || SubjectTheme.English;
  const lang = lesson.subject === 'Marathi' ? 'mr' : 'en';
  const resumeKey = `lesson:${lesson.lesson_id}`;
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
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  // Talk mode: the app reads the question, listens, understands commands and answers by voice.
  const voiceAvailable = voiceUnavailableReason() === null;
  const [talkMode, setTalkMode] = useState(voiceAvailable);
  const [heard, setHeard] = useState('');
  const [autoCheckIn, setAutoCheckIn] = useState<number | null>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const reduce = useReducedMotion();
  const missRef = useRef(0);

  // Latest values for callbacks fired by speech events.
  const live = useRef({ talkMode, result, activity, answer, submitting, roundCount, showHint });
  live.current = { talkMode, result, activity, answer, submitting, roundCount, showHint };

  const say = useCallback((text: string, then?: () => void) => {
    speakText(text, { lang, rate: 0.9, onEnd: () => then?.() });
  }, [lang]);

  const voice = useVoiceInput({
    lang,
    onText: (text, isFinal) => handleSpeech(text, isFinal),
    onError: () => { missRef.current += 1; },
  });
  const stopVoice = voice.stop;
  const listen = voice.start;

  const loadNext = useCallback(async (ex: string[]) => {
    setLoading(true);
    setError('');
    setResult(null);
    setAnswer('');
    setSelected(null);
    setShowHint(false);
    setHeard('');
    setAutoCheckIn(null);
    missRef.current = 0;
    try {
      setActivity(await PracticeApi.next(studentId, lesson.lesson_id, ex));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [studentId, lesson.lesson_id]);

  // Start: continue from where the learner stopped last time, if there is an unfinished round.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let ex: string[] = [];
      try {
        const saved = (await ResumeApi.get(studentId, resumeKey)).item?.state;
        if (saved && saved.roundCount > 0 && saved.roundCount < ROUND_SIZE) {
          ex = Array.isArray(saved.exclude) ? saved.exclude : [];
          if (!cancelled) {
            setExclude(ex);
            setRoundCount(saved.roundCount);
            setRoundCorrect(saved.roundCorrect || 0);
            setResumedFrom(saved.roundCount + 1);
          }
        }
      } catch {
        // No saved progress (or offline): start a fresh round.
      }
      if (!cancelled) loadNext(ex);
    })();
    return () => { cancelled = true; };
  }, [loadNext, studentId, resumeKey]);

  useEffect(() => () => { stopSpeech(); }, []);

  const q = activity?.question;
  const completed = activity && (activity.activity_type === 'lesson_completed' || !q);
  const isMcq = !!(q?.options && q.options.length);

  const saveProgress = (ex: string[], count: number, correct: number) => {
    ResumeApi.save(studentId, resumeKey, { exclude: ex.slice(-60), roundCount: count, roundCorrect: correct },
      `${lesson.subject} · ${lesson.lesson_name}`).catch(() => {});
  };

  const doShake = () => {
    if (reduce) return;
    const n = Platform.OS !== 'web';
    Animated.sequence([10, -10, 6, -6, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: n }))).start();
  };

  const submit = async (value: string) => {
    if (!q || live.current.submitting || live.current.result) return;
    const text = value.trim();
    if (!text) return;
    stopVoice();
    setAutoCheckIn(null);
    setSubmitting(true);
    try {
      const ex = [...exclude, q.question_id];
      const res = await PracticeApi.answer(studentId, q.question_id, text, lesson.lesson_id, ex);
      const count = roundCount + 1;
      const correct = roundCorrect + (res.is_correct ? 1 : 0);
      setExclude(ex);
      setResult(res);
      setRoundCount(count);
      setRoundCorrect(correct);
      if (count >= ROUND_SIZE) ResumeApi.clear(studentId, resumeKey).catch(() => {});
      else saveProgress(ex, count, correct);
      if (res.is_correct) {
        playStarCollectSound();
      } else {
        playGentleRetrySound();
        doShake();
      }
      if (live.current.talkMode) {
        const tip = !res.is_correct && res.next_activity?.hint ? ` ${res.next_activity.hint}` : '';
        say(`${res.is_correct ? SAY[lang].correct : SAY[lang].wrong}${tip} ${SAY[lang].next}`, () => listen());
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    stopVoice();
    stopSpeech();
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
    setResumedFrom(null);
    loadNext(exclude);
  };

  const readQuestion = useCallback(() => {
    const current = live.current.activity?.question;
    if (!current) return;
    const opts = current.options?.length ? ` ${current.options.join(', ')}.` : '';
    say(`${current.question}${opts}`, () => { if (live.current.talkMode && !live.current.result) listen(); });
  }, [say, listen]);

  // Talk mode: read each new question aloud, then listen for the answer.
  useEffect(() => {
    if (!talkMode || loading || !q || result) return;
    const t = setTimeout(readQuestion, 350);
    return () => clearTimeout(t);
  }, [talkMode, loading, q?.question_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spoken text answers are checked automatically after a short countdown (cancel to edit).
  useEffect(() => {
    if (autoCheckIn === null) return;
    if (autoCheckIn <= 0) {
      setAutoCheckIn(null);
      submit(live.current.answer);
      return;
    }
    const t = setTimeout(() => setAutoCheckIn((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [autoCheckIn]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSpeech(text: string, isFinal: boolean) {
    const cur = live.current;
    const question = cur.activity?.question;
    const mcq = !!(question?.options && question.options.length);
    if (!isFinal) {
      if (!cur.result) {
        if (mcq) setHeard(text);
        else setAnswer(text);
      }
      return;
    }
    const cmd = parseVoiceCommand(text);
    if (cur.result) {
      if (cmd === 'next') next();
      else if (cmd === 'repeat') readQuestion();
      return;
    }
    if (cmd === 'repeat') return readQuestion();
    if (cmd === 'hint') {
      setShowHint(true);
      return say(question?.hint || '', () => cur.talkMode && listen());
    }
    if (cmd === 'next') return say(SAY[lang].answerFirst, () => cur.talkMode && listen());
    if (cmd === 'stop') return;
    if (!question) return;
    if (mcq) {
      setHeard(text);
      const opt = matchSpokenOption(text, question.options);
      if (opt) {
        setSelected(opt);
        if (cur.talkMode) say(SAY[lang].chose(opt), () => submit(opt));
        else submit(opt);
      } else if (cur.talkMode && missRef.current < 2) {
        missRef.current += 1;
        say(SAY[lang].notOption(text), () => listen());
      }
      return;
    }
    setAnswer(text);
    if (cur.talkMode) setAutoCheckIn(AUTO_CHECK_SECONDS);
  }

  const toggleTalkMode = () => {
    const nextMode = !talkMode;
    setTalkMode(nextMode);
    if (!nextMode) { stopVoice(); stopSpeech(); setAutoCheckIn(null); }
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
          <Row gap={8}>
            {voiceAvailable ? (
              <Pressable onPress={toggleTalkMode} accessibilityRole="switch" accessibilityState={{ checked: talkMode }}
                accessibilityLabel="Talk mode" style={[styles.talkToggle, talkMode && { backgroundColor: theme.color, borderColor: theme.color }]}>
                <MessageCircle size={14} color={talkMode ? '#FFFFFF' : theme.color} />
                <Text style={[styles.talkToggleText, { color: talkMode ? '#FFFFFF' : theme.color }]}>
                  {talkMode ? 'Talk mode on' : 'Talk mode'}
                </Text>
              </Pressable>
            ) : null}
            <Text style={Type.small}>⭐ {roundCorrect}</Text>
          </Row>
        </Row>
        <ProgressBar value={roundCount / ROUND_SIZE} color={theme.color} />
      </View>

      {resumedFrom ? (
        <Banner tone="info" text={`👋 Welcome back! Continuing your round from question ${resumedFrom} of ${ROUND_SIZE}.`} />
      ) : null}

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
                {lesson.subject === 'English' || talkMode ? (
                  <Button title="Read aloud" size="sm" variant="secondary" icon={<Volume2 size={14} color={Colors.primary} />}
                    onPress={readQuestion} />
                ) : null}
                {q.hint ? (
                  <Button title={showHint ? 'Hide hint' : 'Hint'} size="sm" variant="secondary" color="#B45309"
                    icon={<Lightbulb size={14} color="#B45309" />} onPress={() => setShowHint((s) => !s)} />
                ) : null}
              </Row>
              {showHint && q.hint ? <Banner tone="warning" text={`💡 ${q.hint}`} /> : null}

              {talkMode && !result ? (
                <View style={[styles.talkPanel, { borderColor: theme.light }]}>
                  <VoiceMicButton voice={voice} size={64} disabled={submitting} color={theme.color} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={Type.h3}>{isMcq ? 'Say your answer' : 'Say or type your answer'}</Text>
                    <Text style={Type.small}>
                      {lang === 'mr'
                        ? 'उत्तर सांगा. "पुन्हा" = प्रश्न पुन्हा ऐका · "सूचना" = मदत · "पुढे" = पुढचा प्रश्न'
                        : 'Say the answer. "Repeat" = hear it again · "Hint" = get help · "Next" = next question'}
                    </Text>
                    {heard && isMcq ? <Text style={[Type.small, { color: theme.color }]}>I heard: “{heard}”</Text> : null}
                    <VoiceStatus voice={voice} />
                  </View>
                </View>
              ) : null}

              {isMcq ? (
                <View style={styles.options}>
                  {q.options.map((opt: string, i: number) => {
                    const isSel = selected === opt;
                    const state = result && isSel ? (result.is_correct ? 'right' : 'wrong') : null;
                    return (
                      <View key={opt} style={styles.optionWrap}>
                        <PressableScale disabled={!!result || submitting} onPress={() => { setSelected(opt); submit(opt); }}
                          accessibilityLabel={`Answer ${opt}`}>
                          <View style={[styles.option, isSel ? { borderColor: theme.color, backgroundColor: theme.light } : null,
                            state === 'right' ? styles.optRight : state === 'wrong' ? styles.optWrong : null]}>
                            {talkMode ? <Text style={[styles.optionNumber, { color: theme.color }]}>{i + 1}</Text> : null}
                            <Text style={styles.optionText}>{opt}</Text>
                          </View>
                        </PressableScale>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <View style={styles.answerRow}>
                    <View style={{ flex: 1 }}>
                      <TextField label="Your answer" value={answer} onChangeText={(t) => { setAnswer(t); setAutoCheckIn(null); }} editable={!result}
                        placeholder={lesson.subject === 'Marathi' ? 'उत्तर लिहा किंवा बोला' : 'Type or say your answer'}
                        onSubmitEditing={() => submit(answer)} returnKeyType="done" />
                    </View>
                    {!talkMode ? <VoiceMicButton voice={voice} size={50} disabled={!!result || submitting} color={theme.color} /> : null}
                  </View>
                  {!result && !talkMode ? <VoiceStatus voice={voice} idleHint="Tap the mic to say your answer, then check or edit it." /> : null}
                  {autoCheckIn !== null && !result ? (
                    <Row style={styles.autoCheck}>
                      <Text style={[Type.small, { flex: 1 }]}>✅ Checking “{answer}” in {autoCheckIn}…</Text>
                      <Button title="Wait, let me edit" size="sm" variant="secondary" onPress={() => setAutoCheckIn(null)} />
                    </Row>
                  ) : null}
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
                  {talkMode ? (
                    <Row style={{ marginTop: 10 }} gap={10}>
                      <VoiceMicButton voice={voice} size={44} color={theme.color} />
                      <Text style={[Type.small, { flex: 1 }]}>{lang === 'mr' ? '"पुढे" म्हणा किंवा बटण दाबा.' : 'Say "next" or tap the button.'}</Text>
                    </Row>
                  ) : null}
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
  answerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  optionWrap: { width: '50%', padding: 6 },
  option: { minHeight: 60, borderRadius: Radius.md, borderWidth: 2, borderColor: Colors.cardBorder, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', padding: 12 },
  optionNumber: { position: 'absolute', top: 6, left: 10, fontSize: 12, fontWeight: '900' },
  optionText: { fontSize: 18, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  optRight: { borderColor: '#059669', backgroundColor: '#DCFCE7' },
  optWrong: { borderColor: '#BE123C', backgroundColor: '#FFE4E6' },
  feedback: { borderRadius: Radius.md, padding: 14, gap: 8 },
  summary: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  talkToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.cardBorder, backgroundColor: '#FFFFFF' },
  talkToggleText: { fontSize: 12, fontWeight: '800' },
  talkPanel: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: Radius.md, borderWidth: 2,
    backgroundColor: Colors.cardLight },
  autoCheck: { backgroundColor: '#ECFDF5', borderRadius: Radius.md, padding: 10, gap: 10 },
});
