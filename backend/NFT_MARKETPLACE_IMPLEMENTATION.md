# NFT Marketplace Implementation

## Overview
Complete NFT Marketplace for buying, selling, and trading player card NFTs with an integrated offer system.

## Features Implemented

### 1. NFT Listing System
- Users can list their player card NFTs for sale
- Set custom price and expiration date
- Support for multiple currencies (default: XLM)
- Automatic NFT locking when listed

### 2. Direct Purchase
- Buyers can purchase NFTs at the listing price
- Atomic transactions ensure secure transfers
- Automatic balance validation
- Instant ownership transfer

### 3. Offer System
- Buyers can make offers below/above listing price
- Sellers can accept, reject offers
- Offer expiration support
- Auto-rejection of other offers when one is accepted

### 4. User Dashboard
- View owned NFTs
- Track active listings
- Monitor offers made and received

## API Endpoints

### Listings

#### Create Listing
```
POST /nft/listings
Authorization: Bearer <token>
Body: {
  "nftCardId": "uuid",
  "price": 100.5,
  "currency": "XLM",
  "expiresAt": "2026-05-23T12:00:00Z"
}
```

#### Browse Listings
```
GET /nft/listings?page=1&limit=10&currency=XLM&minPrice=50&maxPrice=200
```

#### Get Listing Details
```
GET /nft/listings/:id
```

#### Update Listing
```
PATCH /nft/listings/:id
Authorization: Bearer <token>
Body: {
  "price": 120.0,
  "expiresAt": "2026-06-23T12:00:00Z"
}
```

#### Cancel Listing
```
DELETE /nft/listings/:id
Authorization: Bearer <token>
```

#### Purchase NFT
```
POST /nft/listings/:id/purchase
Authorization: Bearer <token>
```

### Offers

#### Make Offer
```
POST /nft/listings/:id/offers
Authorization: Bearer <token>
Body: {
  "offerPrice": 95.0,
  "currency": "XLM",
  "expiresAt": "2026-05-23T12:00:00Z"
}
```

#### Accept Offer
```
POST /nft/offers/:id/accept
Authorization: Bearer <token>
```

#### Reject Offer
```
POST /nft/offers/:id/reject
Authorization: Bearer <token>
```

#### Cancel Offer
```
DELETE /nft/offers/:id
Authorization: Bearer <token>
```

### User-Specific

#### My Listings
```
GET /nft/my-listings
Authorization: Bearer <token>
```

#### My Offers
```
GET /nft/my-offers
Authorization: Bearer <token>
```

#### My NFTs
```
GET /nft/my-nfts?page=1&limit=10
Authorization: Bearer <token>
```

## Database Schema

### NFTPlayerCard
- `id` - UUID primary key
- `metadataId` - Reference to PlayerCardMetadata
- `ownerId` - Current owner (User)
- `contractAddress` - Blockchain contract address
- `tokenId` - Unique token identifier
- `acquiredAt` - Acquisition timestamp
- `acquisitionPrice` - Purchase price
- `isListed` - Listing status flag

### NFTListing
- `id` - UUID primary key
- `nftCardId` - Reference to NFTPlayerCard
- `sellerId` - Seller (User)
- `price` - Listing price
- `currency` - Currency code (XLM, USDC, etc.)
- `status` - active, sold, cancelled, expired
- `expiresAt` - Listing expiration
- `blockchainTxHash` - On-chain transaction hash
- `soldAt` - Sale timestamp
- `buyerId` - Buyer (User)

### NFTOffer
- `id` - UUID primary key
- `listingId` - Reference to NFTListing
- `buyerId` - Offer maker (User)
- `offerPrice` - Offer amount
- `currency` - Currency code
- `status` - pending, accepted, rejected, cancelled, expired
- `expiresAt` - Offer expiration
- `respondedAt` - Response timestamp

## Business Logic Flow

### Listing Flow
1. User owns NFT → Validates ownership
2. Creates listing with price and expiry
3. NFT marked as `isListed = true` (locked)
4. Listing becomes visible in marketplace

### Purchase Flow
1. Buyer initiates purchase
2. System validates:
   - Listing is active and not expired
   - Buyer has sufficient balance
   - Buyer is not the seller
