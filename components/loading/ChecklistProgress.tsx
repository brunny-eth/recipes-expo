import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import StepItem from './StepItem';
import { SPACING } from '@/constants/theme';

const URL_STEPS = [
  {
    label: 'Skipping the slop',
    subtext: 'Sifting through 3,000 words of fluff',
  },
  { label: 'Deleting the ads', 
    subtext: 'Why are there so many of them?', 
  },
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
    subtext: 'Scaling ingredients up and down for you',
  },
];

const VIDEO_STEPS = [
  {
    label: 'Waking up the Recipe Gnomes',
    subtext: 'They help check video caption quality',
  },
  {
    label: 'Transcribing the chaos',
    subtext: 'The Gnomes are zooming in and rewinding',
  },
  {
    label: 'Sifting through the comments',
    subtext: 'Looking for the recipe in these...',
  },
  {
    label: 'Extracting ingredients',
    subtext: 'Counting scoops, pinches, and dashes',
  },
  {
    label: 'Proofreading the magic',
    subtext: 'The Gnomes love to check for typos',
  },
];

const IMAGE_STEPS = [
  {
    label: 'Analyzing attached images',
    subtext: 'Trying to find the recipe in here',
  },
  {
    label: 'Transcribing the chaos',
    subtext: 'Extracting content from the pages',
  },
  {
    label: 'Fixing the ingredients',
    subtext: 'Changing "cimanon" back to "cinnamon"',
  },
  {
    label: 'Organizing the steps',
    subtext: 'Putting instructions in the right order',
  },
  {
    label: 'Formatting the recipe for you',
    subtext: 'Making everything clear and concise',
  },
];

const TEXT_STEPS = [
  {
    label: 'Understanding your dish',
    subtext: 'Picking a clear starting point',
  },
  {
    label: 'Finding the best references',
    subtext: 'Scanning trusted recipes and techniques',
  },
  {
    label: 'Building a solid ingredient list',
    subtext: 'Only the best ingredients for a Meez-er',
  },
  {
    label: 'Writing clean, step‑by‑step directions',
    subtext: 'Clear, concise, and easy to follow',
  },
  {
    label: 'Dialing in quantities & timing',
    subtext: 'Scaling and smoothing out the details',
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
  const STEPS = inputType === 'video'
    ? VIDEO_STEPS
    : (inputType === 'image' || inputType === 'images')
    ? IMAGE_STEPS
    : inputType === 'raw_text'
    ? TEXT_STEPS
    : URL_STEPS;

  useEffect(() => {
    // First step loads after 3.125 seconds (25% slower)
    const firstStepTimer = setTimeout(() => {
      setCurrentStepIndex(1);
    }, 3125);

    // Then start the regular interval for subsequent steps (4.375 seconds each, 25% slower)
    const regularIntervalTimer = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setCurrentStepIndex((prevIndex) => {
          if (prevIndex < STEPS.length - 1) {
            return prevIndex + 1;
          }
          clearInterval(intervalRef.current!);
          return prevIndex;
        });
      }, 4375) as any;
    }, 3125);

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
      }, 250) as any; // 25% slower fast-forward

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
