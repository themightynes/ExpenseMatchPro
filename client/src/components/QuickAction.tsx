import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "primary" | "success" | "warning";
  className?: string;
  badge?: string | number;
}

export default function QuickAction({
  icon,
  label,
  onClick,
  variant = "default",
  className,
  badge
}: QuickActionProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return "bg-primary text-white hover:bg-primary/90 shadow-md";
      case "success":
        return "bg-green-500 text-white hover:bg-green-600 shadow-md";
      case "warning":
        return "bg-orange-500 text-white hover:bg-orange-600 shadow-md";
      default:
        return "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm";
    }
  };

  return (
    <Button
      variant="ghost"
      className={cn(
        "h-auto p-4 flex flex-col items-center gap-2 rounded-xl transition-all duration-200 relative",
        getVariantStyles(),
        className
      )}
      onClick={onClick}
    >
      {badge && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
          {badge}
        </div>
      )}
      
      <div className="text-lg">
        {icon}
      </div>
      
      <span className="text-sm font-medium leading-tight text-center">
        {label}
      </span>
    </Button>
  );
}