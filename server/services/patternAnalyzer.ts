import { db } from '../db';
import { skipAnalytics, receipts, amexCharges } from '@shared/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';

interface PatternInsight {
  type: 'merchant_mismatch' | 'date_offset' | 'amount_variance' | 'category_confusion';
  description: string;
  frequency: number;
  examples: any[];
  recommendation: string;
}

interface MismatchPattern {
  receiptMerchant: string;
  chargeMerchant: string;
  frequency: number;
  avgAmountDiff: number;
  avgDateDiff: number;
}

export class PatternAnalyzer {
  // Analyze patterns in skip/rejection data
  public async analyzePatterns(days: number = 30): Promise<PatternInsight[]> {
    const insights: PatternInsight[] = [];
    
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      // Analyze merchant mismatches
      const merchantPatterns = await this.analyzeMerchantPatterns(startDate);
      if (merchantPatterns.length > 0) {
        insights.push(...merchantPatterns);
      }
      
      // Analyze date offset patterns
      const datePatterns = await this.analyzeDatePatterns(startDate);
      if (datePatterns.length > 0) {
        insights.push(...datePatterns);
      }
      
      // Analyze amount variance patterns
      const amountPatterns = await this.analyzeAmountPatterns(startDate);
      if (amountPatterns.length > 0) {
        insights.push(...amountPatterns);
      }
      
      // Analyze category confusion
      const categoryPatterns = await this.analyzeCategoryPatterns(startDate);
      if (categoryPatterns.length > 0) {
        insights.push(...categoryPatterns);
      }
      
      console.log(`Pattern analysis complete: found ${insights.length} insights`);
    } catch (error) {
      console.error('Error analyzing patterns:', error);
    }
    
