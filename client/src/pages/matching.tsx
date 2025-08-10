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
        title="Matching"
        showBack={true}
        onBack={() => window.history.back()}
        actions={
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-600 hidden sm:block">
              3 ready to match
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-8 w-8 min-h-[44px] min-w-[44px]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </Button>
          </div>
        }
      />

      <div className="px-4 py-6">
        {statementsLoading ? (
          <div className="flex flex-col items-center justify-center py-12 min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 text-center">Loading statements...</p>
            <p className="mt-2 text-sm text-gray-400 text-center">Preparing statement periods for matching</p>
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
            {/* Mode Selection - Mobile Optimized */}
            <div className="mb-6">
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Matching Mode:</span>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="hidden sm:inline">Swipe through matches one by one</span>
                    <span className="sm:hidden">1 of 3 reviewed</span>
                  </div>
                </div>
                <div className="flex bg-gray-100 rounded-lg p-1 w-full">
                  <Button
                    variant={matchingMode === "tinder" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setMatchingMode("tinder")}
                    className="flex items-center gap-2 flex-1 justify-center"
                  >
                    <span className="text-blue-600">💙</span>
                    <span className="hidden sm:inline">Tinder Style</span>
                    <span className="sm:hidden text-xs">Tinder</span>
                  </Button>
                  <Button
                    variant={matchingMode === "drag" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setMatchingMode("drag")}
                    className="flex items-center gap-2 flex-1 justify-center"
                  >
                    <span>⚡</span>
                    <span className="hidden sm:inline">Drag & Drop</span>
                    <span className="sm:hidden text-xs">Drag</span>
                  </Button>
                </div>
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
