export function formatMeasurement(amount: number): string {
  if (isNaN(amount)) return '';

  const FRACTIONS = [
    { value: 1, label: '' },
    { value: 0.875, label: '⅞' },
    { value: 0.75, label: '¾' },
    { value: 0.666, label: '⅔' },
    { value: 0.5, label: '½' },
    { value: 0.333, label: '⅓' },
    { value: 0.25, label: '¼' },
    { value: 0.125, label: '⅛' }
  ];

  const whole = Math.floor(amount);
  const decimal = amount - whole;

  let closest = FRACTIONS.reduce((prev, curr) =>
    Math.abs(curr.value - decimal) < Math.abs(prev.value - decimal) ? curr : prev
  );

  if (whole === 0 && closest.value === 1) return '1'; // e.g. 0.99 rounds to 1
  if (closest.value === 0) return `${whole}`;
  return whole > 0 ? `${whole} ${closest.label}` : `${closest.label}`;
} 