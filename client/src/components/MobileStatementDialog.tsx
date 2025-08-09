import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  XCircle, 
  User, 
  DollarSign, 
  Calendar,
  StickyNote,
  Eye,
  EyeOff,
  MessageSquare,
  Edit3
} from "lucide-react";
import { AmexStatement, AmexCharge, Receipt } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface MobileStatementDialogProps {
  statement: AmexStatement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Individual Charge Card Component
interface ChargeCardProps {
  charge: AmexCharge;
  formatCurrency: (amount: string) => string;
  formatDate: (date: Date | string) => string;
  onTogglePersonalExpense: (chargeId: string) => void;
}

function ChargeCard({ charge, formatCurrency, formatDate, onTogglePersonalExpense }: ChargeCardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(charge.userNotes || "");
  const { toast } = useToast();

  const updateChargeNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const response = await fetch(`/api/charges/${charge.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userNotes: newNotes }),
      });
      if (!response.ok) throw new Error('Failed to update charge notes');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/charges"] });
      toast({
        title: "Notes Updated",
        description: "Charge notes have been saved successfully.",
      });
      setShowNotes(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update notes. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveNotes = () => {
    updateChargeNotesMutation.mutate(notes);
  };

  return (
    <Card className="border">
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">{charge.description}</p>
              <p className="text-xs text-gray-500">{formatDate(charge.date)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{formatCurrency(charge.amount)}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Badge variant={charge.isMatched ? "default" : "secondary"} className="text-xs">
                {charge.isMatched ? "Matched" : "Unmatched"}
              </Badge>
              {charge.isPersonalExpense && (
                <Badge variant="outline" className="text-xs">Personal</Badge>
              )}
              {charge.userNotes && (
                <Badge variant="outline" className="text-xs">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Notes
                </Badge>
              )}
            </div>
            
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNotes(!showNotes)}
                className="h-6 px-2 text-xs"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onTogglePersonalExpense(charge.id)}
                className="h-6 px-2 text-xs"
              >
                {charge.isPersonalExpense ? "Business" : "Personal"}
              </Button>
            </div>
          </div>

          {charge.category && (
            <p className="text-xs text-gray-600">Category: {charge.category}</p>
          )}

          {/* Notes Section */}
          {showNotes && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
              <Label className="text-xs font-medium">Charge Notes:</Label>
              <Textarea
                placeholder="Add notes about this specific charge..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px] text-xs resize-none"
              />
              <div className="flex gap-2">
                <Button 
                  onClick={handleSaveNotes}
                  disabled={updateChargeNotesMutation.isPending}
                  size="sm"
                  className="h-7 px-3 text-xs"
                >
                  {updateChargeNotesMutation.isPending ? "Saving..." : "Save"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowNotes(false)}
                  size="sm"
                  className="h-7 px-3 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Show existing notes when not editing */}
          {!showNotes && charge.userNotes && (
            <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
              <p className="font-medium text-blue-800 mb-1">Notes:</p>
              <p className="text-blue-700 whitespace-pre-wrap">{charge.userNotes}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MobileStatementDialog({ statement, open, onOpenChange }: MobileStatementDialogProps) {
  const [notes, setNotes] = useState(statement.userNotes || "");
  const [showPersonalExpenses, setShowPersonalExpenses] = useState(false);
  const { toast } = useToast();
  
  const { data: charges = [] } = useQuery<AmexCharge[]>({
    queryKey: ["/api/charges", statement.id],
    queryFn: () => fetch(`/api/statements/${statement.id}/charges`).then(res => res.json()),
    enabled: open,
  });

  const { data: receipts = [] } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts", statement.id],
    queryFn: () => fetch(`/api/statements/${statement.id}/receipts`).then(res => res.json()),
    enabled: open,
  });

  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const response = await fetch(`/api/statements/${statement.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userNotes: newNotes }),
      });
      if (!response.ok) throw new Error('Failed to update notes');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/statements"] });
      toast({
        title: "Notes Updated",
        description: "Statement notes have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update notes. Please try again.",
        variant: "destructive",
      });
    },
  });

  const togglePersonalExpenseMutation = useMutation({
    mutationFn: async (chargeId: string) => {
      const response = await fetch(`/api/charges/${chargeId}/toggle-personal`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to toggle personal expense');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/charges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/financial-stats"] });
      
      toast({
        title: "Personal Expense Updated",
        description: data.message,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update personal expense status",
        variant: "destructive",
      });
    },
  });

  const handleSaveNotes = () => {
    updateNotesMutation.mutate(notes);
  };

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Filter charges based on personal expense toggle
  const filteredCharges = showPersonalExpenses 
    ? charges.filter(c => c.isPersonalExpense)
    : charges.filter(c => !c.isPersonalExpense);

  const stats = {
    totalCharges: charges.length,
    matchedCharges: charges.filter(c => c.isMatched).length,
    unmatchedCharges: charges.filter(c => !c.isMatched).length,
    personalExpenses: charges.filter(c => c.isPersonalExpense).length,
    totalAmount: charges.reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0),
    matchedAmount: charges.filter(c => c.isMatched).reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md h-[90vh] max-h-[90vh] p-0 gap-0 m-4">
        <DialogHeader className="p-4 pb-2 space-y-2">
          <DialogTitle className="text-lg font-semibold leading-tight">
            {statement.periodName}
          </DialogTitle>
          <Badge variant="outline" className="w-fit text-xs">
            {formatDate(statement.startDate)} - {formatDate(statement.endDate)}
          </Badge>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mx-4">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="charges" className="text-xs">Charges</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-4 pb-4">
            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="border border-blue-200 bg-blue-50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-800">Total</span>
                    </div>
                    <p className="text-lg font-bold text-blue-900">{stats.totalCharges}</p>
                    <p className="text-xs text-blue-700">{formatCurrency(stats.totalAmount.toString())}</p>
                  </CardContent>
                </Card>

                <Card className="border border-green-200 bg-green-50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-medium text-green-800">Matched</span>
                    </div>
                    <p className="text-lg font-bold text-green-900">{stats.matchedCharges}</p>
                    <p className="text-xs text-green-700">{formatCurrency(stats.matchedAmount.toString())}</p>
                  </CardContent>
                </Card>

                <Card className="border border-red-200 bg-red-50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-xs font-medium text-red-800">Unmatched</span>
                    </div>
                    <p className="text-lg font-bold text-red-900">{stats.unmatchedCharges}</p>
                    <p className="text-xs text-red-700">Need receipts</p>
                  </CardContent>
                </Card>

                <Card className="border border-purple-200 bg-purple-50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-purple-600" />
                      <span className="text-xs font-medium text-purple-800">Personal</span>
                    </div>
                    <p className="text-lg font-bold text-purple-900">{stats.personalExpenses}</p>
                    <p className="text-xs text-purple-700">Non-business</p>
                  </CardContent>
                </Card>
              </div>

              {/* Progress Bar */}
              <Card>
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Matching Progress</span>
                      <span className="font-medium">
                        {stats.totalCharges > 0 ? Math.round((stats.matchedCharges / stats.totalCharges) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                        style={{ 
                          width: `${stats.totalCharges > 0 ? (stats.matchedCharges / stats.totalCharges) * 100 : 0}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Recent Receipts</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  {receipts.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2">No receipts in this period</p>
                  ) : (
                    <div className="space-y-2">
                      {receipts.slice(0, 3).map((receipt) => (
                        <div key={receipt.id} className="flex justify-between items-center py-1">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{receipt.merchant || 'Unknown Merchant'}</p>
                            <p className="text-xs text-gray-500">{receipt.date ? formatDate(receipt.date) : 'No date'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium">{receipt.amount ? formatCurrency(receipt.amount) : 'No amount'}</p>
                            <Badge variant={receipt.isMatched ? "default" : "secondary"} className="text-xs">
                              {receipt.isMatched ? "Matched" : "Unmatched"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      {receipts.length > 3 && (
                        <p className="text-xs text-gray-500 text-center pt-1">
                          +{receipts.length - 3} more receipts
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="charges" className="space-y-4 mt-4">
              {/* Toggle Personal Expenses */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Show Personal Expenses</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPersonalExpenses(!showPersonalExpenses)}
                  className="h-8 px-2"
                >
                  {showPersonalExpenses ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>

              {/* Charges List */}
              <div className="space-y-3">
                {filteredCharges.length === 0 ? (
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-gray-500">
                        {showPersonalExpenses ? "No personal expenses found" : "No business charges found"}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredCharges.map((charge) => (
                    <ChargeCard 
                      key={charge.id} 
                      charge={charge} 
                      formatCurrency={formatCurrency}
                      formatDate={formatDate}
                      onTogglePersonalExpense={togglePersonalExpenseMutation.mutate}
                    />
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <StickyNote className="h-4 w-4" />
                    Statement Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-xs">Add your annotations:</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add notes about this statement period, important reminders, or observations..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[120px] text-sm resize-none"
                    />
                  </div>
                  
                  <Button 
                    onClick={handleSaveNotes}
                    disabled={updateNotesMutation.isPending}
                    className="w-full"
                    size="sm"
                  >
                    {updateNotesMutation.isPending ? "Saving..." : "Save Notes"}
                  </Button>

                  {statement.userNotes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 mb-2">Current Notes:</p>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap">{statement.userNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}