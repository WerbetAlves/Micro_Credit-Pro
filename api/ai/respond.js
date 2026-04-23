const extractOpenAiText = (output = []) => {
  return output
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text)
    .join('\n')
    .trim();
};

const formatOpenAiMessageContent = (message) => {
  const contentType = message.role === 'assistant' ? 'output_text' : 'input_text';

  return [{ type: contentType, text: message.content }];
};

const buildOpenAiPayload = (body, env) => {
  const payload = {
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
      ...(body.messages || []).map((message) => ({
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

const extractGeminiText = (data) => {
  return (data.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || '')
    .join('\n')
    .trim();
};

const extractGeminiFunctionCall = (data) => {
  return (data.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .find((part) => part.functionCall)?.functionCall;
};

const buildGeminiContents = (body) => {
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
    ...(body.messages || []).map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content || '' }],
    })),
    {
      role: 'user',
      parts: [{ text: body.userMessage || '' }],
    },
  ];
};

const callGemini = async (body, env, reason = 'fallback') => {
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

const callOpenAi = async (body, env) => {
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY nao configurada no Vercel.');
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
    error.status = response.status;
    throw error;
  }

  const functionCall = (data.output || []).find((item) => item.type === 'function_call');

  if (functionCall) {
    let parsedArgs = {};

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

const shouldFallbackToGemini = (error) => {
  return [402, 403, 429].includes(error.status) || error.message?.toLowerCase().includes('quota');
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const aiResponse = await callOpenAi(body, process.env).catch((error) => {
      if (shouldFallbackToGemini(error)) {
        return callGemini(body, process.env, 'openai-quota');
      }

      throw error;
    });

    res.status(200).json(aiResponse);
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Falha ao processar a requisicao da IA.',
    });
  }
}