3. Atomic transaction:
   - Debit buyer's balance
   - Credit seller's balance
   - Transfer NFT ownership
   - Update listing status to SOLD
   - Mark NFT as not listed
4. Blockchain transfer triggered (async)
5. Transaction hash recorded

### Offer Flow
1. Buyer makes offer with price and expiry
2. System validates balance and listing status
3. Offer stored with PENDING status
4. Seller can:
   - **Accept**: Triggers same flow as purchase
   - **Reject**: Updates offer status to REJECTED
   - **Ignore**: Offer expires automatically
5. When accepted, all other pending offers auto-rejected

## Security Features

### Authorization
- All write operations require JWT authentication
- Ownership verification before listing
- Seller-only actions (cancel listing, accept/reject offers)
- Buyer-only actions (make offer, cancel offer, purchase)

### Validation
- Price minimum validation (0.00000001)
- Expiration date must be in the future
- Balance verification before transactions
- State transition validation (e.g., can't purchase expired listing)

### Atomic Transactions
- All financial operations use database transactions
- Rollback on any failure
- Prevents partial updates and inconsistencies

### Blockchain Integration
- On-chain transfers via SorobanService
- Transaction hash recording for reconciliation
- Async execution to prevent blocking
- Error logging for failed transfers

## Error Handling

| HTTP Code | Scenario |
|-----------|----------|
| 400 | Invalid input, expired listing, insufficient balance |
| 401 | Missing or invalid authentication |
| 404 | Resource not found |
| 409 | Conflict (e.g., NFT already listed) |

## Transaction Types

Added to `TransactionSource` enum:
- `NFT_PURCHASE` - Buyer's debit transaction
- `NFT_SALE` - Seller's credit transaction
- `NFT_OFFER` - Offer-related transactions

## Migration

Run the migration to create database tables:
```bash
npm run typeorm migration:run
```

Migration file: `1769500000000-CreateNFTMarketplaceTables.ts`

Creates:
- `nft_player_cards` table
- `nft_listings` table
- `nft_offers` table
- Indexes for performance
- Foreign key constraints
- Updated balance_transactions enum

## Swagger Documentation

Full API documentation available at:
```
http://localhost:3000/api/docs
```

Tag: **NFT Marketplace**

## File Structure

```
src/nft/
├── entities/
│   ├── nft-player-card.entity.ts
│   ├── nft-listing.entity.ts
│   └── nft-offer.entity.ts
├── dto/
│   ├── create-listing.dto.ts
│   ├── make-offer.dto.ts
│   ├── update-listing.dto.ts
│   └── nft-response.dto.ts
├── nft-marketplace.service.ts
├── nft-marketplace.controller.ts
└── nft-marketplace.module.ts
```

## Integration Points

### Wallet Service
- Balance checking before transactions
- Debit/credit operations via `WalletService`
- Transaction recording with NFT-specific sources

### Blockchain (Soroban)
- NFT transfer via `SorobanService.invokeContract()`
- Contract function: `transfer_nft`
- Parameters: contractAddress, tokenId, fromUserId, toUserId

### Player Card Metadata
- Links NFT ownership to card metadata
- Validates NFT exists before listing
- Provides card details (rarity, player, etc.)

## Testing Recommendations

1. **Unit Tests**
   - Service method validation logic
   - DTO validation
   - State transition checks

2. **Integration Tests**
   - Full purchase flow
   - Offer acceptance flow
   - Cancellation scenarios

3. **E2E Tests**
   - API endpoint testing
   - Authentication flow
   - Error handling

## Future Enhancements

- [ ] Add caching for listings endpoint (Redis)
- [ ] Implement offer counter-system
- [ ] Add auction/bidding support
- [ ] NFT bundling (multiple NFTs in one sale)
- [ ] Royalty fees for original creators
- [ ] Price history tracking
- [ ] Marketplace analytics dashboard
- [ ] Email notifications for offers
- [ ] WebSocket real-time updates
- [ ] Bulk listing operations
- [ ] Advanced filtering and search

## Acceptance Criteria Met

✅ Users can list NFTs for sale
✅ Users can purchase NFTs
✅ Offer system works (make, accept, reject, cancel)
✅ Proper error handling and validation
✅ Blockchain integration ready
✅ Comprehensive API documentation
✅ Atomic transactions for safety
✅ User dashboards for managing NFTs
