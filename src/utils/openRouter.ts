interface OpenRouterConfig {
    apiKey: string;
    baseURL?: string;
}

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ChatCompletion {
    choices: Array<{
        message: ChatMessage;
    }>;
}

export class OpenRouterClient {
    private apiKey: string;
    private baseURL: string;

    constructor(config: OpenRouterConfig) {
        this.apiKey = config.apiKey;
        this.baseURL = config.baseURL || 'https://openrouter.ai/api/v1';
    }

    async generateComment(postContent: string, styleGuide: string): Promise<string> {
        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': 'https://linkedin-auto-commenter.com',
                    'X-Title': 'LinkedIn Auto Commenter',
                },
                body: JSON.stringify({
                    model: 'google/gemini-2.0-flash-exp:free',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a LinkedIn comment generator. Generate concise but engaging comments for LinkedIn posts. Style guide: ${styleGuide}. Keep comments professional yet conversational, under 100 words, and avoid generic responses.`
                        },
                        {
                            role: 'user',
                            content: `Generate a thoughtful comment for this LinkedIn post: ${postContent}`
                        }
                    ],
                    max_tokens: 150,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data: ChatCompletion = await response.json();
            return data.choices[0]?.message?.content || 'Great post! Thanks for sharing.';
        } catch (error) {
            console.error('Error generating comment:', error);
            return 'Great post! Thanks for sharing.';
        }
    }
} 