// Transform Worker - Handles all heavy text transformations locally
// NO external API calls, purely deterministic transforms

interface TransformRequest {
  id: string;
  type: 'transform' | 'analyze';
  payload: {
    text: string;
    settings?: {
      length?: 'short' | 'medium' | 'long' | 'custom';
      customLength?: number;
      tone?: string;
      style?: string;
      prompt?: string;
    };
  };
}

interface TransformResponse {
  id: string;
  status: 'ok' | 'err';
  result?: {
    text: string;
    rulesApplied: string[];
    changeRatio: number;
  };
  error?: string;
  timing: {
    elapsedMs: number;
  };
}

interface AnalyzeResponse {
  id: string;
  status: 'ok' | 'err';
  result?: {
    keywords: string[];
    summary: string;
    score: number;
  };
  error?: string;
  timing: {
    elapsedMs: number;
  };
}

// Enforce worker context
if (typeof importScripts !== 'function') {
  throw new Error('transformWorker must run in worker context');
}

const TIMEOUT_MS = 1000;
const activeAbortControllers = new Map<string, AbortController>();

// Lexicon swap tables for tone/style transforms
const TONE_LEXICONS: Record<string, Record<string, string>> = {
  formal: {
    hi: 'greetings',
    hey: 'hello',
    yeah: 'yes',
    nope: 'no',
    gonna: 'going to',
    wanna: 'want to',
    kinda: 'kind of',
    a lot: 'many',
    really: 'very',
    pretty: 'quite',
  },
  casual: {
    greetings: 'hi',
    hello: 'hey',
    yes: 'yeah',
    no: 'nope',
    'going to': 'gonna',
    'want to': 'wanna',
    'kind of': 'kinda',
    very: 'really',
    quite: 'pretty',
  },
  professional: {
    think: 'believe',
    get: 'obtain',
    make: 'create',
    help: 'assist',
    show: 'demonstrate',
    tell: 'inform',
  },
};

const STYLE_PATTERNS: Record<string, (text: string) => string> = {
  concise: text => {
    const fillers = [
      'actually',
      'basically',
      'literally',
      'essentially',
      'obviously',
      'clearly',
    ];
    let result = text;
    fillers.forEach(filler => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      result = result.replace(regex, '');
    });
    result = result.replace(/\s{2,}/g, ' ');
    return result.trim();
  },
  detailed: text => {
    return text
      .replace(/\bis\b/g, 'is currently')
      .replace(/\bwas\b/g, 'was previously')
      .replace(/\bcan\b/g, 'is able to');
  },
  technical: text => {
    return text
      .replace(/\buse\b/g, 'utilize')
      .replace(/\bpart\b/g, 'component')
      .replace(/\bthing\b/g, 'element');
  },
};

function applyLengthTransform(
  text: string,
  length: 'short' | 'medium' | 'long' | 'custom',
  customLength?: number
): { text: string; rule: string } {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let targetSentences: number;

  switch (length) {
    case 'short':
      targetSentences = Math.max(1, Math.ceil(sentences.length * 0.3));
      break;
    case 'medium':
      targetSentences = Math.max(1, Math.ceil(sentences.length * 0.6));
      break;
    case 'long':
      targetSentences = sentences.length;
      break;
    case 'custom':
      targetSentences = customLength || sentences.length;
      break;
  }

  const result = sentences.slice(0, targetSentences).join(' ');
  return {
    text: result,
    rule: `length_${length}_${targetSentences}_sentences`,
  };
}

function applyToneTransform(text: string, tone: string): { text: string; rule: string } {
  const lexicon = TONE_LEXICONS[tone.toLowerCase()];
  if (!lexicon) return { text, rule: 'tone_unchanged' };

  let result = text;
  let swaps = 0;

  Object.entries(lexicon).forEach(([from, to]) => {
    const regex = new RegExp(`\\b${from}\\b`, 'gi');
    const matches = result.match(regex);
    if (matches) {
      result = result.replace(regex, to);
      swaps += matches.length;
    }
  });

  return {
    text: result,
    rule: `tone_${tone}_${swaps}_swaps`,
  };
}

