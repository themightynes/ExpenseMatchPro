import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Receipt, AmexCharge } from "@shared/schema";

interface DragMatchingInterfaceProps {
  statementId: string;
  onBack: () => void;
}

interface FilterState {
  receipts: {
    minAmount: string;
    maxAmount: string;
    startDate: string;
    endDate: string;
    merchant: string;
  };
  charges: {
    minAmount: string;
    maxAmount: string;
    startDate: string;
    endDate: string;
    merchant: string;
  };
}

export default function DragMatchingInterface({ statementId, onBack }: DragMatchingInterfaceProps) {
  const [draggedReceipt, setDraggedReceipt] = useState<Receipt | null>(null);
  const [hoveredCharge, setHoveredCharge] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    receipts: {
      minAmount: "",
      maxAmount: "",
      startDate: "",
      endDate: "",
      merchant: "",
    },
    charges: {
      minAmount: "",
      maxAmount: "",
      startDate: "",
      endDate: "",
      merchant: "",
    },
  });
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
  const allReceipts: Receipt[] = (candidates as any)?.receipts || [];
  const allCharges: AmexCharge[] = (candidates as any)?.charges || [];

  // Apply filters
  const filteredReceipts = useMemo(() => {
    return allReceipts.filter(receipt => {
      const amount = parseFloat(receipt.amount);
      const date = receipt.date ? new Date(receipt.date) : null;
      
      // Amount filters
      if (filters.receipts.minAmount && amount < parseFloat(filters.receipts.minAmount)) return false;
      if (filters.receipts.maxAmount && amount > parseFloat(filters.receipts.maxAmount)) return false;
      
      // Date filters
      if (filters.receipts.startDate && date && date < new Date(filters.receipts.startDate)) return false;
      if (filters.receipts.endDate && date && date > new Date(filters.receipts.endDate)) return false;
      
      // Merchant filter
      if (filters.receipts.merchant && !receipt.merchant?.toLowerCase().includes(filters.receipts.merchant.toLowerCase())) return false;
      
      return true;
    });
  }, [allReceipts, filters.receipts]);

  const filteredCharges = useMemo(() => {
    return allCharges.filter(charge => {
      const amount = parseFloat(charge.amount);
      const date = new Date(charge.date);
      
      // Amount filters
      if (filters.charges.minAmount && amount < parseFloat(filters.charges.minAmount)) return false;
      if (filters.charges.maxAmount && amount > parseFloat(filters.charges.maxAmount)) return false;
      
      // Date filters
      if (filters.charges.startDate && date < new Date(filters.charges.startDate)) return false;
      if (filters.charges.endDate && date > new Date(filters.charges.endDate)) return false;
      
      // Merchant filter
      if (filters.charges.merchant && !charge.description?.toLowerCase().includes(filters.charges.merchant.toLowerCase())) return false;
      
      return true;
    });
  }, [allCharges, filters.charges]);

  const receipts = filteredReceipts;
  const charges = filteredCharges;

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

  const clearFilters = () => {
    setFilters({
      receipts: {
        minAmount: "",
        maxAmount: "",
        startDate: "",
        endDate: "",
        merchant: "",
      },
      charges: {
        minAmount: "",
        maxAmount: "",
        startDate: "",
        endDate: "",
        merchant: "",
      },
    });
  };

  const updateReceiptFilter = (field: keyof FilterState["receipts"], value: string) => {
    setFilters(prev => ({
      ...prev,
      receipts: {
        ...prev.receipts,
        [field]: value,
      },
    }));
  };

  const updateChargeFilter = (field: keyof FilterState["charges"], value: string) => {
    setFilters(prev => ({
      ...prev,
      charges: {
        ...prev.charges,
        [field]: value,
      },
    }));
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
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <i className="fas fa-filter"></i>
          {showFilters ? "Hide Filters" : "Show Filters"}
        </Button>
      </div>

      <p className="text-center text-gray-600 mb-4">
        Drag receipts from the left to matching charges on the right
      </p>

      {/* Filters Section */}
      {showFilters && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Filters</CardTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-8">
              {/* Receipt Filters */}
              <div>
                <h3 className="font-semibold mb-4 text-gray-900">Receipt Filters</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="receipt-min-amount" className="text-sm">Min Amount</Label>
                      <Input
                        id="receipt-min-amount"
                        type="number"
                        placeholder="0.00"
                        value={filters.receipts.minAmount}
                        onChange={(e) => updateReceiptFilter("minAmount", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="receipt-max-amount" className="text-sm">Max Amount</Label>
                      <Input
                        id="receipt-max-amount"
                        type="number"
                        placeholder="1000.00"
                        value={filters.receipts.maxAmount}
                        onChange={(e) => updateReceiptFilter("maxAmount", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="receipt-start-date" className="text-sm">Start Date</Label>
                      <Input
                        id="receipt-start-date"
                        type="date"
                        value={filters.receipts.startDate}
                        onChange={(e) => updateReceiptFilter("startDate", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="receipt-end-date" className="text-sm">End Date</Label>
                      <Input
                        id="receipt-end-date"
                        type="date"
                        value={filters.receipts.endDate}
                        onChange={(e) => updateReceiptFilter("endDate", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="receipt-merchant" className="text-sm">Merchant</Label>
                    <Input
                      id="receipt-merchant"
                      placeholder="Search merchant..."
                      value={filters.receipts.merchant}
                      onChange={(e) => updateReceiptFilter("merchant", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Charge Filters */}
              <div>
                <h3 className="font-semibold mb-4 text-gray-900">Charge Filters</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="charge-min-amount" className="text-sm">Min Amount</Label>
                      <Input
                        id="charge-min-amount"
                        type="number"
                        placeholder="0.00"
                        value={filters.charges.minAmount}
                        onChange={(e) => updateChargeFilter("minAmount", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="charge-max-amount" className="text-sm">Max Amount</Label>
                      <Input
                        id="charge-max-amount"
                        type="number"
                        placeholder="1000.00"
                        value={filters.charges.maxAmount}
                        onChange={(e) => updateChargeFilter("maxAmount", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="charge-start-date" className="text-sm">Start Date</Label>
                      <Input
                        id="charge-start-date"
                        type="date"
                        value={filters.charges.startDate}
                        onChange={(e) => updateChargeFilter("startDate", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="charge-end-date" className="text-sm">End Date</Label>
                      <Input
                        id="charge-end-date"
                        type="date"
                        value={filters.charges.endDate}
                        onChange={(e) => updateChargeFilter("endDate", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="charge-merchant" className="text-sm">Merchant/Description</Label>
                    <Input
                      id="charge-merchant"
                      placeholder="Search description..."
                      value={filters.charges.merchant}
                      onChange={(e) => updateChargeFilter("merchant", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Summary */}
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div>
                  Showing: {receipts.length} of {allReceipts.length} receipts, {charges.length} of {allCharges.length} charges
                </div>
                {(receipts.length !== allReceipts.length || charges.length !== allCharges.length) && (
                  <Badge variant="secondary" className="text-xs">
                    Filters Active
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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