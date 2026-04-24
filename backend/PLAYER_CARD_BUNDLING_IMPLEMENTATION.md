# Player Card Bundling & Bundle-Based Commerce

## Overview

This document outlines the implementation of a player card bundling system that enables grouping multiple NFT player cards for sale, applying bundle-based discounts, and executing atomic bundle transfers with transactional consistency.

## Features

### 1. Bundle Creation & Management
- Group multiple player cards into named, tradeable bundles
- Set bundle-level metadata and descriptions
- Discount pricing models (percentage, fixed, tiered)
- Bundle visibility (public, private, listed)
- Transfer complete bundles as single transaction

### 2. Bundle Pricing & Discounts
- **Bundle Discount Models**:
  - Percentage discount (e.g., 5% off)
  - Fixed discount (e.g., -$5)
  - Tiered discounts (buy more, save more)
  - Dynamic pricing based on card rarity
- Automatic discount calculation
- Price override capability for admins
- Time-limited promotional discounts

### 3. Atomic Bundle Transfers
- All-or-nothing bundle transfers
- Transactional consistency across multiple NFTs
- Escrow-based multi-sig transfers
- Batch settlement of multiple bundle transactions
- Rollback on any card transfer failure

## Database Schema

### Player Card Bundles Table
```sql
CREATE TABLE player_card_bundles (
  id UUID PRIMARY KEY,
  creator_user_id UUID NOT NULL REFERENCES users(id),
  bundle_name VARCHAR(255) NOT NULL,
  bundle_description TEXT,
  total_cards INT NOT NULL CHECK (total_cards >= 2),
  base_price DECIMAL(20,8) NOT NULL,
  discount_amount DECIMAL(20,8) DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  final_price DECIMAL(20,8) NOT NULL GENERATED ALWAYS AS 
    (base_price - discount_amount - (base_price * discount_percentage / 100)),
  discount_reason VARCHAR(100),
  discount_valid_until TIMESTAMP,
  bundle_status ENUM(
    'draft',
    'active',
    'delisted',
    'sold',
    'cancelled'
  ) DEFAULT 'draft',
  visibility ENUM('private', 'public', 'unlisted') DEFAULT 'public',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  listed_at TIMESTAMP,
  sold_at TIMESTAMP,
  sold_to_user_id UUID REFERENCES users(id),
  category VARCHAR(50),
  rarity_combination VARCHAR(255),
  INDEX idx_creator_user_id (creator_user_id),
  INDEX idx_bundle_status (bundle_status),
  INDEX idx_visibility (visibility),
  INDEX idx_created_at (created_at),
  FULLTEXT INDEX ft_bundle_name (bundle_name)
);
```

### Bundle Cards Association Table
```sql
CREATE TABLE bundle_card_items (
  id UUID PRIMARY KEY,
  bundle_id UUID NOT NULL REFERENCES player_card_bundles(id) ON DELETE CASCADE,
  player_card_id UUID NOT NULL REFERENCES player_cards(id),
  card_position INT NOT NULL,
  individual_card_price DECIMAL(20,8),
  card_rarity VARCHAR(50),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bundle_id, player_card_id),
  UNIQUE(bundle_id, card_position),
  INDEX idx_bundle_id (bundle_id),
  INDEX idx_player_card_id (player_card_id)
);
```

### Bundle Discount Rules Table
```sql
CREATE TABLE bundle_discount_rules (
  id UUID PRIMARY KEY,
  discount_name VARCHAR(255) NOT NULL,
  discount_type ENUM('percentage', 'fixed', 'tiered', 'dynamic') NOT NULL,
  discount_value DECIMAL(10,4),
  min_card_count INT,
  max_card_count INT,
  min_rarity_level INT,
  applicable_to_all_bundles BOOLEAN DEFAULT false,
  applicable_to_bundle_ids JSON,
  promotional BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,
  priority INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_active (active),
  INDEX idx_valid_from (valid_from),
  INDEX idx_priority (priority)
);
```

