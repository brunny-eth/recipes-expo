import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';

export default function StepsScreen() {
  const params = useLocalSearchParams<{ instructionsData?: string, substitutionsText?: string }>();
  const router = useRouter();
  
  const [instructions, setInstructions] = useState<string[]>([]);
  const [substitutions, setSubstitutions] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    try {
      if (params.instructionsData) {
        const parsedInstructions = JSON.parse(params.instructionsData);
        if (Array.isArray(parsedInstructions)) {
            setInstructions(parsedInstructions);
        } else {
            throw new Error("Instructions data is not an array.");
        }
      } else {
        // Allow empty instructions, maybe show placeholder later
        setInstructions([]); 
      }
      
      // Set substitutions text (it's already a string or empty/null)
      setSubstitutions(params.substitutionsText || null);

    } catch (e) {
        console.error("Failed to parse instructions data:", e);
        setError("Could not load recipe instructions.");
    }
    setIsLoading(false);
  }, [params.instructionsData, params.substitutionsText]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButtonSimple} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={COLORS.raisinBlack} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Instructions</Text>
        <View style={styles.placeholder} />
      </Animated.View>
      
      <ScrollView 
        style={styles.stepsContainer}
        showsVerticalScrollIndicator={false}
      >
        {instructions.length > 0 ? (
            instructions.map((step, index) => (
              <View key={`step-${index}`} style={styles.stepItemSimple}>
                 <Text style={styles.stepNumberSimple}>{`${index + 1}`}</Text>
                 <Text style={styles.stepTextSimple}>{step}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.placeholderText}>No instructions found.</Text>
          )}
        
        {substitutions && (
            <View style={styles.substitutionsContainer}>
                <Text style={styles.sectionTitle}>Substitution Notes</Text>
                <Text style={styles.substitutionsText}>{substitutions}</Text>
            </View>
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: COLORS.raisinBlack,
    marginHorizontal: 10,
  },
  placeholder: {
    width: 24 + 16,
  },
  stepsContainer: {
    padding: 20,
  },
  stepItemSimple: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'flex-start',
  },
  stepNumberSimple: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: COLORS.primary,
    marginRight: 12,
    minWidth: 25,
    textAlign: 'right',
  },
  stepTextSimple: {
    fontFamily: 'Poppins-Regular',
    fontSize: 15,
    color: COLORS.textDark,
    flex: 1,
    lineHeight: 22,
  },
  centeredStatusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
  },
  errorText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButtonSimple: {
     marginTop: 15,
     paddingVertical: 10,
     paddingHorizontal: 20,
     backgroundColor: COLORS.lightGray,
     borderRadius: 8,
  },
  backButtonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.textDark,
  },
  placeholderText: {
    fontFamily: 'Poppins-Italic',
    fontSize: 14,
    color: COLORS.darkGray,
    marginTop: 20,
    textAlign: 'center',
  },
  substitutionsContainer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.secondary,
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 8,
  },
  substitutionsText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: COLORS.textDark,
    lineHeight: 20,
  },
});