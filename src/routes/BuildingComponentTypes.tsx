import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CategorySection from '@/components/buildingComponentTypes/CategorySection';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';
import type { BuildingComponentCategory } from '@/types';

const CATEGORIES: BuildingComponentCategory[] = ['yttervegg', 'vindu', 'ytterdor', 'tak', 'gulv', 'dekke'];

export default function BuildingComponentTypes() {
  const navigate = useNavigate();
  const types = useBuildingComponentTypeStore((s) => s.types);
  const loadTypes = useBuildingComponentTypeStore((s) => s.loadTypes);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate('/')} title="Til prosjektliste">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold leading-none text-foreground">Bygningsdeltyper</h1>
          <p className="mt-1 text-xs text-muted-foreground">Delt bibliotek av bygningsdeltyper for alle prosjekter.</p>
        </div>
      </header>

      {CATEGORIES.map((category) => (
        <CategorySection key={category} category={category} types={types.filter((t) => t.category === category)} />
      ))}
    </div>
  );
}
