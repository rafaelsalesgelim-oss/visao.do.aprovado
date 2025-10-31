
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Copy, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function BulkUpload() {
  const [uploadMethod, setUploadMethod] = useState('text');
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState(null);
  const [selectedDiscipline, setSelectedDiscipline] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleTextUpload = async () => {
    if (!textInput.trim()) {
      setError("Por favor, cole as questões no campo de texto");
      return;
    }

    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const disciplineInstruction = selectedDiscipline.trim()
        ? `A disciplina de todas as questões é "${selectedDiscipline}", use isso para todas as questões.`
        : `Você deve detectar e extrair a disciplina de cada questão com base no conteúdo. Seja específico (ex: "Direito Constitucional", "Português", "Matemática", etc).`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um extrator de questões de concurso público. Extraia todas as questões do texto abaixo e retorne um array JSON com os seguintes campos para cada questão:

IMPORTANTE: Detecte automaticamente o tipo de questão:
- Se a questão for do tipo Certo/Errado (também chamada de Verdadeiro/Falso ou questões estilo CESPE/CEBRASPE), use questionType: "Certo/Errado" e options deve ter apenas 2 itens: ["Certo", "Errado"]
- Se a questão for de Múltipla Escolha com alternativas A, B, C, D, E, use questionType: "Múltipla Escolha" e options deve ter 5 itens

Campos obrigatórios:
- discipline (string): ${selectedDiscipline.trim() ? `sempre use "${selectedDiscipline}"` : 'detecte a disciplina da questão baseado no conteúdo'}
- subject (string): assunto específico da questão
- questionType (string): "Certo/Errado" ou "Múltipla Escolha"
- questionText (string): texto completo da questão
- options (array de strings): 2 opções ["Certo", "Errado"] OU 5 opções [A, B, C, D, E]
- correctAnswer (número): 0 ou 1 para Certo/Errado, 0-4 para Múltipla Escolha
- source (string): banca/fonte se mencionada
- year (número): ano se mencionado
- institution (string): instituição/órgão se mencionado
- difficulty (string): "fácil", "médio" ou "difícil" baseado na complexidade

${disciplineInstruction}

TEXTO:
${textInput}`,
        response_json_schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  discipline: { type: "string" },
                  subject: { type: "string" },
                  questionType: { type: "string", enum: ["Certo/Errado", "Múltipla Escolha"] },
                  questionText: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                  correctAnswer: { type: "integer" },
                  source: { type: "string" },
                  year: { type: "integer" },
                  institution: { type: "string" },
                  difficulty: { type: "string" }
                },
                required: ["discipline", "questionType", "questionText", "options", "correctAnswer"]
              }
            }
          }
        }
      });

      if (response.questions && response.questions.length > 0) {
        const createdQuestions = await Promise.all(
          response.questions.map(q =>
            base44.entities.Question.create({
              ...q,
              discipline: selectedDiscipline.trim() || q.discipline,
              status: 'ativa'
            })
          )
        );

        setResult({
          success: true,
          count: createdQuestions.length,
          questions: createdQuestions
        });
        setTextInput('');
        setSelectedDiscipline('');
      } else {
        setError("Nenhuma questão foi encontrada no texto fornecido");
      }
    } catch (err) {
      setError("Erro ao processar questões: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleFileUpload = async () => {
    if (!file) {
      setError("Por favor, selecione um arquivo");
      return;
    }

    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const disciplineInstruction = selectedDiscipline.trim()
        ? `Use a disciplina "${selectedDiscipline}" para TODAS as questões extraídas`
        : `Analise o conteúdo de cada questão e identifique a disciplina específica (ex: "Direito Constitucional", "Português", "Matemática", "Raciocínio Lógico", "Informática", etc)`;

      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  discipline: { 
                    type: "string",
                    description: disciplineInstruction
                  },
                  subject: { 
                    type: "string",
                    description: "Assunto específico da questão dentro da disciplina"
                  },
                  questionType: { 
                    type: "string", 
                    enum: ["Certo/Errado", "Múltipla Escolha"],
                    description: "IMPORTANTE: Detecte automaticamente - Use 'Certo/Errado' para questões estilo CESPE/CEBRASPE com apenas 2 opções (Certo/Errado ou Verdadeiro/Falso). Use 'Múltipla Escolha' para questões com 5 alternativas (A, B, C, D, E)"
                  },
                  questionText: { 
                    type: "string",
                    description: "Texto completo do enunciado da questão"
                  },
                  options: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "IMPORTANTE: Para Certo/Errado use EXATAMENTE ['Certo', 'Errado']. Para Múltipla Escolha extraia as 5 alternativas completas"
                  },
                  correctAnswer: { 
                    type: "integer",
                    description: "Índice da resposta correta: 0 ou 1 para Certo/Errado, 0 a 4 para Múltipla Escolha (onde 0=A, 1=B, 2=C, 3=D, 4=E)"
                  },
                  source: { 
                    type: "string",
                    description: "Banca organizadora (ex: CESPE, FCC, FGV, VUNESP)"
                  },
                  year: { 
                    type: "integer",
                    description: "Ano da prova"
                  },
                  institution: { 
                    type: "string",
                    description: "Órgão ou instituição (ex: TRT, INSS, Polícia Federal)"
                  },
                  difficulty: { 
                    type: "string",
                    enum: ["fácil", "médio", "difícil"],
                    description: "Avalie a dificuldade baseado na complexidade da questão"
                  }
                },
                required: ["discipline", "questionType", "questionText", "options", "correctAnswer"]
              }
            }
          },
          required: ["questions"]
        }
      });

      console.log("Resultado da extração:", extractResult);

      if (extractResult.status === 'error') {
        setError(`Erro ao extrair questões: ${extractResult.details || 'Erro desconhecido'}`);
        setProcessing(false);
        return;
      }

      if (!extractResult.output || !extractResult.output.questions || extractResult.output.questions.length === 0) {
        setError("Nenhuma questão foi encontrada no arquivo. Verifique se o PDF contém questões em formato reconhecível.");
        setProcessing(false);
        return;
      }

      // Criar questões no banco
      const createdQuestions = await Promise.all(
        extractResult.output.questions.map(q => 
          base44.entities.Question.create({
            ...q,
            discipline: selectedDiscipline.trim() || q.discipline,
            status: 'ativa'
          })
        )
      );

      setResult({
        success: true,
        count: createdQuestions.length,
        questions: createdQuestions
      });
      setFile(null);
      setSelectedDiscipline('');
    } catch (err) {
      console.error("Erro completo:", err);
      setError("Erro ao processar arquivo: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const exampleText = `1. (FCC - TRT - 2023) Em relação aos direitos fundamentais previstos na Constituição Federal, é correto afirmar que:
a) São absolutos e não podem sofrer restrições
b) Aplicam-se apenas aos brasileiros natos
c) Podem sofrer limitações em situações específicas
d) São aplicáveis apenas no âmbito federal
e) Não se aplicam às pessoas jurídicas

