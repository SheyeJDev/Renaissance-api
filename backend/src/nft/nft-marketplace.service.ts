import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NFTPlayerCard } from './entities/nft-player-card.entity';
import { NFTListing, ListingStatus } from './entities/nft-listing.entity';
import { NFTOffer, OfferStatus } from './entities/nft-offer.entity';
import { WalletService } from '../wallet/services/wallet.service';
import { SorobanService } from '../blockchain/soroban.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { MakeOfferDto } from './dto/make-offer.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

export interface ListingsFilter {
  status?: ListingStatus;
  currency?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

@Injectable()
export class NFTMarketplaceService {
  private readonly logger = new Logger(NFTMarketplaceService.name);

  constructor(
    @InjectRepository(NFTPlayerCard)
    private nftCardRepo: Repository<NFTPlayerCard>,
    @InjectRepository(NFTListing)
    private listingRepo: Repository<NFTListing>,
    @InjectRepository(NFTOffer)
    private offerRepo: Repository<NFTOffer>,
    private walletService: WalletService,
    private sorobanService: SorobanService,
    private dataSource: DataSource,
  ) {}

  /**
   * List an NFT for sale
   */
  async listNFT(
    userId: string,
    createListingDto: CreateListingDto,
  ): Promise<NFTListing> {
    const { nftCardId, price, currency = 'XLM', expiresAt } = createListingDto;

    // Verify NFT exists and belongs to user
    const nftCard = await this.nftCardRepo.findOne({
      where: { id: nftCardId },
      relations: ['owner'],
    });

    if (!nftCard) {
      throw new NotFoundException(`NFT card with ID ${nftCardId} not found`);
    }

    if (nftCard.ownerId !== userId) {
      throw new UnauthorizedException('You do not own this NFT');
    }

    if (nftCard.isListed) {
      throw new ConflictException('This NFT is already listed for sale');
    }

    // Validate expiration date
    const expirationDate = new Date(expiresAt);
    if (expirationDate <= new Date()) {
      throw new BadRequestException('Expiration date must be in the future');
    }

    // Create listing and mark NFT as listed
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const listing = this.listingRepo.create({
        nftCardId,
        sellerId: userId,
        price,
        currency,
        expiresAt: expirationDate,
        status: ListingStatus.ACTIVE,
      });

      const savedListing = await queryRunner.manager.save(listing);

      // Mark NFT as listed
      nftCard.isListed = true;
      await queryRunner.manager.save(nftCard);

      await queryRunner.commitTransaction();

      this.logger.log(`NFT ${nftCardId} listed for sale by ${userId}`);
      return savedListing;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to list NFT: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Purchase an NFT at listing price
   */
  async purchaseNFT(buyerId: string, listingId: string): Promise<NFTListing> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
      relations: ['nftCard', 'seller', 'buyer'],
    });

    if (!listing) {
      throw new NotFoundException(`Listing with ID ${listingId} not found`);
    }

