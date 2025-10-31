
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { BookOpen, Search, Edit, Trash2, Plus, AlertTriangle, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export default function QuestionManager() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('all');
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  // Novos estados para exclusão em massa
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleteType, setBulkDeleteType] = useState('');
  const [showTimeDeleteDialog, setShowTimeDeleteDialog] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timeFilterDiscipline, setTimeFilterDiscipline] = useState('all');
  const [timeFilterYear, setTimeFilterYear] = useState('all');
  const [timeFilterInstitution, setTimeFilterInstitution] = useState('all');
  
  const [newQuestion, setNewQuestion] = useState({
    discipline: '',
    subject: '',
    questionType: 'Múltipla Escolha', // Adicionado tipo de questão
    questionText: '',
    options: ['', '', '', '', ''],
    correctAnswer: 0,
    difficulty: 'médio',
    source: '',
    year: new Date().getFullYear(),
    institution: '',
    status: 'ativa',
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const checkAdmin = async () => {
      const user = await base44.auth.me();
      if (user.email !== "rafaelsalesgelim@gmail.com") {
        window.location.href = createPageUrl("UserDashboard");
      }
      setCurrentUser(user);
    };
    checkAdmin();
  }, []);

  const { data: questions = [] } = useQuery({
    queryKey: ['all-questions'],
    queryFn: () => base44.entities.Question.list(),
    enabled: !!currentUser,
  });

  const { data: reportedIssues = [] } = useQuery({
    queryKey: ['all-reported-issues'],
    queryFn: () => base44.entities.ReportedIssue.list(),
    enabled: !!currentUser,
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({ questionId, data }) => base44.entities.Question.update(questionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['all-questions']);
      setShowEditDialog(false);
      setEditingQuestion(null);
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId) => base44.entities.Question.delete(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries(['all-questions']);
      queryClient.invalidateQueries(['all-reported-issues']); // Invalidate reported issues when a question is deleted
    },
    onError: (error) => {
        console.error("Erro ao excluir questão:", error);
        alert("Ocorreu um erro ao excluir a questão. Tente novamente.");
    }
  });

  const deleteReportedIssueMutation = useMutation({
    mutationFn: (issueId) => base44.entities.ReportedIssue.delete(issueId),
    onSuccess: () => {
      queryClient.invalidateQueries(['all-reported-issues']); // Invalidate reported issues specifically
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: (data) => base44.entities.Question.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['all-questions']);
      setShowAddDialog(false);
      setNewQuestion({
        discipline: '',
        subject: '',
        questionType: 'Múltipla Escolha', // Resetando o tipo de questão
        questionText: '',
        options: ['', '', '', '', ''],
        correctAnswer: 0,
        difficulty: 'médio',
        source: '',
        year: new Date().getFullYear(),
        institution: '',
        status: 'ativa',
      });
    },
  });

  const availableDisciplines = [...new Set(questions.map(q => q.discipline))].filter(Boolean);
  const availableYears = [...new Set(questions.map(q => q.year).filter(Boolean))].sort((a, b) => b - a);
  const availableInstitutions = [...new Set(questions.map(q => q.institution))].filter(Boolean);

  // Filtrar apenas issues de questões que ainda existem
  const activeReportedIssues = reportedIssues.filter(issue => 
    questions.some(q => q.id === issue.questionId)
  );

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.questionText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (q.discipline || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDiscipline = filterDiscipline === 'all' || q.discipline === filterDiscipline;
    return matchesSearch && matchesDiscipline;
  });

  const handleEditQuestion = (question) => {
    // Adiciona um valor padrão para questionType se não existir (para questões antigas)
    setEditingQuestion({
      ...question,
      questionType: question.questionType || 'Múltipla Escolha'
    });
    setShowEditDialog(true);
  };

  const handleSaveQuestion = () => {
    if (!editingQuestion) return;
    updateQuestionMutation.mutate({
      questionId: editingQuestion.id,
      data: editingQuestion
    });
  };

  const handleDeleteQuestion = async (questionId) => {
    if (window.confirm('Tem certeza que deseja excluir esta questão?')) {
      try {
        // Primeiro, excluir os problemas reportados relacionados a esta questão
        const relatedIssues = reportedIssues.filter(issue => issue.questionId === questionId);
        await Promise.all(relatedIssues.map(issue => deleteReportedIssueMutation.mutateAsync(issue.id)));
        
        // Depois, excluir a questão
        await deleteQuestionMutation.mutateAsync(questionId);
      } catch (error) {
        console.error("Erro ao excluir questão e problemas relacionados:", error);
        alert("Ocorreu um erro ao excluir a questão e seus problemas reportados. Tente novamente.");
      }
    }
  };

  const handleCreateQuestion = () => {
    createQuestionMutation.mutate(newQuestion);
  };

  const handleBulkAction = (actionType) => {
    setBulkDeleteType(actionType);
    setShowBulkDeleteDialog(true);
  };

  const confirmBulkDelete = async () => {
    if (bulkDeleteType === 'all') {
      const numQuestions = questions.length;
      if (numQuestions === 0) {
        alert('Não há questões para excluir.');
        setShowBulkDeleteDialog(false);
        return;
      }
      try {
        // Excluir todos os problemas reportados
        await Promise.all(reportedIssues.map(issue => deleteReportedIssueMutation.mutateAsync(issue.id)));
        
        // Excluir todas as questões
        await Promise.all(questions.map(q => deleteQuestionMutation.mutateAsync(q.id)));
        alert(`${numQuestions} questões foram excluídas com sucesso!`);
      } catch (error) {
        console.error("Erro ao excluir todas as questões:", error);
        alert("Ocorreu um erro ao excluir todas as questões.");
      }
    } else if (bulkDeleteType === 'reported') {
      const reportedQuestionIds = [...new Set(activeReportedIssues.map(issue => issue.questionId))];
      const reportedQuestions = questions.filter(q => reportedQuestionIds.includes(q.id));
      const numReportedQuestions = reportedQuestions.length;
      if (numReportedQuestions === 0) {
        alert('Não há questões reportadas para excluir.');
        setShowBulkDeleteDialog(false);
        return;
      }
      try {
        // Excluir os problemas reportados relacionados
        await Promise.all(activeReportedIssues.map(issue => deleteReportedIssueMutation.mutateAsync(issue.id)));
        
        // Excluir as questões reportadas
        await Promise.all(reportedQuestions.map(q => deleteQuestionMutation.mutateAsync(q.id)));
        alert(`${numReportedQuestions} questões reportadas foram excluídas com sucesso!`);
      } catch (error) {
        console.error("Erro ao excluir questões reportadas:", error);
        alert("Ocorreu um erro ao excluir as questões reportadas.");
      }
    }
    setShowBulkDeleteDialog(false);
  };

  const handleTimeBasedDelete = () => {
    if (!startDate || !endDate) {
      alert('Por favor, selecione o intervalo de datas.');
      return;
    }
    setShowTimeDeleteDialog(true);
  };

  const confirmTimeBasedDelete = async () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Incluir todo o dia final

    let questionsToDelete = questions.filter(q => {
      // Ensure created_date exists and is a valid date string/timestamp
      if (!q.created_date) return false;
      const createdDate = new Date(q.created_date);
      return createdDate >= start && createdDate <= end;
    });

    // Aplicar filtros adicionais
    if (timeFilterDiscipline !== 'all') {
      questionsToDelete = questionsToDelete.filter(q => q.discipline === timeFilterDiscipline);
    }
    if (timeFilterYear !== 'all') {
      questionsToDelete = questionsToDelete.filter(q => q.year === parseInt(timeFilterYear));
    }
    if (timeFilterInstitution !== 'all') {
      questionsToDelete = questionsToDelete.filter(q => q.institution === timeFilterInstitution);
    }

    if (questionsToDelete.length === 0) {
      alert('Nenhuma questão encontrada com os filtros selecionados para exclusão.');
      setShowTimeDeleteDialog(false);
      return;
    }
    
    try {
        // Excluir problemas reportados relacionados às questões que serão excluídas
        const questionIdsToDelete = questionsToDelete.map(q => q.id);
        const relatedIssues = reportedIssues.filter(issue => questionIdsToDelete.includes(issue.questionId));
        await Promise.all(relatedIssues.map(issue => deleteReportedIssueMutation.mutateAsync(issue.id)));

        // Excluir as questões
        await Promise.all(questionsToDelete.map(q => deleteQuestionMutation.mutateAsync(q.id)));
        alert(`${questionsToDelete.length} questões foram excluídas com sucesso!`);
        
        // Limpar filtros
        setStartDate('');
        setEndDate('');
        setTimeFilterDiscipline('all');
        setTimeFilterYear('all');
        setTimeFilterInstitution('all');
    } catch (error) {
        console.error("Erro ao excluir questões por período:", error);
        alert("Ocorreu um erro ao excluir questões por período.");
    }
    setShowTimeDeleteDialog(false);
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciar Questões</h1>
          <p className="text-gray-600 mt-2">Edite e organize o banco de questões</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-5 h-5 mr-2" />
          Nova Questão
        </Button>
      </div>

      {/* Filtros de Ação em Massa */}
      <Card className="bg-orange-50 border-2 border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center text-orange-900">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Ações em Massa - Zona de Perigo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bulk-delete-action" className="text-sm font-semibold text-gray-700 mb-2 block">
                Ação de Exclusão
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => handleBulkAction('all')}
                  variant="destructive"
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Todas as Questões
                </Button>
                <Button
                  onClick={() => handleBulkAction('reported')}
                  variant="destructive"
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Questões Reportadas ({activeReportedIssues.length})
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t border-orange-300 pt-4 mt-4">
            <Label className="text-sm font-semibold text-gray-700 mb-3 block">
              <Calendar className="w-4 h-4 inline mr-2" />
              Exclusão por Período de Importação
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="start-date" className="text-xs text-gray-600">Data Inicial</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="end-date" className="text-xs text-gray-600">Data Final</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="time-filter-discipline" className="text-xs text-gray-600">Filtrar por Disciplina</Label>
                <Select value={timeFilterDiscipline} onValueChange={setTimeFilterDiscipline}>
                  <SelectTrigger id="time-filter-discipline" className="mt-1">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {availableDisciplines.map(disc => (
                      <SelectItem key={disc} value={disc}>{disc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="time-filter-year" className="text-xs text-gray-600">Filtrar por Ano</Label>
                <Select value={timeFilterYear} onValueChange={setTimeFilterYear}>
                  <SelectTrigger id="time-filter-year" className="mt-1">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <Label htmlFor="time-filter-institution" className="text-xs text-gray-600">Filtrar por Instituição</Label>
                <Select value={timeFilterInstitution} onValueChange={setTimeFilterInstitution}>
                  <SelectTrigger id="time-filter-institution" className="mt-1">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {availableInstitutions.map(inst => (
                      <SelectItem key={inst} value={inst}>{inst}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleTimeBasedDelete}
                  variant="destructive"
                  className="w-full bg-red-600 hover:bg-red-700"
                  disabled={!startDate || !endDate || deleteQuestionMutation.isPending || deleteReportedIssueMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir por Período
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
              Questões Cadastradas ({filteredQuestions.length})
            </CardTitle>
            <div className="flex gap-3">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar questão..."
                  className="pl-10"
                />
              </div>
              <Select value={filterDiscipline} onValueChange={setFilterDiscipline}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Disciplina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {availableDisciplines.map(disc => (
                    <SelectItem key={disc} value={disc}>{disc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredQuestions.map((question) => (
              <div key={question.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-semibold">
                        {question.discipline}
                      </span>
                      {question.questionType && ( // Display question type if available
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-semibold">
                          {question.questionType}
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs rounded-full font-semibold ${
                        question.status === 'ativa' ? 'bg-green-100 text-green-800' :
                        question.status === 'revisão' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {question.status}
                      </span>
                    </div>
                    <p className="text-gray-900 font-medium mb-2">
                      {question.questionText.substring(0, 150)}...
                    </p>
                    <p className="text-sm text-gray-500">
                      {question.source && `${question.source} • `}
                      {question.year && `${question.year} • `}
                      {question.difficulty}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      onClick={() => handleEditQuestion(question)}
                      variant="outline"
                      size="sm"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDeleteQuestion(question.id)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {filteredQuestions.length === 0 && (
              <p className="text-center text-gray-500 py-12">
                Nenhuma questão encontrada
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Confirmação de Exclusão em Massa */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Confirmar Exclusão em Massa
            </DialogTitle>
            <DialogDescription>
              {bulkDeleteType === 'all' && (
                <span>Você está prestes a excluir <strong>TODAS as {questions.length} questões</strong> do banco de dados e todos os problemas reportados. Esta ação é irreversível!</span>
              )}
              {bulkDeleteType === 'reported' && (
                <span>Você está prestes a excluir todas as questões que foram reportadas com erros e seus respectivos problemas reportados. Esta ação é irreversível!</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete} disabled={deleteQuestionMutation.isPending || deleteReportedIssueMutation.isPending}>
              {deleteQuestionMutation.isPending || deleteReportedIssueMutation.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão por Período */}
      <Dialog open={showTimeDeleteDialog} onOpenChange={setShowTimeDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Confirmar Exclusão por Período
            </DialogTitle>
            <DialogDescription>
              Você está prestes a excluir questões importadas entre <strong>{new Date(startDate).toLocaleDateString('pt-BR')}</strong> e <strong>{new Date(endDate).toLocaleDateString('pt-BR')}</strong>, e quaisquer problemas reportados relacionados.
              {timeFilterDiscipline !== 'all' && ` Disciplina: ${timeFilterDiscipline}.`}
              {timeFilterYear !== 'all' && ` Ano: ${timeFilterYear}.`}
              {timeFilterInstitution !== 'all' && ` Instituição: ${timeFilterInstitution}.`}
              <br/><br/>
              Esta ação é irreversível!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTimeDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmTimeBasedDelete} disabled={deleteQuestionMutation.isPending || deleteReportedIssueMutation.isPending}>
              {deleteQuestionMutation.isPending || deleteReportedIssueMutation.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Questão</DialogTitle>
          </DialogHeader>
          {editingQuestion && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Disciplina</label>
                  <Input
                    value={editingQuestion.discipline}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, discipline: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assunto</label>
                  <Input
                    value={editingQuestion.subject || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, subject: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Questão</label>
                <Select
                  value={editingQuestion.questionType}
                  onValueChange={(value) => {
                    const newOptions = value === 'Certo/Errado' 
                      ? ['Certo', 'Errado'] 
                      : ['', '', '', '', ''];
                    setEditingQuestion({ 
                      ...editingQuestion, 
                      questionType: value,
                      options: newOptions,
                      correctAnswer: 0 // Reset correct answer when type changes
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Certo/Errado">Certo/Errado</SelectItem>
                    <SelectItem value="Múltipla Escolha">Múltipla Escolha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Texto da Questão</label>
                <Textarea
                  value={editingQuestion.questionText}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, questionText: e.target.value })}
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Opções de Resposta</label>
                {editingQuestion.options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <span className="w-16 text-center font-semibold">
                      {editingQuestion.questionType === 'Certo/Errado' 
                        ? (idx === 0 ? 'Certo' : 'Errado')
                        : String.fromCharCode(65 + idx) + ')'}
                    </span>
                    <Input
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...editingQuestion.options];
                        newOptions[idx] = e.target.value;
                        setEditingQuestion({ ...editingQuestion, options: newOptions });
                      }}
                      disabled={editingQuestion.questionType === 'Certo/Errado'}
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Resposta Correta</label>
                  <Select
                    value={editingQuestion.correctAnswer.toString()}
                    onValueChange={(value) => setEditingQuestion({ ...editingQuestion, correctAnswer: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {editingQuestion.questionType === 'Certo/Errado' ? (
                        <>
                          <SelectItem value="0">Certo</SelectItem>
                          <SelectItem value="1">Errado</SelectItem>
                        </>
                      ) : (
                        [0, 1, 2, 3, 4].map(idx => (
                          <SelectItem key={idx} value={idx.toString()}>
                            {String.fromCharCode(65 + idx)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dificuldade</label>
                  <Select
                    value={editingQuestion.difficulty}
                    onValueChange={(value) => setEditingQuestion({ ...editingQuestion, difficulty: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fácil">Fácil</SelectItem>
                      <SelectItem value="médio">Médio</SelectItem>
                      <SelectItem value="difícil">Difícil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <Select
                    value={editingQuestion.status}
                    onValueChange={(value) => setEditingQuestion({ ...editingQuestion, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativa">Ativa</SelectItem>
                      <SelectItem value="revisão">Revisão</SelectItem>
                      <SelectItem value="inativa">Inativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fonte</label>
                  <Input
                    value={editingQuestion.source || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, source: e.target.value })}
                    placeholder="Ex: CESPE, FCC"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
                  <Input
                    type="number"
                    value={editingQuestion.year || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, year: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Instituição</label>
                  <Input
                    value={editingQuestion.institution || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, institution: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveQuestion} disabled={updateQuestionMutation.isPending}>
              {updateQuestionMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Questão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Disciplina</label>
                <Input
                  value={newQuestion.discipline}
                  onChange={(e) => setNewQuestion({ ...newQuestion, discipline: e.target.value })}
                  placeholder="Ex: Português"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assunto</label>
                <Input
                  value={newQuestion.subject}
                  onChange={(e) => setNewQuestion({ ...newQuestion, subject: e.target.value })}
                  placeholder="Ex: Sintaxe"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Questão</label>
              <Select
                value={newQuestion.questionType}
                onValueChange={(value) => {
                  const newOptions = value === 'Certo/Errado' 
                    ? ['Certo', 'Errado'] 
                    : ['', '', '', '', ''];
                  setNewQuestion({ 
                    ...newQuestion, 
                    questionType: value,
                    options: newOptions,
                    correctAnswer: 0 // Reset correct answer when type changes
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Certo/Errado">Certo/Errado</SelectItem>
                  <SelectItem value="Múltipla Escolha">Múltipla Escolha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Texto da Questão</label>
              <Textarea
                value={newQuestion.questionText}
                onChange={(e) => setNewQuestion({ ...newQuestion, questionText: e.target.value })}
                rows={4}
                placeholder="Digite o enunciado da questão"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Opções de Resposta</label>
              {newQuestion.options.map((option, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <span className="w-16 text-center font-semibold">
                    {newQuestion.questionType === 'Certo/Errado' 
                      ? (idx === 0 ? 'Certo' : 'Errado')
                      : String.fromCharCode(65 + idx) + ')'}
                  </span>
                  <Input
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...newQuestion.options];
                      newOptions[idx] = e.target.value;
                      setNewQuestion({ ...newQuestion, options: newOptions });
                    }}
                    placeholder={newQuestion.questionType === 'Certo/Errado' ? '' : `Opção ${String.fromCharCode(65 + idx)}`}
                    disabled={newQuestion.questionType === 'Certo/Errado'}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resposta Correta</label>
                <Select
                  value={newQuestion.correctAnswer.toString()}
                  onValueChange={(value) => setNewQuestion({ ...newQuestion, correctAnswer: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {newQuestion.questionType === 'Certo/Errado' ? (
                      <>
                        <SelectItem value="0">Certo</SelectItem>
                        <SelectItem value="1">Errado</SelectItem>
                      </>
                    ) : (
                      [0, 1, 2, 3, 4].map(idx => (
                        <SelectItem key={idx} value={idx.toString()}>
                          {String.fromCharCode(65 + idx)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dificuldade</label>
                <Select
                  value={newQuestion.difficulty}
                  onValueChange={(value) => setNewQuestion({ ...newQuestion, difficulty: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fácil">Fácil</SelectItem>
                    <SelectItem value="médio">Médio</SelectItem>
                    <SelectItem value="difícil">Difícil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
                <Input
                  type="number"
                  value={newQuestion.year}
                  onChange={(e) => setNewQuestion({ ...newQuestion, year: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fonte</label>
                <Input
                  value={newQuestion.source}
                  onChange={(e) => setNewQuestion({ ...newQuestion, source: e.target.value })}
                  placeholder="Ex: CESPE, FCC"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Instituição</label>
                <Input
                  value={newQuestion.institution}
                  onChange={(e) => setNewQuestion({ ...newQuestion, institution: e.target.value })}
                  placeholder="Ex: TRT, INSS"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateQuestion} disabled={createQuestionMutation.isPending}>
              {createQuestionMutation.isPending ? 'Criando...' : 'Criar Questão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
