declare module 'scraperapi-sdk' {
  interface ScraperAPIClient {
    get: (url: string, options?: any) => Promise<any>; // You might want to refine 'any' to a more specific type if you know the response structure
    // Add other methods if you use them, e.g.:
    // post: (url: string, data: any, options?: any) => Promise<any>;
    // put: (url: string, data: any, options?: any) => Promise<any>;
  }

  function scraperapiClient(apiKey: string): ScraperAPIClient;
  export default scraperapiClient;
} 