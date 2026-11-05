import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Modal,
} from 'react-native';
import { Colors } from '../theme/colors';
import { Sticker } from '../components/Sticker';
import {
  getDashboardSummary,
  DashboardSummary,
  WeakConcept,
} from '../config/api';
import {
  Bell,
  Sparkles,
  Award,
  AlertCircle,
  BookOpen,
  ArrowRight,
  Lock,
  Flame,
  CheckCircle2,
  Server,
  X,
  LogOut,
  User,
  TrendingUp,
} from 'lucide-react-native';

interface StudentProfile {
  name: string;
  avatar: string;
  studentClass: string;
  studentId: string;
}

interface DashboardScreenProps {
  student: StudentProfile;
  onOpenEnglish: () => void;
  onOpenSettings: () => void;
  onLogout?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  student,
  onOpenEnglish,
  onOpenSettings,
  onLogout,
}) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showAccountDrawer, setShowAccountDrawer] = useState<boolean>(false);

  const fetchSummary = async () => {
    const data = await getDashboardSummary(student.studentId || 'student_001');
    setSummary(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchSummary();
  }, [student.studentId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSummary();
  };

  const overallAccuracy = summary?.overall_accuracy ?? 0.0;
  const totalAttempts = summary?.total_attempts ?? 0;
  const weakConcepts: WeakConcept[] = summary?.weak_concepts ?? [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Sticker name="abc.png" size={56} style={styles.stickerTopRight} />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={onOpenSettings} style={styles.iconBtn}>
              <Server size={18} color={Colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn}>
              <Bell size={20} color={Colors.primary} />
              <View style={styles.bellBadge} />
            </TouchableOpacity>

            {/* Click Avatar to open Account Drawer Side Panel */}
            <TouchableOpacity
              onPress={() => setShowAccountDrawer(true)}
              style={styles.avatarCircle}
              activeOpacity={0.8}
            >
              <Text style={styles.avatarInitial}>
                {student.avatar ? student.avatar.charAt(0).toUpperCase() : 'S'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting Card */}
        <View style={styles.greetingCard}>
          <View style={styles.greetingContent}>
            <Text style={styles.greetingSubtitle}>Welcome back 👋</Text>
            <Text style={styles.greetingTitle}>{student.name || 'Learner'}!</Text>
            <View style={styles.tagRow}>
              <TouchableOpacity
                onPress={() => setShowAccountDrawer(true)}
                style={styles.avatarTag}
              >
                <Text style={styles.avatarTagText}>✨ {student.avatar || 'Star Learner'}</Text>
              </TouchableOpacity>
              <View style={styles.classTag}>
                <Text style={styles.classTagText}>Class {student.studentClass || '1st'}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onOpenEnglish} style={styles.continueBtn} activeOpacity={0.85}>
              <Text style={styles.continueBtnText}>Continue English</Text>
              <ArrowRight size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <Sticker name="owl.png" size={90} style={styles.greetingOwl} />
        </View>

        {/* Class Subjects Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subjects</Text>

          {/* Subject 1: English (Active) */}
          <TouchableOpacity onPress={onOpenEnglish} style={styles.subjectCard} activeOpacity={0.9}>
            <View style={[styles.subjectIconBox, { backgroundColor: Colors.primaryLight }]}>
              <BookOpen size={26} color={Colors.primary} />
            </View>

            <View style={styles.subjectInfo}>
              <Text style={styles.subjectTitle}>English</Text>
              <Text style={styles.subjectSubtitle}>
                {summary?.total_lessons ?? 6} Unit 1 Lessons & YouTube Videos
              </Text>
            </View>

            <View style={styles.subjectActionBtn}>
              <Text style={styles.subjectActionText}>Start</Text>
              <ArrowRight size={16} color="#ffffff" />
            </View>
          </TouchableOpacity>

          {/* Subject 2: Mathematics (Locked) */}
          <View style={[styles.subjectCard, styles.subjectCardLocked]}>
            <View style={[styles.subjectIconBox, { backgroundColor: Colors.border }]}>
              <Lock size={22} color={Colors.textMuted} />
            </View>

            <View style={styles.subjectInfo}>
              <Text style={[styles.subjectTitle, { color: Colors.textMuted }]}>Mathematics</Text>
              <Text style={styles.subjectSubtitle}>Coming Soon in Unit 2</Text>
            </View>

            <View style={styles.subjectBadgeLocked}>
              <Text style={styles.subjectBadgeText}>Locked</Text>
            </View>
          </View>
        </View>

        {/* Challenge Banner */}
        <View style={styles.challengeCard}>
          <View style={styles.challengeHeader}>
            <Sparkles size={20} color={Colors.warningText} />
            <Text style={styles.challengeTitle}>Daily Practice Goal</Text>
          </View>
          <Text style={styles.challengeDescription}>
            Complete 1 practice session today to keep your daily streak alive!
          </Text>
          <TouchableOpacity onPress={onOpenEnglish} style={styles.challengeFooter}>
            <Text style={styles.challengeAction}>Take Today's Practice →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Account Drawer Side Panel Modal */}
      <Modal
        visible={showAccountDrawer}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAccountDrawer(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.drawerContainer}>
            {/* Drawer Header */}
            <View style={styles.drawerHeader}>
              <View style={styles.drawerHeaderTitleRow}>
                <User size={22} color={Colors.primary} />
                <Text style={styles.drawerTitle}>Account & Progress</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAccountDrawer(false)}
                style={styles.closeBtn}
              >
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerContent}>
              {/* Profile Card */}
              <View style={styles.profileCard}>
                <View style={styles.drawerAvatarLarge}>
                  <Text style={styles.drawerAvatarText}>
                    {student.avatar ? student.avatar.charAt(0).toUpperCase() : 'S'}
                  </Text>
                </View>
                <View style={styles.profileMeta}>
                  <Text style={styles.profileName}>{student.name || 'Learner'}</Text>
                  <Text style={styles.profileNickName}>Nick Name: {student.avatar || 'Star Learner'}</Text>
                  <View style={styles.drawerTagRow}>
                    <View style={styles.drawerClassBadge}>
                      <Text style={styles.drawerClassBadgeText}>Class {student.studentClass || '1st'}</Text>
                    </View>
                    <Text style={styles.studentIdText}>ID: {student.studentId || 'student_001'}</Text>
                  </View>
                </View>
              </View>

              {/* 1. Daily Streak Section */}
              <View style={styles.streakCard}>
                <View style={styles.streakHeader}>
                  <Flame size={24} color="#ff6b6b" />
                  <View>
                    <Text style={styles.streakTitle}>5 Day Streak! 🔥</Text>
                    <Text style={styles.streakSubtitle}>Active Learning Streak</Text>
                  </View>
                </View>

                <View style={styles.daysRow}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.dayCircle,
                        idx < 5 ? styles.dayCircleActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          idx < 5 ? styles.dayTextActive : null,
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* 2. Mastery Update Section */}
              <View style={styles.masterySection}>
                <View style={styles.sectionHeaderRow}>
                  <TrendingUp size={18} color={Colors.primary} />
                  <Text style={styles.drawerSectionTitle}>Mastery Update</Text>
                </View>

                <View style={styles.masteryGrid}>
                  <View style={styles.masteryBox}>
                    <Award size={20} color={Colors.primary} />
                    <Text style={styles.masteryScore}>{overallAccuracy}%</Text>
                    <Text style={styles.masteryLabel}>Overall Accuracy</Text>
                  </View>

                  <View style={styles.masteryBox}>
                    <Sparkles size={20} color={Colors.warning} />
                    <Text style={styles.masteryScore}>{totalAttempts}</Text>
                    <Text style={styles.masteryLabel}>Questions Solved</Text>
                  </View>
                </View>

                {/* Weak Concepts Breakdown */}
                {weakConcepts.length > 0 && (
                  <View style={styles.drawerWeakBox}>
                    <View style={styles.drawerWeakHeader}>
                      <AlertCircle size={16} color={Colors.warningText} />
                      <Text style={styles.drawerWeakTitle}>Weak Concepts to Review</Text>
                    </View>
                    {weakConcepts.map((item) => (
                      <View key={item.concept_id} style={styles.drawerWeakItem}>
                        <Text style={styles.drawerWeakName} numberOfLines={1}>
                          {item.concept_id}: {item.concept_name}
                        </Text>
                        <Text style={styles.drawerWeakBadgeText}>
                          {item.accuracy}% ({item.status})
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* 3. Log Out Button */}
              <TouchableOpacity
                onPress={() => {
                  setShowAccountDrawer(false);
                  if (onLogout) {
                    onLogout();
                  } else {
                    onOpenSettings();
                  }
                }}
                style={styles.logoutBtn}
                activeOpacity={0.85}
              >
                <LogOut size={18} color="#ffffff" />
                <Text style={styles.logoutBtnText}>Log Out Account</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  bellBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  greetingCard: {
    backgroundColor: Colors.card,
    borderRadius: 28,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  greetingContent: {
    flex: 1,
    gap: 4,
  },
  greetingSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.primary,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  avatarTag: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  avatarTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  classTag: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  classTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  continueBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  continueBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  greetingOwl: {
    marginRight: -10,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
  },
  subjectCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  subjectCardLocked: {
    opacity: 0.75,
  },
  subjectIconBox: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectInfo: {
    flex: 1,
  },
  subjectTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  subjectSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 2,
  },
  subjectActionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subjectActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  subjectBadgeLocked: {
    backgroundColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subjectBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  challengeCard: {
    backgroundColor: Colors.warningLight,
    borderRadius: 24,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.softDustyRose,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.warningText,
  },
  challengeDescription: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 18,
  },
  challengeFooter: {
    marginTop: 4,
  },
  challengeAction: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  stickerTopRight: {
    position: 'absolute',
    top: 10,
    right: 120,
    opacity: 0.6,
  },

  /* Modal Account Drawer Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(25, 0, 25, 0.65)',
    justifyContent: 'flex-end',
  },
  drawerContainer: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '85%',
    padding: 24,
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  drawerHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.primary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerContent: {
    gap: 18,
    paddingBottom: 20,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.secondary,
    padding: 16,
    borderRadius: 24,
  },
  drawerAvatarLarge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerAvatarText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
  },
  profileMeta: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  profileNickName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.softDustyRose,
  },
  drawerTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  drawerClassBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  drawerClassBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  studentIdText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.softDustyRose,
  },

  /* Streak Section */
  streakCard: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.primary,
  },
  streakSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: Colors.primary,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  dayTextActive: {
    color: '#ffffff',
  },

  /* Mastery Section */
  masterySection: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  drawerSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  masteryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  masteryBox: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  masteryScore: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.primary,
  },
  masteryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  drawerWeakBox: {
    backgroundColor: Colors.warningLight,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  drawerWeakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  drawerWeakTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.warningText,
  },
  drawerWeakItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 8,
    borderRadius: 10,
  },
  drawerWeakName: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  drawerWeakBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.warningText,
  },

  /* Logout Button */
  logoutBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 50,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
});
