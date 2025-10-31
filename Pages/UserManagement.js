
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { Users, Award, Search, Filter, UserPlus, Edit, Power, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function UserManagement() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingUser, setEditingUser] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [feedback, setFeedback] = useState(null);

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

  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      console.log("Buscando usuários...");
      const usersList = await base44.entities.User.list();
      console.log("Usuários encontrados:", usersList);
      return usersList || [];
    },
    enabled: !!currentUser,
    refetchInterval: 5000,
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }) => base44.entities.User.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['all-users']);
      queryClient.invalidateQueries(['admin-users']);
      queryClient.invalidateQueries(['admin-users-rankings']);
      queryClient.invalidateQueries(['admin-users-redacoes']);
      setShowEditDialog(false);
      setEditingUser(null);
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

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = filterPlan === 'all' || user.plan === filterPlan;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesPlan && matchesStatus;
  });

  const handleEditUser = (user) => {
    setEditingUser({ 
      ...user,
      plan: user.plan || 'GRATUITO',
      status: user.status || 'ATIVO',
      questionsLimit: user.questionsLimit === undefined ? 30 : user.questionsLimit // Default to 30 if undefined, otherwise keep existing value (which can be 0 for unlimited)
    });
    setShowEditDialog(true);
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    
    const updateData = {
      full_name: editingUser.full_name,
      plan: editingUser.plan,
      status: editingUser.status,
      questionsLimit: parseInt(editingUser.questionsLimit) || 0, // Ensure 0 is handled correctly for unlimited
    };

    updateUserMutation.mutate({
      userId: editingUser.id,
      data: updateData
    });
  };

  const toggleUserStatus = (user) => {
    const newStatus = user.status === 'ATIVO' ? 'SUSPENSO' : 'ATIVO';
    updateUserMutation.mutate({
      userId: user.id,
      data: { status: newStatus }
    });
  };

  if (!currentUser) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', backgroundColor: '#121212' }}>
        <div style={{ 
          border: '4px solid rgba(255,255,255,0.1)', 
          borderTop: '4px solid #007BFF', 
          borderRadius: '50%', 
          width: '48px', 
          height: '48px', 
          animation: 'spin 1s linear infinite' 
        }}></div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#121212', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ marginBottom: '30px' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#E0E0E0', margin: 0 }}>Gerenciamento de Usuários</h1>
          <p style={{ color: '#aaa', marginTop: '8px' }}>Controle completo sobre planos, permissões e usuários do sistema</p>
        </div>

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

        {/* Estatísticas Rápidas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #007BFF' }}>
            <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Total de Usuários</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#007BFF' }}>{users.length}</div>
          </div>
          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #28a745' }}>
            <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Usuários Ativos</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>
              {users.filter(u => u.status === 'ATIVO').length}
            </div>
          </div>
          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #f7931e' }}>
            <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Usuários Premium</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f7931e' }}>
              {users.filter(u => u.plan === 'PREMIUM').length}
            </div>
          </div>
          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #dc3545' }}>
            <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Usuários Suspensos</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc3545' }}>
              {users.filter(u => u.status === 'SUSPENSO').length}
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Users style={{ width: '20px', height: '20px', marginRight: '10px', color: '#007BFF' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>
                  Usuários Cadastrados ({filteredUsers.length})
                </h2>
              </div>
              <Button onClick={() => refetch()} style={{ backgroundColor: '#007BFF', color: 'white' }}>
                Atualizar Lista
              </Button>
            </div>
            
            {/* Filtros */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px', position: 'relative' }}>
                <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#aaa', width: '16px', height: '16px' }} />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome ou email..."
                  style={{ paddingLeft: '40px', backgroundColor: '#2A2A2A', border: '1px solid #333333', color: '#E0E0E0' }}
                />
              </div>
              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger style={{ width: '150px', backgroundColor: '#2A2A2A', border: '1px solid #333333', color: '#E0E0E0' }}>
                  <SelectValue placeholder="Plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Planos</SelectItem>
                  <SelectItem value="GRATUITO">Gratuito</SelectItem>
                  <SelectItem value="PREMIUM">Premium</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger style={{ width: '150px', backgroundColor: '#2A2A2A', border: '1px solid #333333', color: '#E0E0E0' }}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="SUSPENSO">Suspenso</SelectItem>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lista de Usuários */}
          {isLoading ? (
            <p style={{ textAlign: 'center', color: '#aaa', padding: '40px 0' }}>Carregando usuários...</p>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ color: '#dc3545', marginBottom: '10px' }}>Erro ao carregar usuários: {error.message}</p>
              <Button onClick={() => refetch()} style={{ backgroundColor: '#007BFF', color: 'white' }}>Tentar Novamente</Button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#aaa', padding: '40px 0' }}>
              {users.length === 0 ? 'Nenhum usuário cadastrado ainda' : 'Nenhum usuário encontrado com os filtros aplicados'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredUsers.map((user) => {
                const userLimit = user.questionsLimit === undefined ? 30 : user.questionsLimit; // Default to 30 if undefined, otherwise use actual value (0 for unlimited)
                const limitText = userLimit === 0 ? 'Ilimitado' : `${userLimit} questões`;
                
                return (
                  <div key={user.id} style={{ padding: '16px', backgroundColor: '#2A2A2A', borderRadius: '8px', border: '1px solid #333333' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: '250px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>
                            {user.full_name || 'Sem nome'}
                          </h3>
                          <span style={{
                            padding: '4px 12px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            borderRadius: '12px',
                            backgroundColor: user.plan === 'PREMIUM' ? '#f7931e' : '#007BFF',
                            color: 'white'
                          }}>
                            {user.plan || 'GRATUITO'}
                          </span>
                          <span style={{
                            padding: '4px 12px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            borderRadius: '12px',
                            backgroundColor: user.status === 'ATIVO' ? '#28a745' : user.status === 'SUSPENSO' ? '#dc3545' : '#6c757d',
                            color: 'white'
                          }}>
                            {user.status || 'ATIVO'}
                          </span>
                          {user.email === 'rafaelsalesgelim@gmail.com' && (
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
                        <p style={{ fontSize: '0.875rem', color: '#aaa', margin: '4px 0' }}>{user.email}</p>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '0.875rem', color: '#888', flexWrap: 'wrap' }}>
                          <span>Acertos: <strong style={{ color: '#28a745' }}>{user.totalHits || 0}</strong></span>
                          <span>Erros: <strong style={{ color: '#dc3545' }}>{user.totalErrors || 0}</strong></span>
                          <span>Taxa: <strong style={{ color: '#007BFF' }}>
                            {((user.totalHits || 0) + (user.totalErrors || 0)) > 0
                              ? (((user.totalHits || 0) / ((user.totalHits || 0) + (user.totalErrors || 0))) * 100).toFixed(0)
                              : 0}%
                          </strong></span>
                          <span>Limite: <strong style={{ color: '#f7931e' }}>{limitText}</strong></span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Button
                          onClick={() => handleEditUser(user)}
                          size="sm"
                          style={{ backgroundColor: '#007BFF', color: 'white', border: 'none' }}
                        >
                          <Edit style={{ width: '14px', height: '14px', marginRight: '4px' }} />
                          Editar
                        </Button>
                        {user.email !== 'rafaelsalesgelim@gmail.com' && (
                          <Button
                            onClick={() => toggleUserStatus(user)}
                            size="sm"
                            style={{ 
                              backgroundColor: user.status === 'ATIVO' ? '#dc3545' : '#28a745',
                              color: 'white',
                              border: 'none'
                            }}
                          >
                            <Power style={{ width: '14px', height: '14px', marginRight: '4px' }} />
                            {user.status === 'ATIVO' ? 'Suspender' : 'Ativar'}
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

        {/* Instruções para deletar usuários */}
        <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '2px solid #dc3545', marginTop: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <Trash2 style={{ width: '20px', height: '20px', marginRight: '10px', color: '#dc3545' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#dc3545', margin: 0 }}>
              Resetar Usuários do Sistema
            </h2>
          </div>
          <p style={{ color: '#E0E0E0', marginBottom: '12px' }}>
            Para resetar todos os usuários (exceto o administrador), siga estas etapas:
          </p>
          <ol style={{ color: '#aaa', paddingLeft: '20px', marginBottom: '16px', lineHeight: '1.8' }}>
            <li>Acesse o Dashboard → Data → User</li>
            <li>Selecione todos os usuários EXCETO rafaelsalesgelim@gmail.com</li>
            <li>Use a opção de deletar em massa</li>
            <li>Os usuários poderão se cadastrar novamente e aparecerão aqui automaticamente</li>
          </ol>
          <p style={{ color: '#f7931e', fontSize: '0.875rem', fontStyle: 'italic' }}>
            ⚠️ Por questões de segurança, a deleção de usuários deve ser feita pelo Dashboard da plataforma.
          </p>
        </div>
      </div>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
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
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#E0E0E0', marginBottom: '8px' }}>
                  Limite de Questões (0 = ilimitado)
                </label>
                <Input
                  type="number"
                  value={editingUser.questionsLimit} // Directly use editingUser.questionsLimit
                  onChange={(e) => setEditingUser({ ...editingUser, questionsLimit: parseInt(e.target.value) })}
                  style={{ backgroundColor: '#2A2A2A', border: '1px solid #333333', color: '#E0E0E0' }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowEditDialog(false)} style={{ backgroundColor: '#6c757d', color: 'white', border: 'none' }}>
              Cancelar
            </Button>
            <Button onClick={handleSaveUser} disabled={updateUserMutation.isPending} style={{ backgroundColor: '#007BFF', color: 'white', border: 'none' }}>
              {updateUserMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
