import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

const ProjectList = lazy(() => import('@/routes/ProjectList'));
const Workspace = lazy(() => import('@/routes/Workspace'));
const BuildingComponentTypes = lazy(() => import('@/routes/BuildingComponentTypes'));
const RoomTemplates = lazy(() => import('@/routes/RoomTemplates'));

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
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<ProjectList />} />
            <Route path="/project/:projectId" element={<Workspace />} />
            <Route path="/bygningsdeltyper" element={<BuildingComponentTypes />} />
            <Route path="/romtyper" element={<RoomTemplates />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
