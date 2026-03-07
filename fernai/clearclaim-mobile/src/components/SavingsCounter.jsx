import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

export function SavingsCounter({ amount }) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: amount,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [amount, animatedValue]);

  const animatedText = animatedValue.interpolate({
    inputRange: [0, Math.max(1, amount)],
    outputRange: [0, Math.max(1, amount)],
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Total Recoverable</Text>
      <Animated.Text style={styles.amount}>
        $
        {animatedText.interpolate({
          inputRange: [0, amount || 1],
          outputRange: [0, amount || 1],
        }).__getValue
          ? amount.toFixed(2)
          : amount.toFixed(2)}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
  label: {
    color: colors.textOnPrimary,
    fontSize: 12,
    opacity: 0.9,
  },
  amount: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '700',
  },
});

export default SavingsCounter;

