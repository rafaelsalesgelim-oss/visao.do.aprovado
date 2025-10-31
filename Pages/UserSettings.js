
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { User, Mail, Settings, Award, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input"; // Input component still used
import { Button } from "@/components/ui/button"; // Button component still used

export default function UserSettings() {
  const [user, setUser] = useState(null);
  const [fullName, setFullName] = useState('');
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setFullName(currentUser.full_name || '');
    };
    fetchUser();
  }, []);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Perfil atualizado com sucesso!' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (error) => {
      setFeedback({ type: 'error', message: 'Erro ao atualizar perfil: ' + error.message });
      setTimeout(() => setFeedback(null), 3000);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({ full_name: fullName });
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96" style={{ backgroundColor: '#121212', minHeight: '100vh', color: '#E0E0E0' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isPremium = user.plan === 'PREMIUM' && user.status === 'ATIVO';

  return (
    <div style={{ backgroundColor: '#121212', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '1024px', margin: '0 auto' }}>
        <div style={{ marginBottom: '30px' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#E0E0E0', margin: 0 }}>Configurações da Conta</h1>
          <p style={{ color: '#aaa', marginTop: '8px' }}>Gerencie suas informações pessoais e plano</p>
        </div>

        {feedback && (
          <div style={{
            backgroundColor: feedback.type === 'success' ? '#1a3d1a' : '#3d1a1a',
            border: `2px solid ${feedback.type === 'success' ? '#28a745' : '#dc3545'}`,
            color: feedback.type === 'success' ? '#28a745' : '#dc3545',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center'
          }}>
            <CheckCircle style={{ width: '16px', height: '16px', marginRight: '8px' }} />
            {feedback.message}
          </div>
        )}

        <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <User style={{ width: '20px', height: '20px', marginRight: '10px', color: '#007BFF' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>
              Informações Pessoais
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#E0E0E0', marginBottom: '8px' }}>
                Nome Completo
              </label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
                style={{ backgroundColor: '#2A2A2A', border: '1px solid #333333', color: '#E0E0E0' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#E0E0E0', marginBottom: '8px' }}>
                Email
              </label>
              <Input
                value={user.email}
                disabled
                style={{ backgroundColor: '#2A2A2A', border: '1px solid #333333', color: '#888' }}
              />
              <p style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '4px' }}>O email não pode ser alterado</p>
            </div>
            <Button onClick={handleSave} disabled={updateMutation.isPending} style={{ backgroundColor: '#007BFF', color: 'white', width: '100%' }}>
              {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>

        <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <Award style={{ width: '20px', height: '20px', marginRight: '10px', color: '#f7931e' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>Plano Atual</h2>
          </div>
          <div style={{ padding: '24px', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#E0E0E0', marginBottom: '8px' }}>
                  Plano {user.plan}
                </h3>
                <p style={{
                  fontWeight: '600',
                  color: user.status === 'ATIVO' ? '#28a745' : '#f7931e'
                }}>
                  Status: {user.status}
                </p>
                {!isPremium && (
                  <p style={{ fontSize: '0.875rem', color: '#aaa', marginTop: '8px' }}>
                    Limite: {user.questionsLimit || 30} questões por dia
                  </p>
                )}
                {isPremium && (
                  <p style={{ fontSize: '0.875rem', color: '#aaa', marginTop: '8px' }}>
                    ✨ Acesso ilimitado a todas as funcionalidades
                  </p>
                )}
              </div>
              {!isPremium && (
                <Award style={{ width: '80px', height: '80px', color: '#f7931e', opacity: '0.5' }} />
              )}
            </div>
          </div>

          {!isPremium && (
            <div style={{ marginTop: '24px', padding: '24px', backgroundColor: '#2A2A2A', borderRadius: '8px', border: '2px solid #f7931e' }}>
              <h4 style={{ fontWeight: 'bold', color: '#E0E0E0', marginBottom: '12px' }}>Benefícios Premium:</h4>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: 0, margin: 0, listStyle: 'none' }}>
                <li style={{ display: 'flex', alignItems: 'start' }}>
                  <CheckCircle style={{ width: '16px', height: '16px', color: '#28a745', marginRight: '8px', marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ color: '#ccc', fontSize: '0.875rem' }}>Questões ilimitadas sem restrição diária</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'start' }}>
                  <CheckCircle style={{ width: '16px', height: '16px', color: '#28a745', marginRight: '8px', marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ color: '#ccc', fontSize: '0.875rem' }}>Filtros avançados por disciplina</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'start' }}>
                  <CheckCircle style={{ width: '16px', height: '16px', color: '#28a745', marginRight: '8px', marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ color: '#ccc', fontSize: '0.875rem' }}>Anotações pessoais nas questões</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'start' }}>
                  <CheckCircle style={{ width: '16px', height: '16px', color: '#28a745', marginRight: '8px', marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ color: '#ccc', fontSize: '0.875rem' }}>Relatório de erros e sugestões</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'start' }}>
                  <CheckCircle style={{ width: '16px', height: '16px', color: '#28a745', marginRight: '8px', marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ color: '#ccc', fontSize: '0.875rem' }}>Estatísticas detalhadas de desempenho</span>
                </li>
              </ul>
              <p style={{ fontSize: '0.875rem', color: '#aaa', marginTop: '16px', fontStyle: 'italic' }}>
                Entre em contato com o administrador para fazer upgrade do seu plano
              </p>
            </div>
          )}
        </div>

        <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <Settings style={{ width: '20px', height: '20px', marginRight: '10px', color: '#9c27b0' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>Estatísticas</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', backgroundColor: '#1a3d1a', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '4px' }}>Total Acertos</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#28a745' }}>{user.totalHits || 0}</p>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#3d1a1a', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '4px' }}>Total Erros</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#dc3545' }}>{user.totalErrors || 0}</p>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#1a2a3d', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '4px' }}>Total Questões</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#007BFF' }}>
                {(user.totalHits || 0) + (user.totalErrors || 0)}
              </p>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#2a1a3d', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '4px' }}>Taxa Acerto</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#9c27b0' }}>
                {((user.totalHits || 0) + (user.totalErrors || 0)) > 0
                  ? (((user.totalHits || 0) / ((user.totalHits || 0) + (user.totalErrors || 0))) * 100).toFixed(0)
                  : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
