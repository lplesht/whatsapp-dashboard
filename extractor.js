const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const SYSTEM_PROMPT = `You extract calendar events from Hebrew (or English) WhatsApp messages sent in parent/school/kindergarten groups.

Return ONLY a JSON object, no other text, no markdown fences:
{"is_event": boolean, "title": string|null, "date": string|null, "time": string|null, "location": string|null}

Rules:
- "date" must be ISO format YYYY-MM-DD if a specific date is mentioned or can be inferred from context (e.g. "next Tuesday" needs the message date to resolve — if you can't resolve it confidently, return null for date but keep is_event true if it's clearly an event).
- If the message is not about a specific event (e.g. general chit-chat, a question, a reminder with no date), return {"is_event": false, "title": null, "date": null, "time": null, "location": null}.
- Keep "title" short and in the same language as the message.`;

/**
 * Sends one message to Claude for extraction. Returns a parsed
 * event object or null if the message isn't an event.
 */
async function extractEvent(text, messageDateISO) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Message date (for resolving relative dates like "tomorrow"): ${messageDateISO}\n\nMessage:\n${text}`,
      },
    ],
  });

  const raw = response.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim()
    .replace(/^```json\s*|```$/g, '');

  try {
    const parsed = JSON.parse(raw);
    return parsed.is_event ? parsed : null;
  } catch (err) {
    console.error('Failed to parse extraction response:', raw);
    return null;
  }
}

module.exports = { extractEvent };
