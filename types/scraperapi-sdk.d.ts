declare module 'scraperapi-sdk' {
  // Assuming scraperapiClient is a function or a class constructor
  // If it's an object with methods, this would need to be different.
  // For now, 'any' is a safe bet to get past the type error.
  const scraperapiClient: any;
  export default scraperapiClient;
} 