import pdfParse from 'pdf-parse';
import { InvalidDocumentError } from '../../domain/errors';
import {
  ExtractedDocument,
  ExtractedPage,
  TextExtractionPort,
} from '../../ports/text-extraction.port';

interface PdfTextItem {
  str?: string;
}

interface PdfPageData {
  getTextContent(options: {
    normalizeWhitespace: boolean;
    disableCombineTextItems: boolean;
  }): Promise<{ items: PdfTextItem[] }>;
}

export class PdfParseTextExtractorAdapter implements TextExtractionPort {
  async extractPdf(data: Buffer): Promise<ExtractedDocument> {
    const pages: ExtractedPage[] = [];

    try {
      const parsed = await pdfParse(data, {
        pagerender: async (pageData: PdfPageData) => {
          const content = await pageData.getTextContent({
            normalizeWhitespace: true,
            disableCombineTextItems: false,
          });
          const text = content.items
            .map((item) => (typeof item.str === 'string' ? item.str : ''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          pages.push({ page: pages.length + 1, text });
          return text;
        },
      });

      if (pages.length === 0 && parsed.text.trim()) {
        pages.push({ page: null, text: parsed.text });
      }
      return { pages };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown PDF parsing error';
      throw new InvalidDocumentError(`The PDF could not be parsed: ${message}`);
    }
  }
}
