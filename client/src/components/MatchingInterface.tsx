import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MobileHeader from "@/components/MobileHeader";
import type { Receipt, AmexCharge } from "@shared/schema";

interface MatchingInterfaceProps {
  statementId: string;
  onBack: () => void;
}

interface FilterState {
  minAmount: string;
  maxAmount: string;
  startDate: string;
  endDate: string;
  merchant: string;
}

export default function MatchingInterface({ statementId, onBack }: MatchingInterfaceProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [matchingScope, setMatchingScope] = useState<'global' | 'statement'>('global');
  const [filters, setFilters] = useState<FilterState>({
    minAmount: "",
    maxAmount: "",
    startDate: "",
    endDate: "",
    merchant: "",
  });
  const { toast } = useToast();

  const { data: candidates, isLoading } = useQuery({
    queryKey: ["/api/matching/candidates", statementId, matchingScope],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/matching/candidates/${statementId}?scope=${matchingScope}`);
      return response.json();
    },
  });

  // Extract data from candidates (must be called before any early returns)
  const pairs = (candidates as any)?.pairs || [];
  const allReceipts: Receipt[] = (candidates as any)?.receipts || [];
  const allCharges: AmexCharge[] = (candidates as any)?.charges || [];

  // Apply filters to receipts (useMemo must be called before early returns)
  const filteredReceipts = useMemo(() => {
    return allReceipts.filter(receipt => {
      const amount = parseFloat(receipt.amount || '0');
      const date = receipt.date ? new Date(receipt.date) : null;
      
      if (filters.minAmount && amount < parseFloat(filters.minAmount)) return false;
      if (filters.maxAmount && amount > parseFloat(filters.maxAmount)) return false;
      if (filters.startDate && date && date < new Date(filters.startDate)) return false;
      if (filters.endDate && date && date > new Date(filters.endDate)) return false;
      if (filters.merchant && !receipt.merchant?.toLowerCase().includes(filters.merchant.toLowerCase())) return false;
      
      return true;
    });
  }, [allReceipts, filters]);

  const matchMutation = useMutation({
    mutationFn: async ({ receiptId, chargeId }: { receiptId: string; chargeId: string }) => {
      const response = await apiRequest("POST", "/api/matching/match", { receiptId, chargeId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matching/candidates", statementId, matchingScope] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setCurrentIndex(prev => prev + 1);
      toast({
        title: "Match successful",
        description: "Receipt has been matched to the AMEX charge.",
      });
    },
    onError: (error: any) => {
      console.error("Error matching:", error);
      
      // Enhanced error messages based on error type
      let errorTitle = "Match failed";
      let errorDescription = "There was an error matching the receipt. Please try again.";
      
      if (error.message?.includes('not found')) {
        errorTitle = "Receipt or Charge Not Found";
        errorDescription = "The receipt or charge could not be found. It may have been deleted or modified.";
      } else if (error.message?.includes('already matched')) {
        errorTitle = "Already Matched";
        errorDescription = "This receipt or charge has already been matched to another transaction.";
      } else if (error.message?.includes('Invalid matching configuration')) {
        errorTitle = "Invalid Match Configuration";
        errorDescription = "The selected matching configuration is not supported. Please try a different combination.";
      } else if (error.message?.includes('network')) {
        errorTitle = "Connection Error";
        errorDescription = "Unable to connect to the server. Please check your internet connection and try again.";
      } else if (error.message?.includes('timeout')) {
        errorTitle = "Request Timeout";
        errorDescription = "The matching process took too long. Please try again or contact support.";
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    },
  });

  const skipMatch = async () => {
    console.log("Skipping match for receipt:", filteredReceipts[currentIndex]?.id);
    
    // Record skip analytics if we have a suggested charge
    const currentReceiptData = filteredReceipts[currentIndex];
    const currentChargeData = pairs[currentIndex]?.charge || allCharges[0];
    
    if (currentReceiptData && currentChargeData) {
      try {
        const matchScores = calculateMatchScore(currentReceiptData, currentChargeData);
        const confidence = matchScores.reduce((sum, score) => sum + (score.matches ? 100 : 0), 0) / matchScores.length;
        
        await fetch('/api/matching/skip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receiptId: currentReceiptData.id,
            chargeId: currentChargeData.id,
            reason: 'manual_skip',
            sessionId: 'current-session',
            confidenceScore: confidence,
            amountDiff: Math.abs(parseFloat(currentReceiptData.amount || '0') - parseFloat(currentChargeData.amount || '0')),
            dateDiff: Math.abs((new Date(currentReceiptData.date || '').getTime() - new Date(currentChargeData.date).getTime()) / (1000 * 60 * 60 * 24)),
            merchantSimilarity: calculateStringSimilarity(currentReceiptData.merchant || '', currentChargeData.description || '')
          })
        });
      } catch (error) {
        console.error("Failed to record skip analytics:", error);
      }
    }
    
    setCurrentIndex(prev => prev + 1);
  };

  const markForReviewMutation = useMutation({
    mutationFn: async (receiptId: string) => {
      const response = await apiRequest("POST", `/api/receipts/${receiptId}/mark-for-review`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matching/candidates", statementId, matchingScope] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setCurrentIndex(prev => prev + 1);
      toast({
        title: "Marked for review",
        description: "This receipt has been marked for manual review.",
      });
    },
    onError: (error: any) => {
      console.error("Error marking for review:", error);
      
      // Enhanced error messages for review marking
      let errorTitle = "Review Marking Failed";
      let errorDescription = "Failed to mark receipt for review. Please try again.";
      
      if (error.message?.includes('not found')) {
        errorTitle = "Receipt Not Found";
        errorDescription = "The receipt could not be found. It may have been deleted or moved.";
      } else if (error.message?.includes('already marked')) {
        errorTitle = "Already Marked for Review";
        errorDescription = "This receipt is already marked for manual review.";
      } else if (error.message?.includes('permission')) {
        errorTitle = "Permission Denied";
        errorDescription = "You don't have permission to mark this receipt for review.";
      } else if (error.message?.includes('network')) {
        errorTitle = "Connection Error";
        errorDescription = "Unable to connect to the server. Please check your internet connection.";
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    },
  });

  const markForReview = () => {
    if (filteredReceipts[currentIndex]) {
      markForReviewMutation.mutate(filteredReceipts[currentIndex].id);
    }
  };

  // Early returns after all hooks have been called
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 text-center">Loading matching candidates...</p>
        <p className="mt-2 text-sm text-gray-400 text-center">Finding receipts to match with charges</p>
      </div>
    );
  }

  console.log("Matching candidates:", { pairs, receipts: filteredReceipts, charges: allCharges });

  if (pairs.length === 0 && filteredReceipts.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6 text-center">
          <i className="fas fa-check-circle text-4xl text-green-500 mb-4"></i>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Unmatched Receipts</h2>
          <p className="text-gray-600 mb-4">
            All receipts have been processed and matched. Upload more receipts to continue matching.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={onBack} variant="outline">Back to Dashboard</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (allCharges.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6 text-center">
          <i className="fas fa-exclamation-triangle text-4xl text-yellow-500 mb-4"></i>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No AMEX Charges</h2>
          <p className="text-gray-600 mb-4">
            This statement has no unmatched AMEX charges. Import a CSV file or add charges to start matching.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={onBack} variant="outline">Back to Dashboard</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use filtered receipts for the current display
  const totalItems = filteredReceipts.length;
  const currentReceipt = filteredReceipts[currentIndex];
  
  // Find the best matching charge for the current receipt from pairs or use first unmatched charge
  const currentPair = pairs.find((p: any) => p.receipt?.id === currentReceipt?.id);
  const currentCharge = currentPair?.charge || allCharges[0];

  if (currentIndex >= totalItems) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6 text-center">
          <i className="fas fa-flag-checkered text-4xl text-primary mb-4"></i>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Matching Complete!</h2>
          <p className="text-gray-600 mb-4">
            You've reviewed all {totalItems} available receipt{totalItems !== 1 ? 's' : ''} {filters.merchant || filters.minAmount || filters.maxAmount || filters.startDate || filters.endDate ? 'matching your filters' : ''}.
          </p>
          <div className="flex gap-2 justify-center">
            {(filters.merchant || filters.minAmount || filters.maxAmount || filters.startDate || filters.endDate) && (
              <Button onClick={() => {
                setFilters({
                  minAmount: "",
                  maxAmount: "",
                  startDate: "",
                  endDate: "",
                  merchant: "",
                });
                setCurrentIndex(0);
              }} variant="outline">
                Clear Filters
              </Button>
            )}
            <Button onClick={onBack}>Back to Statement Selection</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const calculateMatchScore = (receipt: Receipt, charge: AmexCharge) => {
    const scores = [];
    
    // Amount match
    if (receipt.amount && charge.amount) {
      const amountDiff = Math.abs(parseFloat(receipt.amount) - parseFloat(charge.amount));
      scores.push({
        type: "Amount",
        matches: amountDiff < 0.01,
        message: amountDiff < 0.01 ? "Amount matches exactly" : `Amount differs by $${amountDiff.toFixed(2)}`,
      });
    }

    // Date match (within 3 days)
    if (receipt.date && charge.date) {
      const receiptDate = new Date(receipt.date);
      const chargeDate = new Date(charge.date);
      const daysDiff = Math.abs((receiptDate.getTime() - chargeDate.getTime()) / (1000 * 60 * 60 * 24));
      scores.push({
        type: "Date",
        matches: daysDiff <= 3,
        message: daysDiff <= 1 ? "Date matches" : `Dates differ by ${Math.floor(daysDiff)} days`,
      });
    }

    // Merchant similarity
    if (receipt.merchant && charge.description) {
      const similarity = calculateStringSimilarity(receipt.merchant.toLowerCase(), charge.description.toLowerCase());
      scores.push({
        type: "Merchant",
        matches: similarity > 0.8,
        message: similarity > 0.9 ? "Merchant matches exactly" : `Merchant similarity: ${Math.round(similarity * 100)}%`,
      });
    }

    return scores;
  };

  const calculateStringSimilarity = (str1: string, str2: string) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string) => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  const clearFilters = () => {
    setFilters({
      minAmount: "",
      maxAmount: "",
      startDate: "",
      endDate: "",
      merchant: "",
    });
    setCurrentIndex(0); // Reset to first item when filters change
  };

  const updateFilter = (field: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
    }));
    setCurrentIndex(0); // Reset to first item when filters change
  };

  const matchScores = currentCharge ? calculateMatchScore(currentReceipt, currentCharge) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader 
        title="Match Receipts"
        showBack={true}
        onBack={onBack}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="p-1 h-8 w-8"
          >
            <i className="fas fa-filter w-4 h-4" />
          </Button>
        }
      />
      
      <div className="px-4 py-6">
        {filteredReceipts.length !== allReceipts.length && (
          <div className="mb-4">
            <Badge variant="secondary" className="text-xs">
              {filteredReceipts.length} of {allReceipts.length} receipts shown
            </Badge>
          </div>
        )}

      {/* Filters Section */}
      {showFilters && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Receipt Filters</CardTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Cross-Statement Matching Scope */}
            <div className="mb-4 pb-4 border-b border-gray-100">
              <Label className="text-sm font-medium mb-2 block">Matching Scope</Label>
              <div className="flex gap-2">
                <Button
                  variant={matchingScope === 'global' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMatchingScope('global')}
                  className="flex-1"
                >
                  <i className="fas fa-globe w-3 h-3 mr-1" />
                  All Statements
                </Button>
                <Button
                  variant={matchingScope === 'statement' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMatchingScope('statement')}
                  className="flex-1"
                >
                  <i className="fas fa-file-invoice w-3 h-3 mr-1" />
                  Current Statement
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {matchingScope === 'global' 
                  ? 'Search charges across all statement periods' 
                  : 'Only search charges in the current statement'
                }
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="min-amount" className="text-sm">Min Amount</Label>
                  <Input
                    id="min-amount"
                    type="number"
                    placeholder="0.00"
                    value={filters.minAmount}
                    onChange={(e) => updateFilter("minAmount", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="max-amount" className="text-sm">Max Amount</Label>
                  <Input
                    id="max-amount"
                    type="number"
                    placeholder="1000.00"
                    value={filters.maxAmount}
                    onChange={(e) => updateFilter("maxAmount", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="start-date" className="text-sm">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => updateFilter("startDate", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date" className="text-sm">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => updateFilter("endDate", e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Label htmlFor="merchant" className="text-sm">Merchant</Label>
              <Input
                id="merchant"
                placeholder="Search merchant..."
                value={filters.merchant}
                onChange={(e) => updateFilter("merchant", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      <div className="text-center mb-6">
        <p className="text-gray-600">Swipe right to match, left to skip, or use the buttons below</p>
        <div className="mt-2 bg-gray-200 rounded-full h-2 max-w-xs mx-auto">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300" 
            style={{ width: `${((currentIndex + 1) / totalItems) * 100}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {currentIndex + 1} of {totalItems} reviewed
        </p>
      </div>

      {/* Mobile-Optimized Card Stack */}
      <div className="space-y-4 mb-8">
        {/* Receipt Card */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <i className="fas fa-receipt text-blue-600 text-sm"></i>
              </div>
              <CardTitle className="text-lg text-gray-900">Receipt</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="font-medium text-gray-600">Merchant:</span>
                <p className="text-gray-900 font-medium">{currentReceipt.merchant || "Not detected"}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Amount:</span>
                <p className="text-gray-900 font-medium text-lg">${currentReceipt.amount || "0.00"}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Date:</span>
                <p className="text-gray-900">{currentReceipt.date ? new Date(currentReceipt.date).toLocaleDateString() : "Not detected"}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Category:</span>
                <p className="text-gray-900 truncate">{currentReceipt.category || "Not assigned"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AMEX Charge Card */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <i className="fas fa-credit-card text-green-600 text-sm"></i>
              </div>
              <CardTitle className="text-lg text-gray-900">AMEX Charge</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {currentCharge ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Merchant:</span>
                    <p className="text-gray-900 font-medium truncate">{currentCharge.description}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Amount:</span>
                    <p className="text-gray-900 font-medium text-lg">${currentCharge.amount}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Date:</span>
                    <p className="text-gray-900">{new Date(currentCharge.date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Reference:</span>
                    <p className="text-gray-900 truncate">{currentCharge.reference || "N/A"}</p>
                  </div>
                </div>
                
                {/* Match Score Indicators */}
                <div className="flex gap-2 pt-2">
                  {matchScores.map((score, index) => (
                    <div key={index} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${score.matches ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      <i className={`fas ${score.matches ? "fa-check" : "fa-exclamation-triangle"} text-xs`}></i>
                      <span>{score.type}</span>
                      {score.matches && <span>✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <i className="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <p>No unmatched charges available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mobile Action Buttons - Fixed Position */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 p-4 z-30">
        <div className="flex justify-center space-x-4">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 max-w-24 h-14 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border-red-200 flex flex-col gap-1"
            onClick={skipMatch}
          >
            <i className="fas fa-times text-lg"></i>
            <span className="text-xs font-medium">Skip</span>
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            className="flex-1 max-w-24 h-14 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 flex flex-col gap-1"
            onClick={markForReview}
          >
            <i className="fas fa-question text-lg"></i>
            <span className="text-xs font-medium">Review</span>
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            className="flex-1 max-w-24 h-14 rounded-xl bg-green-50 hover:bg-green-100 text-green-600 border-green-200 flex flex-col gap-1"
            onClick={() => currentCharge && matchMutation.mutate({ receiptId: currentReceipt.id, chargeId: currentCharge.id })}
            disabled={!currentCharge || matchMutation.isPending}
          >
            <i className="fas fa-heart text-lg"></i>
            <span className="text-xs font-medium">Match</span>
          </Button>
        </div>
      </div>

        {/* Spacer for fixed buttons */}
        <div className="h-32"></div>
      </div>
    </div>
  );
}
