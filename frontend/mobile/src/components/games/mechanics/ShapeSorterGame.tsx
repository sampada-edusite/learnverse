import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GameChallenge, GameOption } from '../types';
import { Colors } from '../../../theme/colors';

interface ShapeSorterGameProps {
  challenge: GameChallenge;
  onSelectOption: (option: GameOption) => void;
  selectedOptionId: string | null;
  isResolved: boolean;
  disabled?: boolean;
}

export const ShapeSorterGame: React.FC<ShapeSorterGameProps> = ({
  challenge,
  onSelectOption,
  selectedOptionId,
  isResolved,
  disabled = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.shapesBoard}>
        {/* Magic Portal Header */}
        <View style={styles.magicBanner}>
          <Text style={styles.magicBannerText}>
            {challenge.targetWord ? `✨ ${challenge.targetWord} ✨` : '🔮 MATCH PORTAL 🔮'}
          </Text>
        </View>

        <Text style={styles.promptText}>{challenge.promptText}</Text>

        {/* Central Object to Sort */}
        <View style={styles.objectCard}>
          <Text style={styles.objectEmoji}>{challenge.targetVisual || '🎁'}</Text>
          <Text style={styles.objectLabel}>{challenge.targetWord}</Text>
        </View>

        <Text style={styles.instructionsText}>
          Tap the matching portal below: 👇
        </Text>

        {/* Shape Portal Selection Cards */}
        <View style={styles.portalsGrid}>
          {challenge.options.map((option) => {
            const isSelected = selectedOptionId === option.id;

            let portalStyle = styles.portalDefault;
            if (isSelected) {
              portalStyle = option.isCorrect ? styles.portalCorrect : styles.portalIncorrect;
            }

            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => onSelectOption(option)}
                disabled={disabled}
                activeOpacity={0.85}
                style={[styles.portalBtn, portalStyle]}
              >
                <Text style={styles.portalEmoji}>{option.visual || '🔺'}</Text>
                <Text style={styles.portalTitle}>{option.text}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  shapesBoard: {
    width: '100%',
    backgroundColor: '#F3E5F5',
    borderRadius: 30,
    padding: 18,
    borderWidth: 3,
    borderColor: '#CE93D8',
    gap: 14,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    alignItems: 'center',
  },
  magicBanner: {
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#B39DDB',
  },
  magicBannerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4A148C',
    letterSpacing: 1,
  },
  promptText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#311B92',
    textAlign: 'center',
  },
  objectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingVertical: 20,
    paddingHorizontal: 30,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#BA68C8',
    gap: 8,
    minWidth: 200,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  objectEmoji: {
    fontSize: 54,
  },
  objectLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4A148C',
  },
  instructionsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6A1B9A',
  },
  portalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  portalBtn: {
    width: '46%',
    maxWidth: 160,
    minHeight: 95,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderWidth: 3,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  portalDefault: {
    backgroundColor: '#FFFFFF',
    borderColor: '#BA68C8',
  },
  portalCorrect: {
    backgroundColor: '#C8E6C9',
    borderColor: '#2E7D32',
  },
  portalIncorrect: {
    backgroundColor: '#FFCDD2',
    borderColor: '#C2185B',
  },
  portalEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  portalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#311B92',
    textAlign: 'center',
  },
});
