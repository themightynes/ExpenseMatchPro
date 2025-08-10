import { User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export default function MobileHeader({ 
  title = "Receipt Manager", 
  showBack = false, 
  onBack,
  actions 
}: MobileHeaderProps) {
  return (
    <header className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 z-40 safe-area-pt">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left side */}
        <div className="flex items-center">
          {showBack ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="mr-2 p-1 h-8 w-8"
            >
              <i className="fas fa-arrow-left w-4 h-4" />
            </Button>
          ) : (
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-3">
                <i className="fas fa-receipt text-white text-sm" />
              </div>
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                {title}
              </h1>
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-2">
          {actions}
        </div>
      </div>
    </header>
  );
}