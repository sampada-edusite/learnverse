import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GameChallenge, GameOption } from '../types';
import { Colors } from '../../../theme/colors';

interface NumberTrainGameProps {
  challenge: GameChallenge;
  onSelectOption: (option: GameOption) => void;
  selectedOptionId: string | null;
  isResolved: boolean;
  disabled?: boolean;
}

export const NumberTrainGame: React.FC<NumberTrainGameProps> = ({
  challenge,
  onSelectOption,
  selectedOptionId,
  isResolved,
  disabled = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.trainBoard}>
        {/* Safari Track Header */}
        <View style={styles.safariBanner}>
          <Text style={styles.safariBannerText}>
            {challenge.targetWord ? `🚂 ${challenge.targetWord} 🚂` : '🚂 JUNGLE TRAIN EXPRESS 🚂'}
          </Text>
        </View>

        {/* Prompt Header */}
        <Text style={styles.promptText}>{challenge.promptText}</Text>

        {/* Visual Animal Carriage Box */}
        <View style={styles.carriageDisplay}>
          <Text style={styles.visualObjectsText}>{challenge.targetVisual}</Text>
          {challenge.targetWord && (
            <Text style={styles.targetWordLabel}>{challenge.targetWord}</Text>
          )}
        </View>

        {/* Train Rails graphic */}
        <View style={styles.railwayTrack}>
          <View style={styles.railLine} />
          <View style={styles.sleepersRow}>
            {Array.from({ length: 12 }).map((_, i) => (
              <View key={i} style={styles.railSleeper} />
            ))}
          </View>
          <View style={styles.railLine} />
        </View>

        {/* Big Number Carriage Buttons */}
        <View style={styles.optionsRow}>
          {challenge.options.map((option) => {
            const isSelected = selectedOptionId === option.id;

            let buttonStyle = styles.optionDefault;
            if (isSelected) {
              buttonStyle = option.isCorrect ? styles.optionCorrect : styles.optionIncorrect;
            }

            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => onSelectOption(option)}
                disabled={disabled}
                activeOpacity={0.85}
                style={[styles.trainOptionBtn, buttonStyle]}
              >
                <View style={styles.carriageRoof} />
                <Text style={styles.optionEmoji}>{option.visual || '🔢'}</Text>
                <Text style={styles.optionNumberText}>{option.text}</Text>
                <View style={styles.carriageWheels}>
                  <View style={styles.wheel} />
                  <View style={styles.wheel} />
                </View>
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
  trainBoard: {
    width: '100%',
    backgroundColor: '#FFF8E1',
    borderRadius: 30,
    padding: 18,
    borderWidth: 3,
    borderColor: '#FFE082',
    gap: 14,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    alignItems: 'center',
  },
  safariBanner: {
    backgroundColor: '#FFECB3',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD54F',
  },
  safariBannerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E65100',
    letterSpacing: 1,
  },
  promptText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#3E2723',
    textAlign: 'center',
  },
  carriageDisplay: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#FFE082',
    minWidth: 260,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  visualObjectsText: {
    fontSize: 32,
    letterSpacing: 6,
    textAlign: 'center',
  },
  targetWordLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#D84315',
  },
  railwayTrack: {
    width: '100%',
    height: 18,
    justifyContent: 'center',
    marginVertical: 4,
  },
  railLine: {
    height: 2,
    backgroundColor: '#8D6E63',
    width: '100%',
  },
  sleepersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginVertical: -2,
  },
  railSleeper: {
    width: 6,
    height: 14,
    backgroundColor: '#5D4037',
    borderRadius: 2,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  trainOptionBtn: {
    flex: 1,
    maxWidth: 105,
    minHeight: 110,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderWidth: 3,
    position: 'relative',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  optionDefault: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFB300',
  },
  optionCorrect: {
    backgroundColor: '#C8E6C9',
    borderColor: '#2E7D32',
  },
  optionIncorrect: {
    backgroundColor: '#FFCDD2',
    borderColor: '#C2185B',
  },
  carriageRoof: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 6,
    backgroundColor: '#FFB300',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  optionEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  optionNumberText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#3E2723',
  },
  carriageWheels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
    position: 'absolute',
    bottom: -6,
  },
  wheel: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#424242',
    borderWidth: 2,
    borderColor: '#BDBDBD',
  },
});
