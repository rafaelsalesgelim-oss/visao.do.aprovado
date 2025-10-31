
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  TrendingUp, Clock, CheckCircle, XCircle, BookOpen, BarChart3, Award
} from "lucide-react";


export default function UserDashboard() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  // Mutation para inicializar campos do usuário
  const initializeUserMutation = useMutation({
    mutationFn: (userData) => base44.auth.updateMe(userData),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.invalidateQueries(['admin-users']);
      queryClient.invalidateQueries(['admin-users-rankings']);
      queryClient.invalidateQueries(['admin-users-redacoes']);
    },
  });

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      
      // Verificar se o usuário precisa ter os campos inicializados
      const needsInitialization = !currentUser.plan || 
                                   !currentUser.status || 
                                   typeof currentUser.totalHits === 'undefined';
      
      if (needsInitialization) {
        console.log("Inicializando campos customizados do usuário...");
        // Inicializar campos que estão faltando
        const initData = {
          plan: currentUser.plan || 'GRATUITO',
          status: currentUser.status || 'ATIVO',
          questionsLimit: currentUser.questionsLimit || 30,
          questionsUsedToday: currentUser.questionsUsedToday || 0,
          totalHits: currentUser.totalHits || 0,
          totalErrors: currentUser.totalErrors || 0,
          disciplines: currentUser.disciplines || []
        };
        
        initializeUserMutation.mutate(initData);
      } else {
        setUser(currentUser);
      }
    };
    fetchUser();
  }, []);

  const { data: history = [] } = useQuery({
    queryKey: ['user-history', user?.id],
    queryFn: () => base44.entities.SimulationHistory.filter(
      { userId: user.id },
      '-created_date',
      10
    ),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96" style={{ backgroundColor: '#121212', minHeight: '100vh', color: '#E0E0E0' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isPremium = user.plan === 'PREMIUM' && user.status === 'ATIVO';
  const totalQuestions = (user.totalHits || 0) + (user.totalErrors || 0);
  const hitRate = totalQuestions > 0 ? ((user.totalHits / totalQuestions) * 100).toFixed(1) : 0;

  return (
    <div style={{ backgroundColor: '#121212', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#E0E0E0', margin: 0 }}>Meu Dashboard</h1>
            <p style={{ color: '#aaa', marginTop: '8px' }}>Acompanhe sua evolução nos estudos</p>
          </div>
          <Link to={createPageUrl("Simulation")}>
            <button style={{
              background: 'linear-gradient(to right, #007BFF, #0056b3)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 123, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <BookOpen style={{ width: '20px', height: '20px' }} />
              Fazer Simulado
            </button>
          </Link>
        </div>

        {!isPremium && (
          <div style={{ 
            backgroundColor: '#2A2A2A', 
            border: '2px solid #f7931e', 
            borderRadius: '10px', 
            padding: '24px', 
            marginBottom: '30px' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#E0E0E0', marginBottom: '8px' }}>
                  Upgrade para Premium
                </h3>
                <p style={{ color: '#aaa' }}>
                  Tenha acesso ilimitado a questões, filtros avançados e muito mais!
                </p>
              </div>
              <Award style={{ width: '64px', height: '64px', color: '#f7931e', opacity: '0.7' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #28a745' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Acertos</div>
                <div style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#E0E0E0' }}>{user.totalHits || 0}</div>
                <div style={{ fontSize: '0.875rem', color: '#aaa', marginTop: '5px' }}>Total de questões</div>
              </div>
              <CheckCircle style={{ width: '48px', height: '48px', color: '#28a745', opacity: 0.8 }} />
            </div>
          </div>

          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #dc3545' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Erros</div>
                <div style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#E0E0E0' }}>{user.totalErrors || 0}</div>
                <div style={{ fontSize: '0.875rem', color: '#aaa', marginTop: '5px' }}>Total de questões</div>
              </div>
              <XCircle style={{ width: '48px', height: '48px', color: '#dc3545', opacity: 0.8 }} />
            </div>
          </div>

          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #007BFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Taxa de Acerto</div>
                <div style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#E0E0E0' }}>{hitRate}%</div>
                <div style={{ fontSize: '0.875rem', color: '#aaa', marginTop: '5px' }}>Desempenho geral</div>
              </div>
              <TrendingUp style={{ width: '48px', height: '48px', color: '#007BFF', opacity: 0.8 }} />
            </div>
          </div>

          <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '10px', border: '1px solid #333333', borderLeft: '4px solid #9c27b0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '5px' }}>Simulados</div>
                <div style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#E0E0E0' }}>{history.length}</div>
                <div style={{ fontSize: '0.875rem', color: '#aaa', marginTop: '5px' }}>Já realizados</div>
              </div>
              <BarChart3 style={{ width: '48px', height: '48px', color: '#9c27b0', opacity: 0.8 }} />
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '20px', border: '1px solid #333333' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <Clock style={{ width: '20px', height: '20px', marginRight: '10px', color: '#007BFF' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#E0E0E0', margin: 0 }}>Histórico de Simulados</h2>
          </div>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <BookOpen style={{ width: '64px', height: '64px', color: '#333', margin: '0 auto 16px' }} />
              <p style={{ color: '#aaa', marginBottom: '16px' }}>Você ainda não fez nenhum simulado</p>
              <Link to={createPageUrl("Simulation")}>
                <button style={{
                  backgroundColor: '#007BFF',
                  color: 'white',
                  padding: '10px 24px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}>
                  Fazer Primeiro Simulado
                </button>
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {history.map((sim) => {
                const percentage = ((sim.correctCount / sim.totalCount) * 100).toFixed(0);
                const date = new Date(sim.created_date);

                return (
                  <div key={sim.id} style={{ padding: '16px', backgroundColor: '#2A2A2A', borderRadius: '8px', border: '1px solid #444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <p style={{ fontWeight: '600', color: '#E0E0E0', marginBottom: '4px' }}>
                          {date.toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        <p style={{ fontSize: '0.875rem', color: '#aaa' }}>
                          {sim.disciplines?.join(', ') || 'Todas as disciplinas'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#E0E0E0' }}>
                          {sim.correctCount}/{sim.totalCount}
                        </div>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: percentage >= 70 ? '#28a745' : percentage >= 50 ? '#f7931e' : '#dc3545'
                        }}>
                          {percentage}% de acertos
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
