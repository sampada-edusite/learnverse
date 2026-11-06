import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Heart, Lightbulb, Timer, X } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Radius, Shadow } from '../theme/tokens';
import {
  Banner, Button, Card, ErrorState, FadeIn, IconButton, LoadingState, PressableScale, ProgressBar, Row, Screen,
  Stars, Type,
} from '../ui';
import {
  GameAnswerResult, GameApi, GameChallenge, GameResult, GameSession, errorMessage,
} from '../config/platformApi';
import {
  playCelebrationFanfare, playGentleRetrySound, playStarCollectSound, playTapSound,
} from '../utils/soundEffects';
import { useReducedMotion } from '../hooks/useReducedMotion';

const OPTION_COLORS = ['#FF6B6B', '#4CC9F0', '#06D6A0', '#FF9234'];

interface Props {
  studentId: string;
  gameId: string;
  level: number;
  onExit: () => void;
}

/** Renders the visual part of a challenge for each display type the game engine produces. */
const ChallengeDisplay: React.FC<{ ch: GameChallenge; color: string }> = ({ ch, color }) => {
  const d = ch.display;
  if (d.type === 'emoji_grid') {
    return (
      <View style={styles.emojiGrid}>
        {Array.from({ length: d.count }, (_, i) => <Text key={i} style={styles.emojiItem}>{d.emoji}</Text>)}
      </View>
    );
  }
  if (d.type === 'emoji') return <Text style={styles.bigEmoji}>{d.emoji}</Text>;
  if (d.type === 'compare') {
    return (
      <Row style={{ justifyContent: 'center' }} gap={14}>
        <View style={[styles.compareBox, { borderColor: color }]}><Text style={styles.compareText}>{d.left}</Text></View>
        <View style={styles.compareMid}><Text style={styles.compareQ}>?</Text></View>
        <View style={[styles.compareBox, { borderColor: color }]}><Text style={styles.compareText}>{d.right}</Text></View>
      </Row>
    );
  }
  if (d.type === 'sequence') {
    return (
      <Row wrap gap={8} style={{ justifyContent: 'center' }}>
        {d.items.map((it: string, i: number) => (
          <View key={i} style={[styles.seqItem, it === '?' ? { backgroundColor: color, borderColor: color } : { borderColor: color }]}>
            <Text style={[styles.seqText, it === '?' ? { color: '#FFF' } : null]}>{it}</Text>
          </View>
        ))}
      </Row>
    );
  }
  return <Text style={styles.bigText}>{d.text}</Text>;
};

