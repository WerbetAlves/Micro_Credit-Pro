const extractText = (output = []) => {
  return output
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text)
    .join('\n')
    .trim();
};

const buildPayload = (body, env) => {
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
        content: [{ type: 'input_text', text: message.content }],
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      res.status(500).json({ error: 'OPENAI_API_KEY nao configurada no Vercel.' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const payload = buildPayload(body, process.env);

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await openAiResponse.text();
    const data = rawText ? JSON.parse(rawText) : {};

    if (!openAiResponse.ok) {
      res.status(openAiResponse.status).json({
        error: data?.error?.message || 'Falha ao consultar a OpenAI.',
      });
      return;
    }

    const functionCall = (data.output || []).find((item) => item.type === 'function_call');

    if (functionCall) {
      let parsedArgs = {};

      try {
        parsedArgs = functionCall.arguments ? JSON.parse(functionCall.arguments) : {};
      } catch {
        parsedArgs = {};
      }

      res.status(200).json({
        type: 'function_call',
        responseId: data.id,
        functionCall: {
          id: functionCall.call_id || functionCall.id,
          name: functionCall.name,
          args: parsedArgs,
        },
      });
      return;
    }

    res.status(200).json({
      type: body.mode === 'text' ? 'text' : 'message',
      responseId: data.id,
      text: data.output_text?.trim() || extractText(data.output || []) || 'Nao houve resposta da IA.',
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Falha ao processar a requisicao da IA.',
    });
  }
}
