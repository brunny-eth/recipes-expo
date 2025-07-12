import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import StepItem from './StepItem';
import { SPACING } from '@/constants/theme';

const URL_STEPS = [
  {
    label: 'Skipping the slop',
    subtext: 'Sifting through 3,000 words of fluff',
  },
  { label: 'Deleting the ads', subtext: 'Why are there so many of them?' },
  {
    label: 'Finding backup ingredients',
    subtext: "Just in case you don't have cardamom",
  },
  {
    label: 'Throwing out all the junk',
    subtext: 'Cleaning up unnecessary extras',
  },
  {
    label: 'Doing the servings math',
    subtext: 'Scaling things up or down for you',
  },
];

const VIDEO_STEPS = [
  {
    label: 'Waking up the Recipe Gnomes',
    subtext: 'They help check video caption quality and extract the recipe',
  },
  {
    label: 'Transcribing the chaos',
    subtext: 'The Gnomes are zooming in. Rewinding. Again. And again.',
  },
  {
    label: 'Sifting through the comments',
    subtext: 'Filtering out “first!” and “recipe???”',
  },
  {
    label: 'Extracting ingredients',
    subtext: 'Counting scoops, pinches, and dashes',
  },
  {
    label: 'Proofreading the magic',
    subtext: 'The Gnomes are checking for typos and errors',
  },
];

interface ChecklistProgressProps {
  isFinished?: boolean;
  inputType?: string;
}

const ChecklistProgress: React.FC<ChecklistProgressProps> = ({
  isFinished,
  inputType = 'url',
}) => {
  const checklistId = useRef(Math.random().toFixed(5));
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const hasCompleted = useRef(false);

  // Select steps based on input type
  const STEPS = inputType === 'video' ? VIDEO_STEPS : URL_STEPS;

  useEffect(() => {
    // First step loads after 2.5 seconds
    const firstStepTimer = setTimeout(() => {
      setCurrentStepIndex(1);
    }, 2500);

    // Then start the regular interval for subsequent steps (3.5 seconds each)
    const regularIntervalTimer = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setCurrentStepIndex((prevIndex) => {
          if (prevIndex < STEPS.length - 1) {
            return prevIndex + 1;
          }
          clearInterval(intervalRef.current!);
          return prevIndex;
        });
      }, 3500) as any;
    }, 2500);

    return () => {
      clearTimeout(firstStepTimer);
      clearTimeout(regularIntervalTimer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [STEPS.length]);

  useEffect(() => {
    if (isFinished) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      const fastForwardInterval = setInterval(() => {
        setCurrentStepIndex((prevIndex) => {
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
  }, [isFinished, STEPS.length]);

  useEffect(() => {
    const maybeComplete = () => {
      const isLastStep = currentStepIndex === STEPS.length - 1;
      if (isLastStep && isFinished && !hasCompleted.current) {
        console.log(
          '[ChecklistProgress] maybeComplete: Firing onChecklistComplete...',
        );
        hasCompleted.current = true;
      }
    };

    maybeComplete();
  }, [currentStepIndex, isFinished, STEPS.length]);

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
    paddingHorizontal: SPACING.pageHorizontal,
    width: '100%',
  } as ViewStyle,
});

export default ChecklistProgress;