### Bundle Transfer Transactions Table
```sql
CREATE TABLE bundle_transfer_transactions (
  id UUID PRIMARY KEY,
  bundle_id UUID NOT NULL REFERENCES player_card_bundles(id),
  seller_user_id UUID NOT NULL REFERENCES users(id),
  buyer_user_id UUID NOT NULL REFERENCES users(id),
  transaction_status ENUM(
    'pending',
    'escrow_held',
    'confirmed',
    'completed',
    'failed',
    'refunded'
  ) DEFAULT 'pending',
  total_price DECIMAL(20,8) NOT NULL,
  discount_applied DECIMAL(20,8) DEFAULT 0,
  final_price DECIMAL(20,8) NOT NULL,
  payment_method VARCHAR(50),
  transaction_hash VARCHAR(255),
  escrow_release_height INT,
  seller_signature VARCHAR(255),
  buyer_signature VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  failed_reason TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  INDEX idx_bundle_id (bundle_id),
  INDEX idx_seller_user_id (seller_user_id),
  INDEX idx_buyer_user_id (buyer_user_id),
  INDEX idx_transaction_status (transaction_status),
  INDEX idx_created_at (created_at)
);
```

### Bundle Transfer Items Table
```sql
CREATE TABLE bundle_transfer_items (
  id UUID PRIMARY KEY,
  transfer_transaction_id UUID NOT NULL REFERENCES bundle_transfer_transactions(id) ON DELETE CASCADE,
  player_card_id UUID NOT NULL REFERENCES player_cards(id),
  transfer_status ENUM('pending', 'transferred', 'failed', 'reverted') DEFAULT 'pending',
  blockchain_tx_hash VARCHAR(255),
  error_message TEXT,
  INDEX idx_transfer_transaction_id (transfer_transaction_id),
  INDEX idx_player_card_id (player_card_id)
);
```

### Bundle Price History Table
```sql
CREATE TABLE bundle_price_history (
  id UUID PRIMARY KEY,
  bundle_id UUID NOT NULL REFERENCES player_card_bundles(id),
  previous_price DECIMAL(20,8),
  new_price DECIMAL(20,8),
  price_change_reason VARCHAR(255),
  changed_by_admin_id UUID REFERENCES admins(id),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bundle_id (bundle_id),
  INDEX idx_changed_at (changed_at)
);
```

## Implementation Details

### Bundle Service

