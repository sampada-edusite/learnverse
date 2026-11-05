import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../theme/colors';
import { Sticker } from '../components/Sticker';
import {
  getLessons,
  LessonItem,
  getUnlockedGamesForStudent,
  toggleGameUnlockForStudent,
} from '../config/api';
import { PracticeSession } from '../components/PracticeSession';
import {
  ArrowLeft,
  Tv,
  Sparkles,
  ArrowRight,
  BookOpen,
  Gamepad2,
  Lock,
  Unlock,
} from 'lucide-react-native';
import { GameContainer } from '../components/games/GameContainer';
import { GameSelectorModal } from '../components/games/GameSelectorModal';
import { GameUnlockCard } from '../components/games/GameUnlockCard';
import { getGameForLesson } from '../components/games/mockGameData';
import { GameDefinition } from '../components/games/types';

const LESSON_VIDEOS: Record<string, { embedUrl: string; title: string; description: string }> = {
  '1.1': {
    embedUrl: 'https://www.youtube-nocookie.com/embed/CFrHNjV5yIs',
    title: 'My First Day — Animated Rhyme & Story',
    description: 'Watch the fun animated story about going to school, meeting friends, and action words!',
  },
  '1.2': {
    embedUrl: 'https://www.youtube-nocookie.com/embed/tWe93wO0VmE',
    title: 'Clap Your Hands — Action Rhyme & Body Parts',
    description: 'Sing along, clap your hands, stamp your feet, and move your body to the music!',
  },
  '1.3': {
    embedUrl: 'https://www.youtube-nocookie.com/embed/yZ8xMwVVZ2U',
    title: 'I Know My Alphabet — Phonics & Letter Sounds',
    description: 'Learn capital and small letters A to Z with cheerful phonics sounds and pictures!',
  },
  '1.4': {
    embedUrl: 'https://www.youtube-nocookie.com/embed/UVHqQJATjKY',
    title: 'Let Us Read — Phonics & Word Families',
    description: 'Practice blending letters and reading simple 2-letter sight words together!',
  },
  '1.5': {
    embedUrl: 'https://www.youtube-nocookie.com/embed/9IoNM9nEpv4',
    title: 'Fun with Special Letters — Vowels Song (A, E, I, O, U)',
    description: 'Discover the 5 special vowel letters with a catchy musical rhyme!',
  },
  '1.6': {
    embedUrl: 'https://www.youtube-nocookie.com/embed/EiYEy0rJm50',
    title: 'The Rainbow — Colors & Sky Poem',
    description: 'Explore the 7 colors of the rainbow peeping out high in the sky!',
  },
};

interface LearnScreenProps {
  studentId?: string;
  studentName?: string;
  onBackToDashboard: () => void;
}

