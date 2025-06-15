import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import ProtectedRoute from './components/ProtectedRoute';
import WelcomePage from './components/WelcomePage';

function AppContent() {
  const { user } = useAuth();

  if (!user) {
    return null; // ProtectedRoute will handle showing auth
  }

  return (
    <ChatProvider>
      <MainApp />
    </ChatProvider>
  );
}

function MainApp() {
  // This component is now inside ChatProvider and can use useChat
  return <WelcomePage />;
}

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <AppContent />
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;