#### BundleService (Core Logic)
```typescript
@Injectable()
export class BundleService {
  constructor(
    @InjectRepository(PlayerCardBundle) private bundleRepo: Repository<PlayerCardBundle>,
    @InjectRepository(BundleCardItem) private bundleCardRepo: Repository<BundleCardItem>,
    @InjectRepository(BundleTransferTransaction) private transferRepo: Repository<BundleTransferTransaction>,
    @InjectRepository(BundlePriceHistory) private priceHistoryRepo: Repository<BundlePriceHistory>,
    private discountService: BundleDiscountService,
    private nftService: NFTService,
    private walletService: WalletService,
    private transactionManager: EntityManager,
    private logger: LoggerService,
  ) {}

  // Create new bundle
  async createBundle(request: CreateBundleDto, userId: string): Promise<PlayerCardBundle> {
    // Validate card ownership and lock status
    await this.validateCardOwnership(request.card_ids, userId);

    // Calculate bundle price
    const basePrice = await this.calculateBundleBasePrice(request.card_ids);
    
    // Check for applicable discounts
    const discount = await this.discountService.getApplicableDiscount(
      request.card_ids,
      request.discount_rule_id,
    );

    const bundle = new PlayerCardBundle();
    bundle.creator_user_id = userId;
    bundle.bundle_name = request.bundle_name;
    bundle.bundle_description = request.description;
    bundle.total_cards = request.card_ids.length;
    bundle.base_price = basePrice;
    bundle.discount_amount = discount?.fixed_amount || 0;
    bundle.discount_percentage = discount?.percentage || 0;
    bundle.discount_reason = discount?.reason;
    bundle.discount_valid_until = discount?.valid_until;
    bundle.bundle_status = 'draft';
    bundle.visibility = request.visibility || 'private';

    const savedBundle = await this.bundleRepo.save(bundle);

    // Add cards to bundle
    for (let i = 0; i < request.card_ids.length; i++) {
      const bundleCard = new BundleCardItem();
      bundleCard.bundle_id = savedBundle.id;
      bundleCard.player_card_id = request.card_ids[i];
      bundleCard.card_position = i + 1;
      await this.bundleCardRepo.save(bundleCard);
    }

    this.logger.log(`Bundle created: ${savedBundle.id} by user ${userId}`);
    return savedBundle;
  }

  // List bundle for sale
  async listBundle(bundleId: string, userId: string, listingPrice?: Decimal): Promise<PlayerCardBundle> {
    const bundle = await this.bundleRepo.findOne(bundleId);

    if (!bundle) {
      throw new NotFoundException(`Bundle ${bundleId} not found`);
    }

    if (bundle.creator_user_id !== userId) {
      throw new ForbiddenException('Only bundle creator can list');
    }

    // Lock all cards in bundle
    const cards = await this.bundleCardRepo.find({ bundle_id: bundleId });
    for (const card of cards) {
      await this.nftService.lockCard(card.player_card_id);
    }

    bundle.bundle_status = 'active';
    bundle.visibility = 'public';
    bundle.listed_at = new Date();

    if (listingPrice) {
      bundle.base_price = listingPrice;
    }

    return this.bundleRepo.save(bundle);
  }

  // Calculate base price from card prices
  private async calculateBundleBasePrice(cardIds: string[]): Promise<Decimal> {
    const cards = await this.nftService.getCardsWithPricing(cardIds);
    return cards.reduce((sum, card) => sum + card.current_price, new Decimal(0));
  }

  // Get bundle with all cards
  async getBundleDetails(bundleId: string): Promise<BundleDetail> {
    const bundle = await this.bundleRepo.findOne(bundleId);
    
    if (!bundle) {
      throw new NotFoundException(`Bundle ${bundleId} not found`);
    }

    const cards = await this.bundleCardRepo.find({
      bundle_id: bundleId,
      order: { card_position: 'ASC' },
    });

    const cardDetails = await Promise.all(
      cards.map(async (bc) => ({
        card_id: bc.player_card_id,
        details: await this.nftService.getCardDetails(bc.player_card_id),
      }))
    );

    return {
      bundle,
      cards: cardDetails,
      finalPrice: bundle.final_price,
      discountApplied: bundle.discount_percentage > 0 || bundle.discount_amount > 0,
    };
  }

  // Cancel bundle (unlisting)
  async cancelBundle(bundleId: string, userId: string): Promise<PlayerCardBundle> {
    const bundle = await this.bundleRepo.findOne(bundleId);

    if (bundle.creator_user_id !== userId) {
      throw new ForbiddenException('Only creator can cancel bundle');
    }

    if (bundle.bundle_status === 'sold') {
      throw new BadRequestException('Cannot cancel sold bundle');
    }

    // Unlock all cards
    const cards = await this.bundleCardRepo.find({ bundle_id: bundleId });
    for (const card of cards) {
      await this.nftService.unlockCard(card.player_card_id);
    }

    bundle.bundle_status = 'cancelled';
    bundle.visibility = 'unlisted';

    return this.bundleRepo.save(bundle);
  }

  // Update bundle price
  async updateBundlePrice(
    bundleId: string,
    newPrice: Decimal,
    adminId: string,
    reason: string,
  ): Promise<PlayerCardBundle> {
    const bundle = await this.bundleRepo.findOne(bundleId);

    if (!bundle) {
      throw new NotFoundException(`Bundle ${bundleId} not found`);
    }

    // Record price change
    await this.priceHistoryRepo.save({
      bundle_id: bundleId,
      previous_price: bundle.base_price,
      new_price: newPrice,
      price_change_reason: reason,
      changed_by_admin_id: adminId,
    });

    bundle.base_price = newPrice;
    return this.bundleRepo.save(bundle);
  }
}
```

### Bundle Transfer Service (Atomic Operations)

