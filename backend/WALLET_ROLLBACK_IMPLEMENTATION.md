# Wallet Rollback Service Implementation

This document describes the implementation of compensating transactions, atomic multi-step operations, and admin balance adjustments for the Renaissance API wallet system.

## Overview

The wallet system now includes robust error handling and rollback capabilities to ensure data consistency and provide administrative controls.

## Features

### 1. Compensating Transactions for Failed Debits

- **Balance Validation**: All debit operations now check available balance before proceeding
- **Automatic Rollback**: Failed operations in multi-step transactions automatically roll back previous successful operations
- **Error Propagation**: Clear error messages indicate insufficient balance or transaction failures

### 2. WalletRollbackService for Atomic Operations

The `WalletRollbackService` provides atomic execution of multiple wallet operations:

```typescript
// Example: Atomic transfer between users
const result = await walletRollbackService.executeAtomicOperations([
  {
    userId: fromUserId,
    amount: 100,
    type: 'debit',
    source: TransactionSource.BET,
    referenceId: 'transfer-001-debit'
  },
  {
    userId: toUserId,
    amount: 100,
    type: 'credit',
    source: TransactionSource.WINNING,
    referenceId: 'transfer-001-credit'
  }
]);

if (!result.success) {
  // All operations were rolled back
  console.error('Transfer failed:', result.error);
}
```

### 3. Manual Balance Adjustments by Admin

Admins can manually adjust user balances with full audit trails:

```typescript
// Admin credit adjustment
const result = await walletRollbackService.adminBalanceAdjustment(
  adminUserId,
  targetUserId,
  500,
  'credit',
  'Bonus for loyal customer',
  'bonus-2024-001'
);
```

## API Endpoints

### Admin Balance Adjustment
```
POST /wallet/admin/balance-adjustment
Authorization: Bearer <admin-token>
Body: {
  "targetUserId": "user-uuid",
  "amount": 1000,
  "adjustmentType": "credit" | "debit",
  "reason": "Description of adjustment",
  "referenceId": "optional-reference"
}
```

### Transaction Rollback
```
POST /wallet/admin/rollback
Authorization: Bearer <admin-token>
Body: {
  "transactionIds": ["transaction-uuid-1", "transaction-uuid-2"]
}
```

### Transaction History
```
GET /wallet/admin/transactions/:userId?includeRollbacks=true
Authorization: Bearer <admin-token>
```

### User Balance
```
GET /wallet/admin/balance/:userId
Authorization: Bearer <admin-token>
```

## Database Changes

### New Migration: AddMetadataToBalanceTransactions

Adds a `metadata` JSON column to `balance_transactions` table for audit trails:

```sql
ALTER TABLE balance_transactions ADD COLUMN metadata JSON NULL;
```

### Enhanced BalanceTransaction Entity

```typescript
@Column({ type: 'json', nullable: true })
metadata: any; // Stores audit information, admin details, rollback references
```

## Usage Examples

### Safe Debit with Automatic Balance Check
```typescript
const result = await walletService.safeDebit(
  userId,
  amount,
  TransactionSource.BET,
  'bet-placement-001'
);

if (!result.success) {
  throw new BadRequestException(result.error);
}
```

### Transfer Funds Atomically
```typescript
const result = await walletService.transferFunds(
  fromUserId,
  toUserId,
  amount,
  TransactionSource.NFT_SALE,
  'nft-sale-001'
);

if (!result.success) {
  // Transfer failed and was rolled back
}
```

## Security Considerations

- Admin operations require `ADMIN` role
- All balance adjustments are logged with admin user ID and timestamp
- Rollback operations create compensating transactions for audit trails
- Balance checks prevent overdrafts

## Testing

Run the wallet tests:
```bash
npm run test:e2e wallet.e2e-spec.ts
```

Tests cover:
- Admin balance adjustments
- Insufficient balance handling
- Transaction rollback
- Atomic operation guarantees
- Audit trail verification

## Migration Notes

1. Run the new migration to add metadata column
2. Existing wallet operations continue to work (metadata is optional)
3. Admin endpoints are protected by role-based access control
4. All new operations include comprehensive error handling