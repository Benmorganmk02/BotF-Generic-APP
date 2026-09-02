import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { isGuestMode, setGuestMode } from './utils/storage';
import LoginPage from './pages/LoginPage';
import CharacterListPage from './pages/CharacterListPage';
import CharacterSheetPage from './pages/CharacterSheetPage';
import CampaignPage from './pages/CampaignPage';
import CampaignCharacterPage from './pages/CampaignCharacterPage';
import { Toaster } from '@/components/ui/sonner';
import { useEffect } from 'react';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (user) setGuestMode(false);
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Not authenticated and not guest — render login inline (no navigate, no bounce)
  if (!user && !isGuestMode()) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AuthGuard><CharacterListPage /></AuthGuard>} />
        <Route path="/sheet/:id" element={<AuthGuard><CharacterSheetPage /></AuthGuard>} />
        <Route path="/campaign/:campaignId" element={<AuthGuard><CampaignPage /></AuthGuard>} />
        <Route path="/campaign/:campaignId/character/:characterId" element={<AuthGuard><CampaignCharacterPage /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  );
}