#### BundleTransferService
```typescript
@Injectable()
export class BundleTransferService {
  constructor(
    @InjectRepository(PlayerCardBundle) private bundleRepo: Repository<PlayerCardBundle>,
    @InjectRepository(BundleTransferTransaction) private transferRepo: Repository<BundleTransferTransaction>,
    @InjectRepository(BundleTransferItem) private transferItemRepo: Repository<BundleTransferItem>,
    @InjectRepository(BundleCardItem) private bundleCardRepo: Repository<BundleCardItem>,
    private nftService: NFTService,
    private walletService: WalletService,
    private blockchainService: BlockchainService,
    private entityManager: EntityManager,
    private logger: LoggerService,
  ) {}

  // Initiate atomic bundle transfer
  async initiateAtomicTransfer(
    bundleId: string,
    buyerId: string,
    paymentMethod: string,
  ): Promise<BundleTransferTransaction> {
    return await this.entityManager.transaction(async (transactionManager) => {
      const bundle = await transactionManager.findOne(PlayerCardBundle, bundleId);

      if (!bundle) {
        throw new NotFoundException(`Bundle ${bundleId} not found`);
      }

      if (bundle.bundle_status !== 'active') {
        throw new BadRequestException(`Bundle is not available for purchase (status: ${bundle.bundle_status})`);
      }

      const sellerId = bundle.creator_user_id;

      // Get all cards in bundle
      const bundleCards = await transactionManager.find(BundleCardItem, {
        bundle_id: bundleId,
      });

      // Verify all cards are still locked and available
      for (const bundleCard of bundleCards) {
        const card = await this.nftService.getCardDetails(bundleCard.player_card_id);
        if (!card.locked || card.owner_id !== sellerId) {
          throw new BadRequestException(`Card ${bundleCard.player_card_id} is not available for transfer`);
        }
      }

      // Verify buyer has sufficient funds
      const buyerWallet = await this.walletService.getWallet(buyerId);
      if (buyerWallet.available_balance < bundle.final_price) {
        throw new BadRequestException('Insufficient funds for bundle purchase');
      }

      // Create transfer transaction record
      const transfer = new BundleTransferTransaction();
      transfer.bundle_id = bundleId;
      transfer.seller_user_id = sellerId;
      transfer.buyer_user_id = buyerId;
      transfer.total_price = bundle.base_price;
      transfer.discount_applied = bundle.discount_amount + (bundle.base_price * bundle.discount_percentage / 100);
      transfer.final_price = bundle.final_price;
      transfer.payment_method = paymentMethod;
      transfer.transaction_status = 'pending';

      const savedTransfer = await transactionManager.save(BundleTransferTransaction, transfer);

      // Create transfer items for each card
      for (const bundleCard of bundleCards) {
        const transferItem = new BundleTransferItem();
        transferItem.transfer_transaction_id = savedTransfer.id;
        transferItem.player_card_id = bundleCard.player_card_id;
        transferItem.transfer_status = 'pending';

        await transactionManager.save(BundleTransferItem, transferItem);
      }

      this.logger.log(`Bundle transfer initiated: ${savedTransfer.id}`);
      return savedTransfer;
    });
  }

  // Execute atomic transfer (all or nothing)
  async executeAtomicTransfer(transferId: string): Promise<BundleTransferTransaction> {
    return await this.entityManager.transaction(
      async (transactionManager) => {
        const transfer = await transactionManager.findOne(BundleTransferTransaction, transferId);

        if (!transfer) {
          throw new NotFoundException(`Transfer ${transferId} not found`);
        }

        if (transfer.transaction_status !== 'pending') {
          throw new BadRequestException(`Transfer is not in pending state (status: ${transfer.transaction_status})`);
        }

        const bundle = await transactionManager.findOne(PlayerCardBundle, transfer.bundle_id);
        const transferItems = await transactionManager.find(BundleTransferItem, {
          transfer_transaction_id: transferId,
        });

        try {
          transfer.transaction_status = 'escrow_held';
          await transactionManager.save(BundleTransferTransaction, transfer);

          // Step 1: Lock buyer funds in escrow
          await this.walletService.holdFundsInEscrow(
            transfer.buyer_user_id,
            transfer.final_price,
            transferId,
          );

          // Step 2: Initiate blockchain transfers for all cards
          const blockchainTransfers = [];
          for (const item of transferItems) {
            try {
              const txHash = await this.blockchainService.initiateCardTransfer(
                item.player_card_id,
                transfer.seller_user_id,
                transfer.buyer_user_id,
                transfer.final_price / transferItems.length, // Split price
              );

              item.blockchain_tx_hash = txHash;
              blockchainTransfers.push({ item, txHash });
            } catch (error) {
              item.transfer_status = 'failed';
              item.error_message = error.message;
              throw new Error(`Failed to transfer card ${item.player_card_id}: ${error.message}`);
            }
          }

          // Step 3: Wait for blockchain confirmations
          const confirmationResults = await Promise.all(
            blockchainTransfers.map((bt) =>
              this.blockchainService.waitForConfirmation(bt.txHash, 12) // 12 confirmations
            )
          );

          // Check if all transfers confirmed
          if (!confirmationResults.every((r) => r.confirmed)) {
            throw new Error('Not all blockchain transfers confirmed');
          }

          // Step 4: Update card ownership in database
          for (const item of transferItems) {
            await this.nftService.transferCardOwnership(
              item.player_card_id,
              transfer.seller_user_id,
              transfer.buyer_user_id,
            );

            item.transfer_status = 'transferred';
            await transactionManager.save(BundleTransferItem, item);
          }

          // Step 5: Release funds from escrow to seller
          await this.walletService.releaseEscrowToSeller(
            transfer.seller_user_id,
            transfer.final_price,
            transferId,
          );

          // Step 6: Update bundle status and set sold
          bundle.bundle_status = 'sold';
          bundle.sold_at = new Date();
          bundle.sold_to_user_id = transfer.buyer_user_id;
          await transactionManager.save(PlayerCardBundle, bundle);

          // Step 7: Finalize transfer status
          transfer.transaction_status = 'completed';
          transfer.completed_at = new Date();

          const finalTransfer = await transactionManager.save(BundleTransferTransaction, transfer);

          this.logger.log(`Bundle transfer completed: ${transferId}`);
          return finalTransfer;
        } catch (error) {
          return await this.handleTransferFailure(transactionManager, transfer, transferItems, error);
        }
      },
      { isolation: 'SERIALIZABLE', timeout: 60000 }, // Prevent concurrent issues
    );
  }

  // Handle transfer failure with rollback
  private async handleTransferFailure(
    transactionManager: EntityManager,
    transfer: BundleTransferTransaction,
    transferItems: BundleTransferItem[],
    error: Error,
  ): Promise<BundleTransferTransaction> {
    this.logger.error(`Transfer failed: ${transfer.id}: ${error.message}`);

    // Mark all items as failed
    for (const item of transferItems) {
      item.transfer_status = 'failed';
      item.error_message = error.message;
      await transactionManager.save(BundleTransferItem, item);
    }

    // Release escrow funds back to buyer
    await this.walletService.releaseEscrowToBuyer(
      transfer.buyer_user_id,
      transfer.final_price,
      transfer.id,
    );

    // Revert any blockchain transfers
    for (const item of transferItems) {
      if (item.blockchain_tx_hash) {
        try {
          await this.blockchainService.revertTransfer(item.blockchain_tx_hash);
          item.transfer_status = 'reverted';
        } catch (revertError) {
          this.logger.error(`Failed to revert transfer: ${item.blockchain_tx_hash}: ${revertError.message}`);
        }
      }
    }

    // Unlock cards in bundle
    const bundle = await transactionManager.findOne(PlayerCardBundle, transfer.bundle_id);
    for (const item of transferItems) {
      await this.nftService.unlockCard(item.player_card_id);
    }

    transfer.transaction_status = 'failed';
    transfer.failed_reason = error.message;

    return await transactionManager.save(BundleTransferTransaction, transfer);
  }

  // Get transfer status
  async getTransferStatus(transferId: string): Promise<BundleTransferTransaction> {
    return this.transferRepo.findOne(transferId);
  }

  // Retry failed transfer
  async retryFailedTransfer(transferId: string): Promise<BundleTransferTransaction> {
    const transfer = await this.transferRepo.findOne(transferId);

    if (transfer.transaction_status !== 'failed') {
      throw new BadRequestException('Only failed transfers can be retried');
    }

    if (transfer.retry_count >= transfer.max_retries) {
      throw new BadRequestException('Maximum retry attempts exceeded');
    }

    transfer.retry_count += 1;
    transfer.transaction_status = 'pending';

    await this.transferRepo.save(transfer);

    return this.executeAtomicTransfer(transferId);
  }
}
```