    return insights;
  }

  // Analyze merchant mismatch patterns
  private async analyzeMerchantPatterns(startDate: Date): Promise<PatternInsight[]> {
    const insights: PatternInsight[] = [];
    
    try {
      // Get skips with low merchant similarity
      const merchantMismatches = await db.select({
        receiptId: skipAnalytics.receiptId,
        chargeId: skipAnalytics.chargeId,
        merchantSimilarity: skipAnalytics.merchantSimilarity,
        skipReason: skipAnalytics.skipReason
      })
        .from(skipAnalytics)
        .where(and(
          gte(skipAnalytics.skippedAt, startDate),
          sql`CAST(${skipAnalytics.merchantSimilarity} AS FLOAT) < 0.5`
        ))
        .limit(100);
      
      if (merchantMismatches.length > 10) {
        // Get details for the mismatches
        const examples = [];
        for (const mismatch of merchantMismatches.slice(0, 5)) {
          const receipt = await db.select()
            .from(receipts)
            .where(eq(receipts.id, mismatch.receiptId))
            .limit(1);
          
          const charge = await db.select()
            .from(amexCharges)
            .where(eq(amexCharges.id, mismatch.chargeId))
            .limit(1);
          
          if (receipt[0] && charge[0]) {
            examples.push({
              receiptMerchant: receipt[0].merchant,
              chargeMerchant: charge[0].description,
              similarity: mismatch.merchantSimilarity
            });
          }
        }
        
        insights.push({
          type: 'merchant_mismatch',
          description: 'Frequent merchant name mismatches detected',
          frequency: merchantMismatches.length,
          examples,
          recommendation: 'Consider adding merchant aliases for these common variations'
        });
      }
    } catch (error) {
      console.error('Error analyzing merchant patterns:', error);
    }
    
    return insights;
  }

  // Analyze date offset patterns
  private async analyzeDatePatterns(startDate: Date): Promise<PatternInsight[]> {
    const insights: PatternInsight[] = [];
    
    try {
      // Get skips with large date differences
      const dateOffsets = await db.select({
        dateDiff: skipAnalytics.dateDiff,
        count: sql<number>`count(*)`,
        avgDiff: sql<number>`avg(${skipAnalytics.dateDiff})`
      })
        .from(skipAnalytics)
        .where(and(
          gte(skipAnalytics.skippedAt, startDate),
          sql`CAST(${skipAnalytics.dateDiff} AS INTEGER) > 7`
        ))
        .groupBy(skipAnalytics.dateDiff);
      
      if (dateOffsets.length > 0) {
        const totalCount = dateOffsets.reduce((sum, d) => sum + (d.count || 0), 0);
        const avgOffset = dateOffsets[0]?.avgDiff || 0;
        
        if (totalCount > 10) {
          insights.push({
            type: 'date_offset',
            description: 'Receipts frequently have dates offset from charges',
            frequency: totalCount,
            examples: dateOffsets.slice(0, 5).map(d => ({
              daysDifference: d.dateDiff,
              occurrences: d.count
            })),
            recommendation: `Consider expanding date matching tolerance. Average offset: ${Math.round(avgOffset)} days`
          });
        }
      }
    } catch (error) {
      console.error('Error analyzing date patterns:', error);
    }
    
    return insights;
  }

  // Analyze amount variance patterns
  private async analyzeAmountPatterns(startDate: Date): Promise<PatternInsight[]> {
    const insights: PatternInsight[] = [];
    
    try {
      // Get skips with amount differences
      const amountVariances = await db.select({
        amountDiff: skipAnalytics.amountDiff,
        count: sql<number>`count(*)`,
        avgDiff: sql<number>`avg(cast(${skipAnalytics.amountDiff} as float))`
      })
        .from(skipAnalytics)
        .where(and(
          gte(skipAnalytics.skippedAt, startDate),
          sql`CAST(${skipAnalytics.amountDiff} AS FLOAT) > 5`
        ))
        .groupBy(skipAnalytics.amountDiff)
        .orderBy(desc(sql`count(*)`))
        .limit(10);
      
      const totalCount = amountVariances.reduce((sum, a) => sum + (a.count || 0), 0);
      
      if (totalCount > 15) {
        // Identify patterns (tips, taxes, etc.)
        const tipPattern = amountVariances.filter(a => {
          const diff = parseFloat(a.amountDiff || '0');
          return diff >= 1 && diff <= 10; // Typical tip range
        });
        
        if (tipPattern.length > 0) {
          insights.push({
            type: 'amount_variance',
            description: 'Frequent amount differences possibly due to tips or taxes',
            frequency: totalCount,
            examples: tipPattern.slice(0, 5).map(p => ({
              amountDifference: `$${p.amountDiff}`,
              occurrences: p.count
            })),
            recommendation: 'Consider implementing tip/tax detection logic for better matching'
          });
        }
      }
    } catch (error) {
      console.error('Error analyzing amount patterns:', error);
    }
    
    return insights;
  }

  // Analyze category confusion patterns
  private async analyzeCategoryPatterns(startDate: Date): Promise<PatternInsight[]> {
    const insights: PatternInsight[] = [];
    
    try {
      // Get receipts and charges from skip analytics to check category mismatches
      const categoryMismatches = await db.select({
        receiptId: skipAnalytics.receiptId,
        chargeId: skipAnalytics.chargeId
      })
        .from(skipAnalytics)
        .where(gte(skipAnalytics.skippedAt, startDate))
        .limit(100);
      
      const categoryConfusion: Record<string, Record<string, number>> = {};
      
      for (const mismatch of categoryMismatches) {
        const receipt = await db.select({ category: receipts.category })
          .from(receipts)
          .where(eq(receipts.id, mismatch.receiptId))
          .limit(1);
        
        const charge = await db.select({ category: amexCharges.category })
          .from(amexCharges)
          .where(eq(amexCharges.id, mismatch.chargeId))
          .limit(1);
        
        if (receipt[0]?.category && charge[0]?.category && receipt[0].category !== charge[0].category) {
          const key = `${receipt[0].category}->${charge[0].category}`;
          if (!categoryConfusion[receipt[0].category]) {
            categoryConfusion[receipt[0].category] = {};
          }
          categoryConfusion[receipt[0].category][charge[0].category] = 
            (categoryConfusion[receipt[0].category][charge[0].category] || 0) + 1;
        }
      }
      
      // Find the most common category confusions
      const confusions = [];
      for (const [receiptCat, chargeCats] of Object.entries(categoryConfusion)) {
        for (const [chargeCat, count] of Object.entries(chargeCats)) {
          if (count > 3) {
            confusions.push({
              from: receiptCat,
              to: chargeCat,
              count
            });
          }
        }
      }
      
      if (confusions.length > 0) {
        insights.push({
          type: 'category_confusion',
          description: 'Categories frequently mismatched between receipts and charges',
          frequency: confusions.reduce((sum, c) => sum + c.count, 0),
          examples: confusions.slice(0, 5),
          recommendation: 'Review category assignment logic or consider category mapping rules'
        });
      }
    } catch (error) {
      console.error('Error analyzing category patterns:', error);
    }
    
    return insights;
  }

  // Get problematic merchants that frequently fail to match
  public async getProblematicMerchants(limit: number = 10): Promise<MismatchPattern[]> {
    const patterns: MismatchPattern[] = [];
    
    try {
      // Get merchants with high skip rates
      const skips = await db.select({
        receiptId: skipAnalytics.receiptId,
        chargeId: skipAnalytics.chargeId,
        amountDiff: skipAnalytics.amountDiff,
        dateDiff: skipAnalytics.dateDiff
      })
        .from(skipAnalytics)
        .where(gte(skipAnalytics.skippedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
        .limit(200);
      
      const merchantPairs: Record<string, {
        count: number;
        totalAmountDiff: number;
        totalDateDiff: number;
      }> = {};
      
      for (const skip of skips) {
        const receipt = await db.select({ merchant: receipts.merchant })
          .from(receipts)
          .where(eq(receipts.id, skip.receiptId))
          .limit(1);
        
        const charge = await db.select({ description: amexCharges.description })
          .from(amexCharges)
          .where(eq(amexCharges.id, skip.chargeId))
          .limit(1);
        
        if (receipt[0]?.merchant && charge[0]?.description) {
          const key = `${receipt[0].merchant}||${charge[0].description}`;
          if (!merchantPairs[key]) {
            merchantPairs[key] = { count: 0, totalAmountDiff: 0, totalDateDiff: 0 };
          }
          merchantPairs[key].count++;
          merchantPairs[key].totalAmountDiff += parseFloat(String(skip.amountDiff || 0));
          merchantPairs[key].totalDateDiff += Number(skip.dateDiff || 0);
        }
      }
      
      // Convert to array and sort by frequency
      for (const [key, data] of Object.entries(merchantPairs)) {
        if (data.count >= 2) {
          const [receiptMerchant, chargeMerchant] = key.split('||');
          patterns.push({
            receiptMerchant,
            chargeMerchant,
            frequency: data.count,
            avgAmountDiff: data.totalAmountDiff / data.count,
            avgDateDiff: data.totalDateDiff / data.count
          });
        }
      }
      
      // Sort by frequency and return top results
      patterns.sort((a, b) => b.frequency - a.frequency);
      
    } catch (error) {
      console.error('Error getting problematic merchants:', error);
    }
    
    return patterns.slice(0, limit);
  }

  // Generate recommendations based on patterns
  public async generateRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    
    try {
      const patterns = await this.analyzePatterns();
      
      for (const pattern of patterns) {
        recommendations.push(pattern.recommendation);
      }
      
      // Add specific recommendations based on problematic merchants
      const problematicMerchants = await this.getProblematicMerchants(5);
      for (const merchant of problematicMerchants) {
        if (merchant.frequency > 3) {
          recommendations.push(
            `Add alias mapping: "${merchant.receiptMerchant}" → "${merchant.chargeMerchant}" (${merchant.frequency} failed matches)`
          );
        }
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
    }
    
    return recommendations;
  }
}

// Singleton instance
export const patternAnalyzer = new PatternAnalyzer();