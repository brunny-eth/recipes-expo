import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { COLORS } from '@/constants/theme';
import {
  convertUnits,
  availableUnits,
  Unit,
  getUnitDisplayName,
} from '@/utils/units';
import {
  sectionHeaderText,
  bodyText,
  captionText,
  bodyStrongText,
  FONT,
} from '@/constants/typography';

export default function UnitsTool() {
  const [amount, setAmount] = useState<string>('1');
  const [fromUnit, setFromUnit] = useState<Unit>('cup');
  const [toUnit, setToUnit] = useState<Unit>('tbsp');
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const numericAmount = parseFloat(amount);
    if (!isNaN(numericAmount)) {
      const conversionResult = convertUnits(numericAmount, fromUnit, toUnit);
      if (conversionResult !== null) {
        setResult(`${conversionResult} ${getUnitDisplayName(toUnit)}`);
      } else {
        setResult('Invalid conversion');
      }
    } else if (amount.trim() === '') {
      setResult(null); // Clear result if input is empty
    } else {
      setResult('Invalid amount');
    }
  }, [amount, fromUnit, toUnit]);

  const handleAmountChange = (text: string) => {
    // Allow only numbers and a single decimal point
    if (/^\d*\.?\d*$/.test(text)) {
      setAmount(text);
    }
  };

  // Sort units alphabetically by display name for the pickers
  const sortedUnits = [...availableUnits].sort((a, b) => {
    const displayNameA = String(getUnitDisplayName(a) || a);
    const displayNameB = String(getUnitDisplayName(b) || b);
    return displayNameA.localeCompare(displayNameB);
  });

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <Text style={styles.title}>Convert Units</Text>
        <View style={styles.conversionRow}>
          {/* Amount Input - Give it less flex space */}
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="numeric"
            placeholder="Amount"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />

          {/* From Unit Picker - Give it more flex space */}
          <View style={styles.pickerContainer}>
            <Picker<Unit>
              selectedValue={fromUnit}
              onValueChange={(itemValue: Unit) => setFromUnit(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {/* Map over the sorted array */}
              {sortedUnits.map((unit) => (
                <Picker.Item
                  key={unit}
                  label={String(getUnitDisplayName(unit) || unit)}
                  value={unit}
                />
              ))}
            </Picker>
          </View>

          <Text style={styles.equalsText}>=</Text>

          {/* To Unit Picker - Give it more flex space */}
          <View style={styles.pickerContainer}>
            <Picker<Unit>
              selectedValue={toUnit}
              onValueChange={(itemValue: Unit) => setToUnit(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {/* Map over the sorted array */}
              {sortedUnits.map((unit) => (
                <Picker.Item
                  key={unit}
                  label={String(getUnitDisplayName(unit) || unit)}
                  value={unit}
                />
              ))}
            </Picker>
          </View>
        </View>

        {/* Result Display */}
        {result && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 15,
    width: '100%',
  },
  title: {
    ...sectionHeaderText,
    color: COLORS.textDark,
    marginBottom: 20,
  },
  conversionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 25,
  },
  input: {
    minWidth: 50,
    maxWidth: 70,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    ...bodyText,
    textAlign: 'center',
    marginRight: 5,
  },
  pickerContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginHorizontal: 5,
    height: Platform.OS === 'ios' ? undefined : 45,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
  },
  pickerItem: {
    ...captionText,
    height: Platform.OS === 'ios' ? 100 : undefined,
  },
  equalsText: {
    ...bodyStrongText,
    fontSize: 18,
    color: COLORS.textDark,
    marginHorizontal: 5,
  },
  resultContainer: {
    marginTop: 10,
    padding: 15,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
  },
  resultText: {
    ...sectionHeaderText,
    fontFamily: FONT.family.interSemiBold,
    color: COLORS.primary,
    textAlign: 'center',
  },
});
