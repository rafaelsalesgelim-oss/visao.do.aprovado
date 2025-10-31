import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './Layout.js'; // Importa o seu layout
import Home from './pages/Home.js';
import SystemSelector from './pages/SystemSelector.js';
import UserDashboard from './pages/UserDashboard.js';

// Importe todos os outros componentes de página que você tem
// (Baseado nas imagens que você compartilhou, vou incluir os principais)
import AdminDashboard from './pages/AdminDashboard.js';
import UserManagement from './pages/UserManagement.js';
import QuestionManager from './pages/QuestionManager.js';

export default function AppRoutes() {
  return (
    <Routes>
      <Route 
        path="/" 
        element={<Layout currentPageName="Home"><Home /></Layout>} 
      />
      <Route 
        path="/Home" 
        element={<Layout currentPageName="Home"><Home /></Layout>} 
      />
      
      {/* Rotas Principais */}
      <Route 
        path="/SystemSelector" 
        element={<Layout currentPageName="SystemSelector"><SystemSelector /></Layout>} 
      />
      <Route 
        path="/UserDashboard" 
        element={<Layout currentPageName="UserDashboard"><UserDashboard /></Layout>} 
      />
      
      {/* Rotas Admin (Exemplo) */}
      <Route 
        path="/AdminDashboard" 
        element={<Layout currentPageName="AdminDashboard"><AdminDashboard /></Layout>} 
      />

      {/* Rota 404/Fallback */}
      <Route 
        path="*" 
        element={
          <div style={{ padding: '50px', color: 'red', textAlign: 'center' }}>
            <h1>404 | Página Não Encontrada</h1>
            <p>O roteamento precisa ser ajustado.</p>
          </div>
        }
      />
    </Routes>
  );
}
