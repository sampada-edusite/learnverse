import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Colors } from '../theme/colors';
import { Sticker } from '../components/Sticker';
import { Sparkles, ArrowRight, Server } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface WelcomeScreenProps {
  onStart: () => void;
  onOpenSettings: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStart,
  onOpenSettings,
}) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Floating Background Vector Badges */}
      <Sticker name="pencil.png" size={54} style={styles.stickerTopLeft} />
      <Sticker name="rocket.png" size={54} style={styles.stickerTopRight} />
      <Sticker name="abc.png" size={54} style={styles.stickerBottomLeft} />
      <Sticker name="owl.png" size={54} style={styles.stickerBottomRight} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Top bar with API Server settings shortcut */}
        <View style={styles.topBar}>
          <View style={styles.badge}>
            <Sparkles size={16} color={Colors.primary} />
            <Text style={styles.badgeText}>Learning is fun</Text>
          </View>

          <TouchableOpacity onPress={onOpenSettings} style={styles.settingsBtn}>
            <Server size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Title Section */}
        <View style={styles.header}>
          <Text style={styles.subtitle}>Welcome to</Text>
          <Text style={styles.titlePrimary}>Samsukh</Text>
          <Text style={styles.titleSecondary}>Learnverse</Text>
        </View>

        {/* Hero Vector Illustration */}
        <View style={styles.heroContainer}>
          <Sticker name="hero-reading.png" size={width * 0.72} />
        </View>

        {/* Footer Call To Action */}
        <View style={styles.footer}>
          <Text style={styles.tagline}>Grow your skills every day</Text>

          <TouchableOpacity onPress={onStart} style={styles.startBtn} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>Let's Start</Text>
            <ArrowRight size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    alignItems: 'center',
    marginVertical: 12,
    zIndex: 10,
  },
  subtitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  titlePrimary: {
    fontSize: 46,
    fontWeight: '900',
    color: Colors.primary,
    lineHeight: 50,
    letterSpacing: -0.5,
  },
  titleSecondary: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 40,
  },
  heroContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
    zIndex: 10,
    marginTop: 8,
  },
  tagline: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  startBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 50,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  startBtnText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  stickerTopLeft: {
    position: 'absolute',
    top: 55,
    left: 15,
    zIndex: 5,
  },
  stickerTopRight: {
    position: 'absolute',
    top: 110,
    right: 15,
    zIndex: 5,
  },
  stickerBottomLeft: {
    position: 'absolute',
    bottom: 120,
    left: 15,
    zIndex: 5,
  },
  stickerBottomRight: {
    position: 'absolute',
    bottom: 125,
    right: 15,
    zIndex: 5,
  },
});

