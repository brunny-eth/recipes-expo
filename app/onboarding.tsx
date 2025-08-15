import React from 'react';
import { useRouter } from 'expo-router';
import OnboardingScreen from '@/components/OnboardingScreen';

export default function OnboardingRoute() {
  const router = useRouter();
  return (
    <OnboardingScreen
      onComplete={() => router.back()}
      onBack={() => router.back()}
    />
  );
}


