import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinancialCardProps {
  title: string;
  amount: number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
  onClick?: () => void;
}

export default function FinancialCard({
  title,
  amount,
  subtitle,
  trend,
  trendValue,
  icon,
  variant = "default",
  className,
  onClick
}: FinancialCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-3 h-3" />;
      case "down":
        return <TrendingDown className="w-3 h-3" />;
      default:
        return <Minus className="w-3 h-3" />;
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return "bg-green-50 border-green-200 text-green-800";
      case "warning":
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case "danger":
        return "bg-red-50 border-red-200 text-red-800";
      default:
        return "bg-white border-gray-200 text-gray-900";
    }
  };

  return (
    <Card 
      className={cn(
        "transition-all duration-200 hover:shadow-md",
        getVariantStyles(),
        onClick && "cursor-pointer hover:scale-102",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {icon && (
                <div className="w-8 h-8 rounded-lg bg-white/50 flex items-center justify-center">
                  {icon}
                </div>
              )}
              <p className="text-sm font-medium text-gray-600">{title}</p>
            </div>
            
            <div className="mt-2">
              <p className="text-2xl font-bold">
                {formatCurrency(amount)}
              </p>
              
              {subtitle && (
                <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
              )}
              
              {trend && trendValue && (
                <div className="flex items-center gap-1 mt-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      trend === "up" && "bg-green-100 text-green-700",
                      trend === "down" && "bg-red-100 text-red-700",
                      trend === "neutral" && "bg-gray-100 text-gray-700"
                    )}
                  >
                    {getTrendIcon()}
                    {trendValue}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}