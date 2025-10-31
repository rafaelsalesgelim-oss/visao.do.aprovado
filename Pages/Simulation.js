
import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock, ChevronLeft, ChevronRight, Flag, CheckCircle, Filter, X, AlertTriangle, BookOpen, Lock,
  BarChart3, Award, TrendingUp, Loader2, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Simulation() {
  const [user, setUser] = useState(null);
  const [simulationStarted, setSimulationStarted] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flags, setFlags] = useState({});
  const [notes, setNotes] = useState({});
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  // Novos estados para análise avançada Premium
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [comparisonFilter, setComparisonFilter] = useState('last5');
  const [disciplineAnalysisFilter, setDisciplineAnalysisFilter] = useState('all');

  // Filtros de configuração
  const [selectedDisciplines, setSelectedDisciplines] = useState([]);
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState([]); // Novo estado para tipos de questão
  const [questionsLimit, setQuestionsLimit] = useState(30);
  const [questionsPerPage, setQuestionsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState('todas');
  
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentQuestionForModal, setCurrentQuestionForModal] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetType, setResetType] = useState('');

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (simulationStarted && startTime) {
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [simulationStarted, startTime]);

  // Scroll para o topo quando mudar de página
  useEffect(() => {
    if (simulationStarted && !showResults) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage, simulationStarted, showResults]);

  const { data: allQuestions = [] } = useQuery({
    queryKey: ['questions'],
    queryFn: () => base44.entities.Question.filter({ status: 'ativa' }),
    enabled: !simulationStarted,
  });

  const { data: existingFlags = [] } = useQuery({
    queryKey: ['user-flags', user?.id],
    queryFn: () => base44.entities.QuestionFlag.filter({ userId: user?.id }),
    enabled: !!user,
  });

  const { data: previousSimulations = [] } = useQuery({
    queryKey: ['user-simulations', user?.id],
    queryFn: () => base44.entities.SimulationHistory.filter({ userId: user?.id }),
    enabled: !!user && !simulationStarted,
  });

  const { data: reportedIssues = [] } = useQuery({
    queryKey: ['user-reported-issues', user?.id],
    queryFn: () => base44.entities.ReportedIssue.filter({ userId: user?.id }),
    enabled: !!user && !simulationStarted,
  });

  const availableDisciplines = useMemo(() => {
    return [...new Set(allQuestions.map(q => q.discipline))].filter(Boolean);
  }, [allQuestions]);

  const isPremium = user?.plan === 'PREMIUM' && user?.status === 'ATIVO';

  // Aplica os filtros de status (Premium)
  const filteredByStatus = useMemo(() => {
    if (!isPremium || statusFilter === 'todas') return allQuestions;

    let filtered = allQuestions;

    if (statusFilter === 'acertos') {
      // Questões que o usuário acertou em simulados anteriores
      const correctAnswers = new Set();
      previousSimulations.forEach(sim => {
        sim.questionIds.forEach((qId, idx) => {
          const question = allQuestions.find(q => q.id === qId);
          if (question && sim.answers[idx] === question.correctAnswer) {
            correctAnswers.add(qId);
          }
        });
      });
      filtered = allQuestions.filter(q => correctAnswers.has(q.id));
    } 
    else if (statusFilter === 'erros') {
      // Questões que o usuário errou em simulados anteriores
      const wrongAnswers = new Set();
      previousSimulations.forEach(sim => {
        sim.questionIds.forEach((qId, idx) => {
          const question = allQuestions.find(q => q.id === qId);
          if (question && sim.answers[idx] !== -1 && sim.answers[idx] !== question.correctAnswer) {
            wrongAnswers.add(qId);
          }
        });
      });
      filtered = allQuestions.filter(q => wrongAnswers.has(q.id));
    }
    else if (statusFilter === 'marcadas') {
      // Questões marcadas para revisão
      const flaggedIds = existingFlags.filter(f => f.isFlagged).map(f => f.questionId);
      filtered = allQuestions.filter(q => flaggedIds.includes(q.id));
    }
    else if (statusFilter === 'com_notas') {
      // Questões com notas pessoais
      const withNotes = existingFlags.filter(f => f.personalNote && f.personalNote.trim()).map(f => f.questionId);
      filtered = allQuestions.filter(q => withNotes.includes(q.id));
    }
    else if (statusFilter === 'reportadas') {
      // Questões que o usuário reportou erro
      const reportedIds = reportedIssues.map(r => r.questionId);
      filtered = allQuestions.filter(q => reportedIds.includes(q.id));
    }

    return filtered;
  }, [allQuestions, statusFilter, isPremium, previousSimulations, existingFlags, reportedIssues]);

  // Aplica filtro de disciplina
  const filteredByDiscipline = useMemo(() => {
    if (selectedDisciplines.length === 0) return filteredByStatus;
    return filteredByStatus.filter(q => selectedDisciplines.includes(q.discipline));
  }, [filteredByStatus, selectedDisciplines]);

  // Aplica filtro de tipo de questão
  const filteredByQuestionType = useMemo(() => {
    if (selectedQuestionTypes.length === 0) return filteredByDiscipline;
    return filteredByDiscipline.filter(q => selectedQuestionTypes.includes(q.questionType));
  }, [filteredByDiscipline, selectedQuestionTypes]);

  // Aplica limite de quantidade
  const simulationQuestions = useMemo(() => {
    if (filteredByQuestionType.length === 0) return [];
    
    // Determine the effective maximum limit for the user
    let effectiveMaxLimit;
    if (isPremium || user?.questionsLimit === 0) { // Premium or explicitly unlimited
      effectiveMaxLimit = filteredByQuestionType.length; // No hard cap from plan, use available or desired
    } else { // Free user with a specific limit
      effectiveMaxLimit = user?.questionsLimit || 30; // Use user's limit or default to 30
    }

    // Apply the configured questionsLimit, capped by effectiveMaxLimit and actual available questions
    const finalLimit = Math.min(questionsLimit, effectiveMaxLimit, filteredByQuestionType.length);
    
    return filteredByQuestionType.slice(0, finalLimit);
  }, [filteredByQuestionType, questionsLimit, isPremium, user]);

  const totalPages = Math.ceil(simulationQuestions.length / questionsPerPage);
  const currentQuestions = simulationQuestions.slice(
    currentPage * questionsPerPage,
    (currentPage + 1) * questionsPerPage
  );

  const saveHistoryMutation = useMutation({
    mutationFn: (historyData) => base44.entities.SimulationHistory.create(historyData),
  });

  const updateUserStatsMutation = useMutation({
    mutationFn: ({ hits, errors }) => base44.auth.updateMe({
      totalHits: (user.totalHits || 0) + hits,
      totalErrors: (user.totalErrors || 0) + errors,
    }),
  });

  const flagMutation = useMutation({
    mutationFn: ({ questionId, isFlagged, note }) => {
      const existing = existingFlags.find(f => f.questionId === questionId);
      if (existing) {
        return base44.entities.QuestionFlag.update(existing.id, { isFlagged, personalNote: note });
      }
      return base44.entities.QuestionFlag.create({
        userId: user.id,
        questionId,
        isFlagged,
        personalNote: note
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user-flags']);
      showFeedback('Marcação salva com sucesso!', 'success');
    },
  });

  const reportIssueMutation = useMutation({
    mutationFn: ({ questionId, issueText }) => 
      base44.entities.ReportedIssue.create({
        userId: user.id,
        userEmail: user.email,
        questionId,
        issueText,
        status: 'pendente'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['user-reported-issues']);
      showFeedback('Problema reportado com sucesso!', 'success');
    },
  });

  const resetFlagsMutation = useMutation({
    mutationFn: async () => {
      const flagsToReset = existingFlags.filter(f => f.isFlagged);
      await Promise.all(flagsToReset.map(flag => 
        base44.entities.QuestionFlag.update(flag.id, { isFlagged: false })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user-flags']);
      showFeedback('Marcações resetadas com sucesso!', 'success');
      setShowResetDialog(false);
    },
  });

  const resetReportedMutation = useMutation({
    mutationFn: async () => {
      const userReports = reportedIssues.filter(r => r.userId === user.id);
      await Promise.all(userReports.map(report => 
        base44.entities.ReportedIssue.delete(report.id)
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user-reported-issues']);
      showFeedback('Questões reportadas resetadas com sucesso!', 'success');
      setShowResetDialog(false);
    },
  });

  const resetNotesMutation = useMutation({
    mutationFn: async () => {
      const flagsWithNotes = existingFlags.filter(f => f.personalNote && f.personalNote.trim());
      await Promise.all(flagsWithNotes.map(flag => 
        base44.entities.QuestionFlag.update(flag.id, { personalNote: '' })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user-flags']);
      showFeedback('Anotações resetadas com sucesso!', 'success');
      setShowResetDialog(false);
    },
  });

  const resetQuestionsHistoryMutation = useMutation({
    mutationFn: async () => {
      const userHistory = previousSimulations;
      await Promise.all(userHistory.map(sim => 
        base44.entities.SimulationHistory.delete(sim.id)
      ));
      // Zera também os totais de acertos e erros no perfil do usuário
      await base44.auth.updateMe({
        totalHits: 0,
        totalErrors: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user-simulations']);
      queryClient.invalidateQueries(['user-history']); // Assuming 'user-history' might also cache data related to simulation history, good to invalidate.
      queryClient.invalidateQueries(['user-me']); // Invalida o cache do usuário para recarregar o dashboard
      showFeedback('Histórico de questões e estatísticas resetados com sucesso!', 'success');
      setShowResetDialog(false);
    },
  });

  const handleReset = (type) => {
    setResetType(type);
    setShowResetDialog(true);
  };

  const confirmReset = () => {
    if (resetType === 'flags') {
      resetFlagsMutation.mutate();
    } else if (resetType === 'reported') {
      resetReportedMutation.mutate();
    } else if (resetType === 'notes') {
      resetNotesMutation.mutate();
    } else if (resetType === 'history') {
      resetQuestionsHistoryMutation.mutate();
    }
  };

  const showFeedback = (message, type = 'info') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const startSimulation = () => {
    if (simulationQuestions.length === 0) {
      showFeedback('Nenhuma questão disponível com os filtros selecionados', 'error');
      return;
    }
    setSimulationStarted(true);
    setStartTime(Date.now());
    setAnswers({});
    setFlags({});
    setNotes({});
    setShowResults(false);
    setAiAnalysis(null); // Reset AI analysis for new simulation
  };

  const handleAnswer = (questionId, optionIndex) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleFlag = (questionId) => {
    const newFlagState = !flags[questionId];
    setFlags(prev => ({ ...prev, [questionId]: newFlagState }));
    flagMutation.mutate({ questionId, isFlagged: newFlagState, note: notes[questionId] || null });
  };

  const handleSaveNote = (questionId, note) => {
    setNotes(prev => ({ ...prev, [questionId]: note }));
    flagMutation.mutate({ questionId, isFlagged: flags[questionId] || false, note });
    setShowNoteModal(false);
  };

  const handleReportIssue = (questionId, issueText) => {
    reportIssueMutation.mutate({ questionId, issueText });
    setShowReportModal(false);
  };

  const finishSimulation = async () => {
    const correctCount = simulationQuestions.filter(
      q => answers[q.id] === q.correctAnswer
    ).length;
    const totalCount = simulationQuestions.length;

    await saveHistoryMutation.mutateAsync({
      userId: user.id,
      userEmail: user.email,
      questionIds: simulationQuestions.map(q => q.id),
      answers: simulationQuestions.map(q => answers[q.id] ?? -1),
      correctCount,
      totalCount,
      timeSpent: elapsedTime,
      disciplines: selectedDisciplines.length > 0 ? selectedDisciplines : ['Todas'],
    });

    await updateUserStatsMutation.mutateAsync({
      hits: correctCount,
      errors: totalCount - correctCount,
    });

    setShowResults(true);
  };

  const generateAIAnalysis = async () => {
    if (!isPremium) return;
    
    setLoadingAnalysis(true);
    try {
      const correctCount = simulationQuestions.filter(q => answers[q.id] === q.correctAnswer).length;
      const totalCount = simulationQuestions.length;
      const percentage = ((correctCount / totalCount) * 100).toFixed(1);
      
      // Análise por disciplina para o prompt
      const disciplineStats = {};
      simulationQuestions.forEach(q => {
        if (!disciplineStats[q.discipline]) {
          disciplineStats[q.discipline] = { correct: 0, total: 0 };
        }
        disciplineStats[q.discipline].total++;
        if (answers[q.id] === q.correctAnswer) {
          disciplineStats[q.discipline].correct++;
        }
      });

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista em análise de desempenho de estudantes de concursos públicos.

Analise o seguinte desempenho em um simulado:

RESUMO GERAL:
- Total de questões: ${totalCount}
- Acertos: ${correctCount}
- Erros: ${totalCount - correctCount}
- Aproveitamento: ${percentage}%
- Tempo gasto: ${Math.floor(elapsedTime / 60)} minutos

DESEMPENHO POR DISCIPLINA:
${Object.entries(disciplineStats).map(([disc, stats]) => 
  `- ${disc}: ${stats.correct}/${stats.total} (${((stats.correct/stats.total)*100).toFixed(0)}%)`
).join('\n')}

HISTÓRICO RECENTE (últimos 5 simulados):
${previousSimulations.slice(0, 5).map(sim => 
  `- Simulado com ${sim.totalCount} questões, ${((sim.correctCount/sim.totalCount)*100).toFixed(0)}% de acertos, em ${formatTime(sim.timeSpent)}`
).join('\n')}

Forneça uma análise detalhada com:
1. Pontos Positivos (áreas de destaque)
2. Pontos Negativos (áreas que precisam de atenção)
3. Recomendações Estratégicas (como melhorar o desempenho)
4. Comparação com simulados anteriores (se melhorou, estabilizou ou piorou)

Seja objetivo, motivador e prático nas recomendações. Use linguagem clara e concisa.`,
        response_json_schema: {
          type: "object",
          properties: {
            pontos_positivos: {
              type: "array",
              items: { type: "string" }
            },
            pontos_negativos: {
              type: "array",
              items: { type: "string" }
            },
            recomendacoes: {
              type: "array",
              items: { type: "string" }
            },
            comparacao_historico: { type: "string" }
          },
          required: ["pontos_positivos", "pontos_negativos", "recomendacoes", "comparacao_historico"]
        }
      });

      setAiAnalysis(response);
    } catch (error) {
      console.error("Erro ao gerar análise:", error);
      showFeedback('Erro ao gerar análise com IA. Tente novamente mais tarde.', 'error');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!simulationStarted) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="p-8">
          <div className="text-center mb-8">
            <BookOpen className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Iniciar Simulado</h1>
            <p className="text-gray-600">Configure seu simulado personalizado</p>
          </div>

          <div className="space-y-6">
            {/* Filtro por Disciplina */}
            <div>
              <Label className="block text-sm font-semibold text-gray-700 mb-2">
                Filtrar por Disciplina
              </Label>
              <Select
                onValueChange={(value) => {
                  if (value === 'all') {
                    setSelectedDisciplines([]);
                  } else {
                    setSelectedDisciplines(prev => 
                      prev.includes(value) ? prev : [...prev, value]
                    );
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as disciplinas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as disciplinas</SelectItem>
                  {availableDisciplines.map(disc => (
                    <SelectItem key={disc} value={disc}>{disc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDisciplines.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedDisciplines.map(disc => (
                    <span key={disc} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center">
                      {disc}
                      <X
                        className="w-4 h-4 ml-2 cursor-pointer"
                        onClick={() => setSelectedDisciplines(prev => prev.filter(d => d !== disc))}
                      />
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Filtro por Tipo de Questão */}
            <div>
              <Label className="block text-sm font-semibold text-gray-700 mb-2">
                Filtrar por Tipo de Questão
              </Label>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    if (selectedQuestionTypes.includes("Certo/Errado")) {
                      setSelectedQuestionTypes(prev => prev.filter(t => t !== "Certo/Errado"));
                    } else {
                      setSelectedQuestionTypes(prev => [...prev, "Certo/Errado"]);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    selectedQuestionTypes.includes("Certo/Errado")
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Certo/Errado
                </button>
                <button
                  onClick={() => {
                    if (selectedQuestionTypes.includes("Múltipla Escolha")) {
                      setSelectedQuestionTypes(prev => prev.filter(t => t !== "Múltipla Escolha"));
                    } else {
                      setSelectedQuestionTypes(prev => [...prev, "Múltipla Escolha"]);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    selectedQuestionTypes.includes("Múltipla Escolha")
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Múltipla Escolha (A, B, C, D, E)
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {selectedQuestionTypes.length === 0 
                  ? 'Todos os tipos de questões serão incluídos' 
                  : `Selecionado: ${selectedQuestionTypes.join(' e ')}`}
              </p>
            </div>

            {/* Filtro por Quantidade de Questões */}
            <div>
              <Label className="block text-sm font-semibold text-gray-700 mb-2">
                Quantidade de Questões {!isPremium && user?.questionsLimit !== 0 && `(máx. ${user?.questionsLimit || 30} para gratuito)`}
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min="1"
                  max={isPremium || user?.questionsLimit === 0 ? filteredByQuestionType.length : (user?.questionsLimit || 30)}
                  value={questionsLimit}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    const max = isPremium || user?.questionsLimit === 0 ? filteredByQuestionType.length : (user?.questionsLimit || 30);
                    setQuestionsLimit(Math.min(val, max));
                  }}
                  className="w-32"
                />
                <span className="text-sm text-gray-500">
                  de {filteredByQuestionType.length} disponíveis
                </span>
              </div>
              {!isPremium && user?.questionsLimit !== 0 && (
                <p className="text-sm text-orange-600 italic mt-2">
                  ⚠️ Plano gratuito: você pode fazer simulados com 1 a {user?.questionsLimit || 30} questões
                </p>
              )}
              {(isPremium || user?.questionsLimit === 0) && (
                <p className="text-sm text-green-600 italic mt-2">
                  ✅ Sem limites: você pode fazer simulados com qualquer quantidade de questões
                </p>
              )}
            </div>

            {/* Filtro por Questões por Página */}
            <div>
              <Label className="block text-sm font-semibold text-gray-700 mb-2">
                Questões por Página
              </Label>
              <Select
                value={questionsPerPage.toString()}
                onValueChange={(value) => setQuestionsPerPage(parseInt(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 questões</SelectItem>
                  <SelectItem value="10">10 questões</SelectItem>
                  <SelectItem value="15">15 questões</SelectItem>
                  <SelectItem value="20">20 questões</SelectItem>
                  <SelectItem value="30">30 questões</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Status (Premium) */}
            <div className={`relative ${!isPremium ? 'opacity-50' : ''}`}>
              <Label className="block text-sm font-semibold text-gray-700 mb-2">
                Filtrar por Status {!isPremium && '⭐ Premium'}
              </Label>
              <Select
                disabled={!isPremium}
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Questões</SelectItem>
                  <SelectItem value="acertos">Todos os Acertos</SelectItem>
                  <SelectItem value="erros">Todos os Erros</SelectItem>
                  <SelectItem value="marcadas">Questões Marcadas para Revisar</SelectItem>
                  <SelectItem value="com_notas">Questões com Notas Pessoais</SelectItem>
                  <SelectItem value="reportadas">Questões com Erro Reportado</SelectItem>
                </SelectContent>
              </Select>
              {!isPremium && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70 rounded-lg cursor-not-allowed">
                  <Lock className="w-5 h-5 text-gray-600 mr-2" />
                  <span className="text-sm font-semibold text-gray-700">Recurso Premium</span>
                </div>
              )}
            </div>

            {/* Filtro Resetar (Premium) */}
            <div className={`relative ${!isPremium ? 'opacity-50' : ''}`}>
              <Label className="block text-sm font-semibold text-gray-700 mb-2">
                Resetar Dados {!isPremium && '⭐ Premium'}
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <Button
                  onClick={() => handleReset('flags')}
                  disabled={!isPremium}
                  variant="outline"
                  className="flex items-center justify-center"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Resetar Marcadas
                </Button>
                <Button
                  onClick={() => handleReset('reported')}
                  disabled={!isPremium}
                  variant="outline"
                  className="flex items-center justify-center"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Resetar Reportadas
                </Button>
                <Button
                  onClick={() => handleReset('notes')}
                  disabled={!isPremium}
                  variant="outline"
                  className="flex items-center justify-center"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Resetar Anotações
                </Button>
                <Button
                  onClick={() => handleReset('history')}
                  disabled={!isPremium}
                  variant="outline"
                  className="flex items-center justify-center"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Resetar Questões
                </Button>
              </div>
              {!isPremium && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70 rounded-lg cursor-not-allowed">
                  <Lock className="w-5 h-5 text-gray-600 mr-2" />
                  <span className="text-sm font-semibold text-gray-700">Recurso Premium</span>
                </div>
              )}
            </div>

            {/* Resumo da Configuração */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border-2 border-blue-200">
              <h3 className="font-bold text-gray-900 mb-4 text-center">Resumo do Simulado</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Questões selecionadas</p>
                  <p className="text-3xl font-bold text-blue-600">{simulationQuestions.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Por página</p>
                  <p className="text-3xl font-bold text-indigo-600">{questionsPerPage}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Tipos de questão</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {selectedQuestionTypes.length === 0 ? 'Todos' : selectedQuestionTypes.length}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Disciplinas</p>
                  <p className="text-3xl font-bold text-green-600">
                    {selectedDisciplines.length > 0 ? selectedDisciplines.length : 'Todas'}
                  </p>
                </div>
              </div>
              {!isPremium && user?.questionsLimit !== 0 && (
                <p className="text-sm text-orange-600 italic text-center mt-4">
                  ℹ️ Plano gratuito: limite de {user?.questionsLimit || 30} questões por simulado
                </p>
              )}
              {(isPremium || user?.questionsLimit === 0) && (
                <p className="text-sm text-green-600 font-semibold text-center mt-4">
                  ⭐ {isPremium ? 'Premium' : 'Ilimitado'}: sem restrições de quantidade
                </p>
              )}
            </div>

            <Button
              onClick={startSimulation}
              disabled={simulationQuestions.length === 0}
              className="w-full py-6 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {simulationQuestions.length === 0 ? 'Nenhuma questão disponível' : 'Iniciar Simulado'}
            </Button>
          </div>
        </Card>

        {/* Dialog de Confirmação de Reset */}
        <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center text-orange-600">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Confirmar Reset
              </DialogTitle>
            </DialogHeader>
            <p className="text-gray-700">
              {resetType === 'flags' && 'Tem certeza que deseja remover TODAS as marcações de revisão? Esta ação não pode ser desfeita.'}
              {resetType === 'reported' && 'Tem certeza que deseja remover TODOS os problemas reportados por você? Esta ação não pode ser desfeita.'}
              {resetType === 'notes' && 'Tem certeza que deseja remover TODAS as anotações pessoais? Esta ação não pode ser desfeita.'}
              {resetType === 'history' && 'Tem certeza que deseja remover TODO o histórico de questões respondidas e suas estatísticas de acertos/erros? Todas as questões voltarão a aparecer como não respondidas. Esta ação não pode ser desfeita.'}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResetDialog(false)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmReset}
                disabled={
                  resetFlagsMutation.isPending || 
                  resetReportedMutation.isPending || 
                  resetNotesMutation.isPending ||
                  resetQuestionsHistoryMutation.isPending
                }
              >
                {(resetFlagsMutation.isPending || 
                  resetReportedMutation.isPending || 
                  resetNotesMutation.isPending ||
                  resetQuestionsHistoryMutation.isPending) ? 'Resetando...' : 'Confirmar Reset'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (showResults) {
    const correctCount = simulationQuestions.filter(q => answers[q.id] === q.correctAnswer).length;
    const percentage = ((correctCount / simulationQuestions.length) * 100).toFixed(1);

    // Análise por disciplina
    const disciplineStats = {};
    simulationQuestions.forEach(q => {
      if (!disciplineStats[q.discipline]) {
        disciplineStats[q.discipline] = { correct: 0, total: 0 };
      }
      disciplineStats[q.discipline].total++;
      if (answers[q.id] === q.correctAnswer) {
        disciplineStats[q.discipline].correct++;
      }
    });

    const filteredDisciplines = disciplineAnalysisFilter === 'all' 
      ? Object.entries(disciplineStats)
      : Object.entries(disciplineStats).filter(([disc]) => disc === disciplineAnalysisFilter);

    // Comparação com histórico
    let comparisonSims = [];
    if (comparisonFilter === 'last5') {
      comparisonSims = previousSimulations.slice(0, 5);
    } else if (comparisonFilter === 'last10') {
      comparisonSims = previousSimulations.slice(0, 10);
    } else if (comparisonFilter === 'all') {
      comparisonSims = previousSimulations;
    }

    const avgPreviousPercentage = comparisonSims.length > 0
      ? (comparisonSims.reduce((sum, sim) => sum + (sim.correctCount / sim.totalCount * 100), 0) / comparisonSims.length).toFixed(1)
      : 0;

    return (
      <div className="max-w-6xl mx-auto">
        <Card className="p-8 mb-6">
          <div className="text-center mb-8">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Simulado Finalizado!</h1>
            <p className="text-gray-600">Confira seu desempenho</p>
          </div>

          {/* Desempenho Atual */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-50 p-6 rounded-lg text-center">
              <p className="text-sm text-gray-600 mb-2">Acertos</p>
              <p className="text-4xl font-bold text-blue-600">{correctCount}</p>
            </div>
            <div className="bg-red-50 p-6 rounded-lg text-center">
              <p className="text-sm text-gray-600 mb-2">Erros</p>
              <p className="text-4xl font-bold text-red-600">{simulationQuestions.length - correctCount}</p>
            </div>
            <div className="bg-green-50 p-6 rounded-lg text-center">
              <p className="text-sm text-gray-600 mb-2">Aproveitamento</p>
              <p className="text-4xl font-bold text-green-600">{percentage}%</p>
            </div>
          </div>

          {/* Funcionalidades Premium */}
          {isPremium && (
            <div className="space-y-6 mt-8">
              {/* Filtro de Comparação de Histórico */}
              <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2 text-yellow-600" />
                      Comparação com Histórico
                    </span>
                    <Select value={comparisonFilter} onValueChange={setComparisonFilter}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Últimos 5 simulados" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="last5">Últimos 5 simulados</SelectItem>
                        <SelectItem value="last10">Últimos 10 simulados</SelectItem>
                        <SelectItem value="all">Todos os simulados</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {comparisonSims.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">Média Anterior</p>
                        <p className="text-3xl font-bold text-gray-900">{avgPreviousPercentage}%</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">Desempenho Atual</p>
                        <p className={`text-3xl font-bold ${
                          parseFloat(percentage) > parseFloat(avgPreviousPercentage) ? 'text-green-600' : 
                          parseFloat(percentage) < parseFloat(avgPreviousPercentage) ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {parseFloat(percentage) > parseFloat(avgPreviousPercentage) && '↑ '}
                          {parseFloat(percentage) < parseFloat(avgPreviousPercentage) && '↓ '}
                          {percentage}%
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {parseFloat(percentage) > parseFloat(avgPreviousPercentage) && 'Você melhorou! 🎉'}
                          {parseFloat(percentage) < parseFloat(avgPreviousPercentage) && 'Você pode melhorar'}
                          {parseFloat(percentage) === parseFloat(avgPreviousPercentage) && 'Desempenho estável'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-4">Nenhum simulado anterior para comparação.</p>
                  )}
                </CardContent>
              </Card>

              {/* Análise por Disciplina */}
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
                      Análise por Disciplina
                    </span>
                    <Select value={disciplineAnalysisFilter} onValueChange={setDisciplineAnalysisFilter}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Todas as disciplinas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as disciplinas</SelectItem>
                        {Object.keys(disciplineStats).map(disc => (
                          <SelectItem key={disc} value={disc}>{disc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {filteredDisciplines.length > 0 ? (
                      filteredDisciplines.map(([discipline, stats]) => {
                        const discPercentage = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(0) : 0;
                        return (
                          <div key={discipline} className="bg-white p-4 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-semibold text-gray-900">{discipline}</span>
                              <span className={`text-lg font-bold ${
                                discPercentage >= 70 ? 'text-green-600' :
                                discPercentage >= 50 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {stats.correct}/{stats.total} ({discPercentage}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  discPercentage >= 70 ? 'bg-green-500' :
                                  discPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${discPercentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center text-gray-500 py-4">Nenhuma disciplina para analisar com este filtro.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Relatório de IA */}
              <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
                    Análise de Eficiência com IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!aiAnalysis && !loadingAnalysis && (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">Gere um relatório personalizado com análise detalhada do seu desempenho</p>
                      <Button onClick={generateAIAnalysis} className="bg-purple-600 hover:bg-purple-700">
                        Gerar Análise com IA
                      </Button>
                    </div>
                  )}
                  
                  {loadingAnalysis && (
                    <div className="text-center py-8">
                      <Loader2 className="w-12 h-12 text-purple-600 mx-auto mb-4 animate-spin" />
                      <p className="text-gray-600">Analisando seu desempenho...</p>
                    </div>
                  )}

                  {aiAnalysis && (
                    <div className="space-y-6">
                      {/* Pontos Positivos */}
                      <div className="bg-white p-6 rounded-lg border-l-4 border-green-500">
                        <h3 className="text-lg font-bold text-green-700 mb-3 flex items-center">
                          <CheckCircle className="w-5 h-5 mr-2" />
                          Pontos Positivos
                        </h3>
                        <ul className="space-y-2 list-none pl-0">
                          {aiAnalysis.pontos_positivos.map((ponto, idx) => (
                            <li key={idx} className="flex items-start">
                              <span className="text-green-600 mr-2">✓</span>
                              <span className="text-gray-700">{ponto}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Pontos Negativos */}
                      <div className="bg-white p-6 rounded-lg border-l-4 border-red-500">
                        <h3 className="text-lg font-bold text-red-700 mb-3 flex items-center">
                          <AlertTriangle className="w-5 h-5 mr-2" />
                          Pontos que Precisam de Atenção
                        </h3>
                        <ul className="space-y-2 list-none pl-0">
                          {aiAnalysis.pontos_negativos.map((ponto, idx) => (
                            <li key={idx} className="flex items-start">
                              <span className="text-red-600 mr-2">⚠</span>
                              <span className="text-gray-700">{ponto}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Recomendações */}
                      <div className="bg-white p-6 rounded-lg border-l-4 border-blue-500">
                        <h3 className="text-lg font-bold text-blue-700 mb-3 flex items-center">
                          <BookOpen className="w-5 h-5 mr-2" />
                          Recomendações Estratégicas
                        </h3>
                        <ul className="space-y-2 list-none pl-0">
                          {aiAnalysis.recomendacoes.map((rec, idx) => (
                            <li key={idx} className="flex items-start">
                              <span className="text-blue-600 mr-2">→</span>
                              <span className="text-gray-700">{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Comparação com Histórico */}
                      <div className="bg-white p-6 rounded-lg border-l-4 border-purple-500">
                        <h3 className="text-lg font-bold text-purple-700 mb-3 flex items-center">
                          <TrendingUp className="w-5 h-5 mr-2" />
                          Evolução do Desempenho
                        </h3>
                        <p className="text-gray-700">{aiAnalysis.comparacao_historico}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {!isPremium && (
            <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 mt-8 mb-6">
              <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
                    <Award className="w-6 h-6 mr-3 text-yellow-600" />
                    Desbloqueie Análises Avançadas com o Plano Premium!
                  </h3>
                  <ul className="text-sm text-gray-700 space-y-1 ml-9">
                    <li>✓ Comparação detalhada com simulados anteriores</li>
                    <li>✓ Análise profunda por disciplina</li>
                    <li>✓ Relatório personalizado com Inteligência Artificial</li>
                    <li>✓ Recomendações estratégicas de estudo para otimizar sua preparação</li>
                  </ul>
                </div>
                <Award className="w-24 h-24 text-yellow-500 opacity-50 hidden md:block" />
              </CardContent>
            </Card>
          )}

          {/* Lista de questões com respostas */}
          <div className="space-y-4 mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Revisão das Questões</h2>
            {simulationQuestions.map((question, idx) => {
              const userAnswer = answers[question.id];
              const isCorrect = userAnswer === question.correctAnswer;
              const isCertoErrado = question.questionType === "Certo/Errado";

              return (
                <div key={question.id} className={`p-4 rounded-lg border-2 ${isCorrect ? 'border-green-500 bg-green-50' : userAnswer !== undefined ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-semibold text-gray-900">Questão {idx + 1}</span>
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <X className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mb-3">{question.questionText}</p>
                  <div className="space-y-1">
                    {question.options.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className={`p-2 rounded text-sm ${
                          optIdx === question.correctAnswer
                            ? 'bg-green-100 text-green-900 font-semibold'
                            : optIdx === userAnswer && userAnswer !== question.correctAnswer
                            ? 'bg-red-100 text-red-900'
                            : 'text-gray-700'
                        }`}
                      >
                        {isCertoErrado ? (
                          <span className="font-semibold">{opt}</span>
                        ) : (
                          <>
                            <span className="font-semibold mr-2">{String.fromCharCode(65 + optIdx)})</span>
                            {opt}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            onClick={() => {
              setSimulationStarted(false);
              setShowResults(false);
              setAiAnalysis(null); // Reset AI analysis
              setComparisonFilter('last5'); // Reset filter
              setDisciplineAnalysisFilter('all'); // Reset filter
            }}
            className="w-full mt-8 py-6 text-lg bg-blue-600 hover:bg-blue-700"
          >
            Fazer Novo Simulado
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-4 mb-6 sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Clock className="w-5 h-5 text-gray-600" />
          <span className="font-mono text-lg font-semibold">{formatTime(elapsedTime)}</span>
        </div>
        <div className="text-sm text-gray-600">
          Questões: {Object.keys(answers).length}/{simulationQuestions.length}
        </div>
        <Button onClick={finishSimulation} className="bg-green-600 hover:bg-green-700">
          Finalizar Simulado
        </Button>
      </div>

      <div className="space-y-6 mb-6">
        {currentQuestions.map((question, idx) => {
          const globalIdx = currentPage * questionsPerPage + idx;
          const questionNumber = globalIdx + 1;
          const isCertoErrado = question.questionType === "Certo/Errado";

          return (
            <Card key={question.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-lg text-gray-900">Questão {questionNumber}</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {question.discipline}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full font-semibold ${
                      isCertoErrado 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {question.questionType}
                    </span>
                  </div>
                  <p className="text-gray-800 leading-relaxed">{question.questionText}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleFlag(question.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      flags[question.id] ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title="Marcar para revisão"
                  >
                    <Flag className="w-5 h-5" />
                  </button>
                  {isPremium && (
                    <>
                      <button
                        onClick={() => {
                          setCurrentQuestionForModal(question.id);
                          setShowNoteModal(true);
                        }}
                        className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        title="Adicionar nota"
                      >
                        <BookOpen className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setCurrentQuestionForModal(question.id);
                          setShowReportModal(true);
                        }}
                        className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        title="Reportar problema"
                      >
                        <AlertTriangle className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {question.options.map((option, optIdx) => (
                  <button
                    key={optIdx}
                    onClick={() => handleAnswer(question.id, optIdx)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      answers[question.id] === optIdx
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    {isCertoErrado ? (
                      <span className="font-semibold">{option}</span>
                    ) : (
                      <>
                        <span className="font-semibold mr-3">{String.fromCharCode(65 + optIdx)})</span>
                        {option}
                      </>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between items-center mb-8">
        <Button
          onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
          disabled={currentPage === 0}
          variant="outline"
        >
          <ChevronLeft className="w-5 h-5 mr-2" />
          Anterior
        </Button>
        <span className="text-gray-600">
          Página {currentPage + 1} de {totalPages}
        </span>
        <Button
          onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
          disabled={currentPage === totalPages - 1}
          variant="outline"
        >
          Próxima
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>

      <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Nota Pessoal</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Digite sua nota sobre esta questão..."
            value={notes[currentQuestionForModal] || ''}
            onChange={(e) => setNotes(prev => ({ ...prev, [currentQuestionForModal]: e.target.value }))}
            className="min-h-[150px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => handleSaveNote(currentQuestionForModal, notes[currentQuestionForModal] || '')}>
              Salvar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar Problema</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Descreva o problema encontrado nesta questão..."
            className="min-h-[150px]"
            id="issue-text"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const issueText = document.getElementById('issue-text').value;
                if (issueText.trim()) {
                  handleReportIssue(currentQuestionForModal, issueText);
                } else {
                  showFeedback('Por favor, descreva o problema.', 'error');
                }
              }}
            >
              Enviar Relatório
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {feedback && (
        <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-xl border-l-4 flex items-center max-w-sm ${
          feedback.type === 'success' ? 'bg-green-50 border-green-500' :
          feedback.type === 'error' ? 'bg-red-50 border-red-500' :
          'bg-blue-50 border-blue-500'
        }`}>
          <CheckCircle className={`w-5 h-5 mr-3 ${
            feedback.type === 'success' ? 'text-green-600' :
            feedback.type === 'error' ? 'text-red-600' :
            'text-blue-600'
          }`} />
          <span className="text-sm font-medium">{feedback.message}</span>
        </div>
      )}
    </div>
  );
}