Gabarito: C

2. (CESPE - TJDFT - 2023) Quanto à organização do Estado brasileiro, assinale a alternativa correta:
a) O Brasil adota o sistema parlamentarista
b) A União, os Estados e os Municípios são entes federados autônomos
c) Os Territórios têm autonomia político-administrativa
d) O Distrito Federal é considerado um Estado
e) A organização político-administrativa compreende apenas União e Estados

Gabarito: B

3. (CESPE/CEBRASPE - MPT - 2022) A súmula vinculante possui efeito erga omnes e vincula os demais órgãos do Poder Judiciário e a administração pública direta e indireta, nas esferas federal, estadual e municipal.

Gabarito: Certo`;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload em Massa de Questões</h1>
        <p className="text-gray-600 mt-2">
          Adicione milhares de questões de uma vez através de texto colado ou arquivos PDF
        </p>
      </div>

      {/* Filtro de Disciplina - OPCIONAL */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-900">
            <BookOpen className="w-5 h-5 mr-2" />
            Disciplina das Questões (Opcional)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-blue-900">
              Informe a disciplina ou deixe em branco para detecção automática pela IA
            </Label>
            <Input
              value={selectedDiscipline}
              onChange={(e) => setSelectedDiscipline(e.target.value)}
              placeholder="Ex: Português, Direito Constitucional, Raciocínio Lógico, etc."
              className="text-lg font-medium bg-white"
            />
            <p className="text-xs text-blue-700 italic">
              💡 Se deixar em branco, a IA detectará automaticamente a disciplina de cada questão
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setUploadMethod('text')}
          className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
            uploadMethod === 'text'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Copy className="w-5 h-5 inline mr-2" />
          Colar Texto
        </button>
        <button
          onClick={() => setUploadMethod('file')}
          className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
            uploadMethod === 'file'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <FileText className="w-5 h-5 inline mr-2" />
          Upload de PDF
        </button>
      </div>

      {uploadMethod === 'text' && (
        <Card>
          <CardHeader>
            <CardTitle>Cole as Questões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Cole aqui milhares de questões com seus gabaritos. A IA irá reconhecer automaticamente as questões, opções e respostas corretas."
                className="min-h-[400px] font-mono text-sm"
              />
              <p className="text-sm text-gray-500 mt-2">
                Dica: Cole questões numeradas com suas opções (a, b, c, d, e) e gabaritos. O sistema irá reconhecer automaticamente, incluindo questões de Certo/Errado.
              </p>
            </div>

            <details className="bg-gray-50 p-4 rounded-lg">
              <summary className="cursor-pointer font-semibold text-gray-700 mb-2">
                Ver exemplo de formato
              </summary>
              <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto whitespace-pre-wrap">
                {exampleText}
              </pre>
            </details>

            <Button
              onClick={handleTextUpload}
              disabled={processing || !textInput.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Processar e Adicionar Questões
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {uploadMethod === 'file' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload de Arquivo PDF</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-700 mb-2">
                  {file ? file.name : 'Clique para selecionar um arquivo PDF'}
                </p>
                <p className="text-sm text-gray-500">
                  Envie provas de concurso em PDF e a IA extrairá automaticamente todas as questões, incluindo questões de Certo/Errado e Múltipla Escolha.
                </p>
              </label>
            </div>

            <Button
              onClick={handleFileUpload}
              disabled={processing || !file}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processando PDF...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Processar PDF e Adicionar Questões
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Sucesso!</strong> {result.count} questão(ões) {selectedDiscipline ? `de ${selectedDiscipline}` : 'com disciplinas detectadas automaticamente'} adicionada(s) ao banco de dados.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
