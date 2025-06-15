import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthPage from './auth/AuthPage';
import { isSupabaseConfigured } from '../lib/supabase';
import { AlertCircle, ExternalLink } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-error-50 via-warning-50 to-warning-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full card p-8 shadow-gentle">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-error-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-error-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Configuration Required</h1>
            <p className="text-gray-600">ChatMind needs to be connected to Supabase to work properly.</p>
          </div>

          <div className="bg-error-50 border border-error-200 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-error-900 mb-3">Missing Environment Variables</h2>
            <p className="text-error-800 mb-4">
              The following environment variables are required but not found:
            </p>
            <ul className="list-disc list-inside text-error-700 space-y-1 mb-4">
              <li><code className="bg-error-100 px-2 py-1 rounded">VITE_SUPABASE_URL</code></li>
              <li><code className="bg-error-100 px-2 py-1 rounded">VITE_SUPABASE_ANON_KEY</code></li>
            </ul>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Setup Guide</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary-600 text-sm font-bold">1</span>
                  </div>
                  <div>
                    <p className="text-gray-800 font-medium">Create a Supabase Project</p>
                    <p className="text-gray-600 text-sm">Go to supabase.com and create a new project</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary-600 text-sm font-bold">2</span>
                  </div>
                  <div>
                    <p className="text-gray-800 font-medium">Run Database Migration</p>
                    <p className="text-gray-600 text-sm">Execute the SQL from <code>supabase/migrations/</code> in your project</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary-600 text-sm font-bold">3</span>
                  </div>
                  <div>
                    <p className="text-gray-800 font-medium">Configure Environment Variables</p>
                    <p className="text-gray-600 text-sm">Add your Supabase URL and anon key to your deployment settings</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <h4 className="font-semibold text-primary-900 mb-2">For Netlify Deployment:</h4>
              <ol className="list-decimal list-inside text-primary-800 text-sm space-y-1">
                <li>Go to your Netlify site dashboard</li>
                <li>Navigate to Site settings → Environment variables</li>
                <li>Add the required variables from your Supabase project settings</li>
                <li>Redeploy your site</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Create Supabase Project
              </a>
              <a
                href="https://docs.supabase.com/guides/getting-started"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View Documentation
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-gentle">
            <span className="text-white font-bold text-2xl">C</span>
          </div>
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading ChatMind...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;