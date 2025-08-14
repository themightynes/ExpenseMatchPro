import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the storage and dependencies with proper typing
const mockStorage = {
  getReceipt: jest.fn() as jest.MockedFunction<any>,
  getUnmatchedCharges: jest.fn() as jest.MockedFunction<any>,
  updateReceipt: jest.fn() as jest.MockedFunction<any>,
  updateAmexCharge: jest.fn() as jest.MockedFunction<any>,
};

const mockObjectStorage = {
  moveObject: jest.fn(),
};

// Mock modules before importing
jest.mock('../../server/storage', () => ({
  storage: mockStorage,
}));

jest.mock('../../server/objectStorage', () => ({
  ObjectStorageService: jest.fn().mockImplementation(() => mockObjectStorage),
}));

// Import after mocking
const { FileOrganizer } = jest.requireActual('../../server/fileOrganizer') as any;

describe('FileOrganizer', () => {
  let fileOrganizer: FileOrganizer;

  beforeEach(() => {
    jest.clearAllMocks();
    fileOrganizer = new FileOrganizer();
  });

  describe('suggestMatching', () => {
    it('should return suggestions sorted by confidence', async () => {
      // Mock receipt data
      const mockReceipt = {
        id: 'receipt-1',
        statementId: 'statement-1',
        merchant: 'Amazon',
        amount: '25.99',
        date: new Date('2024-01-15'),
      };

      // Mock charge data
      const mockCharges = [
        {
          id: 'charge-1',
          description: 'AMZN Mktp US',
          amount: '-25.99',
          date: new Date('2024-01-15'),
        },
        {
          id: 'charge-2', 
          description: 'WALMART STORE',
          amount: '-26.99',
          date: new Date('2024-01-16'),
        },
      ];

      mockStorage.getReceipt.mockResolvedValue(mockReceipt);
      mockStorage.getUnmatchedCharges.mockResolvedValue(mockCharges);

      const result = await fileOrganizer.suggestMatching('receipt-1');

      expect(result.suggestions).toHaveLength(1); // Only Amazon should match well
      expect(result.suggestions[0].charge.id).toBe('charge-1');
      expect(result.suggestions[0].confidence).toBeGreaterThan(90); // High confidence for exact match
      expect(result.suggestions[0].reason).toContain('Exact amount match');
      expect(result.suggestions[0].reason).toContain('Same date');
    });

    it('should handle fuzzy merchant matching', async () => {
      const mockReceipt = {
        id: 'receipt-1',
        statementId: 'statement-1',
        merchant: 'Amazon Marketplace',
        amount: '15.50',
        date: new Date('2024-01-15'),
      };

      const mockCharges = [
        {
          id: 'charge-1',
          description: 'AMZN MKTP US*1234567890',
          amount: '-15.50',
          date: new Date('2024-01-15'),
        },
      ];

      mockStorage.getReceipt.mockResolvedValue(mockReceipt);
      mockStorage.getUnmatchedCharges.mockResolvedValue(mockCharges);

      const result = await fileOrganizer.suggestMatching('receipt-1');

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].reason).toContain('Merchant abbreviation match');
    });

    it('should return empty suggestions for no matches', async () => {
      const mockReceipt = {
        id: 'receipt-1',
        statementId: 'statement-1',
        merchant: 'Local Coffee Shop',
        amount: '4.50',
        date: new Date('2024-01-15'),
      };

      const mockCharges = [
        {
          id: 'charge-1',
          description: 'AMAZON.COM',
          amount: '-25.99',
          date: new Date('2024-01-20'),
        },
      ];

      mockStorage.getReceipt.mockResolvedValue(mockReceipt);
      mockStorage.getUnmatchedCharges.mockResolvedValue(mockCharges);

      const result = await fileOrganizer.suggestMatching('receipt-1');

      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe('attemptAutoMatch', () => {
    it('should auto-match when confidence is above threshold', async () => {
      const mockReceipt = {
        id: 'receipt-1',
        statementId: 'statement-1',
        merchant: 'Amazon',
        amount: '25.99',
        date: new Date('2024-01-15'),
      };

      mockStorage.getReceipt.mockResolvedValue(mockReceipt);
      
      // Mock high-confidence suggestion
      jest.spyOn(fileOrganizer, 'suggestMatching').mockResolvedValue({
        suggestions: [
          {
            charge: { id: 'charge-1' },
            confidence: 95,
            reason: 'Exact amount match, Same date, High similarity merchant match',
          },
        ],
      });

      const result = await fileOrganizer.attemptAutoMatch('receipt-1');

      expect(result.matched).toBe(true);
      expect(result.confidence).toBe(95);
      expect(mockStorage.updateReceipt).toHaveBeenCalledWith('receipt-1', {
        isMatched: true,
        matchedChargeId: 'charge-1',
      });
      expect(mockStorage.updateAmexCharge).toHaveBeenCalledWith('charge-1', {
        isMatched: true,
        receiptId: 'receipt-1',
      });
    });

    it('should not auto-match when confidence is below threshold', async () => {
      const mockReceipt = {
        id: 'receipt-1',
        merchant: 'Local Shop', // Only one field, requires 95% confidence
        amount: null,
        date: null,
      };

      mockStorage.getReceipt.mockResolvedValue(mockReceipt);
      
      jest.spyOn(fileOrganizer, 'suggestMatching').mockResolvedValue({
        suggestions: [
          {
            charge: { id: 'charge-1' },
            confidence: 85, // Below 95% threshold for single field
            reason: 'Moderate similarity merchant match',
          },
        ],
      });

      const result = await fileOrganizer.attemptAutoMatch('receipt-1');

      expect(result.matched).toBe(false);
      expect(mockStorage.updateReceipt).not.toHaveBeenCalled();
    });
  });
});