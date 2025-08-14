import { db } from '../db';
import { skipAnalytics, receipts, amexCharges } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

interface MatchFeatures {
  amountDiff: number;
  dateDiff: number;
  merchantSimilarity: number;
  categoryMatch: boolean;
}

interface TrainingData {
  features: MatchFeatures;
  accepted: boolean;
}

// Simple logistic regression model for confidence prediction
export class ConfidenceModel {
  private weights: {
    amountDiff: number;
    dateDiff: number;
    merchantSimilarity: number;
    categoryMatch: number;
    bias: number;
  };

  constructor() {
    // Initialize with default weights (will be updated by training)
    this.weights = {
      amountDiff: -0.1,      // Negative weight - larger differences reduce confidence
      dateDiff: -0.05,        // Negative weight - more days difference reduces confidence
      merchantSimilarity: 2.0, // Positive weight - higher similarity increases confidence
      categoryMatch: 0.5,      // Positive weight - matching category increases confidence
      bias: 0.5
    };
    
    // Load saved weights if available
    this.loadWeights();
  }

  // Sigmoid function for probability calculation
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  // Calculate confidence score for a match
  public predictConfidence(features: MatchFeatures): number {
    const logit = 
      this.weights.amountDiff * features.amountDiff +
      this.weights.dateDiff * features.dateDiff +
      this.weights.merchantSimilarity * features.merchantSimilarity +
      this.weights.categoryMatch * (features.categoryMatch ? 1 : 0) +
      this.weights.bias;
    
    const probability = this.sigmoid(logit);
    // Convert to confidence score (0-100)
    return Math.round(probability * 100);
  }

  // Train the model using historical data
  public async train(): Promise<void> {
    console.log('Training confidence model...');
    
    try {
      // Fetch training data from skip analytics and successful matches
      const trainingData = await this.collectTrainingData();
      
      if (trainingData.length < 10) {
        console.log('Insufficient training data, using default weights');
        return;
      }

      // Simple gradient descent training
      const learningRate = 0.01;
      const iterations = 100;

      for (let iter = 0; iter < iterations; iter++) {
        let totalError = 0;
        const gradients = {
          amountDiff: 0,
          dateDiff: 0,
          merchantSimilarity: 0,
          categoryMatch: 0,
          bias: 0
        };

        // Calculate gradients
        for (const data of trainingData) {
          const predicted = this.predictConfidence(data.features) / 100;
          const actual = data.accepted ? 1 : 0;
          const error = predicted - actual;
          totalError += Math.abs(error);

          // Update gradients
          gradients.amountDiff += error * data.features.amountDiff;
          gradients.dateDiff += error * data.features.dateDiff;
          gradients.merchantSimilarity += error * data.features.merchantSimilarity;
          gradients.categoryMatch += error * (data.features.categoryMatch ? 1 : 0);
          gradients.bias += error;
        }

        // Update weights
        this.weights.amountDiff -= learningRate * gradients.amountDiff / trainingData.length;
        this.weights.dateDiff -= learningRate * gradients.dateDiff / trainingData.length;
        this.weights.merchantSimilarity -= learningRate * gradients.merchantSimilarity / trainingData.length;
        this.weights.categoryMatch -= learningRate * gradients.categoryMatch / trainingData.length;
        this.weights.bias -= learningRate * gradients.bias / trainingData.length;

        if (iter % 20 === 0) {
          console.log(`Training iteration ${iter}, average error: ${totalError / trainingData.length}`);
        }
      }

      // Save trained weights
      await this.saveWeights();
      console.log('Confidence model training complete');
    } catch (error) {
      console.error('Error training confidence model:', error);
    }
  }

  // Collect training data from database
  private async collectTrainingData(): Promise<TrainingData[]> {
    const data: TrainingData[] = [];

    try {
      // Get skip analytics (negative examples)
      const skips = await db.select()
        .from(skipAnalytics)
        .where(gte(skipAnalytics.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))) // Last 30 days
        .limit(100);

      for (const skip of skips) {
        if (skip.amountDiff !== null && skip.dateDiff !== null && skip.merchantSimilarity !== null) {
          data.push({
            features: {
              amountDiff: parseFloat(skip.amountDiff),
              dateDiff: skip.dateDiff,
              merchantSimilarity: parseFloat(skip.merchantSimilarity),
              categoryMatch: false // Assume no category match for skips
            },
            accepted: false
          });
        }
      }

      // Get successful matches (positive examples)
      const matches = await db.select({
        receipt: receipts,
        charge: amexCharges
      })
        .from(receipts)
        .innerJoin(amexCharges, eq(receipts.matchedChargeId, amexCharges.id))
        .where(and(
          eq(receipts.isMatched, true),
          gte(receipts.updatedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        ))
        .limit(100);

      for (const match of matches) {
        const amountDiff = Math.abs(parseFloat(match.receipt.amount || '0') - parseFloat(match.charge.amount || '0'));
        const dateDiff = match.receipt.date && match.charge.date 
          ? Math.abs((new Date(match.receipt.date).getTime() - new Date(match.charge.date).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        
        data.push({
          features: {
            amountDiff,
            dateDiff,
            merchantSimilarity: 0.9, // Assume high similarity for successful matches
            categoryMatch: match.receipt.category === match.charge.category
          },
          accepted: true
        });
      }

      console.log(`Collected ${data.length} training samples (${data.filter(d => d.accepted).length} positive, ${data.filter(d => !d.accepted).length} negative)`);
    } catch (error) {
      console.error('Error collecting training data:', error);
    }

    return data;
  }

  // Save model weights to storage
  private async saveWeights(): Promise<void> {
    try {
      // In production, this would save to database or file system
      // For now, we'll just log the weights
      console.log('Saving model weights:', this.weights);
      
      // Store in environment or config file
      process.env.CONFIDENCE_MODEL_WEIGHTS = JSON.stringify(this.weights);
    } catch (error) {
      console.error('Error saving weights:', error);
    }
  }

  // Load saved model weights
  private loadWeights(): void {
    try {
      const savedWeights = process.env.CONFIDENCE_MODEL_WEIGHTS;
      if (savedWeights) {
        this.weights = JSON.parse(savedWeights);
        console.log('Loaded saved model weights');
      }
    } catch (error) {
      console.error('Error loading weights, using defaults:', error);
    }
  }

  // Get adaptive threshold based on recent performance
  public async getAdaptiveThreshold(): Promise<number> {
    try {
      // Calculate recent acceptance rate
      const recentSkips = await db.select({ count: sql<number>`count(*)` })
        .from(skipAnalytics)
        .where(gte(skipAnalytics.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
      
      const recentMatches = await db.select({ count: sql<number>`count(*)` })
        .from(receipts)
        .where(and(
          eq(receipts.isMatched, true),
          gte(receipts.updatedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        ));

      const skipCount = recentSkips[0]?.count || 0;
      const matchCount = recentMatches[0]?.count || 0;
      const total = skipCount + matchCount;

      if (total === 0) {
        return 70; // Default threshold
      }

      const acceptanceRate = matchCount / total;
      
      // Adjust threshold based on acceptance rate
      // High acceptance rate -> lower threshold (be more aggressive)
      // Low acceptance rate -> higher threshold (be more conservative)
      if (acceptanceRate > 0.8) {
        return 65; // More aggressive
      } else if (acceptanceRate > 0.6) {
        return 70; // Balanced
      } else {
        return 75; // More conservative
      }
    } catch (error) {
      console.error('Error calculating adaptive threshold:', error);
      return 70; // Default threshold
    }
  }
}

// Singleton instance
export const confidenceModel = new ConfidenceModel();