### Discount Service

#### BundleDiscountService
```typescript
@Injectable()
export class BundleDiscountService {
  constructor(
    @InjectRepository(BundleDiscountRule) private discountRuleRepo: Repository<BundleDiscountRule>,
    private logger: LoggerService,
  ) {}

  // Get applicable discount for bundle
  async getApplicableDiscount(
    cardIds: string[],
    discountRuleId?: string,
  ): Promise<ApplicableDiscount> {
    let rule: BundleDiscountRule;

    if (discountRuleId) {
      rule = await this.discountRuleRepo.findOne(discountRuleId);
    } else {
      // Find best matching rule
      rule = await this.findBestMatchingRule(cardIds);
    }

    if (!rule) {
      return null;
    }

    return {
      rule_id: rule.id,
      discount_type: rule.discount_type,
      percentage: rule.discount_type === 'percentage' ? rule.discount_value : 0,
      fixed_amount: rule.discount_type === 'fixed' ? rule.discount_value : 0,
      reason: rule.discount_name,
      valid_until: rule.valid_until,
    };
  }

  // Find best applicable discount rule
  private async findBestMatchingRule(cardIds: string[]): Promise<BundleDiscountRule> {
    const now = new Date();

    const rules = await this.discountRuleRepo.find({
      active: true,
      valid_from: LessThanOrEqual(now),
      valid_until: GreaterThanOrEqual(now),
      order: { priority: 'DESC' },
    });

    for (const rule of rules) {
      if (this.isRuleApplicable(rule, cardIds)) {
        return rule;
      }
    }

    return null;
  }

  // Check if rule applies to these cards
  private isRuleApplicable(rule: BundleDiscountRule, cardIds: string[]): boolean {
    if (rule.min_card_count && cardIds.length < rule.min_card_count) {
      return false;
    }

    if (rule.max_card_count && cardIds.length > rule.max_card_count) {
      return false;
    }

    return true;
  }

  // Create discount rule
  async createDiscountRule(request: CreateDiscountRuleDto): Promise<BundleDiscountRule> {
    const rule = new BundleDiscountRule();
    rule.discount_name = request.name;
    rule.discount_type = request.type;
    rule.discount_value = request.value;
    rule.min_card_count = request.min_cards;
    rule.max_card_count = request.max_cards;
    rule.priority = request.priority || 0;
    rule.valid_from = request.valid_from || new Date();
    rule.valid_until = request.valid_until;
    rule.active = true;

    return this.discountRuleRepo.save(rule);
  }
}
```

