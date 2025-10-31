import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen, Trophy, FileText, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SystemSelector() {
  const navigate = useNavigate();

  const systems = [
    {
      id: 'simulados',
      name: 'Visão do Aprovado - Simulados',
      description: 'Configure e responda simulados personalizados de questões de concursos',
      icon: BookOpen,
      color: 'from-blue-600 to-indigo-600',
      route: 'UserDashboard',
      features: ['Questões filtradas', 'Estatísticas detalhadas', 'Histórico completo']
    },
    {
      id: 'rankings',
      name: 'Visão do Aprovado - Rankings',
      description: 'Crie e participe de rankings competitivos com outros candidatos',
      icon: Trophy,
      color: 'from-yellow-600 to-orange-600',
      route: 'RankingHome',
      features: ['Rankings customizados', 'Classificação automática', 'Competição em tempo real']
    },
    {
      id: 'redacoes',
      name: 'Visão do Aprovado - Redações',
      description: 'Análise preditiva de redações com inteligência artificial',
      icon: FileText,
      color: 'from-green-600 to-teal-600',
      route: 'RedacaoHome',
      features: ['Análise por IA', 'Avaliação por competências', 'Feedback detalhado']
    }
  ];

  const handleSystemSelect = (route) => {
    navigate(createPageUrl(route));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 flex items-center justify-center p-6">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            🎯 Visão do Aprovado
          </h1>
          <p className="text-xl text-blue-200">
            Escolha o sistema que deseja acessar
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {systems.map((system) => {
            const Icon = system.icon;
            return (
              <Card 
                key={system.id}
                className="bg-gray-800 border-gray-700 hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
              >
                <CardHeader>
                  <div className={`w-16 h-16 bg-gradient-to-r ${system.color} rounded-full flex items-center justify-center mb-4 mx-auto`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-center text-white text-xl">
                    {system.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-300 text-center text-sm">
                    {system.description}
                  </p>
                  
                  <ul className="space-y-2">
                    {system.features.map((feature, idx) => (
                      <li key={idx} className="text-sm text-gray-400 flex items-center">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSystemSelect(system.route)}
                    className={`w-full bg-gradient-to-r ${system.color} hover:opacity-90 text-white`}
                  >
                    Acessar Sistema
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-400 text-sm">
            Todos os sistemas compartilham o mesmo login e dados de usuário
          </p>
        </div>
      </div>
    </div>
  );
}