import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Receipt, AmexCharge } from "@shared/schema";

interface DragMatchingInterfaceProps {
  statementId: string;
  onBack: () => void;
}

export default function DragMatchingInterface({ statementId, onBack }: DragMatchingInterfaceProps) {
  const [draggedReceipt, setDraggedReceipt] = useState<Receipt | null>(null);
  const [hoveredCharge, setHoveredCharge] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: candidates, isLoading } = useQuery({
    queryKey: ["/api/matching/candidates", statementId],
  });

  const matchMutation = useMutation({
    mutationFn: async ({ receiptId, chargeId }: { receiptId: string; chargeId: string }) => {
      const response = await apiRequest("POST", "/api/matching/match", { receiptId, chargeId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matching/candidates", statementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Match successful",
        description: "Receipt has been matched to the AMEX charge.",
      });
    },
    onError: (error) => {
      console.error("Error matching:", error);
      toast({
        title: "Match failed",
        description: "There was an error matching the receipt. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading matching candidates...</p>
      </div>
    );
  }

  const pairs = (candidates as any)?.pairs || [];
  const receipts: Receipt[] = (candidates as any)?.receipts || [];
  const charges: AmexCharge[] = (candidates as any)?.charges || [];

  const handleDragStart = (receipt: Receipt) => {
    setDraggedReceipt(receipt);
  };

  const handleDragEnd = () => {
    setDraggedReceipt(null);
    setHoveredCharge(null);
  };

  const handleDragOver = (e: React.DragEvent, chargeId: string) => {
    e.preventDefault();
    setHoveredCharge(chargeId);
  };

  const handleDragLeave = () => {
    setHoveredCharge(null);
  };

  const handleDrop = (e: React.DragEvent, charge: AmexCharge) => {
    e.preventDefault();
    if (draggedReceipt) {
      matchMutation.mutate({ 
        receiptId: draggedReceipt.id, 
        chargeId: charge.id 
      });
    }
    setDraggedReceipt(null);
    setHoveredCharge(null);
  };

  const calculateMatchQuality = (receipt: Receipt, charge: AmexCharge) => {
    const amountDiff = Math.abs(parseFloat(receipt.amount) - parseFloat(charge.amount));
    const dateDiff = receipt.date && charge.date ? 
      Math.abs(new Date(receipt.date).getTime() - new Date(charge.date).getTime()) / (1000 * 60 * 60 * 24) : 999;
    
    if (amountDiff < 0.01 && dateDiff <= 1) return "excellent";
    if (amountDiff < 1 && dateDiff <= 7) return "good";
    if (amountDiff < 10 && dateDiff <= 30) return "fair";
    return "poor";
  };

  const getMatchQualityColor = (quality: string) => {
    switch (quality) {
      case "excellent": return "text-green-600 bg-green-50 border-green-200";
      case "good": return "text-blue-600 bg-blue-50 border-blue-200";
      case "fair": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      default: return "text-red-600 bg-red-50 border-red-200";
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          onClick={onBack}
          className="flex items-center gap-2"
        >
          ← Back
        </Button>
        <h1 className="text-2xl font-bold text-primary">Drag & Drop Matching</h1>
        <div></div>
      </div>

      <p className="text-center text-gray-600 mb-8">
        Drag receipts from the left to matching charges on the right
      </p>

      <div className="grid grid-cols-2 gap-8">
        {/* Receipts Column */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            Unmatched Receipts ({receipts.length})
          </h2>
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {receipts.map((receipt) => (
              <Card
                key={receipt.id}
                className={`cursor-move transition-all hover:shadow-md ${
                  draggedReceipt?.id === receipt.id ? "opacity-50" : ""
                }`}
                draggable
                onDragStart={() => handleDragStart(receipt)}
                onDragEnd={handleDragEnd}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      {receipt.merchant || "Unknown Merchant"}
                    </span>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      ${receipt.amount}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Date: {receipt.date ? new Date(receipt.date).toLocaleDateString() : "Not set"}</p>
                    <p>File: {receipt.fileName}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Charges Column */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            AMEX Charges ({charges.length})
          </h2>
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {charges.map((charge) => {
              // Find best matching receipt for this charge
              const bestMatch = receipts.reduce((best, receipt) => {
                const currentQuality = calculateMatchQuality(receipt, charge);
                const bestQuality = best ? calculateMatchQuality(best, charge) : "poor";
                const qualityOrder = { excellent: 4, good: 3, fair: 2, poor: 1 };
                return qualityOrder[currentQuality as keyof typeof qualityOrder] > 
                       qualityOrder[bestQuality as keyof typeof qualityOrder] ? receipt : best;
              }, null as Receipt | null);

              const matchQuality = bestMatch ? calculateMatchQuality(bestMatch, charge) : "poor";
              const isHovered = hoveredCharge === charge.id;

              return (
                <Card
                  key={charge.id}
                  className={`transition-all border-2 ${
                    isHovered 
                      ? "border-primary bg-primary/5 shadow-lg" 
                      : "border-gray-200"
                  } ${
                    bestMatch && draggedReceipt?.id === bestMatch.id 
                      ? getMatchQualityColor(matchQuality)
                      : ""
                  }`}
                  onDragOver={(e) => handleDragOver(e, charge.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, charge)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 text-sm">
                        {charge.description?.substring(0, 40)}...
                      </span>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        ${charge.amount}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Date: {new Date(charge.date).toLocaleDateString()}</p>
                      <p>Card Member: {charge.cardMember}</p>
                    </div>
                    
                    {/* Show best match suggestion */}
                    {bestMatch && draggedReceipt?.id === bestMatch.id && (
                      <div className={`mt-3 p-2 rounded text-xs border ${getMatchQualityColor(matchQuality)}`}>
                        <div className="font-medium capitalize">{matchQuality} match</div>
                        {matchQuality !== "excellent" && (
                          <div className="mt-1 space-y-1">
                            {Math.abs(parseFloat(bestMatch.amount) - parseFloat(charge.amount)) > 0.01 && (
                              <p>Amount diff: ${Math.abs(parseFloat(bestMatch.amount) - parseFloat(charge.amount)).toFixed(2)}</p>
                            )}
                            {bestMatch.date && Math.abs(new Date(bestMatch.date).getTime() - new Date(charge.date).getTime()) / (1000 * 60 * 60 * 24) > 1 && (
                              <p>Date diff: {Math.round(Math.abs(new Date(bestMatch.date).getTime() - new Date(charge.date).getTime()) / (1000 * 60 * 60 * 24))} days</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">How to match:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Drag a receipt from the left column</li>
          <li>• Drop it on the matching AMEX charge on the right</li>
          <li>• Color coding shows match quality when dragging</li>
          <li>• Green = Excellent match, Blue = Good, Yellow = Fair, Red = Poor</li>
        </ul>
      </div>
    </div>
  );
}