import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

const ProjectList = lazy(() => import('@/routes/ProjectList'));
const Workspace = lazy(() => import('@/routes/Workspace'));

function RouteFallback() {
  return (
    <div className="flex h-svh items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}

function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<ProjectList />} />
            <Route path="/project/:projectId" element={<Workspace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
