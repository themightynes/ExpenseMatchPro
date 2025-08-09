import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MobileHeader from "@/components/MobileHeader";
import MatchingInterface from "@/components/MatchingInterface";
import DragMatchingInterface from "@/components/DragMatchingInterface";
import type { AmexStatement } from "@shared/schema";

export default function Matching() {
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [matchingMode, setMatchingMode] = useState<"tinder" | "drag">("tinder");

  const { data: statements = [], isLoading: statementsLoading } = useQuery<AmexStatement[]>({
    queryKey: ["/api/statements"],
  });

  const activeStatement = statements.find((s: any) => s.isActive);

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader 
        title="Match Receipts"
        showBack={true}
        onBack={() => window.history.back()}
      />

      <div className="px-4 py-6">
        {statementsLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading statements...</p>
          </div>
        ) : statements.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
              <i className="fas fa-exclamation-triangle text-4xl text-gray-400 mb-4"></i>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Statements Found</h2>
              <p className="text-gray-600 mb-4">
                You need to have AMEX statements to start matching receipts.
              </p>
              <Link href="/">
                <Button>Go to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        ) : !selectedStatementId && !activeStatement ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Select Statement Period</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {statements.map((statement: any) => (
                  <Button
                    key={statement.id}
                    variant="outline"
                    className="w-full justify-between h-auto p-4"
                    onClick={() => setSelectedStatementId(statement.id)}
                  >
                    <div className="text-left">
                      <p className="font-medium">{statement.periodName}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(statement.startDate).toLocaleDateString()} -{" "}
                        {new Date(statement.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{statement.receiptCount || 0} receipts</p>
                      <p className="text-xs text-gray-500">{statement.matchedCount || 0} matched</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div>
            {/* Mode Selection */}
            <div className="max-w-4xl mx-auto mb-6">
              <div className="flex items-center justify-center gap-4 bg-white rounded-lg p-4 shadow-sm">
                <span className="text-sm font-medium text-gray-700">Matching Mode:</span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <Button
                    variant={matchingMode === "tinder" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setMatchingMode("tinder")}
                    className="flex items-center gap-2"
                  >
                    <i className="fas fa-heart text-sm"></i>
                    Tinder Style
                  </Button>
                  <Button
                    variant={matchingMode === "drag" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setMatchingMode("drag")}
                    className="flex items-center gap-2"
                  >
                    <i className="fas fa-arrows-alt text-sm"></i>
                    Drag & Drop
                  </Button>
                </div>
                <Badge variant="outline" className="text-xs">
                  {matchingMode === "tinder" ? "Swipe through matches one by one" : "Drag receipts to charges directly"}
                </Badge>
              </div>
            </div>

            {/* Render appropriate interface */}
            {matchingMode === "tinder" ? (
              <MatchingInterface 
                statementId={selectedStatementId || activeStatement?.id!} 
                onBack={() => setSelectedStatementId(null)}
              />
            ) : (
              <DragMatchingInterface 
                statementId={selectedStatementId || activeStatement?.id!} 
                onBack={() => setSelectedStatementId(null)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
