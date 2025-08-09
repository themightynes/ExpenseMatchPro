import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Receipt, AmexCharge } from "@shared/schema";

interface MatchingInterfaceProps {
  statementId: string;
  onBack: () => void;
}

export default function MatchingInterface({ statementId, onBack }: MatchingInterfaceProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
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
      setCurrentIndex(prev => prev + 1);
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

  const skipMatch = () => {
    setCurrentIndex(prev => prev + 1);
  };

  const markForReview = () => {
    // TODO: Implement manual review marking
    setCurrentIndex(prev => prev + 1);
    toast({
      title: "Marked for review",
      description: "This receipt has been marked for manual review.",
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading matching candidates...</p>
      </div>
    );
  }

  const receipts: Receipt[] = (candidates as any)?.receipts || [];
  const charges: AmexCharge[] = (candidates as any)?.charges || [];

  console.log("Matching candidates:", { receipts, charges });

  if (receipts.length === 0) {
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

  if (charges.length === 0) {
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

  if (currentIndex >= receipts.length) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6 text-center">
          <i className="fas fa-check-circle text-4xl text-green-500 mb-4"></i>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h2>
          <p className="text-gray-600 mb-4">
            There are no receipts or charges that need matching for this statement period.
          </p>
          <Button onClick={onBack}>Back to Statement Selection</Button>
        </CardContent>
      </Card>
    );
  }

  if (currentIndex >= receipts.length) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6 text-center">
          <i className="fas fa-flag-checkered text-4xl text-primary mb-4"></i>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Matching Complete!</h2>
          <p className="text-gray-600 mb-4">
            You've reviewed all available receipts for this statement period.
          </p>
          <Button onClick={onBack}>Back to Statement Selection</Button>
        </CardContent>
      </Card>
    );
  }

  const currentReceipt = receipts[currentIndex];
  const currentCharge = charges[0]; // For simplicity, match against first charge

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
    if (receipt.merchant && charge.merchant) {
      const similarity = calculateStringSimilarity(receipt.merchant.toLowerCase(), charge.merchant.toLowerCase());
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

  const matchScores = currentCharge ? calculateMatchScore(currentReceipt, currentCharge) : [];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress */}
      <div className="text-center mb-6">
        <p className="text-gray-600">Swipe right to match, left to skip, or use the buttons below</p>
        <div className="mt-2 bg-gray-200 rounded-full h-2 max-w-xs mx-auto">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300" 
            style={{ width: `${((currentIndex + 1) / receipts.length) * 100}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {currentIndex + 1} of {receipts.length} reviewed
        </p>
      </div>

      {/* Card Stack */}
      <div className="relative h-96 mb-8">
        <Card className="absolute inset-0 p-6">
          <div className="grid grid-cols-2 gap-6 h-full">
            {/* Receipt Side */}
            <div className="border-r border-gray-200 pr-6">
              <h3 className="font-semibold text-gray-900 mb-4">Receipt</h3>
              <div className="bg-gray-100 rounded-lg p-4 h-48 flex items-center justify-center mb-4">
                <i className="fas fa-file-image text-4xl text-gray-400"></i>
              </div>
              <div className="space-y-2">
                <p><span className="font-medium">Merchant:</span> {currentReceipt.merchant || "Not detected"}</p>
                <p><span className="font-medium">Date:</span> {currentReceipt.date ? new Date(currentReceipt.date).toLocaleDateString() : "Not detected"}</p>
                <p><span className="font-medium">Amount:</span> {currentReceipt.amount ? `$${currentReceipt.amount}` : "Not detected"}</p>
                <p><span className="font-medium">Category:</span> {currentReceipt.category || "Not assigned"}</p>
              </div>
            </div>

            {/* AMEX Charge Side */}
            <div className="pl-6">
              <h3 className="font-semibold text-gray-900 mb-4">AMEX Charge</h3>
              {currentCharge ? (
                <>
                  <div className="bg-blue-50 rounded-lg p-4 mb-4">
                    <div className="space-y-2">
                      <p><span className="font-medium">Merchant:</span> {currentCharge.merchant}</p>
                      <p><span className="font-medium">Date:</span> {new Date(currentCharge.date).toLocaleDateString()}</p>
                      <p><span className="font-medium">Amount:</span> ${currentCharge.amount}</p>
                      <p><span className="font-medium">Reference:</span> {currentCharge.reference || "N/A"}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {matchScores.map((score, index) => (
                      <div key={index} className={`flex items-center ${score.matches ? "text-green-600" : "text-yellow-600"}`}>
                        <i className={`fas ${score.matches ? "fa-check-circle" : "fa-exclamation-circle"} mr-2`}></i>
                        <span className="text-sm">{score.message}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <i className="fas fa-exclamation-triangle text-2xl mb-2"></i>
                  <p>No unmatched charges available</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Background cards for stack effect */}
        <div className="absolute inset-0 bg-white rounded-xl shadow-md border border-gray-100 transform rotate-1 -z-10"></div>
        <div className="absolute inset-0 bg-white rounded-xl shadow-sm border border-gray-50 transform -rotate-1 -z-20"></div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center space-x-6">
        <Button
          variant="outline"
          size="lg"
          className="w-16 h-16 rounded-full bg-red-50 hover:bg-red-100 text-red-500 border-red-200"
          onClick={skipMatch}
        >
          <i className="fas fa-times text-2xl"></i>
        </Button>
        
        <Button
          variant="outline"
          size="lg"
          className="w-16 h-16 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500"
          onClick={markForReview}
        >
          <i className="fas fa-question text-2xl"></i>
        </Button>
        
        <Button
          variant="outline"
          size="lg"
          className="w-16 h-16 rounded-full bg-green-50 hover:bg-green-100 text-green-500 border-green-200"
          onClick={() => currentCharge && matchMutation.mutate({ receiptId: currentReceipt.id, chargeId: currentCharge.id })}
          disabled={!currentCharge || matchMutation.isPending}
        >
          <i className="fas fa-heart text-2xl"></i>
        </Button>
      </div>

      <div className="text-center mt-6">
        <p className="text-sm text-gray-600">
          <span className="font-medium">Left:</span> Skip • 
          <span className="font-medium">Middle:</span> Manual Review • 
          <span className="font-medium">Right:</span> Match
        </p>
      </div>
    </div>
  );
}
