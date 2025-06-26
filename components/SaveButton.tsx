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
      console.log(`Checking saved status for recipe: ${recipeId}`);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        console.warn(
          'No user session found on mount. Cannot check saved status.',
        );
        setIsLoading(false);
        return;
      }

      const saved = await isRecipeSaved(recipeId);
      console.log(`Recipe ${recipeId} is ${saved ? 'saved' : 'not saved'}`);
      setIsSaved(saved);
      setIsLoading(false);
    };

    checkSavedStatus();
  }, [recipeId, isIdValid]);

  const handlePress = async () => {
    if (!isIdValid) {
      console.warn(
        '[SaveButton] Save pressed with invalid recipeId:',
        recipeId,
      );
      return;
    }

    console.log('[SaveButton] Saving recipe with ID:', recipeId);
    setIsLoading(true);
    console.log(`Button pressed. Current state isSaved: ${isSaved}`);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn(
        'No user session found on button press. Cannot save/unsave recipe.',
      );
      setIsLoading(false);
      return;
    }

    const previousState = isSaved;
    setIsSaved(!previousState); // Optimistic update

    let success;
    if (previousState) {
      console.log(`Attempting to unsave recipe: ${recipeId}`);
      success = await unsaveRecipe(recipeId);
    } else {
      console.log(`Attempting to save recipe: ${recipeId}`);
      success = await saveRecipe(recipeId);
    }

    if (success) {
      console.log(
        `Successfully ${previousState ? 'unsaved' : 'saved'} recipe: ${recipeId}`,
      );
    } else {
      console.error(
        `Failed to ${previousState ? 'unsave' : 'save'} recipe: ${recipeId}`,
      );
      // Revert on failure
      setIsSaved(previousState);
      // TODO: Show toast message on failure
    }

    setIsLoading(false);
  };

  if (!isIdValid) {
    return (
      <View style={[styles.button, styles.disabled]}>
        <Text style={styles.text}>Save</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, isLoading && styles.disabled]}
      onPress={handlePress}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#000" />
      ) : (
        <Text style={styles.text}>{isSaved ? 'Saved ✓' : 'Save'}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#E0E0E0', // A light gray
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    backgroundColor: '#BDBDBD', // A darker gray for disabled state
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SaveButton;
