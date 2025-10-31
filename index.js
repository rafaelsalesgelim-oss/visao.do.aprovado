import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Importa o componente de Layout.
import Layout from './Layout.js'; 

// ==========================================================
// FUNÇÕES DE UTILIDADE EXPORTADAS PARA O RESTANTE DO CÓDIGO
// (Necessário para o import 'import { createPageUrl } from ".";' em Layout.js)
// ==========================================================

/**
 * Cria uma URL básica a partir do nome de uma página.
 * Ex: createPageUrl("UserDashboard") retorna "/UserDashboard"
 * @param {string} pageName O nome da página (ex: "Home", "AdminDashboard").
 * @returns {string} O caminho da URL.
 */
export const createPageUrl = (pageName) => {
  // ATENÇÃO: Se o seu site usava um subdiretório (ex: /app/Home),
  // você deve ajustar o retorno aqui.
  return `/${pageName}`; 
};

// ==========================================================
// INICIALIZAÇÃO DO REACT
// ==========================================================
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    {/* Envolvendo o app com BrowserRouter para usar a navegação do React */}
    <BrowserRouter>
      <Layout /> 
    </BrowserRouter>
  </React.StrictMode>
);
