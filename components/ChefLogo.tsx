import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { COLORS } from '@/constants/theme';

type ChefLogoProps = {
  size?: number;
};

const ChefLogo: React.FC<ChefLogoProps> = ({ size = 80 }) => {
  const scaleFactor = size / 80; // 80 is the base size

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.chefHat, { 
        width: 60 * scaleFactor, 
        height: 40 * scaleFactor,
        borderRadius: 30 * scaleFactor,
        top: -12 * scaleFactor,
        left: 10 * scaleFactor,
      }]}>
        <View style={[styles.hatBase, {
          width: 60 * scaleFactor,
          height: 10 * scaleFactor,
          bottom: -5 * scaleFactor,
          borderRadius: 5 * scaleFactor,
        }]} />
      </View>
      <View style={[styles.face, { 
        width: 50 * scaleFactor, 
        height: 50 * scaleFactor,
        borderRadius: 25 * scaleFactor,
        borderWidth: 3 * scaleFactor,
      }]}>
        <View style={[styles.eyes, {
          top: 15 * scaleFactor,
          width: 30 * scaleFactor,
        }]}>
          <View style={[styles.eye, { 
            width: 6 * scaleFactor, 
            height: 6 * scaleFactor,
            borderRadius: 3 * scaleFactor,
          }]} />
          <View style={[styles.eye, { 
            width: 6 * scaleFactor, 
            height: 6 * scaleFactor,
            borderRadius: 3 * scaleFactor,
          }]} />
        </View>
        <View style={[styles.mustache, {
          width: 26 * scaleFactor,
          height: 10 * scaleFactor,
          borderRadius: 5 * scaleFactor,
          top: 26 * scaleFactor,
          borderWidth: 2 * scaleFactor,
        }]} />
        <View style={[styles.mouth, {
          width: 14 * scaleFactor,
          height: 7 * scaleFactor,
          borderBottomLeftRadius: 7 * scaleFactor,
          borderBottomRightRadius: 7 * scaleFactor,
          top: 32 * scaleFactor,
        }]} />
      </View>
      <View style={[styles.book, {
        width: 40 * scaleFactor,
        height: 30 * scaleFactor,
        borderRadius: 5 * scaleFactor,
        top: 45 * scaleFactor,
        left: 20 * scaleFactor,
      }]}>
        <View style={[styles.bookSpine, {
          width: 4 * scaleFactor,
          height: 30 * scaleFactor,
          borderRadius: 2 * scaleFactor,
          left: 18 * scaleFactor,
        }]} />
        <View style={[styles.bookPage, {
          width: 16 * scaleFactor,
          height: 24 * scaleFactor,
          borderRadius: 2 * scaleFactor,
          top: 3 * scaleFactor,
          left: 2 * scaleFactor,
        }]} />
        <View style={[styles.bookPage, {
          width: 16 * scaleFactor,
          height: 24 * scaleFactor,
          borderRadius: 2 * scaleFactor,
          top: 3 * scaleFactor,
          right: 2 * scaleFactor,
        }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chefHat: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#333333',
    zIndex: 2,
  },
  hatBase: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#333333',
  },
  face: {
    position: 'absolute',
    backgroundColor: '#FFD8B9',
    borderColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  eyes: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eye: {
    backgroundColor: '#333333',
  },
  mustache: {
    position: 'absolute',
    backgroundColor: '#8B4513',
    borderColor: '#333333',
  },
  mouth: {
    position: 'absolute',
    backgroundColor: '#FF6B6B',
    left: '50%',
    transform: [{ translateX: -7 }],
  },
  book: {
    position: 'absolute',
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
    transform: [{ rotate: '10deg' }],
  },
  bookSpine: {
    position: 'absolute',
    backgroundColor: '#D32F2F',
  },
  bookPage: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
});

export default ChefLogo;