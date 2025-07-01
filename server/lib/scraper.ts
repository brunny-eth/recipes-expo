console.log('--- server/lib/scraper.ts: Start ---');
import scraperapiClient from 'scraperapi-sdk';
import logger from './logger';
console.log('--- server/lib/scraper.ts: End ---');

const scraperApiKey = process.env.SCRAPERAPI_KEY;

if (!scraperApiKey) {
  // This log will now appear once on server startup instead of on each request if the key is missing.
  logger.error({ context: 'init', missingKey: 'SCRAPERAPI_KEY', nodeEnv: process.env.NODE_ENV }, 'SCRAPERAPI_KEY environment variable is not set!');
}

// The client is initialized once and can be imported elsewhere.
const scraperClient = scraperapiClient(scraperApiKey || '');

export { scraperClient, scraperApiKey }; 