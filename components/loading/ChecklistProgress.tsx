import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import StepItem from './StepItem';

const STEPS = [
  { label: 'Skipping the slop', subtext: 'Sifting through 3,000 words of fluff' },
  { label: 'Deleting the ads', subtext: 'Why are there so many of them?' },
  { label: 'Finding backup ingredients', subtext: "Just in case you don't have cardamom" },
  { label: 'Throwing out all the junk', subtext: 'Cleaning up unnecessary extras' },
  { label: 'Doing the servings math', subtext: 'Scaling things up or down for you' },
];

interface ChecklistProgressProps {
  isFinished?: boolean;
}

const ChecklistProgress: React.FC<ChecklistProgressProps> = ({ isFinished }) => {
  const checklistId = useRef(Math.random().toFixed(5));
  console.log(`[ChecklistProgress] Mount ID ${checklistId.current}`);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const hasCompleted = useRef(false);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCurrentStepIndex(prevIndex => {
        if (prevIndex < STEPS.length - 1) {
          return prevIndex + 1;
        }
        clearInterval(intervalRef.current!);
        return prevIndex;
      });
    }, 3000) as any;

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isFinished) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      const fastForwardInterval = setInterval(() => {
        setCurrentStepIndex(prevIndex => {
          if (prevIndex < STEPS.length - 1) {
            return prevIndex + 1;
          }
          clearInterval(fastForwardInterval);
          return prevIndex;
        });
      }, 200) as any;

      return () => {
        clearInterval(fastForwardInterval);
      };
    }
  }, [isFinished]);

  useEffect(() => {
    const maybeComplete = () => {
      const isLastStep = currentStepIndex === STEPS.length - 1;
      if (isLastStep && isFinished && !hasCompleted.current) {
        console.log('[ChecklistProgress] maybeComplete: Firing onChecklistComplete...');
        hasCompleted.current = true;
      }
    };

    maybeComplete();
  }, [currentStepIndex, isFinished]);

  const getStepState = (stepIndex: number) => {
    if (stepIndex < currentStepIndex) {
      return 'complete';
    }
    if (stepIndex === currentStepIndex) {
      return 'active';
    }
    return 'pending';
  };

  return (
    <View style={styles.container} pointerEvents="none">
      {STEPS.map((step, index) => (
        <StepItem
          key={index}
          label={step.label}
          subtext={step.subtext}
          state={getStepState(index)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
  },
});

export default ChecklistProgress; 