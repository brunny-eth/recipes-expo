declare module 'fraction.js' {
  interface Fraction {
    n: number;
    d: number;
    s: number;
  }

  function parse(value: string | number): number;
  function toFraction(value: number, maxDenominator?: number): string;

  export { parse, toFraction, Fraction };
} 