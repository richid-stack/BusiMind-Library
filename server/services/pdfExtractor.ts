/**
 * PDF Text & Metadata Extractor for Telegram Book Assets
 * Extracts the first few pages (Title, Copyright, Table of Contents) of a PDF
 * so Gemini can deterministically identify the book regardless of its filename.
 */

export async function extractPdfSnippetFromBuffer(buffer: Buffer, maxPages: number = 4): Promise<string> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText({ first: maxPages });
    
    if (typeof (parser as any).destroy === 'function') {
      try {
        await (parser as any).destroy();
      } catch {
        // Ignore destroy error
      }
    }

    const rawText = result?.text || '';
    // Clean up excessive whitespace while preserving structure
    const cleaned = rawText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return cleaned.slice(0, 4000);
  } catch (err: any) {
    console.warn('[PDF Extractor] Error parsing PDF buffer:', err?.message || err);
    // Fallback: extract ASCII strings from buffer if PDF parser fails
    try {
      const ascii = buffer.toString('latin1').replace(/[^a-zA-Z0-9\s.,;:'"?!()-]/g, ' ');
      const words = ascii.split(/\s+/).filter((w) => w.length >= 3).slice(0, 500).join(' ');
      return words.slice(0, 3000);
    } catch {
      return '';
    }
  }
}

export async function extractPdfSnippetFromFileId(fileId: string): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !fileId) return null;

  try {
    // 1. Get file path from Telegram Bot API
    const fileMetaRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    if (!fileMetaRes.ok) return null;
    const fileMeta = await fileMetaRes.json() as any;
    if (!fileMeta.ok || !fileMeta.result?.file_path) return null;

    // 2. Download the file into buffer
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileMeta.result.file_path}`;
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) return null;

    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Extract text snippet
    const snippet = await extractPdfSnippetFromBuffer(buffer, 4);
    return snippet.length >= 20 ? snippet : null;
  } catch (err: any) {
    console.warn('[PDF Extractor] Could not download/extract snippet for fileId:', fileId, err?.message || err);
    return null;
  }
}
