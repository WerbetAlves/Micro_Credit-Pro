export type AiToolDefinition = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AiRequest =
  | {
      mode: 'text';
      prompt: string;
      systemInstruction?: string;
    }
  | {
      mode: 'message';
      messages: ChatMessage[];
      userMessage: string;
      systemInstruction?: string;
      tools?: AiToolDefinition[];
    }
  | {
      mode: 'tool_result';
      previousResponseId: string;
      toolCallId: string;
      toolResult: string;
      systemInstruction?: string;
    };

export type AiResponse =
  | {
      type: 'text' | 'message';
      responseId: string;
      text: string;
    }
  | {
      type: 'function_call';
      responseId: string;
      functionCall: {
        id: string;
        name: string;
        args: Record<string, unknown>;
      };
    };

export async function requestAi(body: AiRequest): Promise<AiResponse> {
  const response = await fetch('/api/ai/respond', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Falha ao consultar o backend da IA.');
  }

  return data as AiResponse;
}
