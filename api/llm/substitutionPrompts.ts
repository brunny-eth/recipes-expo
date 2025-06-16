import { formatMeasurement } from '../../utils/format';
import { PromptPayload } from './adapters';

export type IngredientChange = { from: string; to: string | null };

export function buildSubstitutionPrompt(
    originalInstructions: string[],
    substitutions: IngredientChange[],
): PromptPayload {

    const substitutionLines = substitutions.map(sub => {
        if (!sub.to || sub.to.trim() === '') {
            // derive simple alternative names (last word and grated form)
            const words = sub.from.split(' ');
            const base = words[words.length - 1];
            const altPhrases: string[] = [];
            if (base.toLowerCase() !== sub.from.toLowerCase()) altPhrases.push(base);
            altPhrases.push(`grated ${base}`);
            const altLine = altPhrases.length ? `\nALSO REMOVE if referred to as: ${altPhrases.map(a => `"${a}"`).join(', ')}` : '';
            return `REMOVE: "${sub.from}"${altLine}`;
        }
        return `REPLACE: "${sub.from}" → "${formatMeasurement(Number(sub.to)) || sub.to}"`;
    }).join('\n');

    const systemPrompt = `
    You are an expert recipe editor. Rewrite the cooking instructions to reflect the following ingredient changes.

    ${substitutionLines}

    Rules:
    1. For any ingredients marked REMOVE, eliminate all mentions/usages as if never present.
    2. For any ingredients marked REPLACE, update wording/preparation to use the substitute. Adjust timings/prep if needed.
    3. Preserve step order and DO NOT number the steps.
    4. Output natural instructions without phrases like "omit" or "instead"—just the corrected steps.

    Respond ONLY in valid JSON:
    { "rewrittenInstructions": [ ... ] }
    `;

    const userPrompt = `
    ORIGINAL_INSTRUCTIONS:
    ${originalInstructions.map(s => `- ${s}`).join('\n')}
    `;

    return {
        system: systemPrompt,
        text: userPrompt,
        isJson: true,
    };
} 