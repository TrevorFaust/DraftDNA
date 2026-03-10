import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LeaguesProvider } from "@/hooks/useLeagues";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import { Rankings } from "./pages/Rankings";
import Statistics from "./pages/Statistics";
import MockDraft from "./pages/MockDraft";
import DraftRoom from "./pages/DraftRoom";
import History from "./pages/History";
import Badges from "./pages/Badges";
import PredictionChallenge from "./pages/PredictionChallenge";
import Settings from "./pages/Settings";
import LeagueSettings from "./pages/LeagueSettings";
import NotFound from "./pages/NotFound";
import { Footer } from "./components/Footer";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <LeaguesProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <div className="min-h-screen flex flex-col">
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/rankings" element={<Rankings />} />
                  <Route path="/statistics" element={<Statistics />} />
                  <Route path="/mock-draft" element={<MockDraft />} />
                  <Route path="/draft/:draftId" element={<DraftRoom />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/badges" element={<Badges />} />
                  <Route path="/prediction-challenge" element={<PredictionChallenge />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/league-settings" element={<LeagueSettings />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </TooltipProvider>
        </LeaguesProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
