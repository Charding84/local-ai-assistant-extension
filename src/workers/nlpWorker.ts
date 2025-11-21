// NLP Worker - Lightweight natural language processing
// Keyword extraction, extractive summarization, scoring

interface NLPRequest {
  id: string;
  type: 'keywords' | 'summarize' | 'score' | 'analyze';
  payload: {
    text: string;
    maxKeywords?: number;
    summaryLength?: number;
  };
}

interface NLPResponse {
  id: string;
  status: 'ok' | 'err';
  result?: unknown;
  error?: string;
  timing: {
    elapsedMs: number;
  };
}

// Enforce worker context
if (typeof importScripts !== 'function') {
  throw new Error('nlpWorker must run in worker context');
}

const TIMEOUT_MS = 1000;
const STOPWORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
]);

function extractKeywords(text: string, maxKeywords = 10): string[] {
  // Tokenize and normalize
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !STOPWORDS.has(word));

  // Count frequencies
  const freq: Record<string, number> = {};
  words.forEach(word => {
    freq[word] = (freq[word] || 0) + 1;
  });

  // Sort by frequency and return top N
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

function extractiveSummarize(text: string, summaryLength = 2): string {
  // Split into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  // Simple extractive: take first N sentences
  return sentences
    .slice(0, Math.min(summaryLength, sentences.length))
    .join(' ')
    .trim();
}

function calculateReadabilityScore(text: string): number {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const words = text.split(/\s+/);
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);

  if (sentences.length === 0 || words.length === 0) return 0;

  // Flesch Reading Ease approximation
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  const score =
    206.835 -
    1.015 * avgWordsPerSentence -
    84.6 * avgSyllablesPerWord;

  // Normalize to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

function countSyllables(word: string): number {
  // Simple syllable counting heuristic
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  const vowels = word.match(/[aeiouy]+/g);
  let count = vowels ? vowels.length : 1;

  // Adjust for silent e
  if (word.endsWith('e')) count--;
  if (word.endsWith('le') && word.length > 2) count++;

  return Math.max(1, count);
}

async function processRequest(
  request: NLPRequest,
  signal: AbortSignal
): Promise<NLPResponse> {
  const startTime = performance.now();
  const { text } = request.payload;

  try {
    if (signal.aborted) {
      throw new Error('Request cancelled');
    }

    let result: unknown;

    switch (request.type) {
      case 'keywords':
        result = {
          keywords: extractKeywords(text, request.payload.maxKeywords),
        };
        break;

      case 'summarize':
        result = {
          summary: extractiveSummarize(text, request.payload.summaryLength),
        };
        break;

      case 'score':
        result = {
          score: calculateReadabilityScore(text),
        };
        break;

      case 'analyze':
        result = {
          keywords: extractKeywords(text),
          summary: extractiveSummarize(text),
          score: calculateReadabilityScore(text),
        };
        break;

      default:
        throw new Error(`Unknown request type: ${request.type}`);
    }

    return {
      id: request.id,
      status: 'ok',
      result,
      timing: { elapsedMs: performance.now() - startTime },
    };
  } catch (error) {
    return {
      id: request.id,
      status: 'err',
      error: error instanceof Error ? error.message : 'Unknown error',
      timing: { elapsedMs: performance.now() - startTime },
    };
  }
}

const activeControllers = new Map<string, AbortController>();

self.onmessage = async (event: MessageEvent<NLPRequest>) => {
  const request = event.data;

  const controller = new AbortController();
  activeControllers.set(request.id, controller);

  const timeoutId = setTimeout(() => {
    controller.abort();
    activeControllers.delete(request.id);
  }, TIMEOUT_MS);

  try {
    const response = await processRequest(request, controller.signal);
    self.postMessage(response);
  } finally {
    clearTimeout(timeoutId);
    activeControllers.delete(request.id);
  }
};

self.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.type === 'cancel' && event.data?.id) {
    const controller = activeControllers.get(event.data.id);
    if (controller) {
      controller.abort();
      activeControllers.delete(event.data.id);
    }
  }
});
