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
import WatchlistPage from "@/pages/watchlist";
import SettingsAlerts from "@/pages/settings-alerts";
import StackIndex from "@/pages/stack-index";
import StackDetail from "@/pages/stack-detail";
import Leaderboard from "@/pages/leaderboard";
import LeaderboardEmbed from "@/pages/leaderboard-embed";
import LeaderboardWeek from "@/pages/leaderboard-week";
import ProviderRollupPage from "@/pages/provider-rollup";
import BlogIndex from "@/pages/blog/index";
import HNTechStack from "@/pages/blog/what-technologies-the-successful-projects-at-hacker-news-are-using";
import BlogOpenAIvsAnthropic from "@/pages/blog/openai-vs-anthropic-which-saas-companies-use-which";
import BlogStateOfAi2026 from "@/pages/blog/the-state-of-ai-in-saas-2026";
import BlogAzureAdoption from "@/pages/blog/azure-openai-adoption-in-enterprise-saas";
import BlogGateways from "@/pages/blog/ai-gateways-explained-cloudflare-portkey-helicone";
import BlogClaudeVsGpt from "@/pages/blog/claude-vs-gpt-4-real-world-saas-deployments";
import BlogSelfHosted from "@/pages/blog/self-hosted-llms-which-saas-products-run-their-own-models";
import BlogBedrock from "@/pages/blog/aws-bedrock-customers-the-complete-list";
import BlogYcBatch from "@/pages/blog/every-yc-batch-and-which-ai-they-use";
import BlogHowToTell from "@/pages/blog/how-to-tell-which-llm-a-website-is-using";
import BlogChangedThisWeek from "@/pages/blog/what-changed-this-week-in-saas-ai-stacks";
import BlogFingerprintGuide from "@/pages/blog/the-complete-guide-to-fingerprinting-ai-providers";

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
      <Route path="/watchlist" component={WatchlistPage}/>
      <Route path="/settings/alerts" component={SettingsAlerts}/>
      <Route path="/stack" component={StackIndex}/>
      <Route path="/stack/:slug" component={StackDetail}/>
      <Route path="/leaderboard" component={Leaderboard}/>
      <Route path="/leaderboard/:week" component={LeaderboardWeek}/>
      <Route path="/embed/leaderboard" component={LeaderboardEmbed}/>
      <Route path="/provider/:slug" component={ProviderRollupPage}/>
      <Route path="/blog" component={BlogIndex}/>
      <Route path="/blog/what-technologies-the-successful-projects-at-hacker-news-are-using" component={HNTechStack}/>
      <Route path="/blog/openai-vs-anthropic-which-saas-companies-use-which" component={BlogOpenAIvsAnthropic}/>
      <Route path="/blog/the-state-of-ai-in-saas-2026" component={BlogStateOfAi2026}/>
      <Route path="/blog/azure-openai-adoption-in-enterprise-saas" component={BlogAzureAdoption}/>
      <Route path="/blog/ai-gateways-explained-cloudflare-portkey-helicone" component={BlogGateways}/>
      <Route path="/blog/claude-vs-gpt-4-real-world-saas-deployments" component={BlogClaudeVsGpt}/>
      <Route path="/blog/self-hosted-llms-which-saas-products-run-their-own-models" component={BlogSelfHosted}/>
      <Route path="/blog/aws-bedrock-customers-the-complete-list" component={BlogBedrock}/>
      <Route path="/blog/every-yc-batch-and-which-ai-they-use" component={BlogYcBatch}/>
      <Route path="/blog/how-to-tell-which-llm-a-website-is-using" component={BlogHowToTell}/>
      <Route path="/blog/what-changed-this-week-in-saas-ai-stacks" component={BlogChangedThisWeek}/>
      <Route path="/blog/the-complete-guide-to-fingerprinting-ai-providers" component={BlogFingerprintGuide}/>
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
