import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CategorySection from '@/components/buildingComponentTypes/CategorySection';
import ImportTypesDialog from '@/components/buildingComponentTypes/ImportTypesDialog';
import AiPromptDialog from '@/components/buildingComponentTypes/AiPromptDialog';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';
import type { BuildingComponentCategory } from '@/types';

const CATEGORIES: BuildingComponentCategory[] = ['yttervegg', 'vindu', 'ytterdor', 'tak', 'gulv', 'dekke'];

export default function BuildingComponentTypes() {
  const navigate = useNavigate();
  const types = useBuildingComponentTypeStore((s) => s.types);
  const loadTypes = useBuildingComponentTypeStore((s) => s.loadTypes);

  const [importOpen, setImportOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate('/')} title="Til prosjektliste">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold leading-none text-foreground">Bygningsdeltyper</h1>
            <p className="mt-1 text-xs text-muted-foreground">Delt bibliotek av bygningsdeltyper for alle prosjekter.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPromptOpen(true)}>
            <Sparkles /> Kopier AI-prompt
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload /> Importer JSON
          </Button>
        </div>
      </header>

      {CATEGORIES.map((category) => (
        <CategorySection key={category} category={category} types={types.filter((t) => t.category === category)} />
      ))}

      <ImportTypesDialog open={importOpen} onOpenChange={setImportOpen} />
      <AiPromptDialog open={promptOpen} onOpenChange={setPromptOpen} />
    </div>
  );
}
