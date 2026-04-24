import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NFTPlayerCard } from './entities/nft-player-card.entity';
import { NFTListing } from './entities/nft-listing.entity';
import { NFTOffer } from './entities/nft-offer.entity';
import { NFTMarketplaceService } from './nft-marketplace.service';
import { NFTMarketplaceController } from './nft-marketplace.controller';
import { WalletModule } from '../wallet/wallet.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NFTPlayerCard, NFTListing, NFTOffer]),
    WalletModule,
    BlockchainModule,
  ],
  controllers: [NFTMarketplaceController],
  providers: [NFTMarketplaceService],
  exports: [NFTMarketplaceService],
})
export class NFTMarketplaceModule {}
