import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import { Radius } from '../theme/tokens';
import {
  AppBar, Card, ErrorState, FadeIn, Grid, LoadingState, Pill, PressableScale, Row, Screen, Stars, Tabs, Type,
} from '../ui';
import { Badge, GameApi, GameInfo, errorMessage } from '../config/platformApi';

interface Props {
  studentId: string;
  initialSubject?: string;
  onBack: () => void;
  onPlay: (gameId: string, level: number) => void;
}

export const GamesHubScreen: React.FC<Props> = ({ studentId, initialSubject, onBack, onPlay }) => {
  const [tab, setTab] = useState(initialSubject || 'all');
  const [games, setGames] = useState<GameInfo[] | null>(null);
  const [coins, setCoins] = useState(0);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await GameApi.list(studentId);
      setGames(data.games);
      setCoins(data.coins);
      setBadges(data.badges);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const shown = (games || []).filter((g) => tab === 'all' || g.subject === tab);
  const totalStars = (games || []).reduce((n, g) => n + (g.total_stars || 0), 0);

  return (
    <Screen header={<AppBar title="🎮 Play & Learn" subtitle="Win 2★ on a level to unlock the next one" onBack={onBack} />}
      onRefresh={load} refreshing={false}>
      <Row wrap gap={8}>
        <Pill label={`${coins} coins`} icon={<Text>🪙</Text>} color="#92400E" light="#FEF3C7" />
        <Pill label={`${totalStars} stars`} icon={<Text>⭐</Text>} color="#6D28D9" light="#EDE9FE" />
        <Pill label={`${badges.length} badges`} icon={<Text>🏅</Text>} color="#047857" light="#DCFCE7" />
      </Row>
      <Tabs value={tab} onChange={setTab}
        tabs={[{ key: 'all', label: 'All games' }, { key: 'Mathematics', label: '🔢 Maths' }, { key: 'Marathi', label: '🪔 मराठी' }]} />

      {!games && !error ? <LoadingState label="Loading games…" /> : error ? <ErrorState message={error} onRetry={load} /> : (
        <Grid>
          {shown.map((g, i) => (
            <FadeIn key={g.game_id} delay={Math.min(i, 8) * 40}>
              <Card style={{ gap: 12 }} accent={g.color}>
                <Row>
                  <View style={[styles.icon, { backgroundColor: g.color + '22' }]}><Text style={{ fontSize: 30 }}>{g.icon}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={Type.h3} numberOfLines={1}>{g.title}</Text>
                    <Text style={Type.small} numberOfLines={1}>{g.title_local} · Std {g.student_class}</Text>
                  </View>
                  <Text style={[Type.small, { color: g.color }]}>{g.total_stars || 0}/15★</Text>
                </Row>
                <Text style={Type.body} numberOfLines={2}>{g.description}</Text>
                <Text style={Type.tiny}>SKILL · {g.skill.toUpperCase()}</Text>
                <View style={styles.levels}>
                  {(g.levels || []).map((l) => (
                    <PressableScale key={l.level} disabled={!l.unlocked} onPress={() => onPlay(g.game_id, l.level)}
                      accessibilityLabel={`${g.title} level ${l.level}${l.unlocked ? '' : ' locked'}`}>
                      <View style={[styles.level, l.unlocked ? { borderColor: g.color, backgroundColor: '#FFF' } : styles.levelLocked]}>
                        {l.unlocked ? (
                          <>
                            <Text style={[styles.levelNum, { color: g.color }]}>{l.level}</Text>
                            <Stars count={l.stars} size={10} />
                          </>
                        ) : <Lock size={16} color="#94A3B8" />}
                      </View>
                    </PressableScale>
                  ))}
                </View>
              </Card>
            </FadeIn>
          ))}
        </Grid>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  icon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  levels: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  level: { width: 48, height: 52, borderRadius: Radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  levelLocked: { borderColor: '#E2E8F0', backgroundColor: '#F1F5F9' },
  levelNum: { fontSize: 18, fontWeight: '900' },
});

export default GamesHubScreen;
