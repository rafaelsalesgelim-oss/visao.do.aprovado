import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from ".";
import { LayoutDashboard, BookOpen, Settings, Upload, Users, BarChart, Home, LogOut } from "lucide-react";
import { base44 } from "./api/base44Client";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Erro ao buscar usuário:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const noLayoutPages = ['SystemSelector', 'RankingHome', 'RankingDetails', 'RedacaoHome'];
  
  if (noLayoutPages.includes(currentPageName)) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121212' }}>
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

  const isAdmin = user?.email === "rafaelsalesgelim@gmail.com";

  const userNav = [
    { name: "Meu Dashboard", path: createPageUrl("UserDashboard"), icon: BarChart },
    { name: "Fazer Simulado", path: createPageUrl("Simulation"), icon: BookOpen },
    { name: "Configurações", path: createPageUrl("UserSettings"), icon: Settings },
  ];

  const adminNav = [
    { name: "Painel Admin", path: createPageUrl("AdminDashboard"), icon: LayoutDashboard },
    { name: "Upload em Massa", path: createPageUrl("BulkUpload"), icon: Upload },
    { name: "Gerenciar Usuários", path: createPageUrl("UserManagement"), icon: Users },
    { name: "Gerenciar Questões", path: createPageUrl("QuestionManager"), icon: BookOpen },
  ];

  const navigation = isAdmin ? adminNav : userNav;

  const handleLogout = async () => {
    await base44.auth.logout(createPageUrl("Home"));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', color: '#E0E0E0' }}>
      <nav style={{ backgroundColor: '#1E1E1E', borderBottom: '2px solid #333333', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', height: '64px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BookOpen style={{ width: '32px', height: '32px', color: '#007BFF' }} />
                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#E0E0E0' }}>Visão do Aprovado</span>
              </div>
              <div style={{ display: 'flex', gap: '20px' }}>
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.path}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderBottom: location.pathname === item.path ? '2px solid #007BFF' : '2px solid transparent',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      textDecoration: 'none',
                      color: location.pathname === item.path ? '#007BFF' : '#aaa',
                      transition: 'color 0.2s'
                    }}
                  >
                    <item.icon style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <Link
                to={createPageUrl("SystemSelector")}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '8px 16px',
                  backgroundColor: '#555',
                  color: 'white',
                  borderRadius: '5px',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  transition: 'background-color 0.2s'
                }}
              >
                <Home style={{ width: '14px', height: '14px' }} />
                Sistemas
              </Link>
              <span style={{ fontSize: '0.875rem', color: '#aaa' }}>
                {user?.full_name || user?.email}
              </span>
              {isAdmin && (
                <span style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: '600', background: 'linear-gradient(to right, #f7931e, #ff6b35)', color: 'white', borderRadius: '9999px' }}>
                  ADMIN
                </span>
              )}
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.875rem',
                  color: '#aaa',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.color = '#dc3545'}
                onMouseLeave={(e) => e.target.style.color = '#aaa'}
              >
                <LogOut style={{ width: '14px', height: '14px' }} />
                Sair
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 20px' }}>
        {children}
      </main>

      <footer style={{ backgroundColor: '#1E1E1E', borderTop: '1px solid #333333', marginTop: '48px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#aaa' }}>
            © 2024 Visão do Aprovado - Sistema de Simulados para Concursos
          </p>
        </div>
      </footer>
    </div>
  );
}
