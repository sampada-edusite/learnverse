import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GameChallenge, GameOption } from '../types';
import { Colors } from '../../../theme/colors';

interface CategoryBasketsGameProps {
  challenge: GameChallenge;
  onSelectOption: (option: GameOption) => void;
  selectedOptionId: string | null;
  isResolved: boolean;
  disabled?: boolean;
}

export const CategoryBasketsGame: React.FC<CategoryBasketsGameProps> = ({
  challenge,
  onSelectOption,
  selectedOptionId,
  isResolved,
  disabled = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.natureBoard}>
        {/* Banner */}
        <View style={styles.natureBanner}>
          <Text style={styles.natureBannerText}>
            {challenge.targetWord ? `🎯 ${challenge.targetWord}` : '🌟 CATEGORY SORT 🧺'}
          </Text>
        </View>

        <Text style={styles.promptText}>{challenge.promptText}</Text>

        {/* Item to Sort */}
        <View style={styles.itemDisplayCard}>
          <Text style={styles.itemEmoji}>{challenge.targetVisual || '🌱'}</Text>
          <Text style={styles.itemTitle}>{challenge.targetWord}</Text>
        </View>

        <Text style={styles.subtextInstruction}>
          Choose the correct category card below: 👇
        </Text>

        {/* Big Category Basket Buttons */}
        <View style={styles.basketsRow}>
          {challenge.options.map((option) => {
            const isSelected = selectedOptionId === option.id;

            let basketStyle = styles.basketDefault;
            if (isSelected) {
              basketStyle = option.isCorrect ? styles.basketCorrect : styles.basketIncorrect;
            }

            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => onSelectOption(option)}
                disabled={disabled}
                activeOpacity={0.85}
                style={[styles.basketBtn, basketStyle]}
              >
                <Text style={styles.basketEmoji}>{option.visual || '🧺'}</Text>
                <Text style={styles.basketTitle}>{option.text}</Text>
                <View style={styles.basketPattern} />
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
  natureBoard: {
    width: '100%',
    backgroundColor: '#E8F5E9',
    borderRadius: 30,
    padding: 18,
    borderWidth: 3,
    borderColor: '#A5D6A7',
    gap: 14,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    alignItems: 'center',
  },
  natureBanner: {
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#81C784',
  },
  natureBannerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1B5E20',
    letterSpacing: 1,
  },
  promptText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1B5E20',
    textAlign: 'center',
  },
  itemDisplayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#66BB6A',
    gap: 6,
    minWidth: 220,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  itemEmoji: {
    fontSize: 54,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2E7D32',
  },
  subtextInstruction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#388E3C',
  },
  basketsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    width: '100%',
  },
  basketBtn: {
    flex: 1,
    maxWidth: 170,
    minHeight: 120,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 3,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  basketDefault: {
    backgroundColor: '#FFFFFF',
    borderColor: '#43A047',
  },
  basketCorrect: {
    backgroundColor: '#C8E6C9',
    borderColor: '#2E7D32',
  },
  basketIncorrect: {
    backgroundColor: '#FFCDD2',
    borderColor: '#C2185B',
  },
  basketEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  basketTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1B5E20',
    textAlign: 'center',
  },
  basketPattern: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: 'rgba(67, 160, 71, 0.2)',
  },
});
