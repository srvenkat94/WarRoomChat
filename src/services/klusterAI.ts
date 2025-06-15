import OpenAI from 'openai';

// Initialize Kluster.ai client
const client = new OpenAI({
  apiKey: "ad5035ae-9f71-49c0-9c4b-0249752fceb4",
  baseURL: "https://api.kluster.ai/v1",
  dangerouslyAllowBrowser: true
});

export class KlusterAIService {
  private static instance: KlusterAIService;
  
  static getInstance(): KlusterAIService {
    if (!KlusterAIService.instance) {
      KlusterAIService.instance = new KlusterAIService();
    }
    return KlusterAIService.instance;
  }

  async generateResponse(
    messages: Array<{role: 'user' | 'assistant', content: string}>,
    roomName: string
  ): Promise<string> {
    try {
      console.log('🤖 Generating AI response for room:', roomName);
      console.log('📝 Message history:', messages);

      const systemPrompt = `You are an AI assistant in ChatMind, a collaborative chat platform. You're participating in a room called "${roomName}".

INSTRUCTIONS:
- Be helpful, collaborative, and concise (keep responses under 200 words)
- Stay focused on topics related to this room: "${roomName}"
- Use a friendly, professional tone
- Help facilitate productive discussions and decision-making
- When users mention @AI, respond directly to their request
- If asked about unrelated topics, politely redirect them back to the room's purpose

Remember: You should focus on topics relevant to "${roomName}". Keep your responses concise and helpful.`;

      // Set a timeout for the API call
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI response timeout')), 20000); // 20 second timeout
      });

      const completionPromise = client.chat.completions.create({
        model: "klusterai/Meta-Llama-3.1-8B-Instruct-Turbo",
        max_tokens: 300,
        temperature: 0.7,
        top_p: 1,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-5) // Only use last 5 messages for context
        ]
      });

      console.log('⏳ Waiting for AI response...');
      const completion = await Promise.race([completionPromise, timeoutPromise]);

      const response = completion.choices[0]?.message?.content || "I apologize, but I couldn't generate a response at this time.";
      console.log('✅ AI response generated:', response);
      return response;
      
    } catch (error) {
      console.error('❌ Kluster.ai API Error:', error);
      
      // Return a helpful fallback message based on error type
      if (error instanceof Error && error.message === 'AI response timeout') {
        console.warn('⏰ AI response timed out');
        return "I'm taking a bit longer than usual to respond. Let me try to help you quickly - could you please rephrase your question?";
      }
      
      // Check for network errors
      if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('network'))) {
        console.warn('🌐 Network error detected');
        return "I'm having network connectivity issues right now. Please try mentioning @AI again in a moment!";
      }
      
      // Check for API errors
      if (error instanceof Error && error.message.includes('401')) {
        console.warn('🔑 API authentication error');
        return "I'm having authentication issues with my AI service. Please try again later or contact support if this persists.";
      }
      
      console.warn('🔧 Generic AI error, returning fallback message');
      return "I'm having trouble connecting to my AI service right now. Please try mentioning @AI again in a moment, or feel free to continue your conversation - I'll be back soon!";
    }
  }

  // Add a test method to verify the service is working
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔍 Testing AI connection...');
      
      const testPromise = client.chat.completions.create({
        model: "klusterai/Meta-Llama-3.1-8B-Instruct-Turbo",
        max_tokens: 50,
        temperature: 0.7,
        messages: [
          { role: "user", content: "Hello, can you respond with 'AI service is working'?" }
        ]
      });

      // Set a shorter timeout for connection test
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection test timeout')), 8000); // 8 second timeout
      });

      const testCompletion = await Promise.race([testPromise, timeoutPromise]);
      const response = testCompletion.choices[0]?.message?.content;
      console.log('✅ AI test response:', response);
      return !!response;
    } catch (error) {
      console.error('❌ AI test connection failed:', error);
      return false;
    }
  }

  // Add a method to check API status
  async checkAPIStatus(): Promise<{ working: boolean; message: string }> {
    try {
      const isWorking = await this.testConnection();
      if (isWorking) {
        return { working: true, message: "AI service is operational" };
      } else {
        return { working: false, message: "AI service test failed" };
      }
    } catch (error) {
      return { 
        working: false, 
        message: `AI service error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}

export const klusterAI = KlusterAIService.getInstance();