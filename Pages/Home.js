import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      try {
        await base44.auth.me();
        // Redireciona para o seletor de sistemas
        navigate(createPageUrl("SystemSelector"));
      } catch (error) {
        console.error("Erro ao buscar usuário:", error);
        // ATENÇÃO: base44.auth.redirectToLogin NÃO EXISTE no nosso mock. 
        // Vamos garantir que ele exista no mock da API.
        base44.auth.redirectToLogin(createPageUrl("Home"));
      } finally {
        setLoading(false);
      }
    };

    checkUserAndRedirect();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-20 h-20 text-blue-600 mx-auto mb-6 animate-pulse" />
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Visão do Aprovado</h1>
          <p className="text-gray-600 mb-8">Carregando...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return null;
}
