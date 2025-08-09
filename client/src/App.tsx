import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import MobileNavigation from "@/components/MobileNavigation";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Matching from "@/pages/matching";
import StatementsPage from "@/pages/statements";
import StatementDetailPage from "@/pages/statement-detail";
import ReceiptsPage from "@/pages/receipts";
import EmailImport from "@/pages/EmailImport";

function Router() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pb-16 md:pb-0">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/matching" component={Matching} />
          <Route path="/statements" component={StatementsPage} />
          <Route path="/statements/:id" component={StatementDetailPage} />
          <Route path="/receipts" component={ReceiptsPage} />
          <Route path="/email-import" component={EmailImport} />
          <Route component={NotFound} />
        </Switch>
      </div>
      <MobileNavigation />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
