import React, { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import Boutique from '@/pages/boutique/Boutique';

// Route-level code splitting: product detail and the payment return page are
// only needed after navigation; keep them out of the initial bundle.
const BoutiqueProductPage = React.lazy(() => import('@/pages/boutique/BoutiqueProductPage'));
const BoutiqueReturn = React.lazy(() => import('@/pages/boutique/BoutiqueReturn'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Navigate to="/boutique" replace />} />
              <Route path="/boutique" element={<Boutique />} />
              <Route path="/boutique/p/:id" element={<BoutiqueProductPage />} />
              <Route path="/boutique/return" element={<BoutiqueReturn />} />
              <Route path="*" element={<Navigate to="/boutique" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
