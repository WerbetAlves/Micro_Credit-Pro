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

const extractOpenAiText = (output: any[] = []) => {
  return output
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text)
    .join('\n')
    .trim();
};

const formatOpenAiMessageContent = (message: MessageHistoryItem) => {
  const contentType = message.role === 'assistant' ? 'output_text' : 'input_text';

  return [{ type: contentType, text: message.content }];
};

const buildOpenAiPayload = (body: AiRequest, env: Record<string, string | undefined>) => {
  const payload: Record<string, unknown> = {
    model: env.OPENAI_MODEL || 'gpt-4.1-mini',
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
        content: formatOpenAiMessageContent(message),
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

  return payload;
};

const extractGeminiText = (data: any) => {
  return (data.candidates || [])
    .flatMap((candidate: any) => candidate.content?.parts || [])
    .map((part: any) => part.text || '')
    .join('\n')
    .trim();
};

const extractGeminiFunctionCall = (data: any) => {
  return (data.candidates || [])
    .flatMap((candidate: any) => candidate.content?.parts || [])
    .find((part: any) => part.functionCall)?.functionCall;
};

const buildGeminiContents = (body: AiRequest) => {
  if (body.mode === 'text') {
    return [{ role: 'user', parts: [{ text: body.prompt || '' }] }];
  }

  if (body.mode === 'tool_result') {
    return [
      {
        role: 'user',
        parts: [
          {
            text: `Resultado da acao executada no sistema: ${body.toolResult}. Responda ao usuario de forma curta, clara e em Portugues-BR.`,
          },
        ],
      },
    ];
  }

  return [
    ...body.messages.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content || '' }],
    })),
    {
      role: 'user',
      parts: [{ text: body.userMessage || '' }],
    },
  ];
};

const callGemini = async (
  body: AiRequest,
  env: Record<string, string | undefined>,
  reason = 'fallback'
): Promise<AiResponse> => {
  const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI falhou e GEMINI_API_KEY nao esta configurada no backend.');
  }

  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: body.systemInstruction ? { parts: [{ text: body.systemInstruction }] } : undefined,
        contents: buildGeminiContents(body),
        tools: body.mode === 'message' && body.tools?.length
          ? [
              {
                functionDeclarations: body.tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.parameters,
                })),
              },
            ]
          : undefined,
      }),
    }
  );

  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : {};

  if (!response.ok) {
    throw new Error(data?.error?.message || 'Falha ao consultar o Gemini.');
  }

  const functionCall = extractGeminiFunctionCall(data);

  if (functionCall) {
    return {
      type: 'function_call',
      responseId: `gemini-${Date.now()}-${reason}`,
      functionCall: {
        id: `gemini-call-${Date.now()}`,
        name: functionCall.name,
        args: functionCall.args || {},
      },
    };
  }

  return {
    type: body.mode === 'text' ? 'text' : 'message',
    responseId: `gemini-${Date.now()}-${reason}`,
    text: extractGeminiText(data) || 'Nao houve resposta da IA.',
  };
};

const callOpenAi = async (body: AiRequest, env: Record<string, string | undefined>): Promise<AiResponse> => {
  const apiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY nao configurada no servidor.');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildOpenAiPayload(body, env)),
  });

  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : {};

  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Falha ao consultar a OpenAI.');
    (error as Error & { status?: number }).status = response.status;
    throw error;
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

  return {
    type: body.mode === 'text' ? 'text' : 'message',
    responseId: data.id,
    text: data.output_text?.trim() || extractOpenAiText(data.output || []) || 'Nao houve resposta da IA.',
  };
};

const shouldFallbackToGemini = (error: Error & { status?: number }) => {
  return [402, 403, 429].includes(error.status || 0) || error.message?.toLowerCase().includes('quota');
};

export async function handleAiRequest(body: AiRequest, env: Record<string, string | undefined>): Promise<AiResponse> {
  try {
    return await callOpenAi(body, env);
  } catch (error) {
    const typedError = error as Error & { status?: number };

    if (shouldFallbackToGemini(typedError)) {
      return callGemini(body, env, 'openai-quota');
    }

    throw error;
  }
}
