
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft } from "lucide-react";

export default function RankingHome() {
  const [user, setUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedRankingId, setSelectedRankingId] = useState(null);
  const [rankingToCopy, setRankingToCopy] = useState(null);
  const [disciplines, setDisciplines] = useState([{ name: 'Português', count: 20, weight: 1.0, minScore: 0.0 }]);
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const handleLogout = async () => {
    await base44.auth.logout(createPageUrl("Home"));
  };

  const isAdmin = user?.email === "rafaelsalesgelim@gmail.com";

  useEffect(() => {
    // Quando seleciona um ranking para copiar, preenche as disciplinas
    if (rankingToCopy && rankingToCopy.subjects) {
      const disciplinesFromCopy = Object.entries(rankingToCopy.subjects).map(([key, subj]) => ({
        name: subj.name,
        count: subj.count,
        weight: subj.weight,
        minScore: subj.minScore
      }));
      setDisciplines(disciplinesFromCopy);
    } else if (!rankingToCopy) {
      // Reset para disciplina padrão quando não está copiando
      setDisciplines([{ name: 'Português', count: 20, weight: 1.0, minScore: 0.0 }]);
    }
  }, [rankingToCopy]);

  const { data: rankings = [] } = useQuery({
    queryKey: ['rankings'],
    queryFn: () => base44.entities.Ranking.list('-created_date'),
  });

  const createRankingMutation = useMutation({
    mutationFn: (data) => base44.entities.Ranking.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['rankings']);
      setSelectedRankingId(data.id);
      setShowCreateModal(false);
      setShowCopyModal(false);
      setRankingToCopy(null);
      setDisciplines([{ name: 'Português', count: 20, weight: 1.0, minScore: 0.0 }]);
      alert('Ranking criado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao criar ranking:', error);
      alert('Erro ao criar ranking: ' + error.message);
    }
  });

  const stringToSlug = (str) => {
    return str.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_ -]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
      .replace(/_+/g, '_');
  };

  const handleCreateRanking = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const concursoName = formData.get('concursoName');
    const bankName = formData.get('bankName');
    const schooling = formData.get('schooling');
    const minOverallScore = parseFloat(formData.get('minOverallScore')) || 40.0;
    
    const concurrency = {
      Ampla: { 
        vagas: parseInt(formData.get('vagasAmpla')) || 0, 
        concorrentes: parseInt(formData.get('concorrentesAmpla')) || 0
      },
      PP: { 
        vagas: parseInt(formData.get('vagasPP')) || 0, 
        concorrentes: parseInt(formData.get('concorrentesPP')) || 0
      },
      PcD: { 
        vagas: parseInt(formData.get('vagasPcD')) || 0, 
        concorrentes: parseInt(formData.get('concorrentesPcD')) || 0
      }
    };

    const subjects = {};
    const gabarito = {};
    let totalQuestions = 0; // Initialize totalQuestions
    
    // Processar as disciplinas do estado
    disciplines.forEach((disc, index) => {
      const name = formData.get(`disciplineName_${index}`) || disc.name;
      const count = parseInt(formData.get(`questionCount_${index}`)) || disc.count;
      const weight = parseFloat(formData.get(`questionWeight_${index}`)) || disc.weight;
      const minScore = parseFloat(formData.get(`minScore_${index}`)) || disc.minScore;

      const key = stringToSlug(name);
      subjects[key] = { name, count, weight, minScore };
      gabarito[key] = Array.from({ length: count }, (_, i) => ['A', 'B', 'C', 'D', 'E'][i % 5]);
      totalQuestions += count; // Accumulate total questions
    });

    const newRanking = {
      title: concursoName,
      description: `Banca: ${bankName} | Escolaridade: ${schooling}`,
      creatorId: user.id,
      creatorName: user.full_name || user.email,
      minOverallScore,
      concurrency,
      subjects,
      gabarito,
      totalQuestions, // Add totalQuestions to the new ranking object
      rankingData: [],
      status: 'aberto'
    };

    console.log('Criando ranking:', newRanking);
    createRankingMutation.mutate(newRanking);
  };

  const openCopyModal = () => {
    if (rankings.length === 0) {
      alert('Não há rankings para copiar. Crie um novo primeiro.');
      return;
    }
    setShowCopyModal(true);
  };

  const startCopying = (ranking) => {
    setRankingToCopy(ranking);
    setShowCopyModal(false);
    setShowCreateModal(true);
  };

  const addDisciplineRow = () => {
    setDisciplines([...disciplines, { name: '', count: 15, weight: 1.0, minScore: 0.0 }]);
  };

  const removeDisciplineRow = (index) => {
    if (disciplines.length > 1) {
      const newDisciplines = disciplines.filter((_, i) => i !== index);
      setDisciplines(newDisciplines);
    } else {
      alert('Você deve ter pelo menos uma disciplina na prova.');
    }
  };

  const updateDiscipline = (index, field, value) => {
    const newDisciplines = [...disciplines];
    newDisciplines[index][field] = value;
    setDisciplines(newDisciplines);
  };

  const selectRanking = (rankingId, action) => {
    setSelectedRankingId(rankingId);
    if (action === 'notes' || action === 'view') {
      navigate(createPageUrl(`RankingDetails?id=${rankingId}`));
    }
  };

  const getTotalVagas = (ranking) => {
    if (!ranking || !ranking.concurrency) return 0;
    return Object.values(ranking.concurrency).reduce((sum, c) => sum + (c?.vagas || 0), 0);
  };

  const getTotalSubjects = (ranking) => {
    if (!ranking || !ranking.subjects) return 0;
    return Object.keys(ranking.subjects).length;
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setRankingToCopy(null);
    setDisciplines([{ name: 'Português', count: 20, weight: 1.0, minScore: 0.0 }]);
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #007BFF', borderRadius: '50%', width: '48px', height: '48px', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#121212', color: '#E0E0E0', minHeight: '100vh', padding: '20px' }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .ranking-card:hover {
          transform: translateY(-5px);
          boxShadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }
      `}</style>
      
      <header style={{ borderBottom: '2px solid #333333', paddingBottom: '10px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => navigate(createPageUrl('SystemSelector'))}
              style={{ backgroundColor: '#555', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft style={{ width: '16px', height: '16px' }} />
              Voltar aos Sistemas
            </button>
            <button
              onClick={() => navigate(createPageUrl('SimuladoHome'))}
              style={{ backgroundColor: '#007BFF', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600' }}
            >
              Simulados
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {isAdmin && (
              <button
                onClick={() => navigate(createPageUrl('AdminDashboardRankings'))}
                style={{ backgroundColor: '#f7931e', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600' }}
              >
                Painel Admin
              </button>
            )}
            <span style={{ color: '#aaa', fontSize: '0.9rem' }}>
              {user?.full_name || user?.email}
            </span>
            <button
              onClick={handleLogout}
              style={{ backgroundColor: '#dc3545', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              Sair
            </button>
          </div>
        </div>
        <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#007BFF' }}>
          Visão do Aprovado - Rankings
        </div>
        <p style={{ color: '#aaa' }}>Crie e participe de rankings competitivos com outros candidatos.</p>
      </header>

      <main>
        <h2 style={{ color: '#E0E0E0', marginBottom: '10px' }}>Rankings Disponíveis</h2>
        <p style={{ color: '#aaa', marginBottom: '20px' }}>Selecione um ranking para participar ou visualizar a classificação preditiva.</p>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setRankingToCopy(null); setDisciplines([{ name: 'Português', count: 20, weight: 1.0, minScore: 0.0 }]); setShowCreateModal(true); }}
            style={{ padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '1rem', fontWeight: '600', backgroundColor: '#007BFF', color: 'white' }}
          >
            + Criar Novo Ranking
          </button>
          <button
            onClick={openCopyModal}
            disabled={rankings.length === 0}
            style={{ padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '1rem', fontWeight: '600', backgroundColor: rankings.length === 0 ? '#444' : '#f7931e', color: 'white', opacity: rankings.length === 0 ? 0.6 : 1 }}
          >
            Copiar Estrutura
          </button>
        </div>

        <div style={{ display: 'grid', gap: '25px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {rankings.map(ranking => (
            <div
              key={ranking.id}
              className="ranking-card"
              style={{
                backgroundColor: '#1E1E1E',
                borderRadius: '10px',
                padding: '25px',
                border: selectedRankingId === ranking.id ? '1px solid #007BFF' : '1px solid #333333',
                boxShadow: selectedRankingId === ranking.id ? '0 0 15px #007BFF' : '0 4px 12px rgba(0, 0, 0, 0.2)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer'
              }}
            >
              <h3 style={{ color: '#007BFF', fontSize: '1.4rem', marginBottom: '5px' }}>{ranking.title || 'Ranking sem título'}</h3>
              <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '15px' }}>{ranking.description || 'Sem descrição'}</p>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed #333333' }}>
                <div style={{ fontSize: '0.9rem', textAlign: 'center' }}>
                  Vagas Total <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 'bold', color: '#4a90e2' }}>{getTotalVagas(ranking)}</span>
                </div>
                <div style={{ fontSize: '0.9rem', textAlign: 'center' }}>
                  Mín. Total <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 'bold', color: '#4a90e2' }}>{(ranking.minOverallScore || 0).toFixed(1)}</span>
                </div>
                <div style={{ fontSize: '0.9rem', textAlign: 'center' }}>
                  Participantes <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 'bold', color: '#4a90e2' }}>{ranking.rankingData?.length || 0}</span>
                </div>
                <div style={{ fontSize: '0.9rem', textAlign: 'center' }}>
                  Disciplinas <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 'bold', color: '#4a90e2' }}>{getTotalSubjects(ranking)}</span>
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => selectRanking(ranking.id, 'notes')}
                  style={{ flex: 1, padding: '10px', fontWeight: '700', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                >
                  Participar (Cadastrar Nota)
                </button>
                <button
                  onClick={() => selectRanking(ranking.id, 'view')}
                  style={{ flex: 1, padding: '10px', fontWeight: '700', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                >
                  Visualizar Ranking
                </button>
              </div>
            </div>
          ))}
        </div>

        {rankings.length === 0 && (
          <p style={{ color: '#aaa', textAlign: 'center', marginTop: '50px' }}>
            Nenhum ranking criado ainda. Comece um novo!
          </p>
        )}
      </main>

      {/* Modal de Seleção para Copiar */}
      {showCopyModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1E1E1E', padding: '30px', borderRadius: '10px', boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)', width: '95%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#007BFF', borderBottom: '2px solid #333333', paddingBottom: '10px', marginBottom: '20px' }}>
              Selecione a Estrutura Base
            </h2>
            <p style={{ color: '#aaa', marginBottom: '20px' }}>
              Escolha um ranking existente para copiar as configurações de vagas, disciplinas e pesos.
            </p>

            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rankings.map(ranking => (
                <div
                  key={ranking.id}
                  onClick={() => startCopying(ranking)}
                  style={{ backgroundColor: '#2A2A2A', padding: '15px', borderRadius: '8px', border: '1px solid #333', cursor: 'pointer', transition: 'background-color 0.2s, border-color 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#3a3a3a'; e.currentTarget.style.borderColor = '#007BFF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#2A2A2A'; e.currentTarget.style.borderColor = '#333'; }}
                >
                  <h4 style={{ color: '#4a90e2', fontSize: '1.1rem', marginBottom: '5px' }}>{ranking.title || 'Ranking sem título'}</h4>
                  <p style={{ fontSize: '0.85rem', color: '#aaa' }}>
                    {ranking.description || 'Sem descrição'} | Vagas: {getTotalVagas(ranking)} | Disciplinas: {getTotalSubjects(ranking)}
                  </p>
                  <button style={{ backgroundColor: '#f7931e', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', marginTop: '10px', display: 'block', width: '100%' }}>
                    Usar esta Estrutura
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #333333' }}>
              <button
                onClick={() => setShowCopyModal(false)}
                style={{ backgroundColor: '#444', color: 'white', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', border: 'none' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1E1E1E', padding: '30px', borderRadius: '10px', boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)', width: '95%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#007BFF', borderBottom: '2px solid #333333', paddingBottom: '10px', marginBottom: '20px' }}>
              {rankingToCopy ? `Copiar Estrutura: ${rankingToCopy.title}` : 'Criar Novo Ranking Preditivo'}
            </h2>

            <form onSubmit={handleCreateRanking}>
              <h3 style={{ color: '#4a90e2', marginTop: '25px', marginBottom: '10px', fontSize: '1.3rem' }}>
                Informações Básicas do Concurso
              </h3>

              <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
                Nome do Concurso / Cargo:
              </label>
              <input
                type="text"
                name="concursoName"
                required
                defaultValue={rankingToCopy ? `${rankingToCopy.title} (Cópia)` : ''}
                placeholder="Ex: PM-RJ - Oficial"
                style={{ width: '100%', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', fontSize: '1rem' }}
              />

              <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
                Banca Organizadora:
              </label>
              <input
                type="text"
                name="bankName"
                required
                defaultValue={rankingToCopy ? (rankingToCopy.description?.split(' | ')[0]?.replace('Banca: ', '') || 'Banca X') : ''}
                placeholder="Ex: FGV, Cebraspe"
                style={{ width: '100%', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', fontSize: '1rem' }}
              />

              <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
                Escolaridade:
              </label>
              <select
                name="schooling"
                required
                defaultValue={rankingToCopy ? (rankingToCopy.description?.split(' | ')[1]?.replace('Escolaridade: ', '') || 'Superior') : 'Superior'}
                style={{ width: '100%', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', fontSize: '1rem' }}
              >
                <option value="Superior">Superior</option>
                <option value="Médio">Médio</option>
                <option value="Fundamental">Fundamental</option>
              </select>

              <h3 style={{ color: '#4a90e2', marginTop: '25px', marginBottom: '10px', fontSize: '1.3rem' }}>
                Vagas e Concorrência por Categoria
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '10px' }}>
                Defina o número de vagas e de concorrentes inscritos para cada cota do seu concurso.
              </p>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', marginBottom: '20px', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '10px', border: '1px solid #333333', textAlign: 'center', fontSize: '0.9rem', backgroundColor: '#007BFF', color: 'white', fontWeight: '700' }}>Categoria</th>
                    <th style={{ padding: '10px', border: '1px solid #333333', textAlign: 'center', fontSize: '0.9rem', backgroundColor: '#007BFF', color: 'white', fontWeight: '700' }}>Vagas (Total)</th>
                    <th style={{ padding: '10px', border: '1px solid #333333', textAlign: 'center', fontSize: '0.9rem', backgroundColor: '#007BFF', color: 'white', fontWeight: '700' }}>Concorrentes (Total Inscritos)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '10px', border: '1px solid #333333', textAlign: 'center', fontSize: '0.9rem' }}>Ampla Concorrência</td>
                    <td style={{ padding: '10px', border: '1px solid #333333', textAlign: 'center', fontSize: '0.9rem' }}>
                      <input type="number" name="vagasAmpla" min="0" defaultValue={rankingToCopy?.concurrency?.Ampla?.vagas || 10} required style={{ padding: '8px', textAlign: 'center', backgroundColor: '#2A2A2A', border: '1px solid #444', fontSize: '0.9rem', color: '#E0E0E0', width: '100%' }} />
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #333333', textAlign: 'center', fontSize: '0.9rem' }}>
                      <input type="number" name="concorrentesAmpla" min="0" defaultValue={rankingToCopy?.concurrency?.Ampla?.concorrentes || 1000} required style={{ padding: '8px', textAlign: 'center', backgroundColor: '#2A2A2A', border: '1px solid #444', fontSize: '0.9rem', color: '#E0E0E0', width: '100%' }} />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px', border: '1px solid #333333', textAlign: 'center', fontSize: '0.9rem' }}>Pessoa Preta/Parda (PP)</td>
                    <td style={{ padding: '10px', border: '1px solid #333333', textAlign: 'center', fontSize: '0.9rem' }}>
                      <input type="number" name="vagasPP" min="0" defaultValue={rankingToCopy?.concurrency?.PP?.vagas || 0} required style={{ padding: '8px', textAlign: 'center', backgroundColor: '#2A2A2A', border: '1px solid #444', fontSize: '0.9rem', color: '#E0E0E0', width: '100%' }} />
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #333333', textAlign: 'center', fontSize: '0.9rem' }}>
                      <input type="number" name="concorrentesPP" min="0" defaultValue={rankingToCopy?.concurrency?.PP?.concorrentes || 0} required style={{ padding: '8px', textAlign: 'center', backgroundColor: '#2A2A2A', border: '1px solid #444', fontSize: '0.9rem', color: '#E0E0E0', width: '100%' }} />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px', border: '1px solid #333333', textAlign: 'center', fontSize: '0.9rem' }}>Pessoa com Deficiência (PcD)</td>
                    <td style={{ padding: '10px', border: '1px solid #333333', textAlign: 'center', fontSize: '0.9rem' }}>
                      <input type="number" name="vagasPcD" min="0" defaultValue={rankingToCopy?.concurrency?.PcD?.vagas || 0} required style={{ padding: '8px', textAlign: 'center', backgroundColor: '#2A2A2A', border: '1px solid #444', fontSize: '0.9rem', color: '#E0E0E0', width: '100%' }} />
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #333333', textAlign: 'center', fontSize: '0.9rem' }}>
                      <input type="number" name="concorrentesPcD" min="0" defaultValue={rankingToCopy?.concurrency?.PcD?.concorrentes || 0} required style={{ padding: '8px', textAlign: 'center', backgroundColor: '#2A2A2A', border: '1px solid #444', fontSize: '0.9rem', color: '#E0E0E0', width: '100%' }} />
                    </td>
                  </tr>
                </tbody>
              </table>

              <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
                Pontuação Mínima Total para Não Eliminação:
              </label>
              <input
                type="number"
                name="minOverallScore"
                step="0.5"
                min="0"
                defaultValue={(rankingToCopy?.minOverallScore || 40.0).toFixed(1)}
                required
                style={{ width: '100%', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', fontSize: '1rem' }}
              />

              <h3 style={{ color: '#4a90e2', marginTop: '25px', marginBottom: '10px', fontSize: '1.3rem' }}>
                Estrutura de Prova (Disciplinas, Questões, Pesos e Mínimos)
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '10px' }}>
                Defina a estrutura da prova, incluindo o mínimo de pontuação exigido em cada disciplina (se aplicável).
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '10px 0', marginTop: '15px' }}>
                {disciplines.map((disc, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', backgroundColor: '#2A2A2A', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #4a90e2', alignItems: 'end' }}>
                    <div style={{ marginTop: 0 }}>
                      <label style={{ marginTop: 0, marginBottom: '3px', fontSize: '0.8rem', fontWeight: 'normal', color: '#aaa' }}>Nome da Disciplina:</label>
                      <input
                        type="text"
                        name={`disciplineName_${index}`}
                        placeholder="Ex: Raciocínio Lógico"
                        value={disc.name}
                        onChange={(e) => updateDiscipline(index, 'name', e.target.value)}
                        required
                        style={{ padding: '8px 10px', fontSize: '0.9rem', width: '100%', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0' }}
                      />
                    </div>
                    <div style={{ marginTop: 0 }}>
                      <label style={{ marginTop: 0, marginBottom: '3px', fontSize: '0.8rem', fontWeight: 'normal', color: '#aaa' }}>Nº de Questões:</label>
                      <input
                        type="number"
                        name={`questionCount_${index}`}
                        min="1"
                        value={disc.count}
                        onChange={(e) => updateDiscipline(index, 'count', parseInt(e.target.value))}
                        required
                        style={{ padding: '8px 10px', fontSize: '0.9rem', width: '100%', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0' }}
                      />
                    </div>
                    <div style={{ marginTop: 0 }}>
                      <label style={{ marginTop: 0, marginBottom: '3px', fontSize: '0.8rem', fontWeight: 'normal', color: '#aaa' }}>Peso (Pontos/Acerto):</label>
                      <input
                        type="number"
                        name={`questionWeight_${index}`}
                        step="0.1"
                        min="0.1"
                        value={disc.weight}
                        onChange={(e) => updateDiscipline(index, 'weight', parseFloat(e.target.value))}
                        required
                        style={{ padding: '8px 10px', fontSize: '0.9rem', width: '100%', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0' }}
                      />
                    </div>
                    <div style={{ marginTop: 0 }}>
                      <label style={{ marginTop: 0, marginBottom: '3px', fontSize: '0.8rem', fontWeight: 'normal', color: '#aaa' }}>Nota Mínima (Eliminatório):</label>
                      <input
                        type="number"
                        name={`minScore_${index}`}
                        step="0.5"
                        min="0"
                        value={disc.minScore}
                        onChange={(e) => updateDiscipline(index, 'minScore', parseFloat(e.target.value))}
                        required
                        style={{ padding: '8px 10px', fontSize: '0.9rem', width: '100%', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDisciplineRow(index)}
                      style={{ backgroundColor: '#dc3545', color: 'white', padding: '8px', height: '100%', maxHeight: '38px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addDisciplineRow}
                style={{ backgroundColor: '#555', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '10px', fontWeight: '600' }}
              >
                + Adicionar Disciplina
              </button>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #333333' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{ backgroundColor: '#444', color: 'white', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', border: 'none' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createRankingMutation.isPending}
                  style={{ backgroundColor: '#28a745', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', fontWeight: '600', cursor: createRankingMutation.isPending ? 'not-allowed' : 'pointer', opacity: createRankingMutation.isPending ? 0.6 : 1 }}
                >
                  {createRankingMutation.isPending ? 'Salvando...' : 'Salvar Ranking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