## API Endpoints

### Bundle Controller
```typescript
@Controller('marketplace/bundles')
@UseGuards(AuthGuard)
export class BundleController {
  constructor(
    private bundleService: BundleService,
    private bundleTransferService: BundleTransferService,
  ) {}

  // Create bundle
  @Post('create')
  async createBundle(
    @Body() request: CreateBundleDto,
    @GetUser() user: User,
  ): Promise<PlayerCardBundle> {
    return this.bundleService.createBundle(request, user.id);
  }

  // Get bundle details
  @Get(':bundleId')
  async getBundleDetails(@Param('bundleId') bundleId: string): Promise<BundleDetail> {
    return this.bundleService.getBundleDetails(bundleId);
  }

  // List bundles with filters
  @Get()
  async listBundles(
    @Query('visibility') visibility?: string,
    @Query('minPrice') minPrice?: Decimal,
    @Query('maxPrice') maxPrice?: Decimal,
    @Query('sort') sort?: string,
  ): Promise<PaginatedResult<PlayerCardBundle>> {}

  // List bundle for sale
  @Post(':bundleId/list')
  async listBundle(
    @Param('bundleId') bundleId: string,
    @Body() request: ListBundleDto,
    @GetUser() user: User,
  ): Promise<PlayerCardBundle> {
    return this.bundleService.listBundle(bundleId, user.id, request.price);
  }

  // Cancel/unlist bundle
  @Post(':bundleId/cancel')
  async cancelBundle(
    @Param('bundleId') bundleId: string,
    @GetUser() user: User,
  ): Promise<PlayerCardBundle> {
    return this.bundleService.cancelBundle(bundleId, user.id);
  }

  // Initiate bundle purchase
  @Post(':bundleId/purchase')
  async purchaseBundle(
    @Param('bundleId') bundleId: string,
    @Body() request: PurchaseBundleDto,
    @GetUser() user: User,
  ): Promise<BundleTransferTransaction> {
    return this.bundleTransferService.initiateAtomicTransfer(
      bundleId,
      user.id,
      request.payment_method,
    );
  }

  // Get transfer status
  @Get('transfer/:transferId')
  async getTransferStatus(
    @Param('transferId') transferId: string,
  ): Promise<BundleTransferTransaction> {
    return this.bundleTransferService.getTransferStatus(transferId);
  }

  // Retry failed transfer
  @Post('transfer/:transferId/retry')
  async retryTransfer(
    @Param('transferId') transferId: string,
    @GetUser() user: User,
  ): Promise<BundleTransferTransaction> {
    return this.bundleTransferService.retryFailedTransfer(transferId);
  }

  // Admin: Update bundle price
  @Post(':bundleId/admin/update-price')
  @UseGuards(AdminGuard)
  async updatePriceAdmin(
    @Param('bundleId') bundleId: string,
    @Body() request: UpdateBundlePriceDto,
    @GetAdmin() admin: Admin,
  ): Promise<PlayerCardBundle> {
    return this.bundleService.updateBundlePrice(
      bundleId,
      request.new_price,
      admin.id,
      request.reason,
    );
  }
}
```

