import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type ToolButtonProps = {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
};

export default function ToolButton({
  icon: Icon,
  label,
  shortcut,
  active,
  disabled,
  disabledReason,
  onClick,
}: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={onClick}
          className={cn(active && 'bg-primary/10 text-primary hover:bg-primary/15')}
          aria-pressed={active}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {disabled && disabledReason ? disabledReason : shortcut ? `${label} (${shortcut})` : label}
      </TooltipContent>
    </Tooltip>
  );
}
