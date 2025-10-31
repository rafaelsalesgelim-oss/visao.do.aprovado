
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

function QuestionSections({ ranking, initialAnswers = {} }) {
  const options = ['A', 'B', 'C', 'D', 'E'];
  let currentQNum = 1;

  if (!ranking || !ranking.subjects) {
    return <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>Nenhuma disciplina configurada</p>;
  }

  return (
    <>
      {Object.entries(ranking.subjects).map(([key, config]) => {
        const start = currentQNum;
        const end = start + (config?.count || 0) - 1;
        currentQNum += (config?.count || 0);

        return (
          <div key={key} style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px dashed #333333' }}>
            <h3 style={{ color: '#4a90e2', fontSize: '1.2rem', marginBottom: '15px' }}>
              {config?.name || 'Disciplina'} (Questões {start} a {end})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: '10px' }}>
              {Array.from({ length: config?.count || 0 }, (_, i) => {
                const qNum = start + i;
                const fieldName = `${key}_q${qNum}`;
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ margin: 0, fontSize: '0.8rem', color: '#aaa', marginBottom: '2px', fontWeight: 400 }}>
                      Q{qNum}
                    </label>
                    <select
                      name={fieldName}
                      required
                      defaultValue={initialAnswers[fieldName] || ""}
                      style={{ width: '100%', padding: '6px', textAlign: 'center', fontSize: '0.9rem', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0' }}
                    >
                      <option value="">-</option>
                      {options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

export default function RankingDetails() {
  const [user, setUser] = useState(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showGabaritoModal, setShowGabaritoModal] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'final_score', direction: 'desc' });

  // New states for Gabarito functionality
  const [gabaritoText, setGabaritoText] = useState('');
  const [gabaritoTipo, setGabaritoTipo] = useState('Preliminar');
  const [gabaritoVersao, setGabaritoVersao] = useState('');

  // New states for User Participation control
  const [userParticipation, setUserParticipation] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [initialUserAnswers, setInitialUserAnswers] = useState({});

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const rankingId = urlParams.get('id');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: ranking, isLoading, error } = useQuery({
    queryKey: ['ranking', rankingId],
    queryFn: async () => {
      const rankings = await base44.entities.Ranking.list();
      return rankings.find(r => r.id === rankingId);
    },
    enabled: !!rankingId,
  });

  const isAdmin = user?.email === "rafaelsalesgelim@gmail.com";
  const isCreator = user && ranking && ranking.creatorId === user.id;

  // Effect to check for user participation and pre-fill form
  useEffect(() => {
    if (ranking && user && ranking.rankingData) {
      const participation = ranking.rankingData.find(d => d.userId === user.id);
      setUserParticipation(participation);

      if (participation) {
        // Prepare initial answers for the form
        const answers = {};
        Object.keys(ranking.subjects || {}).forEach(subjectKey => {
          let currentQNum = 1;
          for (const key in ranking.subjects) {
            if (key === subjectKey) break;
            currentQNum += (ranking.subjects[key]?.count || 0);
          }
          const config = ranking.subjects[subjectKey];
          for (let i = 0; i < (config?.count || 0); i++) {
            const qNum = currentQNum + i;
            const fieldName = `${subjectKey}_q${qNum}`;
            // Assuming answers are stored directly in participation object,
            // or need to be extracted from some specific field.
            // For now, let's assume they are keys like "subject_qX" directly in the participation object.
            answers[fieldName] = participation[fieldName];
          }
        });
        setInitialUserAnswers(answers);
      } else {
        setInitialUserAnswers({});
      }
    }
  }, [ranking, user]);

  const updateRankingMutation = useMutation({
    mutationFn: (data) => base44.entities.Ranking.update(rankingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['ranking', rankingId]);
    },
  });

  const calculateScore = (userAnswers, subjectKey, currentRanking) => {
    try {
      // Use ranking from currentRanking parameter for recalculation
      const gabarito = currentRanking?.gabarito?.[subjectKey];
      const config = currentRanking?.subjects?.[subjectKey];
      
      if (!gabarito || !config) {
        return { hits: 0, total: 0, score: 0, eliminatedByMinScore: false };
      }
      
      let hits = 0;
      let currentQNum = 1;
      
      // Calculate starting question number for this subject
      for (const key in currentRanking.subjects) {
        if (key === subjectKey) break;
        currentQNum += (currentRanking.subjects[key]?.count || 0);
      }

      for (let i = 0; i < config.count; i++) {
        const qNum = currentQNum + i;
        const userAnswer = userAnswers[`${subjectKey}_q${qNum}`];
        const correct = gabarito[i]; // gabarito is an array of answers for this subject

        if (userAnswer && correct && userAnswer === correct) {
          hits++;
        }
      }

      const score = hits * (config.weight || 1);
      const eliminatedByMinScore = score < (config.minScore || 0);

      return { hits, total: config.count, score, eliminatedByMinScore };
    } catch (err) {
      console.error('Erro ao calcular score:', err);
      return { hits: 0, total: 0, score: 0, eliminatedByMinScore: false };
    }
  };

  const recalculateAllScores = (currentRanking, newGabarito = null) => {
    if (!currentRanking || !currentRanking.rankingData) return [];

    return currentRanking.rankingData.map(participant => {
      let finalScore = 0;
      let disciplineScores = {};
      let isEliminated = false;

      for (const key in currentRanking.subjects) {
        const result = calculateScore(participant, key, { ...currentRanking, gabarito: newGabarito || currentRanking.gabarito });
        finalScore += result.score;
        disciplineScores[key] = result.score;

        if (result.eliminatedByMinScore) {
          isEliminated = true;
        }
      }

      if (finalScore < (currentRanking.minOverallScore || 0)) {
        isEliminated = true;
      }

      return {
        ...participant,
        final_score: finalScore,
        eliminado: isEliminated,
        ...disciplineScores,
      };
    });
  };

  const handleNotesSubmission = (e) => {
    e.preventDefault();
    if (!ranking || !user) return;

    try {
      const formData = new FormData(e.target);
      const nickname = formData.get('userNickname');
      const category = formData.get('userCategory');
      const userAnswers = Object.fromEntries(formData.entries());

      // Recalculate score based on current gabarito
      let finalScore = 0;
      let disciplineScores = {};
      let isEliminated = false;

      for (const key in ranking.subjects) {
        const result = calculateScore(userAnswers, key, ranking);
        finalScore += result.score;
        disciplineScores[key] = result.score;

        if (result.eliminatedByMinScore) {
          isEliminated = true;
        }
      }

      if (finalScore < (ranking.minOverallScore || 0)) {
        isEliminated = true;
      }

      const newRankerData = {
        userId: user.id,
        userEmail: user.email,
        nickname,
        category,
        final_score: finalScore,
        eliminado: isEliminated,
        ...disciplineScores,
        ...userAnswers // Store all question answers for this user
      };

      const newRankingData = [...(ranking.rankingData || [])];
      const existingIndex = newRankingData.findIndex(d => d.userId === user.id);

      if (existingIndex !== -1) {
        // Update existing participation
        newRankingData[existingIndex] = newRankerData;
      } else {
        // Add new participation
        newRankingData.push(newRankerData);
      }

      updateRankingMutation.mutate({ rankingData: newRankingData });
      setShowNotesModal(false);
      setIsEditMode(false);

      if (isEliminated) {
        alert(`Sua nota preditiva (${finalScore.toFixed(1)} pts) foi ${existingIndex !== -1 ? 'atualizada' : 'cadastrada'}. Atenção: Você foi ELIMINADO por não atingir o mínimo.`);
      } else {
        alert(`Sua nota preditiva (${finalScore.toFixed(1)} pts) foi ${existingIndex !== -1 ? 'atualizada' : 'cadastrada'} e o Ranking foi atualizado em tempo real!`);
      }
    } catch (err) {
      console.error('Erro ao submeter notas:', err);
      alert('Erro ao processar as respostas. Tente novamente.');
    }
  };

  const handleDeleteParticipation = () => {
    if (!ranking || !user) return;

    const confirmed = confirm('Tem certeza que deseja deletar sua participação neste ranking? Esta ação não pode ser desfeita.');
    if (!confirmed) return;

    const newRankingData = ranking.rankingData.filter(d => d.userId !== user.id);
    updateRankingMutation.mutate({ rankingData: newRankingData });
    setUserParticipation(null); // Clear user participation state
    setInitialUserAnswers({}); // Clear initial answers
    alert('Participação deletada com sucesso!');
  };

  const handleEditParticipation = () => {
    setIsEditMode(true);
    setShowNotesModal(true);
  };

  const handleUpdateGabarito = () => {
    if (!gabaritoText.trim()) {
      alert('Por favor, cole o gabarito no campo de texto.');
      return;
    }

    if (!gabaritoVersao.trim()) {
      alert('Por favor, informe a versão do gabarito.');
      return;
    }

    try {
      const lines = gabaritoText.trim().split('\n');
      const newGabarito = {};
      const subjectKeys = Object.keys(ranking.subjects || {});
      const subjectNamesMap = new Map(Object.entries(ranking.subjects || {}).map(([key, subj]) => [subj.name.toLowerCase(), key]));

      let currentSubjectKey = null;
      let currentAnswers = [];

      lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        // Check if the line is a subject name
        const lowerCaseLine = line.toLowerCase();
        const foundSubjectKey = subjectNamesMap.get(lowerCaseLine);

        if (foundSubjectKey) {
          // If a previous subject was being processed, save its answers
          if (currentSubjectKey && currentAnswers.length > 0) {
            newGabarito[currentSubjectKey] = currentAnswers;
          }
          currentSubjectKey = foundSubjectKey;
          currentAnswers = [];
        } else if (currentSubjectKey) {
          // If in a subject context, try to extract answers (A-E)
          const matches = line.match(/[A-E]/g);
          if (matches) {
            currentAnswers.push(...matches);
          }
        }
      });

      // Save the last processed subject's answers
      if (currentSubjectKey && currentAnswers.length > 0) {
        newGabarito[currentSubjectKey] = currentAnswers;
      }

      if (Object.keys(newGabarito).length === 0) {
        alert('Não foi possível extrair o gabarito. Verifique o formato do texto colado. Certifique-se de que cada disciplina é seguida por suas respostas.');
        return;
      }

      // Validate counts
      let gabaritoIsValid = true;
      for (const subjKey of subjectKeys) {
        const expectedCount = ranking.subjects[subjKey]?.count || 0;
        const actualCount = newGabarito[subjKey]?.length || 0;
        if (expectedCount !== actualCount) {
          alert(`Gabarito incompleto ou incorreto para a disciplina "${ranking.subjects[subjKey].name}". Esperado: ${expectedCount} questões, Encontrado: ${actualCount}.`);
          gabaritoIsValid = false;
          break;
        }
      }

      if (!gabaritoIsValid) return;

      // Recalculate all scores with the new gabarito before updating the ranking
      const updatedRankingData = recalculateAllScores(ranking, newGabarito);

      updateRankingMutation.mutate({ 
        gabarito: newGabarito,
        gabaritoTipo,
        gabaritoVersao,
        rankingData: updatedRankingData // Update with recalculated scores
      });

      setShowGabaritoModal(false);
      setGabaritoText('');
      setGabaritoVersao('');
      alert(`Gabarito ${gabaritoTipo} (${gabaritoVersao}) atualizado com sucesso! O ranking foi recalculado.`);
    } catch (err) {
      console.error('Erro ao processar gabarito:', err);
      alert('Erro ao processar gabarito: ' + err.message);
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const getFilteredAndSortedData = () => {
    if (!ranking || !ranking.rankingData || !Array.isArray(ranking.rankingData)) {
      return [];
    }

    try {
      let filtered = ranking.rankingData.filter(d => {
        const matchesCategory = currentFilter === 'Todos' || d.category === currentFilter;
        const matchesSearch = searchTerm === '' || (d.nickname?.toUpperCase() || '').includes(searchTerm.toUpperCase());
        return matchesCategory && matchesSearch;
      });

      // Ensure that 'eliminado' property is correctly set after any recalculation
      // This is handled by `recalculateAllScores` if a new gabarito is applied,
      // but if the data is just filtered/sorted, we assume `eliminado` is correct.

      const approvedRows = filtered.filter(d => !d.eliminado);
      const eliminatedRows = filtered.filter(d => d.eliminado);

      const compare = (a, b) => {
        let valA = a[sortConfig.key] || 0;
        let valB = b[sortConfig.key] || 0;

        if (sortConfig.key === 'nickname' || sortConfig.key === 'category') {
          valA = String(valA);
          valB = String(valB);
          return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        if (sortConfig.direction === 'asc') {
          return valA - valB;
        } else {
          return valB - valA;
        }
      };

      approvedRows.sort(compare);
      eliminatedRows.sort(compare);

      return [...approvedRows, ...eliminatedRows];
    } catch (err) {
      console.error('Erro ao filtrar dados:', err);
      return [];
    }
  };

  if (isLoading || !user) {
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

  if (error || !ranking) {
    return (
      <div style={{ backgroundColor: '#121212', color: '#E0E0E0', minHeight: '100vh', padding: '20px' }}>
        <button
          onClick={() => navigate(createPageUrl('RankingHome'))}
          style={{ backgroundColor: '#555', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600' }}
        >
          ← Voltar à Lista
        </button>
        <p style={{ color: '#dc3545', marginTop: '20px', textAlign: 'center' }}>Erro ao carregar ranking ou ranking não encontrado.</p>
      </div>
    );
  }

  const totalVacancies = Object.values(ranking.concurrency || {}).reduce((sum, c) => sum + (c?.vagas || 0), 0);
  const totalContestants = Object.values(ranking.concurrency || {}).reduce((sum, c) => sum + (c?.concorrentes || 0), 0);
  const filteredAndSortedData = getFilteredAndSortedData();

  return (
    <div style={{ backgroundColor: '#121212', color: '#E0E0E0', minHeight: '100vh', padding: '20px' }}>
      <header style={{ marginBottom: '10px', paddingBottom: 0, borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <button
          onClick={() => navigate(createPageUrl('RankingHome'))}
          style={{ backgroundColor: '#555', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600' }}
        >
          ← Voltar à Lista
        </button>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {!userParticipation ? (
            <button
              onClick={() => {
                setIsEditMode(false);
                setInitialUserAnswers({}); // Clear previous answers when opening for new submission
                setShowNotesModal(true);
              }}
              style={{ backgroundColor: '#28a745', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 4px 10px rgba(40, 167, 69, 0.3)' }}
            >
              Cadastre Sua Nota
            </button>
          ) : (
            <>
              <button
                onClick={handleEditParticipation}
                style={{ backgroundColor: '#ffc107', color: '#121212', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600' }}
              >
                Editar Minhas Respostas
              </button>
              <button
                onClick={handleDeleteParticipation}
                style={{ backgroundColor: '#dc3545', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600' }}
              >
                Deletar Participação
              </button>
            </>
          )}
          {(isAdmin || isCreator) && (
            <button
              onClick={() => {
                setShowGabaritoModal(true);
                // Pre-fill gabarito info if available
                setGabaritoTipo(ranking.gabaritoTipo || 'Preliminar');
                setGabaritoVersao(ranking.gabaritoVersao || '');
                setGabaritoText(''); // Clear text area on open
              }}
              style={{ backgroundColor: '#333333', color: '#E0E0E0', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600' }}
            >
              Gabarito
            </button>
          )}
        </div>
      </header>

      <div style={{ backgroundColor: '#1E1E1E', padding: '20px', borderRadius: '8px', marginBottom: '25px', borderLeft: '5px solid #007BFF' }}>
        <h1 style={{ color: '#007BFF', fontSize: '1.5rem', marginBottom: '5px' }}>{ranking.title || 'Ranking sem título'}</h1>
        <p style={{ color: '#E0E0E0', marginBottom: '10px' }}>{ranking.description || 'Sem descrição'}</p>
        <div style={{ display: 'flex', gap: '25px', marginTop: '10px', fontSize: '0.9rem', flexWrap: 'wrap' }}>
          <div>Vagas Totais: <span style={{ fontWeight: 'bold', color: '#4a90e2' }}>{totalVacancies}</span></div>
          <div>Concorrência Total: <span style={{ fontWeight: 'bold', color: '#4a90e2' }}>{totalContestants}</span></div>
          <div>Participantes no Simulado: <span style={{ fontWeight: 'bold', color: '#4a90e2' }}>{ranking.rankingData?.length || 0}</span></div>
          <div>Mínimo Total: <span style={{ fontWeight: 'bold', color: '#4a90e2' }}>{(ranking.minOverallScore || 0).toFixed(1)} pts</span></div>
          {ranking.gabaritoTipo && ranking.gabaritoVersao && (
            <div>Gabarito: <span style={{ fontWeight: 'bold', color: '#4a90e2' }}>{ranking.gabaritoTipo} - {ranking.gabaritoVersao}</span></div>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '10px', marginTop: '20px', backgroundColor: '#38381e', color: '#ffc107', borderRadius: '5px', fontSize: '0.9rem', marginBottom: '20px' }}>
        ⚠️ **RANKING PREDITIVO:** As pontuações são baseadas em um Gabarito Majoritário de IA. Candidatos em **vermelho-claro** não atingiram o mínimo necessário.
        {ranking.gabaritoTipo && ranking.gabaritoVersao && (
          <p style={{ marginTop: '5px', marginBottom: 0 }}>Atualmente, as pontuações são calculadas com o Gabarito {ranking.gabaritoTipo} - {ranking.gabaritoVersao}.</p>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setCurrentFilter('Todos')}
            style={{ backgroundColor: currentFilter === 'Todos' ? '#007BFF' : '#333', color: currentFilter === 'Todos' ? 'white' : '#E0E0E0', padding: '8px 15px', border: currentFilter === 'Todos' ? '1px solid #007BFF' : '1px solid #444', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', boxShadow: currentFilter === 'Todos' ? '0 0 10px rgba(0, 123, 255, 0.4)' : 'none' }}
          >
            Todos (Vagas: {totalVacancies})
          </button>
          <button
            onClick={() => setCurrentFilter('Ampla')}
            style={{ backgroundColor: currentFilter === 'Ampla' ? '#007BFF' : '#333', color: currentFilter === 'Ampla' ? 'white' : '#E0E0E0', padding: '8px 15px', border: currentFilter === 'Ampla' ? '1px solid #007BFF' : '1px solid #444', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', boxShadow: currentFilter === 'Ampla' ? '0 0 10px rgba(0, 123, 255, 0.4)' : 'none' }}
          >
            Ampla (Vagas: {ranking.concurrency?.Ampla?.vagas || 0})
          </button>
          <button
            onClick={() => setCurrentFilter('PP')}
            style={{ backgroundColor: currentFilter === 'PP' ? '#007BFF' : '#333', color: currentFilter === 'PP' ? 'white' : '#E0E0E0', padding: '8px 15px', border: currentFilter === 'PP' ? '1px solid #007BFF' : '1px solid #444', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', boxShadow: currentFilter === 'PP' ? '0 0 10px rgba(0, 123, 255, 0.4)' : 'none' }}
          >
            PP (Vagas: {ranking.concurrency?.PP?.vagas || 0})
          </button>
          <button
            onClick={() => setCurrentFilter('PcD')}
            style={{ backgroundColor: currentFilter === 'PcD' ? '#007BFF' : '#333', color: currentFilter === 'PcD' ? 'white' : '#E0E0E0', padding: '8px 15px', border: currentFilter === 'PcD' ? '1px solid #007BFF' : '1px solid #444', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', boxShadow: currentFilter === 'PcD' ? '0 0 10px rgba(0, 123, 255, 0.4)' : 'none' }}
          >
            PcD (Vagas: {ranking.concurrency?.PcD?.vagas || 0})
          </button>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar participante por Nickname..."
            style={{ width: '100%', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', fontSize: '1rem' }}
          />
        </div>
      </div>

      <div style={{ overflowX: 'auto', backgroundColor: '#1E1E1E', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr>
              <th onClick={() => handleSort('pos')} style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #333333', backgroundColor: '#007BFF', color: 'white', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.5px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Pos.
                  <span style={{ marginLeft: '8px', fontSize: '0.7rem', opacity: sortConfig.key === 'pos' ? 1 : 0.6 }}>
                    {sortConfig.key === 'pos' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
              </th>
              <th onClick={() => handleSort('nickname')} style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #333333', backgroundColor: '#007BFF', color: 'white', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.5px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Nickname
                  <span style={{ marginLeft: '8px', fontSize: '0.7rem', opacity: sortConfig.key === 'nickname' ? 1 : 0.6 }}>
                    {sortConfig.key === 'nickname' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
              </th>
              <th onClick={() => handleSort('category')} style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #333333', backgroundColor: '#007BFF', color: 'white', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.5px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Categoria
                  <span style={{ marginLeft: '8px', fontSize: '0.7rem', opacity: sortConfig.key === 'category' ? 1 : 0.6 }}>
                    {sortConfig.key === 'category' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
              </th>
              {Object.entries(ranking.subjects || {}).map(([key, config]) => (
                <th key={key} onClick={() => handleSort(key)} style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #333333', backgroundColor: '#007BFF', color: 'white', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.5px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {config?.name || 'Disciplina'} (P: {(config?.weight || 1).toFixed(1)}, Mín: {(config?.minScore || 0).toFixed(1)})
                    <span style={{ marginLeft: '8px', fontSize: '0.7rem', opacity: sortConfig.key === key ? 1 : 0.6 }}>
                      {sortConfig.key === key ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </div>
                </th>
              ))}
              <th onClick={() => handleSort('final_score')} style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #333333', backgroundColor: '#007BFF', color: 'white', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.5px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Nota Final (Predita)
                  <span style={{ marginLeft: '8px', fontSize: '0.7rem', opacity: sortConfig.key === 'final_score' ? 1 : 0.6 }}>
                    {sortConfig.key === 'final_score' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedData.map((data, index) => {
              const badgeStyle = data.category === 'Ampla' ? { backgroundColor: '#007BFF', color: 'white' } :
                                 data.category === 'PP' ? { backgroundColor: '#ffc107', color: '#121212' } :
                                 { backgroundColor: '#28a745', color: 'white' };

              return (
                <tr key={data.userId || index} style={{ backgroundColor: data.eliminado ? '#401f1f' : 'transparent', opacity: data.eliminado ? 0.7 : 1 }}>
                  <td style={{ padding: '12px 15px', borderBottom: '1px solid #333333', fontWeight: 'bold', color: '#007BFF' }}>
                    {index + 1}º
                  </td>
                  <td style={{ padding: '12px 15px', borderBottom: '1px solid #333333' }}>
                    {data.nickname || 'Anônimo'}
                  </td>
                  <td style={{ padding: '12px 15px', borderBottom: '1px solid #333333' }}>
                    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', ...badgeStyle }}>
                      {data.category || 'Ampla'}
                    </span>
                  </td>
                  {Object.keys(ranking.subjects || {}).map(key => (
                    <td key={key} style={{ padding: '12px 15px', borderBottom: '1px solid #333333' }}>
                      (NA / {(data[key] || 0).toFixed(1)} pts)
                    </td>
                  ))}
                  <td style={{ padding: '12px 15px', borderBottom: '1px solid #333333', fontWeight: 'bold', color: data.eliminado ? '#dc3545' : '#28a745', backgroundColor: data.eliminado ? '#3b2020' : '#28302c' }}>
                    {(data.final_score || 0).toFixed(1)} pts
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showNotesModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1E1E1E', padding: '30px', borderRadius: '10px', boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)', width: '95%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#007BFF', borderBottom: '2px solid #333333', paddingBottom: '10px', marginBottom: '20px' }}>
              {isEditMode ? 'Editar Suas Respostas' : 'Cadastre Suas Respostas'}
            </h2>
            <p style={{ marginBottom: '20px', fontSize: '0.9rem', color: '#aaa' }}>
              Insira o seu Nickname e as respostas que você marcou em cada questão. Isso será cruzado com os dados dos demais candidatos para gerar a pontuação preditiva.
            </p>

            <form onSubmit={handleNotesSubmission}>
              <h3 style={{ color: '#4a90e2', marginTop: '25px', marginBottom: '10px', fontSize: '1.3rem' }}>
                Seus Dados de Participação
              </h3>

              <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
                Seu Nickname:
              </label>
              <input
                type="text"
                name="userNickname"
                required
                defaultValue={userParticipation?.nickname || ''}
                placeholder="Ex: Meu_Nome_Aqui"
                style={{ width: '100%', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', fontSize: '1rem' }}
              />

              <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
                Sua Categoria de Cota:
              </label>
              <select
                name="userCategory"
                required
                defaultValue={userParticipation?.category || 'Ampla'}
                style={{ width: '100%', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', fontSize: '1rem' }}
              >
                <option value="Ampla">Ampla Concorrência</option>
                <option value="PP">Pessoa Preta/Parda (PP)</option>
                <option value="PcD">Pessoa com Deficiência (PcD)</option>
              </select>

              <h3 style={{ color: '#4a90e2', marginTop: '25px', marginBottom: '10px', fontSize: '1.3rem' }}>
                Marcação do Gabarito
              </h3>

              <QuestionSections ranking={ranking} initialAnswers={initialUserAnswers} />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #333333' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowNotesModal(false);
                    setIsEditMode(false);
                  }}
                  style={{ backgroundColor: '#444', color: 'white', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', border: 'none' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#28a745', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', fontWeight: '600', cursor: 'pointer' }}
                >
                  {isEditMode ? 'Atualizar Respostas' : 'Submeter Respostas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showGabaritoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1E1E1E', padding: '30px', borderRadius: '10px', boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)', width: '95%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#007BFF', borderBottom: '2px solid #333333', paddingBottom: '10px', marginBottom: '20px' }}>
              Cadastro de Gabarito (Preliminar/Oficial)
            </h2>

            <h3 style={{ color: '#4a90e2', marginTop: '25px', marginBottom: '10px', fontSize: '1.3rem' }}>
              Configuração de Gabarito
            </h3>

            <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
              Tipo de Gabarito:
            </label>
            <select
              value={gabaritoTipo}
              onChange={(e) => setGabaritoTipo(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', fontSize: '1rem' }}
            >
              <option value="Preliminar">Preliminar (Possível alteração)</option>
              <option value="Oficial">Oficial (Definitivo)</option>
            </select>

            <label style={{ display: 'block', marginTop: '15px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
              Versão do Gabarito:
            </label>
            <input
              type="text"
              value={gabaritoVersao}
              onChange={(e) => setGabaritoVersao(e.target.value)}
              placeholder="Ex: Versão 1, Prova Amarela, Gabarito Final, etc."
              required
              style={{ width: '100%', padding: '10px 15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', fontSize: '1rem' }}
            />

            <label style={{ display: 'block', marginTop: '20px', marginBottom: '5px', fontWeight: '600', fontSize: '0.95rem' }}>
              Cole o Gabarito Abaixo:
            </label>
            <p style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '10px' }}>
              Cole o gabarito no formato: Nome da Disciplina seguido das respostas (A, B, C, D, E).
              <br />
              **Atenção:** As disciplinas devem ter o mesmo nome configurado no ranking.
              <br />
              Exemplo:
              <br />
              <pre style={{ backgroundColor: '#222', padding: '10px', borderRadius: '5px', color: '#ddd' }}>
                Português<br />
                A B C D E A B C<br />
                Matemática<br />
                C D E A B C
              </pre>
            </p>
            <textarea
              value={gabaritoText}
              onChange={(e) => setGabaritoText(e.target.value)}
              placeholder="Português&#10;A B C D E A B C D E&#10;Matemática&#10;C D E A B C D E"
              style={{ width: '100%', minHeight: '200px', padding: '15px', backgroundColor: '#2A2A2A', border: '1px solid #333333', borderRadius: '5px', color: '#E0E0E0', fontSize: '1rem', fontFamily: 'monospace', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #333333' }}>
              <button
                type="button"
                onClick={() => {
                  setShowGabaritoModal(false);
                  setGabaritoText('');
                  setGabaritoVersao('');
                }}
                style={{ backgroundColor: '#444', color: 'white', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', border: 'none' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpdateGabarito}
                style={{ backgroundColor: '#28a745', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', fontWeight: '600', cursor: 'pointer' }}
              >
                Atualizar Gabarito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
