import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';

/**
 * Executes a promise with an enforced timeout.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Resilient Content Generator
 * Automatically fails over across Google Gemini 3.x models and Groq ('qwen/qwen3.8-27b', 'openai/gpt-oss-120b')
 * with strict timeouts to prevent freezing or hanging the Telegram bot.
 */
export async function safeGenerateContent(
  ai: GoogleGenAI,
  params: {
    model?: string;
    contents: any;
    config?: any;
  }
) {
  // 1. If Groq is available, use it FIRST for ultra-low latency (200-300ms)
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
    const groqModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];
    
    for (const gModel of groqModels) {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        let messages: any[] = [];
        
        if (params.config?.systemInstruction) {
          const sysText = typeof params.config.systemInstruction === 'string' 
            ? params.config.systemInstruction 
            : (params.config.systemInstruction.parts?.[0]?.text || String(params.config.systemInstruction));
          messages.push({ role: 'system', content: sysText });
        }

        if (typeof params.contents === 'string') {
          messages.push({ role: 'user', content: params.contents });
        } else if (Array.isArray(params.contents)) {
          params.contents.forEach((c: any) => {
            if (typeof c === 'string') {
              messages.push({ role: 'user', content: c });
            } else {
              const role = c.role === 'model' || c.role === 'assistant' ? 'assistant' : 'user';
              const textContent = Array.isArray(c.parts)
                ? c.parts.map((p: any) => p.text || '').join('\n')
                : (c.content || c.text || '');
              messages.push({ role, content: textContent });
            }
          });
        } else {
          messages.push({ role: 'user', content: String(params.contents) });
        }

        const isJson = params.config?.responseMimeType === 'application/json';
        const chatCompletion = await withTimeout(
          groq.chat.completions.create({
            messages: messages,
            model: gModel,
            temperature: params.config?.temperature || 0.3,
            response_format: isJson ? { type: 'json_object' } : undefined,
          }),
          3500,
          `Groq (${gModel}) timed out after 3500ms`
        );

        const outText = chatCompletion.choices[0]?.message?.content || '';
        if (outText.trim().length > 0) {
          return {
            text: outText,
            functionCalls: [],
          } as any;
        }
      } catch (groqErr: any) {
        console.warn(`[Resilience] Groq (${gModel}) failover:`, groqErr?.message || groqErr);
      }
    }
  }

  // 2. Failover to Google Gemini 3.6-flash / 3.8-flash with a 3-second timeout
  if (ai) {
    const candidateModels = [
      params.model || 'gemini-3.6-flash',
      'gemini-3.8-flash',
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    for (const currentModel of candidateModels) {
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            ...params,
            model: currentModel,
          }),
          3000,
          `Gemini (${currentModel}) timed out after 3000ms`
        );
        if (response && (response.text !== undefined || (response as any).candidates?.length)) {
          return response;
        }
      } catch (err: any) {
        console.warn(
          `[Resilience] ${currentModel} error or timeout (${err?.message || err}).`
        );
      }
    }
  }

  // Graceful fallback response if all AI calls fail
  console.error('[Resilience] All AI providers exhausted. Returning fallback response.');
  if (params.config?.responseMimeType === 'application/json') {
    return {
      text: JSON.stringify({
        category: 'CONVERSATION',
        isBookSearch: false,
        reply: 'I am here and ready to help! What business book, valuation, or reading path can I assist you with today?',
      }),
      functionCalls: [],
    } as any;
  }

  return {
    text: 'I am here and ready to assist! What business book, financial valuation, or reading path would you like to explore today?',
    functionCalls: [],
  } as any;
}


