import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LoadingExperienceScreen from '@/components/loading/LoadingExperienceScreen';
import {
  SafeAreaView,
  StyleSheet,
  View,
  TouchableOpacity,
  ViewStyle,
  Platform,
} from 'react-native';
import { COLORS, SPACING, ICON_SIZE } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useFreeUsage } from '@/context/FreeUsageContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LoadingRoute() {
  const router = useRouter();
  const { recipeUrl, forceNewParse, inputType } = useLocalSearchParams<{ 
    recipeUrl?: string; 
    forceNewParse?: string;
    inputType?: string;
  }>();
  const { isAuthenticated } = useAuth();
  const { markFreeRecipeUsed } = useFreeUsage();

  // Move navigation to useEffect to avoid setState during render
  React.useEffect(() => {
    if (!recipeUrl) {
      console.error('[LoadingRoute] No recipe URL provided.');
      router.back();
    }
  }, [recipeUrl, router]);

  if (!recipeUrl) {
    return null;
  }

  const handleClose = () => {
    // Current navigation is to /tabs. This is the desired "home" screen for exit.
    console.log('[LoadingRoute] Close button pressed. Navigating to /tabs.'); // Added for debugging
    router.replace('/tabs'); 
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top navigation bar - copied exactly from RecipeStepsHeader */}
      <View style={styles.mainHeader}>
        <TouchableOpacity style={styles.button} onPress={handleClose}>
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={COLORS.textDark}
          />
        </TouchableOpacity>
      </View>

      <LoadingExperienceScreen
        recipeInput={recipeUrl}
        loadingMode="checklist"
        forceNewParse={forceNewParse === 'true'}
        inputType={inputType}
        onComplete={() => {
          console.log('[LoadingRoute] Recipe parsing complete callback.');
        }}
        onFailure={() => {
          console.log('[LoadingRoute] Recipe parsing failed, navigating back.');
          router.back();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  } as ViewStyle,
  mainHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === 'ios' ? 0 : SPACING.sm,
    paddingBottom: SPACING.sm,
  } as ViewStyle,
  button: {
    padding: SPACING.sm,
  } as ViewStyle,
});
