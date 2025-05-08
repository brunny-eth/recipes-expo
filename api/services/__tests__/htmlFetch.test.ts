import { fetchHtmlWithFallback } from '../htmlFetch';

// Mock the global fetch function
global.fetch = jest.fn();

// Create a mock ScraperAPI client
const mockScraperClient = {
  get: jest.fn(),
};

// Define default mock API key
const mockApiKey = 'test-scraper-api-key';

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

describe('fetchHtmlWithFallback', () => {
  beforeEach(() => {
    // Reset mocks before each test
    (global.fetch as jest.Mock).mockClear();
    mockScraperClient.get.mockClear();
    // Suppress console output during tests
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    // Restore console output after each test
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  test('should return HTML from direct fetch on success', async () => {
    const mockHtml = '<html><body>Direct Success</body></html>';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => mockHtml,
    });

    const result = await fetchHtmlWithFallback('http://example.com', mockApiKey, mockScraperClient);

    expect(result.htmlContent).toBe(mockHtml);
    expect(result.fetchMethodUsed).toBe('Direct Fetch');
    expect(result.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockScraperClient.get).not.toHaveBeenCalled();
  });

  test('should use ScraperAPI fallback if direct fetch returns 403', async () => {
    const fallbackHtml = '<html><body>Fallback Success</body></html>';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });
    mockScraperClient.get.mockResolvedValueOnce({ body: fallbackHtml }); // Simulate SDK response structure

    const result = await fetchHtmlWithFallback('http://blocked.com', mockApiKey, mockScraperClient);

    expect(result.htmlContent).toBe(fallbackHtml);
    expect(result.fetchMethodUsed).toBe('ScraperAPI Fallback');
    expect(result.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockScraperClient.get).toHaveBeenCalledTimes(1);
    expect(mockScraperClient.get).toHaveBeenCalledWith('http://blocked.com');
  });
  
   test('should use ScraperAPI fallback if direct fetch returns non-403 error and API key exists', async () => {
    const fallbackHtml = '<html><body>Fallback Success After 500</body></html>';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    mockScraperClient.get.mockResolvedValueOnce({ body: fallbackHtml });

    const result = await fetchHtmlWithFallback('http://servererror.com', mockApiKey, mockScraperClient);

    expect(result.htmlContent).toBe(fallbackHtml);
    expect(result.fetchMethodUsed).toBe('ScraperAPI Fallback');
    expect(result.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockScraperClient.get).toHaveBeenCalledTimes(1);
  });

  test('should use ScraperAPI fallback if direct fetch throws network error and API key exists', async () => {
    const fallbackHtml = '<html><body>Fallback Success After Network Error</body></html>';
    const networkError = new Error('Network request failed');
    (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);
    mockScraperClient.get.mockResolvedValueOnce({ body: fallbackHtml });

    const result = await fetchHtmlWithFallback('http://networkerror.com', mockApiKey, mockScraperClient);

    expect(result.htmlContent).toBe(fallbackHtml);
    expect(result.fetchMethodUsed).toBe('ScraperAPI Fallback');
    expect(result.error).toBeNull(); 
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockScraperClient.get).toHaveBeenCalledTimes(1);
  });

  test('should return error if direct fetch fails and ScraperAPI fallback also fails', async () => {
    const directError = new Error('Fetch failed: 403 Forbidden');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
    });
    const fallbackError = new Error('Scraper API failed');
    mockScraperClient.get.mockRejectedValueOnce(fallbackError);

    const result = await fetchHtmlWithFallback('http://bothfail.com', mockApiKey, mockScraperClient);

    expect(result.htmlContent).toBe('');
    expect(result.fetchMethodUsed).toBe('ScraperAPI Fallback'); // It attempted fallback
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain('Fetch failed: 403 Forbidden');
    expect(result.error?.message).toContain('Scraper API failed');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockScraperClient.get).toHaveBeenCalledTimes(1);
  });

  test('should return direct fetch error if API key is missing and direct fetch fails', async () => {
     const directError = new Error('Fetch failed: 403 Forbidden');
     (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
    });

    // Pass undefined for apiKey
    const result = await fetchHtmlWithFallback('http://directfailnokey.com', undefined, mockScraperClient);

    expect(result.htmlContent).toBe('');
    expect(result.fetchMethodUsed).toBe('Direct Fetch'); // Fallback not attempted
    expect(result.error).toEqual(directError); // Should be the original direct fetch error
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockScraperClient.get).not.toHaveBeenCalled();
  });

  test('should handle scraper returning plain string successfully', async () => {
    const fallbackHtmlString = '<html><body>Fallback String Success</body></html>';
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Direct fetch failed'));
    mockScraperClient.get.mockResolvedValueOnce(fallbackHtmlString); // Simulate direct string response

    const result = await fetchHtmlWithFallback('http://fallbackstring.com', mockApiKey, mockScraperClient);

    expect(result.htmlContent).toBe(fallbackHtmlString);
    expect(result.fetchMethodUsed).toBe('ScraperAPI Fallback');
    expect(result.error).toBeNull();
    expect(mockScraperClient.get).toHaveBeenCalledTimes(1);
  });

   test('should return error if ScraperAPI returns unexpected response format', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Direct fetch failed'));
    // Simulate unexpected response (not string, not object with .body)
    mockScraperClient.get.mockResolvedValueOnce({ someOtherKey: 'value' }); 

    const result = await fetchHtmlWithFallback('http://badfallbackformat.com', mockApiKey, mockScraperClient);

    expect(result.htmlContent).toBe('');
    expect(result.fetchMethodUsed).toBe('ScraperAPI Fallback'); 
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain('ScraperAPI fallback returned unexpected response');
    expect(mockScraperClient.get).toHaveBeenCalledTimes(1);
  });

}); 