## DTOs

```typescript
export class CreateBundleDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  card_ids: string[];

  @IsNotEmpty()
  @MaxLength(255)
  bundle_name: string;

  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsEnum(['private', 'public', 'unlisted'])
  visibility?: string;

  @IsOptional()
  @IsUUID()
  discount_rule_id?: string;
}

export class ListBundleDto {
  @IsOptional()
  @IsDecimal()
  price?: Decimal;
}

export class PurchaseBundleDto {
  @IsEnum(['wallet', 'card', 'crypto'])
  payment_method: string;
}

export class UpdateBundlePriceDto {
  @IsDecimal()
  new_price: Decimal;

  @IsNotEmpty()
  reason: string;
}

export class CreateDiscountRuleDto {
  @IsNotEmpty()
  name: string;

  @IsEnum(['percentage', 'fixed', 'tiered', 'dynamic'])
  type: string;

  @IsDecimal()
  value: Decimal;

  @IsOptional()
  @IsInt()
  min_cards?: number;

  @IsOptional()
  @IsInt()
  max_cards?: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsISO8601()
  valid_from?: Date;

  @IsOptional()
  @IsISO8601()
  valid_until?: Date;
}
```

## Configuration

```env
# Bundle Settings
BUNDLE_MIN_CARDS=2
BUNDLE_MAX_CARDS=20
BUNDLE_LISTING_FEE_PERCENTAGE=2.5
BUNDLE_DISCOUNT_PERCENTAGE_MAX=20

# Transfer Settings
BUNDLE_TRANSFER_TIMEOUT_MINUTES=30
BUNDLE_TRANSFER_MAX_RETRIES=3
BUNDLE_TRANSFER_CONFIRMATION_BLOCKS=12

# Escrow
ESCROW_RESERVE_PERCENTAGE=5
ESCROW_TIMEOUT_DAYS=7
```

## Security & Atomicity

- **Serializable Isolation**: Prevents concurrent bundle modifications
- **Transaction Timeout**: Ensures transfers complete or rollback within limits
- **Escrow Validation**: Funds held until all cards transferred
- **Blockchain Confirmation**: Multiple confirmations before finalizing
- **Automatic Rollback**: All-or-nothing semantics
- **Card Locking**: Prevents double-spending while listed

## Monitoring & Analytics

- Bundle creation and listing rates
- Purchase completion rate
- Average discount applied
- Transfer failure and retry rates
- Popular bundle types and combinations
- Revenue from bundles

## Testing Strategy

1. Unit tests for discount calculation
2. Integration tests for bundle creation and listing
3. Transaction tests for atomic transfers with failures
4. Concurrency tests for prevented double-spending
5. Blockchain integration tests
6. Escrow validation tests
7. Rollback scenarios
