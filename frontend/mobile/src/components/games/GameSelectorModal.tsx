import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import {
  Gamepad2,
  X,
  Sparkles,
  ArrowRight,
  BookOpen,
  Calculator,
  Compass,
  Trees,
  Lock,
} from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { GameDefinition, GameSubject } from './types';
import { MOCK_GAME_DATABASE } from './mockGameData';

interface GameSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectGame: (game: GameDefinition) => void;
  currentLessonId?: string;
  unlockedGameIds?: string[];
}

export const GameSelectorModal: React.FC<GameSelectorModalProps> = ({
  visible,
  onClose,
  onSelectGame,
  currentLessonId = '1.1',
  unlockedGameIds,
}) => {
  const gamesList = Object.values(MOCK_GAME_DATABASE);

  const getSubjectIcon = (subject: GameSubject) => {
    switch (subject) {
      case 'LANGUAGE':
        return <BookOpen size={16} color="#2B124C" />;
      case 'MATHEMATICS':
        return <Calculator size={16} color="#B71C1C" />;
      case 'SHAPES':
        return <Compass size={16} color="#4A148C" />;
      case 'EVS':
        return <Trees size={16} color="#1B5E20" />;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
            <X size={22} color={Colors.primary} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Gamepad2 size={20} color={Colors.primary} />
            <Text style={styles.headerTitle}>Concept Mini-Games Hub</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
          <View style={styles.bannerNotice}>
            <Sparkles size={18} color="#2B124C" />
            <Text style={styles.bannerNoticeText}>
              Every lesson unlocks a unique concept mini-game! Explore all 4 game mechanics below:
            </Text>
          </View>

          <View style={styles.cardsGrid}>
            {gamesList.map((game) => {
              const isCurrent = game.lessonId === currentLessonId;
              const isUnlocked = unlockedGameIds ? unlockedGameIds.includes(game.lessonId) : true;

              return (
                <TouchableOpacity
                  key={game.id}
                  onPress={() => {
                    onSelectGame(game);
                    onClose();
                  }}
                  style={[
                    styles.gameSelectCard,
                    { borderColor: isCurrent ? game.theme.primary : '#E0E0E0' },
                    !isUnlocked && { opacity: 0.9, backgroundColor: '#FAF9F6' },
                  ]}
                  activeOpacity={0.85}
                >
                  {isCurrent && (
                    <View style={[styles.activeLessonBadge, { backgroundColor: game.theme.primary }]}>
                      <Text style={styles.activeLessonBadgeText}>Current Lesson Game</Text>
                    </View>
                  )}

                  <View style={styles.cardHeader}>
                    <View style={[styles.subjectTag, { backgroundColor: game.theme.lightBg }]}>
                      {getSubjectIcon(game.subject)}
                      <Text style={[styles.subjectTagText, { color: game.theme.primary }]}>
                        {game.subject}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {!isUnlocked && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFEBEE', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12 }}>
                          <Lock size={11} color="#C62828" />
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#C62828' }}>Locked</Text>
                        </View>
                      )}
                      <Text style={styles.lessonPill}>Lesson {game.lessonId}</Text>
                    </View>
                  </View>

                  <View style={styles.mascotInfoRow}>
                    <View style={[styles.mascotCircle, { backgroundColor: game.theme.lightBg }]}>
                      <Text style={styles.mascotEmoji}>{game.mascotEmoji}</Text>
                    </View>

                    <View style={styles.gameInfo}>
                      <Text style={styles.gameTitleText}>{game.title}</Text>
                      <Text style={styles.conceptText} numberOfLines={2}>
                        {game.conceptName}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.subtitleText} numberOfLines={2}>
                    {game.subtitle}
                  </Text>

                  {isUnlocked ? (
                    <View style={[styles.playNowRow, { backgroundColor: game.theme.background }]}>
                      <Text style={[styles.playNowText, { color: game.theme.primary }]}>
                        Play {game.mascotName} ➔
                      </Text>
                      <ArrowRight size={16} color={game.theme.primary} />
                    </View>
                  ) : (
                    <View style={[styles.playNowRow, { backgroundColor: '#F0F0F0', borderColor: '#E0E0E0', borderWidth: 1 }]}>
                      <Lock size={14} color="#718096" />
                      <Text style={[styles.playNowText, { color: '#718096' }]}>
                        Complete Practice to Unlock
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primary,
  },
  scrollList: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  bannerNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#DFB6B2',
  },
  bannerNoticeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  cardsGrid: {
    gap: 14,
  },
  gameSelectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 2,
    gap: 12,
    position: 'relative',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  activeLessonBadge: {
    position: 'absolute',
    top: -10,
    right: 18,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  activeLessonBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subjectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  subjectTagText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  lessonPill: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  mascotInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mascotCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotEmoji: {
    fontSize: 30,
  },
  gameInfo: {
    flex: 1,
    gap: 2,
  },
  gameTitleText: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.text,
  },
  conceptText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  subtitleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#455A64',
    lineHeight: 18,
  },
  playNowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  playNowText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
