type ToolDefinition = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

type MessageHistoryItem = {
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
      messages: MessageHistoryItem[];
      userMessage: string;
      systemInstruction?: string;
      tools?: ToolDefinition[];
    }
  | {
      mode: 'tool_result';
      previousResponseId: string;
      toolCallId: string;
      toolResult: string;
      systemInstruction?: string;
    };

type AiResponse =
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

const extractText = (output: any[] = []) => {
  return output
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text)
    .join('\n')
    .trim();
};

const formatMessageContent = (message: MessageHistoryItem) => {
  const contentType = message.role === 'assistant' ? 'output_text' : 'input_text';

  return [{ type: contentType, text: message.content }];
};

export async function handleAiRequest(body: AiRequest, env: Record<string, string | undefined>): Promise<AiResponse> {
  const apiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY;
  const model = env.OPENAI_MODEL || 'gpt-4.1-mini';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada no servidor.');
  }

  let payload: Record<string, unknown> = {
    model,
  };

  if (body.systemInstruction) {
    payload.instructions = body.systemInstruction;
  }

  if (body.mode === 'text') {
    payload.input = body.prompt;
  }

  if (body.mode === 'message') {
    payload.input = [
      ...body.messages.map((message) => ({
        role: message.role,
        content: formatMessageContent(message),
      })),
      {
        role: 'user',
        content: [{ type: 'input_text', text: body.userMessage }],
      },
    ];

    if (body.tools?.length) {
      payload.tools = body.tools.map((tool) => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
    }
  }

  if (body.mode === 'tool_result') {
    payload.previous_response_id = body.previousResponseId;
    payload.input = [
      {
        type: 'function_call_output',
        call_id: body.toolCallId,
        output: body.toolResult,
      },
    ];
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : {};

  if (!response.ok) {
    throw new Error(data?.error?.message || 'Falha ao consultar a OpenAI.');
  }

  const functionCall = (data.output || []).find((item: any) => item.type === 'function_call');
  if (functionCall) {
    let parsedArgs: Record<string, unknown> = {};

    try {
      parsedArgs = functionCall.arguments ? JSON.parse(functionCall.arguments) : {};
    } catch {
      parsedArgs = {};
    }

    return {
      type: 'function_call',
      responseId: data.id,
      functionCall: {
        id: functionCall.call_id || functionCall.id,
        name: functionCall.name,
        args: parsedArgs,
      },
    };
  }

  const text = data.output_text?.trim() || extractText(data.output || []) || 'Não houve resposta da IA.';

  return {
    type: body.mode === 'text' ? 'text' : 'message',
    responseId: data.id,
    text,
  };
}
