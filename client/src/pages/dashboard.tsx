import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient } from "@/lib/queryClient";
import StatsCard from "@/components/StatsCard";
import FileUploadZone from "@/components/FileUploadZone";
import ReceiptCard from "@/components/ReceiptCard";
import CsvUploadModal from "@/components/CsvUploadModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import type { Receipt, AmexStatement } from "@shared/schema";

export default function Dashboard() {
  const [showCsvModal, setShowCsvModal] = useState(false);
  
  const { data: stats, isLoading: statsLoading } = useQuery<{
    processedCount: number;
    pendingCount: number;
    readyCount: number;
    processingCount: number;
  }>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: receipts = [], isLoading: receiptsLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  const { data: statements = [], isLoading: statementsLoading } = useQuery<AmexStatement[]>({
    queryKey: ["/api/statements"],
  });

  const recentReceipts = receipts.slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50 font-inter">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <i className="fas fa-receipt text-primary text-2xl mr-3"></i>
              <h1 className="text-xl font-semibold text-gray-900">Receipt Manager</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-bell text-lg"></i>
              </button>
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">JD</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatsCard
            icon="fas fa-upload"
            iconColor="text-primary"
            iconBg="bg-primary/10"
            title="Processed This Month"
            value={statsLoading ? "..." : stats?.processedCount.toString() || "0"}
          />
          <StatsCard
            icon="fas fa-exclamation-triangle"
            iconColor="text-warning-500"
            iconBg="bg-warning-50"
            title="Pending Match"
            value={statsLoading ? "..." : stats?.pendingCount.toString() || "0"}
          />
          <StatsCard
            icon="fas fa-check-circle"
            iconColor="text-success-500"
            iconBg="bg-success-50"
            title="Ready for Oracle"
            value={statsLoading ? "..." : stats?.readyCount.toString() || "0"}
          />
          <StatsCard
            icon="fas fa-clock"
            iconColor="text-gray-500"
            iconBg="bg-gray-100"
            title="Processing"
            value={statsLoading ? "..." : stats?.processingCount.toString() || "0"}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-2">
            <FileUploadZone />

            {/* Recent Uploads */}
            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Uploads</CardTitle>
                  <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {receiptsLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading receipts...</div>
                  ) : recentReceipts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No receipts uploaded yet. Start by uploading your first receipt above.
                    </div>
                  ) : (
                    recentReceipts.map((receipt) => (
                      <ReceiptCard key={receipt.id} receipt={receipt} />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* AMEX Statement Periods */}
            <Card>
              <CardHeader>
                <CardTitle>AMEX Statement Periods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statementsLoading ? (
                    <div className="text-center py-4 text-gray-500">Loading statements...</div>
                  ) : statements.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">No statements found</div>
                  ) : (
                    statements.map((statement: any) => (
                      <div
                        key={statement.id}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                          statement.isActive
                            ? "bg-primary/5 border border-primary/20"
                            : "bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        <div>
                          <p className={`font-medium ${statement.isActive ? "text-primary" : "text-gray-900"}`}>
                            {statement.periodName}
                          </p>
                          <p className={`text-sm ${statement.isActive ? "text-primary/70" : "text-gray-500"}`}>
                            {new Date(statement.startDate).toLocaleDateString()} -{" "}
                            {new Date(statement.endDate).toLocaleDateString()}
                            {statement.isActive && " (Current)"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${statement.isActive ? "text-primary" : "text-gray-900"}`}>
                            {statement.receiptCount || 0} receipts
                          </p>
                          <p className={`text-xs ${statement.isActive ? "text-primary/70" : "text-gray-500"}`}>
                            {statement.matchedCount || 0} matched
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <Button variant="outline" className="w-full mt-4">
                  View All Periods
                </Button>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Link href="/matching">
                    <Button variant="outline" className="w-full justify-between bg-warning-50 border-warning-200 text-warning-700 hover:bg-warning-100">
                      <div className="flex items-center">
                        <i className="fas fa-heart mr-3"></i>
                        <span className="font-medium">Match Receipts</span>
                      </div>
                      <Badge variant="secondary" className="bg-warning-100 text-warning-800">
                        {stats?.pendingCount || 0} pending
                      </Badge>
                    </Button>
                  </Link>

                  <Button variant="outline" className="w-full justify-start">
                    <i className="fas fa-download mr-3"></i>
                    <span className="font-medium">Export to Oracle</span>
                  </Button>

                  <Button variant="outline" className="w-full justify-start">
                    <i className="fas fa-search mr-3"></i>
                    <span className="font-medium">Find Missing Receipts</span>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setShowCsvModal(true)}
                  >
                    <i className="fas fa-upload mr-3"></i>
                    <span className="font-medium">Import AMEX CSV</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CSV Upload Modal */}
      <CsvUploadModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        statements={statements}
      />
    </div>
  );
}
