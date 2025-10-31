
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import {
  BookOpen, Users, AlertCircle, TrendingUp, Upload, Settings,
  CheckCircle, XCircle, Clock, BarChart3, ExternalLink, ArrowLeft, LogOut, Edit, Power, Shield, Trash2, Filter, Flag
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [activeTab, setActiveTab] = useState('questoes'); // 'questoes', 'users', 'permissions'

  const queryClient = useQueryClient();

  useEffect(() => {
    const checkAdmin = async () => {
      const currentUser = await base44.auth.me();
      if (currentUser.email !== "rafaelsalesgelim@gmail.com") {
        window.location.href = createPageUrl("UserDashboard");
      }
      setUser(currentUser);
    };
    checkAdmin();
  }, []);

  const handleLogout = async () => {
    await base44.auth.logout(createPageUrl("Home"));
  };

  const { data: questions = [] } = useQuery({
    queryKey: ['admin-questions'],
    queryFn: () => base44.entities.Question.list(),
    enabled: !!user,
  });

  const { data: users = [], isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      try {
        const usersList = await base44.entities.User.list();
        return usersList || [];
      } catch (error) {
        console.error("Erro ao buscar usuários:", error);
        throw error;
      }
    },
    enabled: !!user,
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const { data: issues = [] } = useQuery({
    queryKey: ['admin-issues'],
    queryFn: () => base44.entities.ReportedIssue.filter({ status: 'pendente' }),
    enabled: !!user,
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ['admin-simulations'],
    queryFn: () => base44.entities.SimulationHistory.list('-created_date', 10),
    enabled: !!user,
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId) => base44.entities.Question.delete(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-questions']);
      showFeedback('Questão excluída com sucesso!', 'success');
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }) => base44.entities.User.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
      setShowEditUserDialog(false);
      setShowPermissionsDialog(false);
      setEditingUser(null);
      setEditingPermissions(null);
      showFeedback('Usuário atualizado com sucesso!', 'success');
    },
    onError: (error) => {
      showFeedback('Erro ao atualizar usuário: ' + error.message, 'error');
    }
  });

  const showFeedback = (message, type = 'info') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const activeIssues = issues.filter(issue => 
    questions.some(q => q.id === issue.questionId)
  );

  const activeQuestions = questions.filter(q => q.status === 'ativa').length;
  const premiumUsers = users.filter(u => u.plan === 'PREMIUM' && u.status === 'ATIVO').length;
  const pendingIssues = activeIssues.length;

  const handleIssueClick = (issue) => {
    const question = questions.find(q => q.id === issue.questionId);
    if (question) {
      setSelectedQuestion({ question, issue });
      setShowQuestionDialog(true);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (window.confirm('Tem certeza que deseja excluir esta questão? Esta ação não pode ser desfeita.')) {
      deleteQuestionMutation.mutate(questionId);
    }
  };

  const handleEditUser = (userToEdit) => {
    setEditingUser({
      ...userToEdit,
      plan: userToEdit.plan || 'GRATUITO',
      status: userToEdit.status || 'ATIVO',
      questionsLimit: userToEdit.questionsLimit || 30
    });
    setShowEditUserDialog(true);
  };

  const handleEditPermissions = (userToEdit) => {
    const defaultPermissions = {
      canCreateSimulado: true,
      canFilterQuestions: true,
      canViewStatistics: true,
      canViewHistory: true,
      canFlagQuestions: true,
      canReportIssues: true,
      canExportResults: false,
      dailyQuestionsLimit: 30
    };
    
    setEditingPermissions({
      userId: userToEdit.id,
      email: userToEdit.email,
      full_name: userToEdit.full_name,
      permissions: userToEdit.simuladoPermissions || defaultPermissions
    });
    setShowPermissionsDialog(true);
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    
    updateUserMutation.mutate({
      userId: editingUser.id,
      data: {
        full_name: editingUser.full_name,
        plan: editingUser.plan,
        status: editingUser.status,
        questionsLimit: parseInt(editingUser.questionsLimit) || 30,
      }
    });
  };

  const handleSavePermissions = () => {
    if (!editingPermissions) return;
    
    updateUserMutation.mutate({
      userId: editingPermissions.userId,
      data: {
        simuladoPermissions: editingPermissions.permissions
      }
    });
  };

  const toggleUserStatus = (userToToggle) => {
    const newStatus = userToToggle.status === 'ATIVO' ? 'SUSPENSO' : 'ATIVO';
    updateUserMutation.mutate({
      userId: userToToggle.id,
      data: { status: newStatus }
    });
  };

  const togglePermission = (permissionKey) => {
    setEditingPermissions({
      ...editingPermissions,
      permissions: {
        ...editingPermissions.permissions,
        [permissionKey]: !editingPermissions.permissions[permissionKey]
      }
    });
  };

  const updateDailyLimit = (newLimit) => {
    setEditingPermissions({
      ...editingPermissions,
      permissions: {
        ...editingPermissions.permissions,
        dailyQuestionsLimit: parseInt(newLimit) || 30
      }
    });
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', backgroundColor: '#121212' }}>
        <div style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #007BFF', borderRadius: '50%', width: '48px', height: '48px', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  const isPermissionError = usersError?.message?.includes('Permission denied');

  const simuladoFunctionalities = [
    { key: 'canCreateSimulado', label: 'Criar Simulados', description: 'Permite iniciar novos simulados personalizados', icon: BookOpen, hasLimit: false },
    { key: 'canFilterQuestions', label: 'Filtrar Questões', description: 'Permite usar filtros por disciplina, tipo e status', icon: Filter, hasLimit: false },
    { key: 'canViewStatistics', label: 'Ver Estatísticas', description: 'Permite visualizar gráficos e análises de desempenho', icon: BarChart3, hasLimit: false },
    { key: 'canViewHistory', label: 'Ver Histórico', description: 'Permite acessar histórico de simulados anteriores', icon: Clock, hasLimit: false },
    { key: 'canFlagQuestions', label: 'Marcar Questões', description: 'Permite marcar questões para revisão posterior', icon: Flag, hasLimit: false },
    { key: 'canReportIssues', label: 'Reportar Problemas', description: 'Permite reportar erros em questões', icon: AlertCircle, hasLimit: false },
    { key: 'canExportResults', label: 'Exportar Resultados', description: 'Permite exportar análises em PDF (Premium)', icon: TrendingUp, hasLimit: false },
    { key: 'dailyQuestionsLimit', label: 'Limite Diário de Questões', description: 'Número máximo de questões por dia', icon: Shield, hasLimit: true }
  ];

  return (
    <div style={{ backgroundColor: '#121212', minHeight: '100vh', padding: '20px', color: '#E0E0E0' }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: '2px solid #333333', paddingBottom: '10px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <button
            onClick={() => window.location.href = createPageUrl('UserDashboard')}
            style={{ backgroundColor: '#555', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
            Voltar ao Sistema Simulados
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ color: '#aaa', fontSize: '0.9rem' }}>
              {user.full_name || user.email}
            </span>
            <span style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: '600', background: 'linear-gradient(to right, #f7931e, #ff6b35)', color: 'white', borderRadius: '9999px' }}>
              ADMIN
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
          Painel Admin - Sistema Simulados
        </div>
        <p style={{ color: '#aaa' }}>Gerenciamento completo de questões, simulados e usuários</p>
      </header>

      {feedback && (
        <div style={{ 
          backgroundColor: feedback.type === 'success' ? '#1a3d1a' : '#3d1a1a', 
          border: `2px solid ${feedback.type === 'success' ? '#28a745' : '#dc3545'}`,
          color: feedback.type === 'success' ? '#28a745' : '#dc3545',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontWeight: '600'
        }}>
          {feedback.message}
        </div>
      )}

      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', borderBottom: '2px solid #333333', paddingBottom: '10px' }}>
          <button
            onClick={() => setActiveTab('questoes')}
            style={{
              padding: '10px 20px',
              backgroundColor: activeTab === 'questoes' ? '#007BFF' : '#2A2A2A',
              color: 'white',
              border: 'none',
              borderRadius: '5px 5px 0 0',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <BookOpen style={{ width: '16px', height: '16px' }} />
            Questões
          </button>
          <button
            onClick={() => setActiveTab('users')}
            style={{
              padding: '10px 20px',
              backgroundColor: activeTab === 'users' ? '#007BFF' : '#2A2A2A',
              color: 'white',
              border: 'none',
              borderRadius: '5px 5px 0 0',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Users style={{ width: '16px', height: '16px' }} />
            Usuários
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            style={{
              padding: '10px 20px',
              backgroundColor: activeTab === 'permissions' ? '#007BFF' : '#2A2A2A',
              color: 'white',
              border: 'none',
              borderRadius: '5px 5px 0 0',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Shield style={{ width: '16px', height: '16px' }} />
            Permissões
          </button>
        </div>

        {/* Alerta de Permissão */}
        {isPermissionError && (
          <div style={{ 
            backgroundColor: '#fef3c7', 
            border: '2px solid #f59e0b', 
            borderRadius: '10px', 
            padding: '20px', 
            marginBottom: '30px' 
          }}>
            <div style={{ display: 'flex', alignItems: 'start', gap: '15px' }}>
              <AlertCircle style={{ width: '24px', height: '24px', color: '#f59e0b', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <h3 style={{ color: '#92400e', fontWeight: 'bold', marginBottom: '10px', fontSize: '1.1rem' }}>
                  ⚠️ Permissão de Administrador Necessária
                </h3>
                <p style={{ color: '#78350f', marginBottom: '15px', lineHeight: '1.6' }}>
                  O usuário <strong>{user.email}</strong> não tem permissão de administrador no sistema base44.
                  Para visualizar e gerenciar usuários, você precisa conceder permissões de admin.
                </p>
                
                <div style={{ backgroundColor: '#fffbeb', padding: '15px', borderRadius: '8px', border: '1px solid #fbbf24' }}>
                  <p style={{ color: '#92400e', fontWeight: 'bold', marginBottom: '10px' }}>
                    📋 Como Corrigir:
                  </p>
                  <ol style={{ color: '#78350f', paddingLeft: '20px', margin: 0, lineHeight: '1.8' }}>
                    <li>Acesse o <strong>Dashboard do base44</strong></li>
                    <li>Vá em <strong>Data → User</strong></li>
                    <li>Encontre o usuário <strong>{user.email}</strong></li>
                    <li>Edite e altere o campo <strong>role</strong> ou <strong>_app_role</strong> para <strong>"admin"</strong></li>
                    <li>Salve e recarregue esta página</li>
                  </ol>
                </div>

                <button
                  onClick={() => window.location.reload()}
                  style={{
                    marginTop: '15px',
                    padding: '10px 20px',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  🔄 Recarregar Página
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Estatísticas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #007BFF' }}>
            <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Total de Questões</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#E0E0E0' }}>{questions.length}</div>
            <div style={{ fontSize: '0.875rem', color: '#28a745', marginTop: '5px' }}>{activeQuestions} ativas</div>
          </div>
          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #28a745' }}>
            <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Usuários Cadastrados</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#E0E0E0' }}>
              {isPermissionError ? '?' : users.length}
            </div>
            {!isPermissionError && (
              <div style={{ fontSize: '0.875rem', color: '#f7931e', marginTop: '5px' }}>{premiumUsers} premium ativos</div>
            )}
          </div>
          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #f7931e' }}>
            <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Problemas Pendentes</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#E0E0E0' }}>{pendingIssues}</div>
            <div style={{ fontSize: '0.875rem', color: '#aaa', marginTop: '5px' }}>Aguardando análise</div>
          </div>
          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #9c27b0' }}>
            <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Simulados Hoje</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#E0E0E0' }}>
              {simulations.filter(s => {
                const today = new Date().toDateString();
                return new Date(s.created_date).toDateString() === today;
              }).length}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#aaa', marginTop: '5px' }}>Realizados</div>
          </div>
        </div>

        {/* Tab Content - Questões */}
        {activeTab === 'questoes' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <AlertCircle style={{ width: '20px', height: '20px', marginRight: '10px', color: '#f7931e' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>Problemas Reportados Recentes</h2>
              </div>
              {activeIssues.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#aaa', padding: '40px 0' }}>Nenhum problema pendente</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeIssues.slice(0, 5).map((issue) => (
                    <div
                      key={issue.id}
                      onClick={() => handleIssueClick(issue)}
                      style={{
                        padding: '16px',
                        backgroundColor: '#2A2A2A',
                        borderRadius: '8px',
                        border: '1px solid #444',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#333';
                        e.currentTarget.style.borderColor = '#f7931e';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#2A2A2A';
                        e.currentTarget.style.borderColor = '#444';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#E0E0E0' }}>{issue.userEmail}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>
                            {new Date(issue.created_date).toLocaleDateString('pt-BR')}
                          </span>
                          <ExternalLink style={{ width: '14px', height: '14px', color: '#f7931e' }} />
                        </div>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#ccc', lineHeight: '1.5' }}>{issue.issueText}</p>
                      <p style={{ fontSize: '0.75rem', color: '#f7931e', marginTop: '8px', fontWeight: '500' }}>
                        Clique para ver a questão completa
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <BookOpen style={{ width: '20px', height: '20px', marginRight: '10px', color: '#007BFF' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>
                  Questões Recentes ({questions.length})
                </h2>
              </div>
              {questions.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#aaa', padding: '40px 0' }}>Nenhuma questão cadastrada ainda</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto' }}>
                  {questions.slice(0, 10).map((question) => (
                    <div key={question.id} style={{ padding: '16px', backgroundColor: '#2A2A2A', borderRadius: '8px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <span style={{
                              padding: '3px 10px',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              borderRadius: '12px',
                              backgroundColor: '#007BFF',
                              color: 'white'
                            }}>
                              {question.discipline}
                            </span>
                            <span style={{
                              padding: '3px 10px',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              borderRadius: '12px',
                              backgroundColor: question.questionType === 'Certo/Errado' ? '#28a745' : '#9c27b0',
                              color: 'white'
                            }}>
                              {question.questionType}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.875rem', color: '#ccc', margin: '4px 0', lineHeight: '1.5' }}>
                            {question.questionText.substring(0, 100)}...
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteQuestion(question.id)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            marginLeft: '10px'
                          }}
                        >
                          <Trash2 style={{ width: '12px', height: '12px' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content - Users */}
        {activeTab === 'users' && (
          <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Users style={{ width: '20px', height: '20px', marginRight: '10px', color: '#007BFF' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>
                  Usuários Cadastrados ({isPermissionError ? '?' : users.length})
                </h2>
              </div>
              <button
                onClick={() => refetchUsers()}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#007BFF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                🔄 Atualizar
              </button>
            </div>

            {usersLoading ? (
              <p style={{ textAlign: 'center', color: '#aaa', padding: '40px 0' }}>🔄 Carregando usuários...</p>
            ) : usersError ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ color: '#dc3545', marginBottom: '10px', fontWeight: 'bold' }}>❌ Erro ao carregar usuários</p>
                <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '15px' }}>{usersError.message}</p>
                <button 
                  onClick={() => refetchUsers()} 
                  style={{ 
                    padding: '8px 16px', 
                    backgroundColor: '#007BFF', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '5px', 
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  🔄 Tentar Novamente
                </button>
              </div>
            ) : users.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ color: '#aaa', marginBottom: '15px' }}>❌ Nenhum usuário encontrado</p>
                <p style={{ color: '#888', fontSize: '0.85rem' }}>Verifique o console (F12) para mais informações</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }}>
                {users.map((newUser) => {
                  const userLimit = newUser.questionsLimit || 0;
                  const limitText = userLimit === 0 ? 'Ilimitado' : `${userLimit} questões`;
                  
                  return (
                    <div key={newUser.id} style={{ padding: '16px', backgroundColor: '#2A2A2A', borderRadius: '8px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: '250px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>
                              {newUser.full_name || 'Sem nome'}
                            </h3>
                            <span style={{
                              padding: '4px 12px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              borderRadius: '12px',
                              backgroundColor: newUser.plan === 'PREMIUM' ? '#f7931e' : '#007BFF',
                              color: 'white'
                            }}>
                              {newUser.plan || 'GRATUITO'}
                            </span>
                            <span style={{
                              padding: '4px 12px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              borderRadius: '12px',
                              backgroundColor: newUser.status === 'ATIVO' ? '#28a745' : newUser.status === 'SUSPENSO' ? '#dc3545' : '#6c757d',
                              color: 'white'
                            }}>
                              {newUser.status || 'ATIVO'}
                            </span>
                            {newUser.email === 'rafaelsalesgelim@gmail.com' && (
                              <span style={{
                                padding: '4px 12px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                borderRadius: '12px',
                                background: 'linear-gradient(to right, #f7931e, #ff6b35)',
                                color: 'white'
                              }}>
                                ADMIN
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '0.875rem', color: '#aaa', margin: '4px 0' }}>{newUser.email}</p>
                          <p style={{ fontSize: '0.875rem', color: '#f7931e', marginTop: '4px' }}>
                            Limite: {limitText}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <Button
                            onClick={() => handleEditUser(newUser)}
                            size="sm"
                            style={{ backgroundColor: '#007BFF', color: 'white', border: 'none' }}
                          >
                            <Edit style={{ width: '14px', height: '14px', marginRight: '4px' }} />
                            Editar
                          </Button>
                          {newUser.email !== 'rafaelsalesgelim@gmail.com' && (
                            <Button
                              onClick={() => toggleUserStatus(newUser)}
                              size="sm"
                              style={{ 
                                backgroundColor: newUser.status === 'ATIVO' ? '#dc3545' : '#28a745',
                                color: 'white',
                                border: 'none'
                              }}
                            >
                              <Power style={{ width: '14px', height: '14px', marginRight: '4px' }} />
                              {newUser.status === 'ATIVO' ? 'Suspender' : 'Ativar'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab Content - Permissions */}
        {activeTab === 'permissions' && (
          <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
              <Shield style={{ width: '20px', height: '20px', marginRight: '10px', color: '#007BFF' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>
                Gerenciar Permissões - Sistema Simulados
              </h2>
            </div>

            {/* Lista de Funcionalidades */}
            <div style={{ backgroundColor: '#2A2A2A', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #444' }}>
              <h3 style={{ color: '#007BFF', marginBottom: '15px', fontSize: '1.1rem' }}>
                📋 Funcionalidades Disponíveis no Sistema Simulados
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
                {simuladoFunctionalities.map((func) => {
                  const Icon = func.icon;
                  return (
                    <div key={func.key} style={{ padding: '15px', backgroundColor: '#1E1E1E', borderRadius: '8px', border: '1px solid #333' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <Icon style={{ width: '18px', height: '18px', color: '#007BFF' }} />
                        <strong style={{ color: '#E0E0E0' }}>{func.label}</strong>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: '#aaa', margin: 0 }}>{func.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lista de Usuários com Permissões */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {users.map((userItem) => {
                const permissions = userItem.simuladoPermissions || {
                  canCreateSimulado: true,
                  canFilterQuestions: true,
                  canViewStatistics: true,
                  canViewHistory: true,
                  canFlagQuestions: true,
                  canReportIssues: true,
                  canExportResults: false,
                  dailyQuestionsLimit: 30
                };

                // Contar apenas permissões booleanas (não incluir o limite numérico)
                const booleanPermissions = Object.entries(permissions).filter(([key, value]) => typeof value === 'boolean');
                const enabledCount = booleanPermissions.filter(([key, value]) => value).length;
                const totalCount = booleanPermissions.length;

                return (
                  <div key={userItem.id} style={{ padding: '16px', backgroundColor: '#2A2A2A', borderRadius: '8px', border: '1px solid #444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>
                            {userItem.full_name || 'Sem nome'}
                          </h3>
                          {userItem.email === 'rafaelsalesgelim@gmail.com' && (
                            <span style={{
                              padding: '4px 12px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              borderRadius: '12px',
                              background: 'linear-gradient(to right, #f7931e, #ff6b35)',
                              color: 'white'
                            }}>
                              ADMIN
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '8px' }}>{userItem.email}</p>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <div style={{ fontSize: '0.9rem', color: '#4a90e2', fontWeight: '600' }}>
                            {enabledCount}/{totalCount} permissões ativas | Limite: {permissions.dailyQuestionsLimit}/dia
                          </div>
                          <div style={{ flex: 1, height: '6px', backgroundColor: '#1E1E1E', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${(enabledCount / totalCount) * 100}%`, 
                              height: '100%', 
                              backgroundColor: '#007BFF',
                              transition: 'width 0.3s'
                            }}></div>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleEditPermissions(userItem)}
                        size="sm"
                        style={{ backgroundColor: '#007BFF', color: 'white', border: 'none' }}
                      >
                        <Shield style={{ width: '14px', height: '14px', marginRight: '4px' }} />
                        Gerenciar Permissões
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ações Rápidas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '30px' }}>
          <button
            onClick={() => window.location.href = createPageUrl('BulkUpload')}
            style={{
              backgroundColor: '#1E1E1E',
              borderRadius: '10px',
              padding: '30px',
              border: '2px solid #333333',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textAlign: 'center',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#007BFF';
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 123, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#333333';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg, #007BFF, #0056b3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Upload style={{ width: '32px', height: '32px', color: 'white' }} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#E0E0E0', margin: '0 0 8px 0' }}>Upload em Massa</h3>
            <p style={{ fontSize: '0.875rem', color: '#aaa', margin: 0 }}>
              Adicione milhares de questões de uma vez
            </p>
          </button>

          <button
            onClick={() => window.location.href = createPageUrl('UserManagement')}
            style={{
              backgroundColor: '#1E1E1E',
              borderRadius: '10px',
              padding: '30px',
              border: '2px solid #333333',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textAlign: 'center',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#28a745';
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(40, 167, 69, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#333333';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg, #28a745, #1e7e34)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Users style={{ width: '32px', height: '32px', color: 'white' }} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#E0E0E0', margin: '0 0 8px 0' }}>Gerenciar Usuários</h3>
            <p style={{ fontSize: '0.875rem', color: '#aaa', margin: 0 }}>
              Controle planos e permissões
            </p>
          </button>

          <button
            onClick={() => window.location.href = createPageUrl('QuestionManager')}
            style={{
              backgroundColor: '#1E1E1E',
              borderRadius: '10px',
              padding: '30px',
              border: '2px solid #333333',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textAlign: 'center',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#9c27b0';
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(156, 39, 176, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#333333';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg, #9c27b0, #7b1fa2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Settings style={{ width: '32px', height: '32px', color: 'white' }} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#E0E0E0', margin: '0 0 8px 0' }}>Gerenciar Questões</h3>
            <p style={{ fontSize: '0.875rem', color: '#aaa', margin: 0 }}>
              Edite e organize as questões
            </p>
          </button>
        </div>
      </div>

      {/* Dialog de Questão Reportada */}
      <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
        <DialogContent style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#1E1E1E', border: '1px solid #333333' }}>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', color: '#f7931e' }}>
              <AlertCircle style={{ width: '20px', height: '20px', marginRight: '10px' }} />
              Questão Reportada
            </DialogTitle>
          </DialogHeader>
          {selectedQuestion && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ backgroundColor: '#2A2A2A', padding: '16px', borderRadius: '8px', border: '2px solid #f7931e' }}>
                <h3 style={{ fontWeight: '700', color: '#E0E0E0', marginBottom: '12px' }}>Problema Reportado:</h3>
                <p style={{ color: '#ccc', marginBottom: '12px', lineHeight: '1.6' }}>{selectedQuestion.issue.issueText}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                  <span style={{ color: '#aaa' }}>
                    Reportado por: <strong style={{ color: '#E0E0E0' }}>{selectedQuestion.issue.userEmail}</strong>
                  </span>
                  <span style={{ color: '#888' }}>
                    {new Date(selectedQuestion.issue.created_date).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>

              <div style={{ backgroundColor: '#2A2A2A', padding: '20px', borderRadius: '8px', border: '1px solid #444' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <span style={{ padding: '6px 14px', backgroundColor: '#007BFF', color: 'white', fontSize: '0.8rem', borderRadius: '20px', fontWeight: '600' }}>
                    {selectedQuestion.question.discipline}
                  </span>
                  <span style={{ padding: '6px 14px', backgroundColor: '#6c757d', color: 'white', fontSize: '0.8rem', borderRadius: '20px', fontWeight: '600' }}>
                    {selectedQuestion.question.difficulty}
                  </span>
                  {selectedQuestion.question.source && (
                    <span style={{ fontSize: '0.875rem', color: '#aaa' }}>
                      {selectedQuestion.question.source} - {selectedQuestion.question.year}
                    </span>
                  )}
                </div>

                <h3 style={{ fontWeight: '700', color: '#E0E0E0', marginBottom: '16px' }}>Enunciado:</h3>
                <p style={{ color: '#ccc', lineHeight: '1.7', marginBottom: '24px' }}>
                  {selectedQuestion.question.questionText}
                </p>

                <h3 style={{ fontWeight: '700', color: '#E0E0E0', marginBottom: '12px' }}>Alternativas:</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedQuestion.question.options.map((option, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '2px solid',
                        borderColor: idx === selectedQuestion.question.correctAnswer ? '#28a745' : '#444',
                        backgroundColor: idx === selectedQuestion.question.correctAnswer ? '#1a3d1a' : '#1a1a1a'
                      }}
                    >
                      <span style={{ fontWeight: '700', marginRight: '12px', color: '#E0E0E0' }}>
                        {String.fromCharCode(65 + idx)})
                      </span>
                      <span style={{ color: '#ccc' }}>{option}</span>
                      {idx === selectedQuestion.question.correctAnswer && (
                        <span style={{ marginLeft: '12px', color: '#28a745', fontWeight: '700' }}>✓ Resposta Correta</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  onClick={() => setShowQuestionDialog(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Fechar
                </button>
                <button
                  onClick={() => window.location.href = createPageUrl('QuestionManager')}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#007BFF',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Ir para Gerenciar Questões
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição de Usuário */}
      <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
        <DialogContent style={{ backgroundColor: '#1E1E1E', border: '1px solid #333333', color: '#E0E0E0' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#E0E0E0' }}>Editar Usuário</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#E0E0E0', marginBottom: '8px' }}>
                  Email
                </label>
                <Input value={editingUser.email} disabled style={{ backgroundColor: '#2A2A2A', border: '1px solid #333333', color: '#888' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#E0E0E0', marginBottom: '8px' }}>
                  Nome Completo
                </label>
                <Input 
                  value={editingUser.full_name || ''} 
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  style={{ backgroundColor: '#2A2A2A', border: '1px solid #333333', color: '#E0E0E0' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#E0E0E0', marginBottom: '8px' }}>
                  Plano
                </label>
                <Select
                  value={editingUser.plan}
                  onValueChange={(value) => setEditingUser({ ...editingUser, plan: value })}
                >
                  <SelectTrigger style={{ backgroundColor: '#2A2A2A', border: '1px solid #333333', color: '#E0E0E0' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GRATUITO">Gratuito</SelectItem>
                    <SelectItem value="PREMIUM">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#E0E0E0', marginBottom: '8px' }}>
                  Status
                </label>
                <Select
                  value={editingUser.status}
                  onValueChange={(value) => setEditingUser({ ...editingUser, status: value })}
                >
                  <SelectTrigger style={{ backgroundColor: '#2A2A2A', border: '1px solid #333333', color: '#E0E0E0' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                    <SelectItem value="SUSPENSO">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowEditUserDialog(false)} style={{ backgroundColor: '#6c757d', color: 'white', border: 'none' }}>
              Cancelar
            </Button>
            <Button onClick={handleSaveUser} disabled={updateUserMutation.isPending} style={{ backgroundColor: '#007BFF', color: 'white', border: 'none' }}>
              {updateUserMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição de Permissões */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent style={{ backgroundColor: '#1E1E1E', border: '1px solid #333333', color: '#E0E0E0', maxWidth: '700px' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#E0E0E0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield style={{ width: '20px', height: '20px', color: '#007BFF' }} />
              Gerenciar Permissões - {editingPermissions?.full_name || editingPermissions?.email}
            </DialogTitle>
          </DialogHeader>
          {editingPermissions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '500px', overflowY: 'auto', padding: '10px' }}>
              {simuladoFunctionalities.map((func) => {
                const Icon = func.icon;
                
                if (func.hasLimit) {
                  // Componente especial para limite diário
                  const currentLimit = editingPermissions.permissions.dailyQuestionsLimit;
                  return (
                    <div key={func.key} style={{ 
                      padding: '16px', 
                      backgroundColor: '#2A2A2A', 
                      borderRadius: '8px', 
                      border: '2px solid #007BFF'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <Icon style={{ width: '18px', height: '18px', color: '#007BFF' }} />
                            <strong style={{ color: '#E0E0E0' }}>{func.label}</strong>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '12px' }}>{func.description}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Input
                              type="number"
                              min="1"
                              max="1000"
                              value={currentLimit}
                              onChange={(e) => updateDailyLimit(e.target.value)}
                              style={{ 
                                width: '80px', 
                                backgroundColor: '#1E1E1E', 
                                border: '1px solid #444', 
                                color: '#E0E0E0',
                                textAlign: 'center',
                                fontSize: '1.1rem',
                                fontWeight: 'bold'
                              }}
                            />
                            <span style={{ color: '#aaa', fontSize: '0.9rem' }}>questões por dia</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Componentes normais de permissão booleana
                const isEnabled = editingPermissions.permissions[func.key];
                return (
                  <div key={func.key} style={{ 
                    padding: '16px', 
                    backgroundColor: '#2A2A2A', 
                    borderRadius: '8px', 
                    border: `2px solid ${isEnabled ? '#007BFF' : '#444'}`,
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <Icon style={{ width: '18px', height: '18px', color: isEnabled ? '#007BFF' : '#888' }} />
                          <strong style={{ color: isEnabled ? '#E0E0E0' : '#888' }}>{func.label}</strong>
                          {isEnabled ? (
                            <CheckCircle style={{ width: '16px', height: '16px', color: '#007BFF' }} />
                          ) : (
                            <XCircle style={{ width: '16px', height: '16px', color: '#888' }} />
                          )}
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#aaa', margin: 0 }}>{func.description}</p>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => togglePermission(func.key)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowPermissionsDialog(false)} style={{ backgroundColor: '#6c757d', color: 'white', border: 'none' }}>
              Cancelar
            </Button>
            <Button onClick={handleSavePermissions} disabled={updateUserMutation.isPending} style={{ backgroundColor: '#007BFF', color: 'white', border: 'none' }}>
              {updateUserMutation.isPending ? 'Salvando...' : 'Salvar Permissões'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
