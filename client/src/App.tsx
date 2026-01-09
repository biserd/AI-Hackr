import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import CardPage from "@/pages/card";
import About from "@/pages/about";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Login from "@/pages/login";
import AuthCallback from "@/pages/auth-callback";
import Dashboard from "@/pages/dashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home}/>
      <Route path="/card/:id" component={CardPage}/>
      <Route path="/scan/:domain" component={CardPage}/>
      <Route path="/about" component={About}/>
      <Route path="/terms" component={Terms}/>
      <Route path="/privacy" component={Privacy}/>
      <Route path="/login" component={Login}/>
      <Route path="/auth/verify" component={AuthCallback}/>
      <Route path="/dashboard" component={Dashboard}/>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SonnerToaster />
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
