import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function SystemLayout({ children, systemName, systemColor = "blue" }) {
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const handleLogout = async () => {
    await base44.auth.logout(createPageUrl("Home"));
  };

  const colorClasses = {
    blue: "bg-gradient-to-br from-blue-50 to-indigo-50",
    yellow: "bg-gradient-to-br from-yellow-50 to-orange-50",
    green: "bg-gradient-to-br from-green-50 to-teal-50"
  };

  return (
    <div className={`min-h-screen ${colorClasses[systemColor] || colorClasses.blue}`}>
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold text-gray-900">{systemName}</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to={createPageUrl("SystemSelector")}>
                <Button variant="outline" size="sm">
                  <Home className="w-4 h-4 mr-2" />
                  Sistemas
                </Button>
              </Link>
              {user && (
                <>
                  <span className="text-sm text-gray-600">
                    {user.full_name || user.email}
                  </span>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}