export const LearnScreen: React.FC<LearnScreenProps> = ({
  studentId = 'student_001',
  studentName = 'Learner',
  onBackToDashboard,
}) => {
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLesson, setSelectedLesson] = useState<LessonItem | null>(null);
  const [viewState, setViewState] = useState<'LIST' | 'VIDEO' | 'PRACTICE'>('LIST');
  const [gameModalVisible, setGameModalVisible] = useState<boolean>(false);
  const [selectorModalVisible, setSelectorModalVisible] = useState<boolean>(false);
  const [activeGame, setActiveGame] = useState<GameDefinition | null>(null);
  const [unlockedGameIds, setUnlockedGameIds] = useState<string[]>([]);
  const [lockedCardModalLesson, setLockedCardModalLesson] = useState<LessonItem | null>(null);

  const refreshUnlockedGames = async () => {
    try {
      const unlocked = await getUnlockedGamesForStudent(studentId);
      setUnlockedGameIds(unlocked);
    } catch (e) {
      console.error('Failed to load unlocked games:', e);
    }
  };

  useEffect(() => {
    refreshUnlockedGames();
  }, [studentId]);

  useEffect(() => {
    const fetchLessonsData = async () => {
      const data = await getLessons();
      setLessons(data);
      if (data.length > 0) {
        setSelectedLesson(data[0]);
      }
      setLoading(false);
    };
    fetchLessonsData();
  }, []);

  const currentVideo = selectedLesson
    ? LESSON_VIDEOS[selectedLesson.lesson_id] || LESSON_VIDEOS['1.1']
    : LESSON_VIDEOS['1.1'];

  const handleSelectLesson = (lesson: LessonItem) => {
    setSelectedLesson(lesson);
    setViewState('VIDEO');
  };

  const renderVideoPlayer = (url: string) => {
    if (Platform.OS === 'web') {
      return (
        <iframe
          src={url}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 20 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
    return (
      <WebView
        source={{ uri: url }}
        style={{ flex: 1 }}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Sticker name="owl.png" size={60} style={styles.stickerTopRight} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Navigation Header */}
        <View style={styles.topNav}>
          <TouchableOpacity onPress={onBackToDashboard} style={styles.backBtn}>
            <ArrowLeft size={22} color={Colors.primary} />
          </TouchableOpacity>

          <View style={styles.topNavRight}>
            {/* Live Testing Toggle Button for Unit 1 Game Lock/Unlock */}
            <TouchableOpacity
              onPress={async () => {
                await toggleGameUnlockForStudent(studentId, '1.1');
                await refreshUnlockedGames();
              }}
              style={[
                styles.testToggleBtn,
                unlockedGameIds.includes('1.1') ? styles.testToggleUnlocked : styles.testToggleLocked,
              ]}
              activeOpacity={0.85}
              accessibilityLabel="Test Toggle Unit 1 Lock State"
            >
              {unlockedGameIds.includes('1.1') ? (
                <Unlock size={13} color="#2E7D32" />
              ) : (
                <Lock size={13} color="#C62828" />
              )}
              <Text
                style={[
                  styles.testToggleText,
                  unlockedGameIds.includes('1.1')
                    ? styles.testToggleUnlockedText
                    : styles.testToggleLockedText,
                ]}
              >
                {unlockedGameIds.includes('1.1') ? 'Unit 1: Unlocked' : 'Unit 1: Locked'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectorModalVisible(true)}
              style={styles.gamesHubBtn}
              activeOpacity={0.85}
            >
              <Gamepad2 size={16} color="#FFFFFF" />
              <Text style={styles.gamesHubBtnText}>Games Hub 🎮</Text>
            </TouchableOpacity>

            <View style={styles.sqliteBadge}>
              <Sparkles size={14} color={Colors.primary} />
              <Text style={styles.sqliteBadgeText}>Expo Ready</Text>
            </View>
          </View>
        </View>

        {/* Header Title */}
        <View style={styles.header}>
          <Text style={styles.title}>English Lessons</Text>
          <Text style={styles.subtitle}>
            {lessons.length} Interactive Lessons with Working & Solving Videos
          </Text>
        </View>

        {/* State 1: Categorized Lessons List */}
        {viewState === 'LIST' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Select a Lesson</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{lessons.length} Lessons</Text>
              </View>
            </View>

            <Text style={styles.hintDescription}>
              Select a lesson to watch animated working videos and practice interactive question solving!
            </Text>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Fetching database lessons...</Text>
              </View>
            ) : (
              <View style={styles.lessonsList}>
                {lessons.map((lesson) => {
                  const isUnlocked = unlockedGameIds.includes(lesson.lesson_id);

                  return (
                    <TouchableOpacity
                      key={lesson.lesson_id}
                      onPress={() => handleSelectLesson(lesson)}
                      style={styles.lessonCard}
                      activeOpacity={0.85}
                    >
                      <View style={styles.lessonNumberBox}>
                        <Text style={styles.lessonNumberText}>{lesson.lesson_id}</Text>
                      </View>

                      <View style={styles.lessonInfo}>
                        <Text style={styles.lessonTag}>Lesson {lesson.lesson_id}</Text>
                        <Text style={styles.lessonName}>{lesson.lesson_name}</Text>
                        <Text style={styles.conceptsText} numberOfLines={1}>
                          {lesson.concepts.map((c) => c.name).join(' • ')}
                        </Text>
                      </View>

                      <View style={styles.lessonActionsRow}>
                        {isUnlocked ? (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              setActiveGame(getGameForLesson(lesson.lesson_id));
                              setGameModalVisible(true);
                            }}
                            style={styles.gamePillBtn}
                            activeOpacity={0.8}
                          >
                            <Gamepad2 size={13} color="#2B124C" />
                            <Text style={styles.gamePillText}>Game</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              setLockedCardModalLesson(lesson);
                            }}
                            style={styles.gameLockedPillBtn}
                            activeOpacity={0.8}
                          >
                            <Lock size={12} color="#718096" />
                            <Text style={styles.gameLockedPillText}>Locked</Text>
                          </TouchableOpacity>
                        )}

                        <View style={styles.watchBtn}>
                          <Tv size={14} color={Colors.primary} />
                          <Text style={styles.watchBtnText}>Watch</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* State 2: Animated YouTube Video Player */}
        {viewState === 'VIDEO' && selectedLesson && (
          <View style={styles.videoCard}>
            <View style={styles.videoHeaderNav}>
              <TouchableOpacity
                onPress={() => setViewState('LIST')}
                style={styles.textLinkBtn}
              >
                <ArrowLeft size={16} color={Colors.primary} />
                <Text style={styles.textLinkText}>Back to Lessons</Text>
              </TouchableOpacity>

              <View style={styles.videoBadge}>
                <Tv size={14} color={Colors.primary} />
                <Text style={styles.videoBadgeText}>Lesson {selectedLesson.lesson_id}</Text>
              </View>
            </View>

            <Text style={styles.videoTitle}>{currentVideo.title}</Text>
            <Text style={styles.videoDesc}>{currentVideo.description}</Text>

            {/* Embedded Native WebView YouTube Video Player */}
            <View style={styles.videoPlayerBox}>
              {renderVideoPlayer(currentVideo.embedUrl)}
            </View>

            <TouchableOpacity
              onPress={() => setViewState('PRACTICE')}
              style={styles.startPracticeBtn}
              activeOpacity={0.85}
            >
              <Sparkles size={20} color="#ffffff" />
              <Text style={styles.startPracticeText}>Ready for Questions? Start Practice!</Text>
              <ArrowRight size={20} color="#ffffff" />
            </TouchableOpacity>

            {unlockedGameIds.includes(selectedLesson.lesson_id) ? (
              <TouchableOpacity
                onPress={() => {
                  setActiveGame(getGameForLesson(selectedLesson.lesson_id));
                  setGameModalVisible(true);
                }}
                style={styles.playMiniGameBtn}
                activeOpacity={0.85}
              >
                <Gamepad2 size={20} color={Colors.primary} />
                <Text style={styles.playMiniGameText}>Play Concept Mini-Game 🎮</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setLockedCardModalLesson(selectedLesson);
                }}
                style={styles.lockedMiniGameBtn}
                activeOpacity={0.85}
              >
                <Lock size={18} color="#718096" />
                <Text style={styles.lockedMiniGameText}>
                  🔒 Concept Mini-Game (Complete Practice Test to Unlock)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* State 3: Interactive Adaptive Practice Session */}
        {viewState === 'PRACTICE' && selectedLesson && (
          <View style={styles.practiceContainer}>
            <View style={styles.videoHeaderNav}>
              <TouchableOpacity
                onPress={() => {
                  refreshUnlockedGames();
                  setViewState('VIDEO');
                }}
                style={styles.textLinkBtn}
              >
                <ArrowLeft size={16} color={Colors.primary} />
                <Text style={styles.textLinkText}>Back to Video</Text>
              </TouchableOpacity>

              <Text style={styles.practiceLessonTag}>
                Lesson {selectedLesson.lesson_id}: {selectedLesson.lesson_name}
              </Text>
            </View>

            <PracticeSession
              studentId={studentId}
              studentName={studentName}
              lessonId={selectedLesson.lesson_id}
              onClose={() => {
                refreshUnlockedGames();
                setViewState('LIST');
              }}
              onGameUnlocked={() => {
                refreshUnlockedGames();
              }}
              onOpenGame={(g) => {
                setActiveGame(g);
                setGameModalVisible(true);
              }}
            />
          </View>
        )}
      </ScrollView>

      {/* Active Game Modal */}
      {activeGame && (
        <GameContainer
          game={activeGame}
          visible={gameModalVisible}
          studentId={studentId}
          onClose={() => {
            setGameModalVisible(false);
            refreshUnlockedGames();
          }}
        />
      )}

      {/* Mini-Games Hub Selector Modal */}
      <GameSelectorModal
        visible={selectorModalVisible}
        currentLessonId={selectedLesson?.lesson_id || '1.1'}
        unlockedGameIds={unlockedGameIds}
        onClose={() => setSelectorModalVisible(false)}
        onSelectGame={(g) => {
          if (unlockedGameIds.includes(g.lessonId)) {
            setActiveGame(g);
            setGameModalVisible(true);
          } else {
            const foundLesson = lessons.find((l) => l.lesson_id === g.lessonId);
            if (foundLesson) {
              setLockedCardModalLesson(foundLesson);
            }
          }
        }}
      />

      {/* Locked Game Milestone Preview Modal */}
      {lockedCardModalLesson && (
        <Modal
          visible={!!lockedCardModalLesson}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setLockedCardModalLesson(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCardWrap}>
              <GameUnlockCard
                lessonId={lockedCardModalLesson.lesson_id}
                lessonTitle={lockedCardModalLesson.lesson_name}
                practiceScore={0}
                isUnlocked={false}
                game={getGameForLesson(lockedCardModalLesson.lesson_id)}
                onPlayGame={() => {}}
                onStartPractice={() => {
                  const targetLesson = lockedCardModalLesson;
                  setLockedCardModalLesson(null);
                  setSelectedLesson(targetLesson);
                  setViewState('PRACTICE');
                }}
                onClose={() => setLockedCardModalLesson(null)}
              />
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 16,
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sqliteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
  },
  sqliteBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  header: {
    gap: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.primary,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  countBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  hintDescription: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  lessonsList: {
    gap: 12,
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 14,
    gap: 12,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lessonNumberBox: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonNumberText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
  },
  lessonInfo: {
    flex: 1,
    gap: 2,
  },
  lessonTag: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  lessonName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  conceptsText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 50,
  },
  watchBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  videoCard: {
    backgroundColor: Colors.card,
    borderRadius: 28,
    padding: 18,
    gap: 14,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  videoHeaderNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  textLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  videoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
  },
  videoBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  videoTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
  },
  videoDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  videoPlayerBox: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  startPracticeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 50,
    marginTop: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startPracticeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  practiceContainer: {
    gap: 12,
  },
  practiceLessonTag: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  stickerTopRight: {
    position: 'absolute',
    top: 10,
    right: 15,
    opacity: 0.8,
  },
  topNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gamesHubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 50,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  gamesHubBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  lessonActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gamePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFE082',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#FFD54F',
  },
  gamePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2B124C',
  },
  playMiniGameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 50,
    marginTop: 4,
  },
  playMiniGameText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
  testToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 50,
    borderWidth: 1.5,
  },
  testToggleUnlocked: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  testToggleLocked: {
    backgroundColor: '#FFEBEE',
    borderColor: '#EF5350',
  },
  testToggleText: {
    fontSize: 11,
    fontWeight: '800',
  },
  testToggleUnlockedText: {
    color: '#2E7D32',
  },
  testToggleLockedText: {
    color: '#C62828',
  },
  gameLockedPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  gameLockedPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#718096',
  },
  lockedMiniGameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F8F9FA',
    borderWidth: 1.5,
    borderColor: '#CBD5E0',
    borderStyle: 'dashed',
    paddingVertical: 14,
    borderRadius: 50,
    marginTop: 4,
  },
  lockedMiniGameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#718096',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCardWrap: {
    width: '100%',
    maxWidth: 500,
  },
});

