import { GoogleGenAI } from '@google/genai';
import type { RiskEvaluationInput, RiskEvaluationResult } from '../src/types';

export const GEMINI_MODEL = 'gemini-3.8-flash';

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim() && key !== 'MY_GEMINI_API_KEY');
}

export async function generateRiskExplanation(params: {
  input: RiskEvaluationInput;
  evaluation: RiskEvaluationResult;
  aiEnabled: boolean;
}): Promise<{
  explanation: string;
  provider: 'gemini' | 'deterministic_fallback';
}> {
  const { input, evaluation, aiEnabled } = params;

  if (!aiEnabled || !isGeminiConfigured()) {
    return {
      explanation: evaluation.fallback_explanation,
      provider: 'deterministic_fallback',
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const activeFactors = evaluation.risk_factors
      .filter((f) => f.points > 0)
      .map((f) => `- ${f.label}: ${f.points}/${f.maxPoints} pts (${f.detail})`)
      .join('\n');

    const prompt = [
      'Explain the following deterministic payment risk assessment for a merchant compliance analyst.',
      `Transaction Amount: ${input.currency} ${input.amount.toFixed(2)}`,
      `Customer Identifier: ${input.customer_id}`,
      `Payment Status: ${input.status}`,
      `Deterministic Risk Score: ${evaluation.risk_score}/100 (${evaluation.risk_category})`,
      `Recommended Action: ${evaluation.recommended_action}`,
      'Triggered Risk Factors:',
      activeFactors || '- None (routine baseline activity)',
      '',
      'Strict rules:',
      '1. Write 2 to 3 clear, concise sentences in plain English.',
      '2. Explain ONLY the provided score and triggered factors—never modify the score or invent external details.',
      '3. Never claim fraud is confirmed; state clearly that the score is a decision-support signal requiring human judgment.',
      '4. Do not speculate on protected personal characteristics.',
    ].join('\n');

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          'You are a careful fintech payment-risk explainer. You translate deterministic risk-scoring factors into clear, neutral, non-accusatory decision-support summaries for merchant analysts.',
      },
    });

    const text = response.text?.trim();
    if (!text) {
      return {
        explanation: evaluation.fallback_explanation,
        provider: 'deterministic_fallback',
      };
    }

    return {
      explanation: text,
      provider: 'gemini',
    };
  } catch (err) {
    console.warn('[Gemini] Falling back to deterministic explanation:', err instanceof Error ? err.message : 'API error');
    return {
      explanation: evaluation.fallback_explanation,
      provider: 'deterministic_fallback',
    };
  }
}
