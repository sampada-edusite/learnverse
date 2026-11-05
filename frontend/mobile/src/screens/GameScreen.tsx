import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { GameContainer } from '../components/games/GameContainer';
import { GameDefinition, GameAttemptResult } from '../components/games/types';
import { getGameForLesson } from '../components/games/mockGameData';
import { Colors } from '../theme/colors';

interface GameScreenProps {
  lessonId?: string;
  onBack: () => void;
  onGameComplete?: (result: GameAttemptResult) => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  lessonId = '1.1',
  onBack,
  onGameComplete,
}) => {
  const game: GameDefinition = getGameForLesson(lessonId);

  return (
    <View style={styles.container}>
      <GameContainer
        game={game}
        visible={true}
        onClose={onBack}
        onFinish={onGameComplete}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
