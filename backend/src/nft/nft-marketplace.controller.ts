import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
  ParseFloatPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NFTMarketplaceService, ListingsFilter } from './nft-marketplace.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { MakeOfferDto } from './dto/make-offer.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import {
  NFTListingResponseDto,
  NFTOfferResponseDto,
  NFTPlayerCardResponseDto,
  PaginatedListingsDto,
  PaginatedNFTsDto,
} from './dto/nft-response.dto';
import { ListingStatus } from './entities/nft-listing.entity';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@ApiTags('NFT Marketplace')
@Controller('nft')
export class NFTMarketplaceController {
  constructor(private readonly nftMarketplaceService: NFTMarketplaceService) {}

  // ==================== LISTINGS ====================

  @Post('listings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List an NFT for sale' })
  @ApiBody({ type: CreateListingDto })
  @ApiResponse({
    status: 201,
    description: 'NFT successfully listed for sale',
    type: NFTListingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'NFT already listed' })
  async createListing(
    @Req() req: AuthenticatedRequest,
    @Body() createListingDto: CreateListingDto,
  ) {
    const listing = await this.nftMarketplaceService.listNFT(
      req.user.userId,
      createListingDto,
    );
    return this.mapListingToResponse(listing);
  }

  @Get('listings')
  @ApiOperation({ summary: 'Browse all active listings' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'currency', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of active listings',
    type: PaginatedListingsDto,
  })
  async getListings(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('currency') currency?: string,
    @Query('minPrice', ParseFloatPipe) minPrice?: number,
    @Query('maxPrice', ParseFloatPipe) maxPrice?: number,
  ) {
    const filter: ListingsFilter = {
      status: ListingStatus.ACTIVE,
      currency,
      minPrice,
      maxPrice,
      page,
      limit,
    };

    const result = await this.nftMarketplaceService.getListings(filter);
    return {
      ...result,
      data: result.data.map((listing) => this.mapListingToResponse(listing)),
    };
  }

  @Get('listings/:id')
  @ApiOperation({ summary: 'Get listing details with offers' })
  @ApiParam({ name: 'id', description: 'Listing ID' })
  @ApiResponse({
    status: 200,
    description: 'Listing details',
    type: NFTListingResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async getListingById(@Param('id') id: string) {
    const listing = await this.nftMarketplaceService.getListingById(id);
    return this.mapListingToResponse(listing);
  }

  @Patch('listings/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update listing price or expiration' })
  @ApiParam({ name: 'id', description: 'Listing ID' })
  @ApiBody({ type: UpdateListingDto })
  @ApiResponse({
    status: 200,
    description: 'Listing updated successfully',
    type: NFTListingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async updateListing(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateListingDto: UpdateListingDto,
  ) {
    const listing = await this.nftMarketplaceService.updateListing(
      req.user.userId,
      id,
      updateListingDto,
    );
    return this.mapListingToResponse(listing);
  }

  @Delete('listings/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a listing' })
  @ApiParam({ name: 'id', description: 'Listing ID' })
  @ApiResponse({
    status: 200,
    description: 'Listing cancelled successfully',
    type: NFTListingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async cancelListing(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const listing = await this.nftMarketplaceService.cancelListing(
      req.user.userId,
      id,
    );
    return this.mapListingToResponse(listing);
  }

  @Post('listings/:id/purchase')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Purchase NFT at listing price' })
  @ApiParam({ name: 'id', description: 'Listing ID' })
  @ApiResponse({
    status: 200,
    description: 'NFT purchased successfully',
    type: NFTListingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request or insufficient balance' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async purchaseNFT(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const listing = await this.nftMarketplaceService.purchaseNFT(
      req.user.userId,
      id,
    );
    return this.mapListingToResponse(listing);
  }

  @Post('listings/:id/offers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Make an offer on a listing' })
  @ApiParam({ name: 'id', description: 'Listing ID' })
  @ApiBody({ type: MakeOfferDto })
  @ApiResponse({
    status: 201,
    description: 'Offer created successfully',
    type: NFTOfferResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async makeOffer(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() makeOfferDto: MakeOfferDto,
  ) {
    const offer = await this.nftMarketplaceService.makeOffer(
      req.user.userId,
      id,
      makeOfferDto,
    );
    return this.mapOfferToResponse(offer);
  }

  // ==================== OFFERS ====================

  @Post('offers/:id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an offer' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({
    status: 200,
    description: 'Offer accepted successfully',
    type: NFTOfferResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async acceptOffer(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const offer = await this.nftMarketplaceService.acceptOffer(
      req.user.userId,
      id,
    );
    return this.mapOfferToResponse(offer);
  }

  @Post('offers/:id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject an offer' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({
    status: 200,
    description: 'Offer rejected successfully',
    type: NFTOfferResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async rejectOffer(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const offer = await this.nftMarketplaceService.rejectOffer(
      req.user.userId,
      id,
    );
    return this.mapOfferToResponse(offer);
  }

  @Delete('offers/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an offer' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({
    status: 200,
    description: 'Offer cancelled successfully',
    type: NFTOfferResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async cancelOffer(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const offer = await this.nftMarketplaceService.cancelOffer(
      req.user.userId,
      id,
    );
    return this.mapOfferToResponse(offer);
  }

  // ==================== USER-SPECIFIC ENDPOINTS ====================

  @Get('my-listings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get authenticated user's listings" })
  @ApiResponse({
    status: 200,
    description: "User's listings",
    type: [NFTListingResponseDto],
  })
  async getMyListings(@Req() req: AuthenticatedRequest) {
    const listings = await this.nftMarketplaceService.getUserListings(
      req.user.userId,
    );
    return listings.map((listing) => this.mapListingToResponse(listing));
  }

  @Get('my-offers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get authenticated user's offers" })
  @ApiResponse({
    status: 200,
    description: "User's offers",
    type: [NFTOfferResponseDto],
  })
  async getMyOffers(@Req() req: AuthenticatedRequest) {
    const offers = await this.nftMarketplaceService.getUserOffers(
      req.user.userId,
    );
    return offers.map((offer) => this.mapOfferToResponse(offer));
  }

  @Get('my-nfts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get authenticated user's owned NFTs" })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "User's owned NFTs",
    type: PaginatedNFTsDto,
  })
  async getMyNFTs(
    @Req() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const result = await this.nftMarketplaceService.getUserOwnedNFTs(
      req.user.userId,
      page,
      limit,
    );
    return {
      ...result,
      data: result.data.map((nft) => this.mapNFTCardToResponse(nft)),
    };
  }

  // ==================== HELPER METHODS ====================

  private mapListingToResponse(listing: any): NFTListingResponseDto {
    return {
      id: listing.id,
      nftCardId: listing.nftCardId,
      sellerId: listing.sellerId,
      sellerUsername: listing.seller?.username || 'Unknown',
      price: Number(listing.price),
      currency: listing.currency,
      status: listing.status,
      expiresAt: listing.expiresAt,
      blockchainTxHash: listing.blockchainTxHash,
      soldAt: listing.soldAt,
      buyerId: listing.buyerId,
      buyerUsername: listing.buyer?.username,
      offers: listing.offers?.map((offer: any) => this.mapOfferToResponse(offer)),
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    };
  }

  private mapOfferToResponse(offer: any): NFTOfferResponseDto {
    return {
      id: offer.id,
      listingId: offer.listingId,
      buyerId: offer.buyerId,
      buyerUsername: offer.buyer?.username || 'Unknown',
      offerPrice: Number(offer.offerPrice),
      currency: offer.currency,
      status: offer.status,
      expiresAt: offer.expiresAt,
      respondedAt: offer.respondedAt,
      createdAt: offer.createdAt,
    };
  }

  private mapNFTCardToResponse(nftCard: any): NFTPlayerCardResponseDto {
    return {
      id: nftCard.id,
      ownerId: nftCard.ownerId,
      ownerUsername: nftCard.owner?.username || 'Unknown',
      contractAddress: nftCard.contractAddress,
      tokenId: nftCard.tokenId,
      acquiredAt: nftCard.acquiredAt,
      acquisitionPrice: nftCard.acquisitionPrice
        ? Number(nftCard.acquisitionPrice)
        : undefined,
      isListed: nftCard.isListed,
      metadata: nftCard.metadata,
      createdAt: nftCard.createdAt,
    };
  }
}
