import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthProvider } from "@/hooks/useAuth";
import { LeaguesProvider } from "@/hooks/useLeagues";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import RecoverPassword from "./pages/RecoverPassword";
import Dashboard from "./pages/Dashboard";
import { Rankings } from "./pages/Rankings";
import PlayersSpreadsheet from "./pages/PlayersSpreadsheet";
import MockDraft from "./pages/MockDraft";
import DraftRoom from "./pages/DraftRoom";
import PredictionChallenge from "./pages/PredictionChallenge";
import Settings from "./pages/Settings";
import LeagueSettings from "./pages/LeagueSettings";
import NotFound from "./pages/NotFound";
import { Footer } from "./components/Footer";
import { BrandedLoader } from "./components/BrandedLoader";
import { Navbar } from "./components/Navbar";
import { FantasyDepthProvider } from "@/contexts/FantasyDepthContext";
import { NflTeamContextProvider } from "@/contexts/NflTeamContext";

const Statistics = lazy(() => import("./pages/Statistics").then((m) => ({ default: m.default })));
const History = lazy(() => import("./pages/History").then((m) => ({ default: m.default })));
const Badges = lazy(() => import("./pages/Badges").then((m) => ({ default: m.default })));

function PageFallback() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex min-h-[40vh] items-center justify-center">
        <BrandedLoader size={36} />
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
        <ScrollToTop />
        <AuthProvider>
          <LeaguesProvider>
            <TooltipProvider>
              <FantasyDepthProvider>
              <NflTeamContextProvider>
              <Toaster />
              <Sonner />
              <div className="min-h-screen flex flex-col">
                <main className="flex-1">
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/recover-password" element={<RecoverPassword />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/rankings" element={<Rankings />} />
                    <Route path="/players" element={<PlayersSpreadsheet />} />
                    <Route path="/statistics" element={<Suspense fallback={<PageFallback />}><Statistics /></Suspense>} />
                    <Route path="/mock-draft" element={<MockDraft />} />
                    <Route path="/draft/:draftId" element={<DraftRoom />} />
                    <Route path="/history" element={<Suspense fallback={<PageFallback />}><History /></Suspense>} />
                    <Route path="/badges" element={<Suspense fallback={<PageFallback />}><Badges /></Suspense>} />
                    <Route path="/prediction-challenge" element={<PredictionChallenge />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/league-settings" element={<LeagueSettings />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>
                <Footer />
              </div>
              </NflTeamContextProvider>
              </FantasyDepthProvider>
            </TooltipProvider>
          </LeaguesProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
