import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft,
  CheckCircle, 
  XCircle, 
  User, 
  DollarSign, 
  Calendar,
  StickyNote,
  Eye,
  EyeOff,
  MessageSquare,
  Edit3,
  Filter,
  Search,
  Download,
  TrendingUp,
  Receipt,
  Building,
  MapPin
} from "lucide-react";
import { AmexStatement, AmexCharge, Receipt as ReceiptType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function StatementDetailPage() {
  const [, params] = useRoute("/statements/:id");
  const statementId = params?.id;
  const { toast } = useToast();

  // All useState hooks at the top
  const [notes, setNotes] = useState("");
  const [showPersonalExpenses, setShowPersonalExpenses] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedChargeNotes, setSelectedChargeNotes] = useState<{ [key: string]: boolean }>({});
  const [chargeNotes, setChargeNotes] = useState<{ [key: string]: string }>({});

  // All useQuery hooks together
  const { data: statement } = useQuery<AmexStatement>({
    queryKey: ["/api/statements", statementId],
    queryFn: () => fetch(`/api/statements/${statementId}`).then(res => res.json()),
    enabled: !!statementId,
  });

  const { data: charges = [] } = useQuery<AmexCharge[]>({
    queryKey: ["/api/charges", statementId],
    queryFn: () => fetch(`/api/statements/${statementId}/charges`).then(res => res.json()),
    enabled: !!statementId,
  });

  const { data: receipts = [] } = useQuery<ReceiptType[]>({
    queryKey: ["/api/receipts", statementId],
    queryFn: () => fetch(`/api/statements/${statementId}/receipts`).then(res => res.json()),
    enabled: !!statementId,
  });

  // All useMutation hooks together
  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const response = await fetch(`/api/statements/${statementId}`, {
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
  });

  const updateChargeNotesMutation = useMutation({
    mutationFn: async ({ chargeId, notes }: { chargeId: string; notes: string }) => {
      const response = await fetch(`/api/charges/${chargeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userNotes: notes }),
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
      toast({
        title: "Personal Expense Updated",
        description: data.message,
      });
    },
  });

  // All useEffect hooks together - MUST be after all other hooks  
  useEffect(() => {
    if (statement?.userNotes && notes === "") {
      setNotes(statement.userNotes);
    }
  }, [statement?.userNotes, notes]);

  useEffect(() => {
    const newChargeNotes: { [key: string]: string } = {};
    charges.forEach(charge => {
      if (charge.userNotes) {
        newChargeNotes[charge.id] = charge.userNotes;
      }
    });
    setChargeNotes(prev => ({ ...prev, ...newChargeNotes }));
  }, [charges]);

  // Helper functions
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

  // Handler functions
  const handleTogglePersonalExpense = (chargeId: string) => {
    togglePersonalExpenseMutation.mutate(chargeId);
  };

  const handleSaveNotes = () => {
    updateNotesMutation.mutate(notes);
  };

  const handleSaveChargeNotes = (chargeId: string) => {
    const notes = chargeNotes[chargeId] || "";
    updateChargeNotesMutation.mutate({ chargeId, notes });
    setSelectedChargeNotes(prev => ({ ...prev, [chargeId]: false }));
  };

  // Early return after all hooks are called
  if (!statement || !statementId) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-600">Loading statement...</h2>
          </div>
        </div>
      </div>
    );
  }

  // Filter and sort charges
  const filteredCharges = charges
    .filter(charge => {
      const matchesSearch = searchTerm === "" || 
        charge.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        charge.amount.includes(searchTerm) ||
        (charge.category && charge.category.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesPersonalFilter = showPersonalExpenses ? charge.isPersonalExpense : !charge.isPersonalExpense;
      
      return matchesSearch && matchesPersonalFilter;
    })
    .sort((a, b) => {
      let aValue: any = a[sortColumn as keyof AmexCharge];
      let bValue: any = b[sortColumn as keyof AmexCharge];
      
      if (sortColumn === "amount") {
        aValue = parseFloat(a.amount);
        bValue = parseFloat(b.amount);
      } else if (sortColumn === "date") {
        aValue = new Date(a.date);
        bValue = new Date(b.date);
      }
      
      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const stats = {
    totalCharges: charges.length,
    matchedCharges: charges.filter(c => c.isMatched).length,
    unmatchedCharges: charges.filter(c => !c.isMatched).length,
    personalExpenses: charges.filter(c => c.isPersonalExpense).length,
    totalAmount: charges.reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0),
    matchedAmount: charges.filter(c => c.isMatched).reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0),
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/statements">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Statements
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{statement.periodName}</h1>
            <p className="text-gray-600">
              {formatDate(statement.startDate)} - {formatDate(statement.endDate)}
            </p>
          </div>
        </div>
        <Button className="gap-2">
          <Download className="h-4 w-4" />
          Export to Oracle
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Charges</p>
                <p className="text-2xl font-bold">{stats.totalCharges}</p>
                <p className="text-sm text-gray-500">{formatCurrency(stats.totalAmount.toString())}</p>
              </div>
              <Receipt className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Matched</p>
                <p className="text-2xl font-bold text-green-600">{stats.matchedCharges}</p>
                <p className="text-sm text-gray-500">{formatCurrency(stats.matchedAmount.toString())}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unmatched</p>
                <p className="text-2xl font-bold text-red-600">{stats.unmatchedCharges}</p>
                <p className="text-sm text-gray-500">Need receipts</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Personal</p>
                <p className="text-2xl font-bold text-purple-600">{stats.personalExpenses}</p>
                <p className="text-sm text-gray-500">Non-business</p>
              </div>
              <User className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by description, amount, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={showPersonalExpenses ? "default" : "outline"}
                onClick={() => setShowPersonalExpenses(!showPersonalExpenses)}
                className="gap-2"
              >
                {showPersonalExpenses ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showPersonalExpenses ? "Show Business" : "Show Personal"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charges Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Charges ({filteredCharges.length})</span>
            <Badge variant="secondary">{formatCurrency(filteredCharges.reduce((sum, c) => sum + parseFloat(c.amount), 0).toString())}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100" 
                    onClick={() => handleSort('date')}
                  >
                    Date {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100" 
                    onClick={() => handleSort('description')}
                  >
                    Description {sortColumn === 'description' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100 text-right" 
                    onClick={() => handleSort('amount')}
                  >
                    Amount {sortColumn === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Card Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCharges.map((charge) => (
                  <>
                    <TableRow key={charge.id} className="hover:bg-gray-50">
                      <TableCell className="font-mono text-sm">
                        {formatDate(charge.date)}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="font-medium truncate">{charge.description}</p>
                          {charge.statementAs && charge.statementAs !== charge.description && (
                            <p className="text-xs text-gray-500 truncate">Appears as: {charge.statementAs}</p>
                          )}
                          {charge.extendedDetails && (
                            <p className="text-xs text-gray-500 truncate">{charge.extendedDetails}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(charge.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {charge.category || "Uncategorized"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {charge.cardMember}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
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
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {charge.cityState && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {charge.cityState}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedChargeNotes(prev => ({ 
                                ...prev, 
                                [charge.id]: !prev[charge.id] 
                              }));
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => togglePersonalExpenseMutation.mutate(charge.id)}
                            className="h-7 px-2 text-xs"
                          >
                            {charge.isPersonalExpense ? "Business" : "Personal"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {/* Notes Row */}
                    {selectedChargeNotes[charge.id] && (
                      <TableRow className="bg-blue-50">
                        <TableCell colSpan={8}>
                          <div className="space-y-2 p-2">
                            <Label className="text-xs font-medium">Charge Notes:</Label>
                            <Textarea
                              placeholder="Add notes about this specific charge..."
                              value={chargeNotes[charge.id] || ""}
                              onChange={(e) => setChargeNotes(prev => ({ 
                                ...prev, 
                                [charge.id]: e.target.value 
                              }))}
                              className="min-h-[80px] text-xs resize-none"
                            />
                            <div className="flex gap-2">
                              <Button 
                                onClick={() => handleSaveChargeNotes(charge.id)}
                                disabled={updateChargeNotesMutation.isPending}
                                size="sm"
                                className="h-7 px-3 text-xs"
                              >
                                {updateChargeNotesMutation.isPending ? "Saving..." : "Save"}
                              </Button>
                              <Button 
                                variant="outline"
                                onClick={() => setSelectedChargeNotes(prev => ({ 
                                  ...prev, 
                                  [charge.id]: false 
                                }))}
                                size="sm"
                                className="h-7 px-3 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Statement Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Statement Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Add your annotations:</Label>
            <Textarea
              id="notes"
              placeholder="Add notes about this statement period, important reminders, or observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px] resize-none"
            />
          </div>
          
          <Button 
            onClick={handleSaveNotes}
            disabled={updateNotesMutation.isPending}
            className="w-full md:w-auto"
          >
            {updateNotesMutation.isPending ? "Saving..." : "Save Notes"}
          </Button>

          {statement.userNotes && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Current Notes:</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{statement.userNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}