import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Lightbulb, X, Sparkles } from 'lucide-react-native';
import { Colors } from '../../theme/colors';

interface GameHintModalProps {
  visible: boolean;
  hintText: string;
  mascotEmoji?: string;
  mascotName?: string;
  onClose: () => void;
  accentColor?: string;
}

export const GameHintModal: React.FC<GameHintModalProps> = ({
  visible,
  hintText,
  mascotEmoji = '🦉',
  mascotName = 'Wise Buddy',
  onClose,
  accentColor = Colors.primary,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {/* Mascot Bubble Header */}
              <View style={styles.mascotBadge}>
                <Text style={styles.mascotEmojiText}>{mascotEmoji}</Text>
              </View>

              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <X size={20} color={Colors.textMuted} />
              </TouchableOpacity>

              <View style={styles.content}>
                <View style={styles.titleRow}>
                  <Lightbulb size={22} color="#F59E0B" />
                  <Text style={styles.titleText}>{mascotName}'s Helpful Clue!</Text>
                </View>

                {/* Speech Bubble Card */}
                <View style={styles.speechBubble}>
                  <Text style={styles.hintBodyText}>"{hintText}"</Text>
                  <Sparkles size={18} color="#F59E0B" style={styles.sparkleIcon} />
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.gotItBtn, { backgroundColor: accentColor }]}
                  activeOpacity={0.85}
                >
                  <Text style={styles.gotItBtnText}>Got it, Let's Play! 👍</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 10,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(25, 0, 25, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    paddingTop: 36,
    position: 'relative',
    alignItems: 'center',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#FBE4D8',
  },
  mascotBadge: {
    position: 'absolute',
    top: -30,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  mascotEmojiText: {
    fontSize: 34,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  speechBubble: {
    width: '100%',
    backgroundColor: '#FFFDE7',
    borderRadius: 20,
    padding: 18,
    borderWidth: 2,
    borderColor: '#FFE082',
    position: 'relative',
  },
  hintBodyText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: '#3E2723',
    textAlign: 'center',
  },
  sparkleIcon: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    opacity: 0.8,
  },
  gotItBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  gotItBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
