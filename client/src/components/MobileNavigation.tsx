import { Link, useLocation } from "wouter";
import { Home, Receipt, CreditCard, BarChart3, Plus, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  isMain?: boolean;
}

const navItems: NavItem[] = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Receipt, label: "Receipts", path: "/receipts" },
  { icon: Mail, label: "Email", path: "/email-import" },
  { icon: CreditCard, label: "Statements", path: "/statements" },
  { icon: BarChart3, label: "Matching", path: "/matching" },
];

export default function MobileNavigation() {
  const [location] = useLocation();

  return (
    <>
      {/* Bottom Navigation */}
      {/* MOBILE: Added iOS safe area support and improved tap targets */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around h-16 px-2 min-h-[64px]">
          {navItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "flex flex-col items-center gap-1 h-12 px-3 rounded-xl transition-all duration-200 min-h-[44px] min-w-[44px]",
                  item.isMain
                    ? "bg-primary text-white hover:bg-primary/90 shadow-lg scale-110"
                    : location === item.path
                    ? "bg-primary/10 text-primary"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5",
                  item.isMain ? "w-6 h-6" : ""
                )} />
                <span className={cn(
                  "text-xs font-medium",
                  item.isMain ? "sr-only" : ""
                )}>
                  {item.label}
                </span>
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {/* Spacer for fixed bottom nav */}
      <div className="h-16 md:h-0"></div>
    </>
  );
}