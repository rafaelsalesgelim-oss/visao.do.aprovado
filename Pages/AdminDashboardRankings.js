
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { Trophy, Users, TrendingUp, Eye, Trash2, Calendar, Award, ArrowLeft, LogOut, Edit, Power, Shield, CheckCircle, XCircle } from "lucide-react";
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

export default function AdminDashboardRankings() {
  const [user, setUser] = useState(null);
  const [selectedRanking, setSelectedRanking] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [activeTab, setActiveTab] = useState('rankings'); // 'rankings', 'users', 'permissions'

  const queryClient = useQueryClient();

  useEffect(() => {
    const checkAdmin = async () => {
      const currentUser = await base44.auth.me();
      if (currentUser.email !== "rafaelsalesgelim@gmail.com") {
        window.location.href = createPageUrl("RankingHome");
      }
      setUser(currentUser);
    };
    checkAdmin();
  }, []);

  const handleLogout = async () => {
    await base44.auth.logout(createPageUrl("Home"));
  };

  const { data: rankings = [] } = useQuery({
    queryKey: ['admin-rankings'],
    queryFn: () => base44.entities.Ranking.list('-created_date'),
    enabled: !!user,
  });

  const { data: users = [], refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users-rankings'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
  });

  const deleteRankingMutation = useMutation({
    mutationFn: (rankingId) => base44.entities.Ranking.delete(rankingId),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-rankings']);
      showFeedback('Ranking excluído com sucesso!', 'success');
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }) => base44.entities.User.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users-rankings']);
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

  const handleDeleteRanking = async (rankingId) => {
    if (window.confirm('Tem certeza que deseja excluir este ranking? Esta ação não pode ser desfeita.')) {
      deleteRankingMutation.mutate(rankingId);
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
      canCreateRanking: true,
      canParticipateRanking: true,
      canViewRanking: true,
      canCopyRanking: true,
      canEditOwnRanking: true,
      canDeleteOwnRanking: true,
      canViewOthersNotes: true,
      canManageGabarito: true, // Added Gabarito permission
      canExportRanking: false
    };
    
    setEditingPermissions({
      userId: userToEdit.id,
      email: userToEdit.email,
      full_name: userToEdit.full_name,
      permissions: userToEdit.rankingPermissions || defaultPermissions
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
        rankingPermissions: editingPermissions.permissions
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

  const getTotalParticipants = (ranking) => {
    return ranking.rankingData?.length || 0;
  };

  const getTotalVagas = (ranking) => {
    if (!ranking || !ranking.concurrency) return 0;
    return Object.values(ranking.concurrency).reduce((sum, c) => sum + (c?.vagas || 0), 0);
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', backgroundColor: '#121212' }}>
        <div style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #007BFF', borderRadius: '50%', width: '48px', height: '48px', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  const rankingFunctionalities = [
    { key: 'canCreateRanking', label: 'Criar Rankings', description: 'Permite criar novos rankings preditivos', icon: Trophy },
    { key: 'canParticipateRanking', label: 'Participar de Rankings', description: 'Permite cadastrar notas e participar', icon: Users },
    { key: 'canViewRanking', label: 'Visualizar Rankings', description: 'Permite ver classificações e rankings', icon: Eye },
    { key: 'canCopyRanking', label: 'Copiar Estrutura', description: 'Permite copiar estrutura de outros rankings', icon: TrendingUp },
    { key: 'canEditOwnRanking', label: 'Editar Próprios Rankings', description: 'Permite editar rankings criados por si', icon: Edit },
    { key: 'canDeleteOwnRanking', label: 'Excluir Próprios Rankings', description: 'Permite excluir rankings criados por si', icon: Trash2 },
    { key: 'canViewOthersNotes', label: 'Ver Notas de Outros', description: 'Permite visualizar notas dos outros participantes', icon: Eye },
    { key: 'canManageGabarito', label: 'Gerenciar Gabarito', description: 'Permite inserir, editar e atualizar gabaritos', icon: Calendar }, // New functionality
    { key: 'canExportRanking', label: 'Exportar Rankings', description: 'Permite exportar dados dos rankings (Premium)', icon: Award }
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
            onClick={() => window.location.href = createPageUrl('RankingHome')}
            style={{ backgroundColor: '#555', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
            Voltar ao Sistema Rankings
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
        <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#f7931e' }}>
          Painel Admin - Sistema Rankings
        </div>
        <p style={{ color: '#aaa' }}>Gerenciamento completo de rankings, usuários e permissões</p>
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
            onClick={() => setActiveTab('rankings')}
            style={{
              padding: '10px 20px',
              backgroundColor: activeTab === 'rankings' ? '#f7931e' : '#2A2A2A',
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
            <Trophy style={{ width: '16px', height: '16px' }} />
            Rankings
          </button>
          <button
            onClick={() => setActiveTab('users')}
            style={{
              padding: '10px 20px',
              backgroundColor: activeTab === 'users' ? '#f7931e' : '#2A2A2A',
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
              backgroundColor: activeTab === 'permissions' ? '#f7931e' : '#2A2A2A',
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

        {/* Estatísticas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #f7931e' }}>
            <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Total de Rankings</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f7931e' }}>{rankings.length}</div>
          </div>
          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #28a745' }}>
            <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Rankings Abertos</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>
              {rankings.filter(r => r.status === 'aberto').length}
            </div>
          </div>
          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #007BFF' }}>
            <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Participantes Totais</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#007BFF' }}>
              {rankings.reduce((sum, r) => sum + getTotalParticipants(r), 0)}
            </div>
          </div>
          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #9c27b0' }}>
            <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Usuários Cadastrados</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#9c27b0' }}>{users.length}</div>
          </div>
        </div>

        {/* Tab Content - Rankings */}
        {activeTab === 'rankings' && (
          <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
              <Trophy style={{ width: '20px', height: '20px', marginRight: '10px', color: '#f7931e' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>
                Todos os Rankings ({rankings.length})
              </h2>
            </div>

            {rankings.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#aaa', padding: '40px 0' }}>
                Nenhum ranking criado ainda
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {rankings.map((ranking) => (
                  <div key={ranking.id} style={{ padding: '16px', backgroundColor: '#2A2A2A', borderRadius: '8px', border: '1px solid #444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>
                            {ranking.title || 'Ranking sem título'}
                          </h3>
                          <span style={{
                            padding: '3px 10px',
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            borderRadius: '12px',
                            backgroundColor: ranking.status === 'aberto' ? '#28a745' : '#6c757d',
                            color: 'white'
                          }}>
                            {ranking.status === 'aberto' ? 'ABERTO' : 'ENCERRADO'}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '4px 0' }}>
                          {ranking.description || 'Sem descrição'}
                        </p>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '0.875rem', color: '#888', flexWrap: 'wrap' }}>
                          <span>
                            <Users style={{ width: '14px', height: '14px', display: 'inline', marginRight: '4px' }} />
                            {getTotalParticipants(ranking)} participantes
                          </span>
                          <span>
                            <Award style={{ width: '14px', height: '14px', display: 'inline', marginRight: '4px' }} />
                            {getTotalVagas(ranking)} vagas
                          </span>
                          <span>
                            <Calendar style={{ width: '14px', height: '14px', display: 'inline', marginRight: '4px' }} />
                            {new Date(ranking.created_date).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => window.open(createPageUrl(`RankingDetails?id=${ranking.id}`), '_blank')}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#007BFF',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <Eye style={{ width: '14px', height: '14px' }} />
                          Ver
                        </button>
                        <button
                          onClick={() => handleDeleteRanking(ranking.id)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content - Users */}
        {activeTab === 'users' && (
          <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Users style={{ width: '20px', height: '20px', marginRight: '10px', color: '#28a745' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>
                  Usuários Cadastrados ({users.length})
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

            {users.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#aaa', padding: '40px 0' }}>
                Nenhum usuário cadastrado ainda
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '600px', overflowY: 'auto' }}>
                {users.map((userItem) => (
                  <div key={userItem.id} style={{ padding: '16px', backgroundColor: '#2A2A2A', borderRadius: '8px', border: '1px solid #444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: '250px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>
                            {userItem.full_name || 'Sem nome'}
                          </h3>
                          <span style={{
                            padding: '4px 12px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            borderRadius: '12px',
                            backgroundColor: userItem.plan === 'PREMIUM' ? '#f7931e' : '#007BFF',
                            color: 'white'
                          }}>
                            {userItem.plan || 'GRATUITO'}
                          </span>
                          <span style={{
                            padding: '4px 12px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            borderRadius: '12px',
                            backgroundColor: userItem.status === 'ATIVO' ? '#28a745' : userItem.status === 'SUSPENSO' ? '#dc3545' : '#6c757d',
                            color: 'white'
                          }}>
                            {userItem.status || 'ATIVO'}
                          </span>
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
                        <p style={{ fontSize: '0.875rem', color: '#aaa', margin: '4px 0' }}>{userItem.email}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Button
                          onClick={() => handleEditUser(userItem)}
                          size="sm"
                          style={{ backgroundColor: '#007BFF', color: 'white', border: 'none' }}
                        >
                          <Edit style={{ width: '14px', height: '14px', marginRight: '4px' }} />
                          Editar
                        </Button>
                        {userItem.email !== 'rafaelsalesgelim@gmail.com' && (
                          <Button
                            onClick={() => toggleUserStatus(userItem)}
                            size="sm"
                            style={{ 
                              backgroundColor: userItem.status === 'ATIVO' ? '#dc3545' : '#28a745',
                              color: 'white',
                              border: 'none'
                            }}
                          >
                            <Power style={{ width: '14px', height: '14px', marginRight: '4px' }} />
                            {userItem.status === 'ATIVO' ? 'Suspender' : 'Ativar'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content - Permissions */}
        {activeTab === 'permissions' && (
          <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
              <Shield style={{ width: '20px', height: '20px', marginRight: '10px', color: '#f7931e' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>
                Gerenciar Permissões - Sistema Rankings
              </h2>
            </div>

            {/* Lista de Funcionalidades */}
            <div style={{ backgroundColor: '#2A2A2A', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #444' }}>
              <h3 style={{ color: '#f7931e', marginBottom: '15px', fontSize: '1.1rem' }}>
                📋 Funcionalidades Disponíveis no Sistema Rankings
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
                {rankingFunctionalities.map((func) => {
                  const Icon = func.icon;
                  return (
                    <div key={func.key} style={{ padding: '15px', backgroundColor: '#1E1E1E', borderRadius: '8px', border: '1px solid #333' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <Icon style={{ width: '18px', height: '18px', color: '#f7931e' }} />
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
                const permissions = userItem.rankingPermissions || {
                  canCreateRanking: true,
                  canParticipateRanking: true,
                  canViewRanking: true,
                  canCopyRanking: true,
                  canEditOwnRanking: true,
                  canDeleteOwnRanking: true,
                  canViewOthersNotes: true,
                  canManageGabarito: true, // Updated default for display
                  canExportRanking: false
                };

                const enabledCount = Object.values(permissions).filter(Boolean).length;
                const totalCount = Object.keys(permissions).length;

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
                            {enabledCount}/{totalCount} permissões ativas
                          </div>
                          <div style={{ flex: 1, height: '6px', backgroundColor: '#1E1E1E', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${(enabledCount / totalCount) * 100}%`, 
                              height: '100%', 
                              backgroundColor: '#f7931e',
                              transition: 'width 0.3s'
                            }}></div>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleEditPermissions(userItem)}
                        size="sm"
                        style={{ backgroundColor: '#f7931e', color: 'white', border: 'none' }}
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
      </div>

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
              <Shield style={{ width: '20px', height: '20px', color: '#f7931e' }} />
              Gerenciar Permissões - {editingPermissions?.full_name || editingPermissions?.email}
            </DialogTitle>
          </DialogHeader>
          {editingPermissions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '500px', overflowY: 'auto', padding: '10px' }}>
              {rankingFunctionalities.map((func) => {
                const Icon = func.icon;
                const isEnabled = editingPermissions.permissions[func.key];
                
                return (
                  <div key={func.key} style={{ 
                    padding: '16px', 
                    backgroundColor: '#2A2A2A', 
                    borderRadius: '8px', 
                    border: `2px solid ${isEnabled ? '#28a745' : '#444'}`,
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <Icon style={{ width: '18px', height: '18px', color: isEnabled ? '#28a745' : '#888' }} />
                          <strong style={{ color: isEnabled ? '#E0E0E0' : '#888' }}>{func.label}</strong>
                          {isEnabled ? (
                            <CheckCircle style={{ width: '16px', height: '16px', color: '#28a745' }} />
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
            <Button onClick={handleSavePermissions} disabled={updateUserMutation.isPending} style={{ backgroundColor: '#f7931e', color: 'white', border: 'none' }}>
              {updateUserMutation.isPending ? 'Salvando...' : 'Salvar Permissões'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