export const GamePlayScreen: React.FC<Props> = ({ studentId, gameId, level: startLevel, onExit }) => {
  const [level, setLevel] = useState(startLevel);
  const [session, setSession] = useState<GameSession | null>(null);
  const [phase, setPhase] = useState<'loading' | 'intro' | 'playing' | 'finishing' | 'result' | 'error'>('loading');
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<GameAnswerResult | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [wrongPicks, setWrongPicks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [points, setPoints] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const startedAt = useRef<number>(0);
  const finishing = useRef(false);
  const indexRef = useRef(0);
  useEffect(() => { indexRef.current = index; }, [index]);
  const bounce = useRef(new Animated.Value(1)).current;
  const reduce = useReducedMotion();
  const color = session?.game.color || Colors.primary;

  const start = useCallback(async (lvl: number) => {
    setPhase('loading');
    setError('');
    setIndex(0);
    indexRef.current = 0;
    setFeedback(null);
    setPicked(null);
    setWrongPicks([]);
    setPoints(0);
    setResult(null);
    finishing.current = false;
    try {
      const s = await GameApi.start(gameId, studentId, lvl);
      setSession(s);
      setLevel(lvl);
      setTimeLeft(s.time_limit_sec);
      setPhase('intro');
    } catch (e) {
      setError(errorMessage(e));
      setPhase('error');
    }
  }, [gameId, studentId]);

  useEffect(() => { start(startLevel); }, [start, startLevel]);

  const finish = useCallback(async () => {
    if (!session || finishing.current) return;
    finishing.current = true;
    setPhase('finishing');
    try {
      const r = await GameApi.finish(session.session_id, Math.round((Date.now() - startedAt.current) / 1000));
      setResult(r);
      setPhase('result');
      if (r.stars >= 2) playCelebrationFanfare();
    } catch (e) {
      setError(errorMessage(e));
      setPhase('error');
    }
  }, [session]);

  // countdown
  useEffect(() => {
    if (phase !== 'playing') return;
    if (timeLeft <= 0) { finish(); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, finish]);

  const pop = () => {
    if (reduce) return;
    const n = Platform.OS !== 'web';
    Animated.sequence([
      Animated.timing(bounce, { toValue: 1.08, duration: 120, useNativeDriver: n }),
      Animated.spring(bounce, { toValue: 1, useNativeDriver: n, bounciness: 12 }),
    ]).start();
  };

  const advance = (from: number = indexRef.current) => {
    if (!session || from !== indexRef.current) return;
    indexRef.current = from + 1;
    setFeedback(null);
    setPicked(null);
    setWrongPicks([]);
    setShowHint(false);
    if (from + 1 >= session.challenges.length) finish();
    else setIndex(from + 1);
  };

  const choose = async (opt: string) => {
    if (!session || busy || feedback?.resolved) return;
    playTapSound();
    setBusy(true);
    setPicked(opt);
    try {
      const at = index;
      const ch = session.challenges[at];
      const r = await GameApi.answer(session.session_id, ch.challenge_id, opt);
      setFeedback(r);
      if (r.correct) {
        setPoints((p) => p + r.points);
        playStarCollectSound();
        pop();
      } else {
        setWrongPicks((w) => [...w, opt]);
        playGentleRetrySound();
      }
      if (r.resolved) setTimeout(() => advance(at), r.correct ? 900 : 1700);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const exitBtn = <IconButton label="Exit game" onPress={onExit} icon={<X size={20} color={Colors.primary} />} />;

  if (phase === 'loading' || phase === 'finishing') {
    return <Screen header={<Row>{exitBtn}</Row>}><LoadingState label={phase === 'loading' ? 'Setting up the game…' : 'Counting your stars…'} /></Screen>;
  }
  if (phase === 'error' || !session) {
    return <Screen header={<Row>{exitBtn}</Row>}><ErrorState message={error} onRetry={() => start(level)} /></Screen>;
  }

  const g = session.game;

  if (phase === 'intro') {
    return (
      <Screen header={<Row>{exitBtn}</Row>}>
        <FadeIn>
          <Card style={styles.center} accent={g.color}>
            <Text style={{ fontSize: 72 }}>{g.icon}</Text>
            <Text style={Type.display}>{g.title}</Text>
            <Text style={Type.h3}>{g.title_local} · Level {level}</Text>
            <Text style={[Type.body, { textAlign: 'center', maxWidth: 440 }]}>{g.description}</Text>
            <Row wrap style={{ justifyContent: 'center' }}>
              <Info icon="🎯" text={`${session.challenges.length} challenges`} />
              <Info icon="⏱️" text={`${Math.round(session.time_limit_sec / 60 * 10) / 10} min`} />
              <Info icon="❤️" text={`${session.max_tries} tries each`} />
              <Info icon="⭐" text="2★ unlocks next level" />
            </Row>
            <Button title="Let's play!" size="lg" color={g.color} onPress={() => { startedAt.current = Date.now(); setPhase('playing'); }} />
          </Card>
        </FadeIn>
      </Screen>
    );
  }

  if (phase === 'result' && result) {
    return (
      <Screen header={<Row>{exitBtn}</Row>}>
        <FadeIn>
          <Card style={styles.center} accent={g.color}>
            <Text style={{ fontSize: 64 }}>{result.stars === 3 ? '🏆' : result.stars === 2 ? '🎉' : '💪'}</Text>
            <Text style={Type.display}>{result.stars === 3 ? 'Superstar!' : result.stars === 2 ? 'Well done!' : 'Good try!'}</Text>
            <Stars count={result.stars} size={40} />
            <Text style={Type.h2}>Score {result.score} / 100</Text>
            <Text style={Type.body}>{result.correct} of {result.total} solved · +{result.coins_earned} coins 🪙{result.new_best ? ' · New best!' : ''}</Text>
            {result.badges_earned.length ? (
              <Row wrap style={{ justifyContent: 'center' }}>
                {result.badges_earned.map((b) => (
                  <View key={b.badge_id} style={styles.badge}><Text style={{ fontSize: 28 }}>{b.icon}</Text><Text style={Type.small}>{b.title}</Text></View>
                ))}
              </Row>
            ) : null}
            {result.next_level && !result.next_level_unlocked ? (
              <Banner tone="info" text={`Get 2 stars to unlock level ${result.next_level}. You can do it!`} />
            ) : null}
            <Row wrap style={{ justifyContent: 'center' }}>
              <Button title="Play again" variant="secondary" color={g.color} onPress={() => start(level)} />
              {result.next_level && result.next_level_unlocked ? (
                <Button title={`Level ${result.next_level} →`} color={g.color} onPress={() => start(result.next_level!)} />
              ) : null}
              <Button title="All games" variant="ghost" onPress={onExit} />
            </Row>
          </Card>
        </FadeIn>
      </Screen>
    );
  }

  const ch = session.challenges[index];
  const triesUsed = feedback?.attempts ?? 0;
  const lowTime = timeLeft <= 15;

  return (
    <Screen header={
      <View style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          {exitBtn}
          <Text style={Type.h3}>{g.icon} {g.title} · L{level}</Text>
          <Row gap={6}>
            <Timer size={16} color={lowTime ? '#BE123C' : Colors.textMuted} />
            <Text style={[Type.h3, lowTime ? { color: '#BE123C' } : null]}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </Text>
          </Row>
        </Row>
        <ProgressBar value={index / session.challenges.length} color={g.color} />
      </View>
    }>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={Type.small}>Challenge {index + 1} of {session.challenges.length}</Text>
        <Row gap={4}>
          {Array.from({ length: session.max_tries }, (_, i) => (
            <Heart key={i} size={16} color="#E11D48" fill={i < session.max_tries - triesUsed || feedback?.correct ? '#E11D48' : 'transparent'} />
          ))}
          <Text style={[Type.small, { marginLeft: 8 }]}>⭐ {points}</Text>
        </Row>
      </Row>

      <FadeIn key={ch.challenge_id}>
        <Animated.View style={[styles.stage, Shadow, { transform: [{ scale: bounce }] }]}>
          <Text style={styles.prompt}>{ch.prompt_local || ch.prompt}</Text>
          {ch.prompt_local ? <Text style={Type.small}>{ch.prompt}</Text> : null}
          <View style={{ paddingVertical: 12 }}><ChallengeDisplay ch={ch} color={g.color} /></View>
        </Animated.View>
      </FadeIn>

      {feedback ? (
        <Banner tone={feedback.correct ? 'success' : feedback.resolved ? 'warning' : 'danger'}
          text={`${feedback.feedback}${feedback.resolved && !feedback.correct ? ` Answer: ${feedback.correct_answer}` : ''}${feedback.correct ? ` +${feedback.points}` : ''}`} />
      ) : null}

      <View style={styles.options}>
        {ch.options.map((opt, i) => {
          const isWrong = wrongPicks.includes(opt);
          const isRight = feedback?.resolved && feedback.correct_answer === opt;
          return (
            <View key={opt} style={styles.optWrap}>
              <PressableScale onPress={() => choose(opt)} disabled={busy || isWrong || !!feedback?.resolved} accessibilityLabel={`Answer ${opt}`}>
                <View style={[styles.opt, { backgroundColor: OPTION_COLORS[i % 4] },
                  isWrong ? styles.optWrong : null, isRight ? styles.optRight : null,
                  picked === opt && busy ? { opacity: 0.7 } : null]}>
                  <Text style={styles.optText}>{opt}</Text>
                </View>
              </PressableScale>
            </View>
          );
        })}
      </View>

      <Row style={{ justifyContent: 'center' }}>
        {ch.hint ? (
          <Button title={showHint ? ch.hint : 'Need a hint?'} variant="secondary" size="sm" color="#B45309"
            icon={<Lightbulb size={14} color="#B45309" />} onPress={() => setShowHint(true)} />
        ) : null}
        {feedback?.resolved ? <Button title="Next →" size="sm" color={g.color} onPress={() => advance(index)} /> : null}
      </Row>
    </Screen>
  );
};

const Info: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <View style={styles.info}><Text>{icon}</Text><Text style={Type.small}>{text}</Text></View>
);

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  info: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#FBF5F8', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  stage: { backgroundColor: '#FFFFFF', borderRadius: Radius.xl, padding: 20, alignItems: 'center', gap: 6, minHeight: 200, justifyContent: 'center' },
  prompt: { fontSize: 20, fontWeight: '900', color: Colors.primary, textAlign: 'center' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 360, gap: 6 },
  emojiItem: { fontSize: 38 },
  bigEmoji: { fontSize: 96 },
  bigText: { fontSize: 44, fontWeight: '900', color: Colors.text, textAlign: 'center' },
  compareBox: { minWidth: 96, paddingHorizontal: 16, height: 90, borderRadius: Radius.lg, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  compareText: { fontSize: 34, fontWeight: '900', color: Colors.text },
  compareMid: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  compareQ: { fontSize: 30, fontWeight: '900', color: Colors.textLight },
  seqItem: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  seqText: { fontSize: 22, fontWeight: '900', color: Colors.text },
  options: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  optWrap: { width: '50%', padding: 6 },
  opt: { minHeight: 72, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 3, borderColor: 'transparent' },
  optText: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  optWrong: { opacity: 0.35 },
  optRight: { borderColor: '#14532D' },
  badge: { alignItems: 'center', backgroundColor: '#FBF5F8', borderRadius: Radius.md, padding: 10, minWidth: 96 },
});

export default GamePlayScreen;