function applyStyleTransform(text: string, style: string): { text: string; rule: string } {
  const transform = STYLE_PATTERNS[style.toLowerCase()];
  if (!transform) return { text, rule: 'style_unchanged' };

  const result = transform(text);
  return {
    text: result,
    rule: `style_${style}_applied`,
  };
}

function calculateChangeRatio(original: string, transformed: string): number {
  const originalWords = original.split(/\s+/);
  const transformedWords = transformed.split(/\s+/);

  const lengthDiff = Math.abs(originalWords.length - transformedWords.length);
  const maxLength = Math.max(originalWords.length, transformedWords.length);

  const ratio = maxLength > 0 ? lengthDiff / maxLength : 0;
  return Math.round(ratio * 100) / 100;
}

async function performTransform(
  request: TransformRequest,
  signal: AbortSignal
): Promise<TransformResponse> {
  const startTime = performance.now();
  const { text, settings = {} } = request.payload;
  const rulesApplied: string[] = [];

  try {
    if (signal.aborted) {
      throw new Error('Transform cancelled');
    }

    let result = text;

    if (settings.length) {
      const lengthResult = applyLengthTransform(
        result,
        settings.length,
        settings.customLength
      );
      result = lengthResult.text;
      rulesApplied.push(lengthResult.rule);
    }

    if (settings.tone) {
      const toneResult = applyToneTransform(result, settings.tone);
      result = toneResult.text;
      rulesApplied.push(toneResult.rule);
    }

    if (settings.style) {
      const styleResult = applyStyleTransform(result, settings.style);
      result = styleResult.text;
      rulesApplied.push(styleResult.rule);
    }

    const changeRatio = calculateChangeRatio(text, result);

    const elapsedMs = performance.now() - startTime;

    return {
      id: request.id,
      status: 'ok',
      result: {
        text: result,
        rulesApplied,
        changeRatio,
      },
      timing: { elapsedMs },
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

async function performAnalyze(
  request: TransformRequest,
  signal: AbortSignal
): Promise<AnalyzeResponse> {
  const startTime = performance.now();
  const { text } = request.payload;

  try {
    if (signal.aborted) {
      throw new Error('Analysis cancelled');
    }

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);

    const freq: Record<string, number> = {};
    words.forEach(w => {
      freq[w] = (freq[w] || 0) + 1;
    });

    const keywords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const summary = sentences.slice(0, 2).join(' ').trim();

    const avgWordsPerSentence =
      sentences.length > 0 ? words.length / sentences.length : 0;
    const score = Math.min(100, Math.round(avgWordsPerSentence * 10));

    return {
      id: request.id,
      status: 'ok',
      result: {
        keywords,
        summary,
        score,
      },
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

self.onmessage = async (event: MessageEvent<TransformRequest>) => {
  const request = event.data;

  const controller = new AbortController();
  activeAbortControllers.set(request.id, controller);

  const timeoutId = setTimeout(() => {
    controller.abort();
    activeAbortControllers.delete(request.id);
  }, TIMEOUT_MS);

  try {
    let response: TransformResponse | AnalyzeResponse;

    if (request.type === 'transform') {
      response = await performTransform(request, controller.signal);
    } else if (request.type === 'analyze') {
      response = await performAnalyze(request, controller.signal);
    } else {
      response = {
        id: request.id,
        status: 'err',
        error: 'Unknown request type',
        timing: { elapsedMs: 0 },
      };
    }

    self.postMessage(response);
  } finally {
    clearTimeout(timeoutId);
    activeAbortControllers.delete(request.id);
  }
};

self.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.type === 'cancel' && event.data?.id) {
    const controller = activeAbortControllers.get(event.data.id);
    if (controller) {
      controller.abort();
      activeAbortControllers.delete(event.data.id);
    }
  }
});
