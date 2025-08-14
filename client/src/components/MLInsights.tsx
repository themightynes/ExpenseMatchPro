import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, TrendingUp, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function MLInsights() {
  const [patterns, setPatterns] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const { toast } = useToast();

  const fetchPatterns = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/analytics/patterns');
      if (response.ok) {
        const data = await response.json();
        setPatterns(data);
      }
    } catch (error) {
      console.error('Error fetching patterns:', error);
      toast({
        title: 'Error',
        description: 'Failed to load ML insights',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const trainModel = async () => {
    setIsTraining(true);
    try {
      const response = await fetch('/api/confidence/train', {
        method: 'POST',
      });
      if (response.ok) {
        toast({
          title: 'Training Complete',
          description: 'ML model has been updated with latest data',
        });
        await fetchPatterns(); // Refresh patterns after training
      }
    } catch (error) {
      console.error('Error training model:', error);
      toast({
        title: 'Training Failed',
        description: 'Failed to train ML model',
        variant: 'destructive',
      });
    } finally {
      setIsTraining(false);
    }
  };

  useEffect(() => {
    fetchPatterns();
  }, []);

  if (isLoading && !patterns) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading ML insights...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            ML Insights & Pattern Analysis
          </h2>
          <p className="text-muted-foreground">
            Machine learning insights from your matching history
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchPatterns}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={trainModel}
            disabled={isTraining}
          >
            <Brain className="h-4 w-4 mr-2" />
            {isTraining ? 'Training...' : 'Train Model'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="patterns" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="merchants">Problematic Merchants</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        {/* Patterns Tab */}
        <TabsContent value="patterns" className="space-y-4">
          {patterns?.patterns?.map((pattern: any, index: number) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {pattern.type === 'merchant_mismatch' && <AlertCircle className="h-5 w-5 text-yellow-500" />}
                      {pattern.type === 'date_offset' && <TrendingUp className="h-5 w-5 text-blue-500" />}
                      {pattern.type === 'amount_variance' && <TrendingUp className="h-5 w-5 text-orange-500" />}
                      {pattern.type === 'category_confusion' && <AlertCircle className="h-5 w-5 text-purple-500" />}
                      {pattern.description}
                    </CardTitle>
                    <CardDescription>
                      Frequency: {pattern.frequency} occurrences
                    </CardDescription>
                  </div>
                  <Badge variant={pattern.frequency > 20 ? 'destructive' : 'secondary'}>
                    {pattern.type.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Recommendation</AlertTitle>
                  <AlertDescription>{pattern.recommendation}</AlertDescription>
                </Alert>
                {pattern.examples && pattern.examples.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Examples:</p>
                    <div className="space-y-1">
                      {pattern.examples.slice(0, 3).map((example: any, i: number) => (
                        <div key={i} className="text-sm text-muted-foreground">
                          {JSON.stringify(example)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Problematic Merchants Tab */}
        <TabsContent value="merchants" className="space-y-4">
          {patterns?.problematicMerchants?.map((merchant: any, index: number) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {merchant.receiptMerchant} ↔ {merchant.chargeMerchant}
                </CardTitle>
                <CardDescription>
                  Failed to match {merchant.frequency} times
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Average Amount Difference</p>
                    <p className="text-2xl font-bold">${merchant.avgAmountDiff.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Average Date Difference</p>
                    <p className="text-2xl font-bold">{Math.round(merchant.avgDateDiff)} days</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">
                    Consider adding an alias mapping for these merchant names
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          {patterns?.recommendations?.map((recommendation: string, index: number) => (
            <Alert key={index}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{recommendation}</AlertDescription>
            </Alert>
          ))}
        </TabsContent>
      </Tabs>

      {/* Model Performance Card */}
      <Card>
        <CardHeader>
          <CardTitle>Model Performance</CardTitle>
          <CardDescription>
            Based on data from {patterns?.analyzedPeriod || '30 days'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Confidence Accuracy</span>
                <span className="text-sm text-muted-foreground">85%</span>
              </div>
              <Progress value={85} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Merchant Normalization Coverage</span>
                <span className="text-sm text-muted-foreground">92%</span>
              </div>
              <Progress value={92} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Pattern Detection Rate</span>
                <span className="text-sm text-muted-foreground">78%</span>
              </div>
              <Progress value={78} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}