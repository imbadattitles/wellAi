export interface ExtractedPage {
  page: number | null;
  text: string;
}

export interface ExtractedDocument {
  pages: ExtractedPage[];
}

export interface TextExtractionPort {
  extractPdf(data: Buffer): Promise<ExtractedDocument>;
}

export const TEXT_EXTRACTION = Symbol('TEXT_EXTRACTION');
