import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export async function generateLoanContract(loanData: any, clientData: any, userData: any) {
  const prompt = `
    Como um sistema SaaS de gestão de crédito profissional, elabore um "CONTRATO DE EMPRÉSTIMO COM GARANTIA" (ou sem, se não houver) com validade jurídica simulada em português do Brasil.
    
    DADOS DO CREDOR (SaaS User):
    - Nome/Razão Social: ${userData?.business_name || userData?.full_name}
    - Documento: ${userData?.document_id}
    - Endereço: ${userData?.address}
    
    DADOS DO DEVEDOR (Cliente):
    - Nome: ${clientData?.full_name}
    - Documento: ${clientData?.document_id || 'Não informado'}
    
    DETALHES DO EMPRÉSTIMO:
    - Valor Principal: R$ ${loanData.principal_amount}
    - Taxa de Juros: ${loanData.interest_rate}% ${loanData.interest_type === 'monthly' ? 'ao mês' : 'ao ano'}
    - Prazo: ${loanData.term_months} meses
    - Valor da Parcela: R$ ${loanData.monthly_installment}
    - Total a Pagar: R$ ${loanData.total_repayment}
    - Garantia: ${loanData.guarantee_info ? `${loanData.guarantee_info.type} - ${loanData.guarantee_info.description}` : 'Nenhuma'}
    
    FORMATO DO CONTRATO:
    1. Título em negrito e centralizado.
    2. Cláusulas numeradas (Objeto, Pagamento, Juros, Mora, Garantia, Foro).
    3. Linguagem formal e jurídica.
    4. Espaço para assinaturas digitais.
    
    Retorne o texto formatado em Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating contract with Gemini:", error);
    return `CONTRATO DE EMPRÉSTIMO\n\nCredor: ${userData?.business_name}\nDevedor: ${clientData?.full_name}\nValor: R$ ${loanData.principal_amount}\n\n(Erro ao gerar contrato completo via IA. Por favor, tente novamente ou use um modelo padrão.)`;
  }
}
