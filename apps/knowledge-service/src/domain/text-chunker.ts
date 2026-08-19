export interface TextSegment {
  text: string;
  page: number | null;
  heading: string | null;
}

export interface ChunkContent {
  text: string;
  page: number | null;
  heading: string | null;
  tokenCount: number;
}

export interface TextChunkerOptions {
  maxWords?: number;
  overlapWords?: number;
}

export class TextChunker {
  constructor(
    private readonly defaultMaxWords = 700,
    private readonly defaultOverlapWords = 80,
  ) {}

  chunk(segments: TextSegment[], options: TextChunkerOptions = {}): ChunkContent[] {
    const maxWords = options.maxWords ?? this.defaultMaxWords;
    const overlapWords = options.overlapWords ?? this.defaultOverlapWords;

    if (maxWords < 1 || overlapWords < 0 || overlapWords >= maxWords) {
      throw new Error('Chunking requires maxWords > overlapWords >= 0');
    }

    const chunks: ChunkContent[] = [];

    for (const segment of segments) {
      const normalized = segment.text.replace(/\s+/g, ' ').trim();
      if (!normalized) continue;

      const words = normalized.split(' ');
      let start = 0;

      while (start < words.length) {
        const end = Math.min(start + maxWords, words.length);
        const chunkWords = words.slice(start, end);
        chunks.push({
          text: chunkWords.join(' '),
          page: segment.page,
          heading: segment.heading,
          tokenCount: chunkWords.length,
        });

        if (end === words.length) break;
        start = end - overlapWords;
      }
    }

    return chunks;
  }
}
