import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, LogOut } from "lucide-react";

export default function RedacaoHome() {
  const [user, setUser] = useState(null);
  const [criteriaInput, setCriteriaInput] = useState("C1: Adequação ao Tema e Gênero (30 pts)\nC2: Coerência e Progressão Argumentativa (40 pts)\nC3: Domínio da Norma Culta (30 pts)\nTotal: 100 pontos");
  const [redactionInput, setRedactionInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [recourseInput, setRecourseInput] = useState("");
  const [showRealRecourseModal, setShowRealRecourseModal] = useState(false);
  const [realRedaction, setRealRedaction] = useState("");
  const [bankScore, setBankScore] = useState("");
  const [bankParecer, setBankParecer] = useState("");
  const [alertMessage, setAlertMessage] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const isAdmin = user?.email === "rafaelsalesgelim@gmail.com";

  const showAlert = (message, isSuccess = true) => {
    setAlertMessage({ message, isSuccess });
    setTimeout(() => setAlertMessage(null), 3000);
  };

  const handleLogout = async () => {
    await base44.auth.logout(createPageUrl("Home"));
  };

  const handleFileUpload = async (file, targetSetter) => {
    if (!file) return;

    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            texto_completo: {
              type: "string",
              description: "Todo o texto extraído do documento, preservando parágrafos e quebras de linha"
            }
          }
        }
      });

      if (result.status === 'success' && result.output?.texto_completo) {
        const textoFormatado = result.output.texto_completo
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .trim();
        
        targetSetter(textoFormatado);
        showAlert("Arquivo processado com sucesso!", true);
      } else {
        showAlert("Não foi possível extrair o texto do arquivo. Por favor, cole o texto manualmente.", false);
      }
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      showAlert("Erro ao processar arquivo: " + error.message, false);
    } finally {
      setUploadingFile(false);
    }
  };

  const analyzeRedactionWithAI = async () => {
    if (!criteriaInput.trim()) {
      showAlert("Por favor, cole os critérios do Edital (Competências e Pontuações) antes de analisar.", false);
      return;
    }

    if (!redactionInput.trim()) {
      showAlert("Por favor, digite ou cole a redação no campo 'Folha de Caderno'.", false);
      return;
    }

    setAnalyzing(true);
    setAnalysisResult(null);

    try {
      const systemPrompt = `Você é um avaliador de redação ALTAMENTE RIGOROSO, TÉCNICO e IMPARCIAL, com profundo conhecimento em correção de redações de concursos públicos.

IMPORTANTE: Sua análise DEVE ser baseada ESTRITAMENTE nos critérios do edital fornecidos abaixo. Cada ponto atribuído deve estar JUSTIFICADO pelos critérios específicos do edital.

--- CRITÉRIOS OFICIAIS DO EDITAL ---
${criteriaInput}
---

INSTRUÇÕES PARA ANÁLISE:
1. Leia ATENTAMENTE cada critério do edital e sua pontuação máxima
2. Analise a redação item por item, comparando com os critérios do edital
3. Seja RIGOROSO: só atribua pontuação se o critério estiver claramente atendido
4. Quando identificar problemas, cite ESPECIFICAMENTE o que está errado
5. Quando possível, cite referências técnicas relevantes:
   - Para questões de língua portuguesa: cite gramáticas (Bechara, Cunha & Cintra)
   - Para questões de direito: cite códigos e leis específicas quando aplicável
   - Para questões de raciocínio lógico: cite princípios técnicos
6. Sua pontuação DEVE refletir EXATAMENTE o que o edital exige

REDAÇÃO A SER AVALIADA:
${redactionInput}

Analise profundamente e forneça uma correção técnica, precisa e fundamentada.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: systemPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            notaFinal: { 
              type: "number", 
              description: "A nota preditiva final baseada ESTRITAMENTE nos critérios do edital." 
            },
            parecerGeral: { 
              type: "string", 
              description: "Um resumo técnico e profissional do desempenho, relacionando com os critérios do edital." 
            },
            analiseDetalhada: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  criterio: { 
                    type: "string",
                    description: "Nome exato do critério conforme edital"
                  },
                  pontuacaoMaxima: {
                    type: "number",
                    description: "Pontuação máxima deste critério conforme edital"
                  },
                  pontuacaoAtribuida: { 
                    type: "number",
                    description: "Pontuação atribuída neste critério"
                  },
                  justificativa: { 
                    type: "string",
                    description: "Justificativa TÉCNICA e DETALHADA, citando especificamente o que foi avaliado"
                  },
                  referenciasTecnicas: {
                    type: "array",
                    items: { type: "string" },
                    description: "Referências técnicas, bibliográficas ou legais que fundamentam a avaliação (quando aplicável)"
                  }
                }
              }
            },
            sugestaoRecurso: { 
              type: "string", 
              description: "Sugestão de um ponto fraco da análise para o usuário tentar recurso." 
            }
          }
        }
      });

      setAnalysisResult(response);
      showAlert(`Análise Preditiva concluída! Nota Estimada: ${response.notaFinal.toFixed(1)}/100.`, true);
    } catch (error) {
      console.error("Erro na análise:", error);
      showAlert("Ocorreu um erro ao processar a análise preditiva.", false);
    } finally {
      setAnalyzing(false);
    }
  };

  const submitRecourse = async () => {
    if (recourseInput.trim().length < 50) {
      showAlert("Seu recurso deve ter pelo menos 50 caracteres para ser submetido.", false);
      return;
    }

    if (!analysisResult) {
      showAlert("Não há análise prévia para recorrer.", false);
      return;
    }

    setAnalyzing(true);

    try {
      const reconsiderationPrompt = `Você é um avaliador de redação que está reconsiderando sua análise após receber um recurso do candidato.

ANÁLISE ORIGINAL:
- Nota atribuída: ${analysisResult.notaFinal}/100
- Parecer geral: ${analysisResult.parecerGeral}
- Análise detalhada: ${JSON.stringify(analysisResult.analiseDetalhada)}

CRITÉRIOS DO EDITAL:
${criteriaInput}

REDAÇÃO AVALIADA:
${redactionInput}

ARGUMENTAÇÃO DO CANDIDATO NO RECURSO:
${recourseInput}

Analise cuidadosamente a argumentação do candidato. Você deve:
1. Verificar se os pontos levantados pelo candidato têm fundamento
2. Revisar sua análise original à luz dos argumentos apresentados
3. Decidir se mantém a nota ou se a recalcula
4. Ser honesto e transparente na sua decisão

Forneça uma resposta profissional e fundamentada.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: reconsiderationPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            decisao: {
              type: "string",
              enum: ["MANTIDA", "ALTERADA"],
              description: "Se a nota foi mantida ou alterada após o recurso"
            },
            novaNotaFinal: {
              type: "number",
              description: "A nova nota final (pode ser igual à anterior se mantida)"
            },
            justificativaDecisao: {
              type: "string",
              description: "Explicação detalhada da decisão tomada"
            },
            pontosAceitos: {
              type: "array",
              items: { type: "string" },
              description: "Quais argumentos do candidato foram aceitos"
            },
            pontosRejeitados: {
              type: "array",
              items: { type: "string" },
              description: "Quais argumentos do candidato foram rejeitados"
            }
          }
        }
      });

      setAnalysisResult({
        ...analysisResult,
        notaFinal: response.novaNotaFinal,
        reconsideracao: response
      });

      if (response.decisao === "MANTIDA") {
        showAlert(`Recurso analisado. Nota mantida em ${response.novaNotaFinal.toFixed(1)}/100.`, true);
      } else {
        showAlert(`Recurso aceito! Nova nota: ${response.novaNotaFinal.toFixed(1)}/100 (anterior: ${analysisResult.notaFinal.toFixed(1)}).`, true);
      }

      setRecourseInput("");
    } catch (error) {
      console.error("Erro ao processar recurso:", error);
      showAlert("Erro ao processar seu recurso. Tente novamente.", false);
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeRealRecourse = async () => {
    if (!realRedaction.trim() || !bankScore.trim() || !bankParecer.trim() || !criteriaInput.trim()) {
      showAlert("Preencha todos os campos do formulário e os Critérios do Edital no painel principal.", false);
      return;
    }

    setShowRealRecourseModal(false);
    setAnalyzing(true);
    setAnalysisResult(null);

    try {
      const recoursePrompt = `Você é um especialista em análise de recursos contra bancas examinadoras de concursos públicos. Sua tarefa é fazer uma análise CIRÚRGICA, PROFISSIONAL e REALISTA do cenário apresentado.

CRITÉRIOS OFICIAIS DO EDITAL:
${criteriaInput}

REDAÇÃO COMPLETA DO CANDIDATO:
${realRedaction}

NOTA ATRIBUÍDA PELA BANCA: ${bankScore}/100

PARECER OFICIAL DA BANCA:
${bankParecer}

Você deve realizar uma análise PROFUNDA e TÉCNICA, considerando:

1. ANÁLISE TÉCNICA DOS CRITÉRIOS:
   - Compare rigorosamente a redação com cada critério do edital
   - Identifique EXATAMENTE onde a banca pode ter errado ou sido injusta
   - Avalie se a pontuação da banca está coerente com os critérios

2. PONTOS FORTES DO RECURSO:
   - Identifique os argumentos MAIS FORTES que o candidato pode usar
   - Cite ESPECIFICAMENTE trechos da redação que comprovem seu ponto
   - Fundamente TECNICAMENTE cada argumento

3. PONTOS FRACOS DA CORREÇÃO DA BANCA:
   - Identifique INCONSISTÊNCIAS no parecer da banca
   - Aponte onde a banca pode ter sido SUBJETIVA demais
   - Mostre onde os critérios não foram aplicados corretamente

4. ESTRATÉGIA DE RECURSO:
   - Defina UMA estratégia principal e CLARA
   - Priorize os argumentos com MAIOR chance de sucesso
   - Seja ESPECÍFICO sobre como redigir o recurso

5. NOTA REALISTA PÓS-RECURSO:
   - Baseie-se em conhecimento REAL de como bancas reavaliam
   - Seja CONSERVADOR mas JUSTO na projeção
   - Explique POR QUE essa nota é viável

IMPORTANTE: Seja HONESTO. Se não há base para recurso, diga claramente. Se há, seja PRECISO e PROFISSIONAL.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: recoursePrompt,
        response_json_schema: {
          type: "object",
          properties: {
            temBaseParaRecurso: {
              type: "boolean",
              description: "Se existe base sólida para recurso"
            },
            chanceSucesso: {
              type: "string",
              enum: ["BAIXA", "MÉDIA", "ALTA", "MUITO ALTA"],
              description: "Avaliação realista da chance de sucesso"
            },
            analiseDetalhada: {
              type: "object",
              properties: {
                pontosFortes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      criterio: { type: "string" },
                      argumentacao: { type: "string" },
                      trechoRedacao: { type: "string" }
                    }
                  }
                },
                errosDaBanca: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      erro: { type: "string" },
                      impactoNaNota: { type: "number" }
                    }
                  }
                }
              }
            },
            estrategiaRecurso: {
              type: "object",
              properties: {
                focoPrincipal: { type: "string" },
                argumentoChave: { type: "string" },
                fundamentacaoTecnica: { type: "string" }
              }
            },
            projecaoNota: {
              type: "object",
              properties: {
                notaAtual: { type: "number" },
                notaEstimadaPosRecurso: { type: "number" },
                ganhoEstimado: { type: "number" },
                justificativaProjecao: { type: "string" }
              }
            },
            recomendacaoFinal: {
              type: "string",
              description: "Recomendação profissional se vale a pena ou não entrar com recurso"
            }
          }
        }
      });

      setAnalysisResult({
        isRecourseAnalysis: true,
        bankScore: parseFloat(bankScore),
        ...response
      });

      if (response.temBaseParaRecurso) {
        showAlert(`Análise de Recurso concluída! Chance de sucesso: ${response.chanceSucesso}.`, true);
      } else {
        showAlert(`Análise concluída: Recurso NÃO recomendado neste caso.`, false);
      }
    } catch (error) {
      console.error("Erro na análise de recurso:", error);
      showAlert("Ocorreu um erro ao processar a análise de recurso.", false);
    } finally {
      setAnalyzing(false);
    }
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #007BFF', borderRadius: '50%', width: '48px', height: '48px', animation: 'spin 1s linear infinite' }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#121212', color: '#E0E0E0', minHeight: '100vh', padding: '20px' }}>
      <style>{`
        .caderno-textarea {
          min-height: 500px;
          background-color: #282a36;
          background-image: repeating-linear-gradient(
            #44475a 0, 
            #44475a 1px, 
            transparent 1px, 
            transparent 22px
          );
          background-position: 0 10px;
          background-repeat: repeat-y;
          line-height: 22px;
          padding: 10px 15px 10px 40px;
          border-left: 3px solid #007BFF;
          font-family: 'Courier New', monospace;
          white-space: pre-wrap;
          overflow-wrap: break-word;
          font-size: 1.05rem;
          width: 100%;
          border: 1px solid #333333;
          borderRadius: 5px;
          color: #E0E0E0;
          resize: vertical;
        }
        .caderno-textarea:focus {
          border-color: #007BFF;
          outline: none;
          box-shadow: 0 0 5px rgba(0, 123, 255, 0.5);
        }
      `}</style>

      <header style={{ borderBottom: '2px solid #333333', paddingBottom: '10px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <button
            onClick={() => navigate(createPageUrl('SystemSelector'))}
            style={{ backgroundColor: '#555', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
            Voltar aos Sistemas
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {isAdmin && (
              <button
                onClick={() => navigate(createPageUrl('AdminDashboardRedacoes'))}
                style={{ backgroundColor: '#f7931e', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600' }}
              >
                Painel Admin
              </button>
            )}
            <span style={{ color: '#aaa', fontSize: '0.9rem' }}>
              {user.full_name || user.email}
            </span>
            <button
              onClick={handleLogout}
              style={{ backgroundColor: '#dc3545', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <LogOut style={{ width: '14px', height: '14px' }} />
              Sair
            </button>
          </div>
        </div>
        <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#007BFF' }}>
          Visão do Aprovado - Análise de Redação IA
        </div>
        <p style={{ color: '#aaa' }}>Simulação preditiva de nota de redação baseada em critérios de edital.</p>
      </header>

      <main style={{ display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
          <h2 style={{ color: '#4a90e2', marginBottom: '20px', fontSize: '1.5rem' }}>1. Dados para Análise da IA</h2>

          <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)', marginBottom: '20px' }}>
            <h3>Critérios do Edital (Instrução para IA)</h3>
            <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
              Cole aqui os critérios de correção/edital (ex: competências e pontuação máxima):
            </label>
            <textarea
              value={criteriaInput}
              onChange={(e) => setCriteriaInput(e.target.value)}
              placeholder="Exemplo: C1 - Domínio da norma culta (30 pts); C2 - Argumentação (40 pts); C3 - Proposta de Intervenção (30 pts)."
              style={{ width: '100%', minHeight: '150px', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', fontSize: '1rem', resize: 'vertical' }}
            />

            <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
              OU Anexar Edital (PDF/Word):
            </label>
            <input
              type="file"
              accept=".pdf, .doc, .docx"
              onChange={(e) => handleFileUpload(e.target.files[0], setCriteriaInput)}
              disabled={uploadingFile}
              style={{ width: '100%', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', cursor: uploadingFile ? 'not-allowed' : 'pointer' }}
            />
            {uploadingFile && (
              <p style={{ padding: '10px', backgroundColor: '#38381e', color: '#ffc107', borderRadius: '5px', marginTop: '10px', fontSize: '0.9rem' }}>
                Processando arquivo...
              </p>
            )}
          </div>

          <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)', marginBottom: '20px' }}>
            <h3>Redação (Folha de Caderno)</h3>
            <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
              Digite ou cole sua redação abaixo:
            </label>
            <textarea
              className="caderno-textarea"
              value={redactionInput}
              onChange={(e) => setRedactionInput(e.target.value)}
              placeholder="Comece a digitar sua redação aqui. A IA usará este texto e os critérios do edital para a correção..."
            />

            <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
              Anexar Redação Escrita (Imagem/PDF/Word):
            </label>
            <input
              type="file"
              accept=".pdf, .doc, .docx, image/*"
              onChange={(e) => handleFileUpload(e.target.files[0], setRedactionInput)}
              disabled={uploadingFile}
              style={{ width: '100%', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', cursor: uploadingFile ? 'not-allowed' : 'pointer' }}
            />

            <button
              onClick={analyzeRedactionWithAI}
              disabled={analyzing || uploadingFile}
              style={{ width: '100%', padding: '12px 20px', border: 'none', borderRadius: '5px', cursor: (analyzing || uploadingFile) ? 'not-allowed' : 'pointer', fontSize: '1.1rem', fontWeight: '700', backgroundColor: (analyzing || uploadingFile) ? '#444' : '#28a745', color: 'white', marginTop: '20px', boxShadow: (analyzing || uploadingFile) ? 'none' : '0 4px 10px rgba(40, 167, 69, 0.3)', opacity: (analyzing || uploadingFile) ? 0.6 : 1 }}
            >
              {analyzing ? 'Analisando...' : uploadingFile ? 'Processando arquivo...' : 'Analisar Redação com IA'}
            </button>

            <button
              onClick={() => setShowRealRecourseModal(true)}
              disabled={uploadingFile}
              style={{ width: '100%', padding: '12px 20px', border: 'none', borderRadius: '5px', cursor: uploadingFile ? 'not-allowed' : 'pointer', fontSize: '1.1rem', fontWeight: '700', backgroundColor: '#f7931e', color: 'white', marginTop: '15px', opacity: uploadingFile ? 0.6 : 1 }}
            >
              Recurso Contra a Banca (Cenário Real)
            </button>
          </div>
        </div>

        <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
          <h2 style={{ color: '#4a90e2', marginBottom: '20px', fontSize: '1.5rem' }}>2. Parecer Analítico da IA</h2>

          <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)', marginBottom: '20px', minHeight: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: analyzing ? 'center' : 'flex-start', textAlign: analyzing || !analysisResult ? 'center' : 'left' }}>
            {analyzing ? (
              <div style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #007BFF', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '20px auto' }}></div>
            ) : !analysisResult ? (
              <p style={{ color: '#aaa' }}>Preencha os dados e clique em "Analisar Redação com IA" para gerar o parecer preditivo.</p>
            ) : analysisResult.isRecourseAnalysis ? (
              <div style={{ width: '100%' }}>
                <h3 style={{ color: '#f7931e', marginBottom: '15px', textAlign: 'center' }}>ANÁLISE PROFISSIONAL DE RECURSO</h3>
                <p style={{ color: '#aaa', marginBottom: '20px', textAlign: 'center' }}>
                  Nota da Banca: {analysisResult.bankScore}/100 | 
                  Base para Recurso: <strong style={{ color: analysisResult.temBaseParaRecurso ? '#28a745' : '#dc3545' }}>
                    {analysisResult.temBaseParaRecurso ? 'SIM' : 'NÃO'}
                  </strong>
                </p>

                {!analysisResult.temBaseParaRecurso ? (
                  <div style={{ backgroundColor: '#2A2A2A', padding: '15px', borderRadius: '5px', marginBottom: '15px', borderLeft: '5px solid #dc3545' }}>
                    <h4 style={{ color: '#dc3545', marginBottom: '10px', fontSize: '1.1rem' }}>⚠️ Recurso Não Recomendado</h4>
                    <p style={{ color: '#aaa', fontSize: '0.95rem', lineHeight: '1.6' }}>
                      {analysisResult.recomendacaoFinal}
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ backgroundColor: '#2A2A2A', padding: '15px', borderRadius: '5px', marginBottom: '15px', borderLeft: '5px solid #28a745' }}>
                      <h4 style={{ color: '#28a745', marginBottom: '10px', fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>✓ Chance de Sucesso</span>
                        <span style={{ color: '#4a90e2', fontWeight: 'bold', fontSize: '1.2rem' }}>
                          {analysisResult.chanceSucesso}
                        </span>
                      </h4>
                    </div>

                    <div style={{ backgroundColor: '#2A2A2A', padding: '15px', borderRadius: '5px', marginBottom: '15px', borderLeft: '5px solid #007BFF' }}>
                      <h4 style={{ color: '#007BFF', marginBottom: '10px', fontSize: '1.1rem' }}>🎯 Estratégia de Recurso</h4>
                      <div style={{ marginBottom: '10px' }}>
                        <strong style={{ color: '#4a90e2' }}>Foco Principal:</strong>
                        <p style={{ color: '#aaa', fontSize: '0.95rem', marginTop: '5px', lineHeight: '1.6' }}>
                          {analysisResult.estrategiaRecurso.focoPrincipal}
                        </p>
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <strong style={{ color: '#4a90e2' }}>Argumento Chave:</strong>
                        <p style={{ color: '#aaa', fontSize: '0.95rem', marginTop: '5px', lineHeight: '1.6' }}>
                          {analysisResult.estrategiaRecurso.argumentoChave}
                        </p>
                      </div>
                      <div>
                        <strong style={{ color: '#4a90e2' }}>Fundamentação Técnica:</strong>
                        <p style={{ color: '#aaa', fontSize: '0.95rem', marginTop: '5px', lineHeight: '1.6' }}>
                          {analysisResult.estrategiaRecurso.fundamentacaoTecnica}
                        </p>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#2A2A2A', padding: '15px', borderRadius: '5px', marginBottom: '15px', borderLeft: '5px solid #28a745' }}>
                      <h4 style={{ color: '#28a745', marginBottom: '10px', fontSize: '1.1rem' }}>💪 Pontos Fortes da Sua Redação</h4>
                      {analysisResult.analiseDetalhada.pontosFortes.map((ponto, idx) => (
                        <div key={idx} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: idx < analysisResult.analiseDetalhada.pontosFortes.length - 1 ? '1px solid #333' : 'none' }}>
                          <strong style={{ color: '#4a90e2', display: 'block', marginBottom: '5px' }}>
                            {ponto.criterio}
                          </strong>
                          <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '8px', lineHeight: '1.5' }}>
                            {ponto.argumentacao}
                          </p>
                          <div style={{ backgroundColor: '#1a1a1a', padding: '8px', borderRadius: '4px', fontStyle: 'italic', fontSize: '0.85rem', color: '#888' }}>
                            "{ponto.trechoRedacao}"
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ backgroundColor: '#2A2A2A', padding: '15px', borderRadius: '5px', marginBottom: '15px', borderLeft: '5px solid #dc3545' }}>
                      <h4 style={{ color: '#dc3545', marginBottom: '10px', fontSize: '1.1rem' }}>⚠️ Erros da Banca Identificados</h4>
                      {analysisResult.analiseDetalhada.errosDaBanca.map((erro, idx) => (
                        <div key={idx} style={{ marginBottom: '12px' }}>
                          <p style={{ color: '#aaa', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            {erro.erro}
                          </p>
                          <p style={{ color: '#4a90e2', fontSize: '0.85rem', marginTop: '5px' }}>
                            <strong>Impacto estimado:</strong> +{erro.impactoNaNota.toFixed(1)} pontos
                          </p>
                        </div>
                      ))}
                    </div>

                    <div style={{ backgroundColor: '#2A2A2A', padding: '15px', borderRadius: '5px', marginBottom: '15px', borderLeft: '5px solid #f7931e' }}>
                      <h4 style={{ color: '#f7931e', marginBottom: '10px', fontSize: '1.1rem' }}>📊 Projeção de Nota</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                        <div style={{ textAlign: 'center', backgroundColor: '#1a1a1a', padding: '10px', borderRadius: '5px' }}>
                          <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '5px' }}>Nota Atual</p>
                          <p style={{ color: '#dc3545', fontSize: '1.5rem', fontWeight: 'bold' }}>
                            {analysisResult.projecaoNota.notaAtual}
                          </p>
                        </div>
                        <div style={{ textAlign: 'center', backgroundColor: '#1a1a1a', padding: '10px', borderRadius: '5px' }}>
                          <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '5px' }}>Ganho Estimado</p>
                          <p style={{ color: '#28a745', fontSize: '1.5rem', fontWeight: 'bold' }}>
                            +{analysisResult.projecaoNota.ganhoEstimado.toFixed(1)}
                          </p>
                        </div>
                        <div style={{ textAlign: 'center', backgroundColor: '#1a1a1a', padding: '10px', borderRadius: '5px' }}>
                          <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '5px' }}>Nova Nota</p>
                          <p style={{ color: '#4a90e2', fontSize: '1.5rem', fontWeight: 'bold' }}>
                            {analysisResult.projecaoNota.notaEstimadaPosRecurso.toFixed(1)}
                          </p>
                        </div>
                      </div>
                      <p style={{ color: '#aaa', fontSize: '0.9rem', lineHeight: '1.6' }}>
                        <strong style={{ color: '#f7931e' }}>Justificativa:</strong> {analysisResult.projecaoNota.justificativaProjecao}
                      </p>
                    </div>

                    <div style={{ backgroundColor: '#1a3a1a', padding: '15px', borderRadius: '5px', borderLeft: '5px solid #28a745' }}>
                      <h4 style={{ color: '#28a745', marginBottom: '10px', fontSize: '1.1rem' }}>✅ Recomendação Final</h4>
                      <p style={{ color: '#ccc', fontSize: '0.95rem', lineHeight: '1.6' }}>
                        {analysisResult.recomendacaoFinal}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ width: '100%' }}>
                <p style={{ fontSize: '1.2rem', color: '#4a90e2', marginBottom: '10px', textAlign: 'center' }}>Nota Preditiva Final</p>
                <div style={{ fontSize: '4rem', fontWeight: 'bold', color: '#007BFF', marginTop: '10px', lineHeight: '1', textAlign: 'center' }}>
                  {analysisResult.notaFinal.toFixed(1)}
                </div>

                {analysisResult.reconsideracao && (
                  <div style={{ backgroundColor: analysisResult.reconsideracao.decisao === 'MANTIDA' ? '#3a2a1a' : '#1a3a1a', padding: '15px', borderRadius: '5px', marginTop: '20px', marginBottom: '20px', borderLeft: `5px solid ${analysisResult.reconsideracao.decisao === 'MANTIDA' ? '#f7931e' : '#28a745'}` }}>
                    <h4 style={{ color: analysisResult.reconsideracao.decisao === 'MANTIDA' ? '#f7931e' : '#28a745', marginBottom: '10px', fontSize: '1.1rem' }}>
                      {analysisResult.reconsideracao.decisao === 'MANTIDA' ? '⚖️ Nota Mantida' : '✓ Nota Alterada'}
                    </h4>
                    <p style={{ color: '#aaa', fontSize: '0.95rem', marginBottom: '15px', lineHeight: '1.6' }}>
                      {analysisResult.reconsideracao.justificativaDecisao}
                    </p>
                    
                    {analysisResult.reconsideracao.pontosAceitos.length > 0 && (
                      <div style={{ marginBottom: '15px' }}>
                        <strong style={{ color: '#28a745', display: 'block', marginBottom: '8px' }}>Argumentos Aceitos:</strong>
                        <ul style={{ paddingLeft: '20px', margin: 0 }}>
                          {analysisResult.reconsideracao.pontosAceitos.map((ponto, idx) => (
                            <li key={idx} style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '5px', lineHeight: '1.5' }}>
                              {ponto}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {analysisResult.reconsideracao.pontosRejeitados.length > 0 && (
                      <div>
                        <strong style={{ color: '#dc3545', display: 'block', marginBottom: '8px' }}>Argumentos Rejeitados:</strong>
                        <ul style={{ paddingLeft: '20px', margin: 0 }}>
                          {analysisResult.reconsideracao.pontosRejeitados.map((ponto, idx) => (
                            <li key={idx} style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '5px', lineHeight: '1.5' }}>
                              {ponto}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: '20px', width: '100%', textAlign: 'left' }}>
                  <h3>Parecer Geral</h3>
                  <p style={{ color: '#aaa', marginBottom: '15px', borderLeft: '3px solid #4a90e2', paddingLeft: '10px' }}>
                    {analysisResult.parecerGeral}
                  </p>

                  <h3>Análise Detalhada por Critério</h3>
                  {analysisResult.analiseDetalhada.map((item, idx) => (
                    <div key={idx} style={{ backgroundColor: '#2A2A2A', padding: '10px', borderRadius: '5px', marginBottom: '10px' }}>
                      <h4 style={{ color: '#28a745', marginBottom: '5px', fontSize: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{item.criterio}</span>
                        <span style={{ color: '#4a90e2', fontWeight: 'bold' }}>
                          {item.pontuacaoAtribuida.toFixed(1)}/{item.pontuacaoMaxima} pts
                        </span>
                      </h4>
                      <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '8px' }}>{item.justificativa}</p>
                      {item.referenciasTecnicas && item.referenciasTecnicas.length > 0 && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
                          <strong style={{ color: '#4a90e2', fontSize: '0.85rem' }}>Referências Técnicas:</strong>
                          <ul style={{ marginTop: '4px', paddingLeft: '20px', fontSize: '0.85rem', color: '#888' }}>
                            {item.referenciasTecnicas.map((ref, refIdx) => (
                              <li key={refIdx} style={{ marginBottom: '2px' }}>{ref}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {analysisResult && !analysisResult.isRecourseAnalysis && (
            <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)', marginBottom: '20px' }}>
              <h3>Recurso (Pós-Análise da IA)</h3>
              <p style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '10px' }}>
                **Dica da IA:** {analysisResult.sugestaoRecurso || 'A análise preditiva é sólida.'}
              </p>
              <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
                Escreva seu recurso contra a nota preditiva da IA (máx. 500 caracteres):
              </label>
              <textarea
                value={recourseInput}
                onChange={(e) => setRecourseInput(e.target.value)}
                placeholder="Argumente por que você discorda da nota ou de uma das justificativas da IA..."
                maxLength={500}
                style={{ width: '100%', minHeight: '150px', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', fontSize: '1rem', resize: 'vertical' }}
              />
              <button
                onClick={submitRecourse}
                disabled={analyzing}
                style={{ width: '100%', padding: '12px 20px', border: 'none', borderRadius: '5px', cursor: analyzing ? 'not-allowed' : 'pointer', fontSize: '1.1rem', fontWeight: '700', backgroundColor: analyzing ? '#444' : '#007BFF', color: 'white', marginTop: '15px', opacity: analyzing ? 0.6 : 1 }}
              >
                {analyzing ? 'Analisando Recurso...' : 'Submeter Recurso Simulado'}
              </button>
            </div>
          )}
        </div>
      </main>

      {showRealRecourseModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1E1E1E', padding: '30px', borderRadius: '10px', boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)', width: '95%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#007BFF', borderBottom: '2px solid #333333', paddingBottom: '10px', marginBottom: '20px' }}>
              Recurso Contra a Banca Examinadora (Cenário Real)
            </h2>
            <p style={{ color: '#aaa', marginBottom: '20px' }}>
              Use esta seção para que a IA analise o seu cenário real de recurso, comparando sua redação e a nota/parecer da banca.
            </p>

            <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
              Redação Final Avaliada (Cole o texto):
            </label>
            <textarea
              value={realRedaction}
              onChange={(e) => setRealRedaction(e.target.value)}
              placeholder="Cole aqui a versão final da redação que você entregou."
              style={{ width: '100%', minHeight: '150px', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', fontSize: '1rem', resize: 'vertical' }}
            />

            <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
              OU Anexar Redação (PDF):
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => handleFileUpload(e.target.files[0], setRealRedaction)}
              disabled={uploadingFile}
              style={{ width: '100%', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', cursor: uploadingFile ? 'not-allowed' : 'pointer' }}
            />

            <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
              Nota Atribuída pela Banca (0 a 100):
            </label>
            <input
              type="number"
              value={bankScore}
              onChange={(e) => setBankScore(e.target.value)}
              step="0.5"
              min="0"
              max="100"
              placeholder="Ex: 78.5"
              style={{ width: '100%', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', fontSize: '1rem' }}
            />

            <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
              Parecer Oficial da Banca (Cole o texto de correção):
            </label>
            <textarea
              value={bankParecer}
              onChange={(e) => setBankParecer(e.target.value)}
              placeholder="Cole aqui a justificativa/parecer que a banca forneceu sobre a sua nota."
              style={{ width: '100%', minHeight: '150px', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', fontSize: '1rem', resize: 'vertical' }}
            />

            <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
              OU Anexar Parecer (PDF):
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => handleFileUpload(e.target.files[0], setBankParecer)}
              disabled={uploadingFile}
              style={{ width: '100%', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', cursor: uploadingFile ? 'not-allowed' : 'pointer' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #333333' }}>
              <button
                onClick={() => setShowRealRecourseModal(false)}
                disabled={uploadingFile}
                style={{ padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: uploadingFile ? 'not-allowed' : 'pointer', fontWeight: '600', backgroundColor: '#444', color: 'white' }}
              >
                Cancelar
              </button>
              <button
                onClick={analyzeRealRecourse}
                disabled={uploadingFile}
                style={{ padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: uploadingFile ? 'not-allowed' : 'pointer', fontWeight: '700', backgroundColor: '#007BFF', color: 'white' }}
              >
                Analisar Possível Recurso
              </button>
            </div>
          </div>
        </div>
      )}

      {alertMessage && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#1E1E1E', padding: '15px', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.5)', borderLeft: `5px solid ${alertMessage.isSuccess ? '#28a745' : '#dc3545'}`, zIndex: 1001 }}>
          <p style={{ marginBottom: '10px', color: '#E0E0E0' }}>{alertMessage.message}</p>
          <button
            onClick={() => setAlertMessage(null)}
            style={{ backgroundColor: '#007BFF', color: 'white', padding: '5px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}