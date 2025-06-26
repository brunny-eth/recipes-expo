import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { supabase } from '../lib/supabaseClient';
import { isRecipeSaved, saveRecipe, unsaveRecipe } from '../lib/savedRecipes';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { captionStrongText, FONT } from '@/constants/typography';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SaveButtonProps {
  recipeId: number;
}

const SaveButton: React.FC<SaveButtonProps> = ({ recipeId }) => {
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isIdValid =
    recipeId !== undefined && recipeId !== null && !isNaN(recipeId);

  useEffect(() => {
    if (!isIdValid) {
      setIsLoading(false);
      return;
    }

    const checkSavedStatus = async () => {
      setIsLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsLoading(false);
        return;
      }
      const saved = await isRecipeSaved(recipeId);
      setIsSaved(saved);
      setIsLoading(false);
    };

    checkSavedStatus();
  }, [recipeId, isIdValid]);

  const handlePress = async () => {
    if (!isIdValid) return;
    setIsLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setIsLoading(false);
      return;
    }
    const previousState = isSaved;
    setIsSaved(!previousState);
    const success = previousState
      ? await unsaveRecipe(recipeId)
      : await saveRecipe(recipeId);
    if (!success) {
      setIsSaved(previousState);
    }
    setIsLoading(false);
  };

  if (!isIdValid) {
    return null; // Don't render if there's no ID
  }

  const buttonStyle = [
    styles.button,
    isSaved ? styles.buttonSaved : styles.buttonUnsaved,
    isLoading && styles.disabled,
  ];

  const textStyle = [
    styles.text,
    isSaved ? styles.textSaved : styles.textUnsaved,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={handlePress}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator
          color={isSaved ? COLORS.successDark : COLORS.white}
          size="small"
        />
      ) : (
        <>
          <MaterialCommunityIcons
            name={isSaved ? 'check' : 'bookmark-outline'}
            size={16}
            color={isSaved ? COLORS.successDark : COLORS.white}
            style={{ marginRight: SPACING.sm }}
          />
          <Text style={textStyle}>{isSaved ? 'Saved' : 'Save'}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
  },
  buttonSaved: {
    backgroundColor: 'transparent',
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  buttonUnsaved: {
    backgroundColor: COLORS.primaryLight,
  },
  disabled: {
    opacity: 0.6,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...captionStrongText,
    fontSize: FONT.size.smBody,
  },
  textSaved: {
    color: COLORS.primary,
  },
  textUnsaved: {
    color: COLORS.primary,
  },
});

export default SaveButton;