    // Validate listing is active
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('This listing is no longer active');
    }

    // Check if expired
    if (new Date() > listing.expiresAt) {
      listing.status = ListingStatus.EXPIRED;
      await this.listingRepo.save(listing);
      throw new BadRequestException('This listing has expired');
    }

    // Cannot purchase own listing
    if (listing.sellerId === buyerId) {
      throw new BadRequestException('You cannot purchase your own listing');
    }

    // Check buyer balance
    const buyerBalance = await this.walletService.getBalance(buyerId);
    if (buyerBalance.available < listing.price) {
      throw new BadRequestException('Insufficient balance to purchase this NFT');
    }

    // Execute atomic transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Debit buyer
      await this.walletService.updateUserBalanceWithQueryRunner(
        buyerId,
        listing.price,
        'debit',
        queryRunner,
        listingId,
        { type: 'nft_purchase', listingId },
      );

      // Credit seller
      await this.walletService.updateUserBalanceWithQueryRunner(
        listing.sellerId,
        listing.price,
        'credit',
        queryRunner,
        listingId,
        { type: 'nft_sale', listingId },
      );

      // Transfer NFT ownership
      const nftCard = listing.nftCard;
      nftCard.ownerId = buyerId;
      nftCard.acquiredAt = new Date();
      nftCard.acquisitionPrice = listing.price;
      nftCard.isListed = false;
      await queryRunner.manager.save(nftCard);

      // Update listing
      listing.status = ListingStatus.SOLD;
      listing.buyerId = buyerId;
      listing.soldAt = new Date();
      const updatedListing = await queryRunner.manager.save(listing);

      await queryRunner.commitTransaction();

      // Trigger blockchain transfer (async, non-blocking)
      this.executeBlockchainTransfer(
        nftCard.contractAddress,
        nftCard.tokenId,
        listing.sellerId,
        buyerId,
        listingId,
      ).catch((err) => {
        this.logger.error(
          `Blockchain transfer failed for listing ${listingId}: ${err.message}`,
        );
      });

      this.logger.log(
        `NFT ${nftCard.id} purchased by ${buyerId} from ${listing.sellerId}`,
      );
      return updatedListing;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to purchase NFT: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Make an offer on a listed NFT
   */
  async makeOffer(
    buyerId: string,
    listingId: string,
    makeOfferDto: MakeOfferDto,
  ): Promise<NFTOffer> {
    const { offerPrice, currency = 'XLM', expiresAt } = makeOfferDto;

    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
      relations: ['nftCard'],
    });

    if (!listing) {
      throw new NotFoundException(`Listing with ID ${listingId} not found`);
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('This listing is no longer active');
    }

    if (new Date() > listing.expiresAt) {
      throw new BadRequestException('This listing has expired');
    }

    if (listing.sellerId === buyerId) {
      throw new BadRequestException('You cannot make an offer on your own listing');
    }

    const expirationDate = new Date(expiresAt);
    if (expirationDate <= new Date()) {
      throw new BadRequestException('Expiration date must be in the future');
    }

    // Check buyer balance
    const buyerBalance = await this.walletService.getBalance(buyerId);
    if (buyerBalance.available < offerPrice) {
      throw new BadRequestException('Insufficient balance to make this offer');
    }

    const offer = this.offerRepo.create({
      listingId,
      buyerId,
      offerPrice,
      currency,
      expiresAt: expirationDate,
      status: OfferStatus.PENDING,
    });

    const savedOffer = await this.offerRepo.save(offer);
    this.logger.log(`Offer ${savedOffer.id} made on listing ${listingId}`);
    return savedOffer;
  }

  /**
   * Accept an offer
   */
  async acceptOffer(sellerId: string, offerId: string): Promise<NFTOffer> {
    const offer = await this.offerRepo.findOne({
      where: { id: offerId },
      relations: ['listing', 'listing.nftCard', 'buyer'],
    });

    if (!offer) {
      throw new NotFoundException(`Offer with ID ${offerId} not found`);
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('This offer is no longer pending');
    }

    if (new Date() > offer.expiresAt) {
      offer.status = OfferStatus.EXPIRED;
      await this.offerRepo.save(offer);
      throw new BadRequestException('This offer has expired');
    }

    if (offer.listing.sellerId !== sellerId) {
      throw new UnauthorizedException('You are not the seller of this listing');
    }

    // Execute atomic transaction similar to purchase
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const listing = offer.listing;
      const nftCard = listing.nftCard;
      const buyerId = offer.buyerId;
      const salePrice = offer.offerPrice;

      // Debit buyer
      await this.walletService.updateUserBalanceWithQueryRunner(
        buyerId,
        salePrice,
        'debit',
        queryRunner,
        offerId,
        { type: 'nft_purchase', offerId },
      );

      // Credit seller
      await this.walletService.updateUserBalanceWithQueryRunner(
        sellerId,
        salePrice,
        'credit',
        queryRunner,
        offerId,
        { type: 'nft_sale', offerId },
      );

      // Transfer NFT ownership
      nftCard.ownerId = buyerId;
      nftCard.acquiredAt = new Date();
      nftCard.acquisitionPrice = salePrice;
      nftCard.isListed = false;
      await queryRunner.manager.save(nftCard);

      // Update listing
      listing.status = ListingStatus.SOLD;
      listing.buyerId = buyerId;
      listing.soldAt = new Date();
      await queryRunner.manager.save(listing);

      // Update offer
      offer.status = OfferStatus.ACCEPTED;
      offer.respondedAt = new Date();
      const updatedOffer = await queryRunner.manager.save(offer);

      // Reject all other pending offers on this listing
      await queryRunner.manager.update(
        NFTOffer,
        { listingId: listing.id, status: OfferStatus.PENDING, id: offerId },
        { status: OfferStatus.REJECTED, respondedAt: new Date() },
      );

      await queryRunner.commitTransaction();

      // Trigger blockchain transfer
      this.executeBlockchainTransfer(
        nftCard.contractAddress,
        nftCard.tokenId,
        sellerId,
        buyerId,
        offerId,
      ).catch((err) => {
        this.logger.error(
          `Blockchain transfer failed for offer ${offerId}: ${err.message}`,
        );
      });

      this.logger.log(`Offer ${offerId} accepted by seller ${sellerId}`);
      return updatedOffer;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to accept offer: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Reject an offer
   */
  async rejectOffer(sellerId: string, offerId: string): Promise<NFTOffer> {
    const offer = await this.offerRepo.findOne({
      where: { id: offerId },
      relations: ['listing'],
    });

    if (!offer) {
      throw new NotFoundException(`Offer with ID ${offerId} not found`);
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('This offer is no longer pending');
    }

    if (offer.listing.sellerId !== sellerId) {
      throw new UnauthorizedException('You are not the seller of this listing');
    }

    offer.status = OfferStatus.REJECTED;
    offer.respondedAt = new Date();
    const updatedOffer = await this.offerRepo.save(offer);

    this.logger.log(`Offer ${offerId} rejected by seller ${sellerId}`);
    return updatedOffer;
  }

  /**
   * Cancel a listing
   */
  async cancelListing(sellerId: string, listingId: string): Promise<NFTListing> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
      relations: ['nftCard'],
    });

    if (!listing) {
      throw new NotFoundException(`Listing with ID ${listingId} not found`);
    }

    if (listing.sellerId !== sellerId) {
      throw new UnauthorizedException('You are not the seller of this listing');
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('This listing is no longer active');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      listing.status = ListingStatus.CANCELLED;
      const updatedListing = await queryRunner.manager.save(listing);

      // Mark NFT as not listed
      const nftCard = listing.nftCard;
      nftCard.isListed = false;
      await queryRunner.manager.save(nftCard);

      // Reject all pending offers
      await queryRunner.manager.update(
        NFTOffer,
        { listingId, status: OfferStatus.PENDING },
        { status: OfferStatus.CANCELLED, respondedAt: new Date() },
      );

      await queryRunner.commitTransaction();

      this.logger.log(`Listing ${listingId} cancelled by seller ${sellerId}`);
      return updatedListing;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Cancel an offer
   */
  async cancelOffer(buyerId: string, offerId: string): Promise<NFTOffer> {
    const offer = await this.offerRepo.findOne({
      where: { id: offerId },
    });

    if (!offer) {
      throw new NotFoundException(`Offer with ID ${offerId} not found`);
    }

    if (offer.buyerId !== buyerId) {
      throw new UnauthorizedException('You are not the buyer who made this offer');
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('This offer is no longer pending');
    }

    offer.status = OfferStatus.CANCELLED;
    offer.respondedAt = new Date();
    const updatedOffer = await this.offerRepo.save(offer);

    this.logger.log(`Offer ${offerId} cancelled by buyer ${buyerId}`);
    return updatedOffer;
  }

  /**
   * Update listing price or expiration
   */
  async updateListing(
    sellerId: string,
    listingId: string,
    updateListingDto: UpdateListingDto,
  ): Promise<NFTListing> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException(`Listing with ID ${listingId} not found`);
    }

    if (listing.sellerId !== sellerId) {
      throw new UnauthorizedException('You are not the seller of this listing');
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('This listing is no longer active');
    }

    if (updateListingDto.price) {
      listing.price = updateListingDto.price;
    }

    if (updateListingDto.expiresAt) {
      const expirationDate = new Date(updateListingDto.expiresAt);
      if (expirationDate <= new Date()) {
        throw new BadRequestException('Expiration date must be in the future');
      }
      listing.expiresAt = expirationDate;
    }

    const updatedListing = await this.listingRepo.save(listing);
    this.logger.log(`Listing ${listingId} updated by seller ${sellerId}`);
    return updatedListing;
  }

  /**
   * Get active listings with pagination and filters
   */
  async getListings(
    filter: ListingsFilter,
  ): Promise<PaginatedResult<NFTListing>> {
    const {
      status = ListingStatus.ACTIVE,
      currency,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
    } = filter;

    const skip = (page - 1) * limit;

    const where: any = { status };

    if (currency) {
      where.currency = currency;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    const [data, total] = await this.listingRepo.findAndCount({
      where,
      relations: ['nftCard', 'seller', 'buyer'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data,
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    };
  }

  /**
   * Get listing by ID with offers
   */
  async getListingById(listingId: string): Promise<NFTListing> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
      relations: ['nftCard', 'seller', 'buyer', 'nftCard.metadata'],
    });

    if (!listing) {
      throw new NotFoundException(`Listing with ID ${listingId} not found`);
    }

    return listing;
  }

  /**
   * Get user's active listings
   */
  async getUserListings(userId: string): Promise<NFTListing[]> {
    return this.listingRepo.find({
      where: { sellerId: userId },
      relations: ['nftCard', 'buyer'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get offers made by or received by user
   */
  async getUserOffers(userId: string): Promise<NFTOffer[]> {
    const offersMade = await this.offerRepo.find({
      where: { buyerId: userId },
      relations: ['listing', 'listing.nftCard'],
      order: { createdAt: 'DESC' },
    });

    const offersReceived = await this.offerRepo
      .createQueryBuilder('offer')
      .innerJoin('offer.listing', 'listing')
      .where('listing.sellerId = :userId', { userId })
      .leftJoinAndSelect('listing.nftCard', 'nftCard')
      .orderBy('offer.createdAt', 'DESC')
      .getMany();

    return [...offersMade, ...offersReceived];
  }

  /**
   * Get NFTs owned by user
   */
  async getUserOwnedNFTs(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResult<NFTPlayerCard>> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.nftCardRepo.findAndCount({
      where: { ownerId: userId },
      relations: ['metadata', 'owner'],
      skip,
      take: limit,
      order: { acquiredAt: 'DESC' },
    });

    return {
      data,
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    };
  }

  /**
   * Execute blockchain transfer (async helper)
   */
  private async executeBlockchainTransfer(
    contractAddress: string,
    tokenId: string,
    fromUserId: string,
    toUserId: string,
    referenceId: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Initiating blockchain transfer for NFT ${tokenId} from ${fromUserId} to ${toUserId}`,
      );

      // Call Soroban service to transfer NFT on-chain
      // This will depend on your actual smart contract implementation
      const txHash = await this.sorobanService.invokeContract('transfer_nft', [
        contractAddress,
        tokenId,
        fromUserId,
        toUserId,
      ]);

      // Update listing with blockchain tx hash
      await this.listingRepo.update(
        { nftCard: { id: referenceId } },
        { blockchainTxHash: txHash },
      );

      this.logger.log(
        `Blockchain transfer completed with tx hash: ${txHash}`,
      );
    } catch (error) {
      this.logger.error(
        `Blockchain transfer failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
