import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WalletConnection,
  WalletStatus,
  WalletType,
} from '../entities/wallet-connection.entity';

@Injectable()
export class WalletConnectionService {
  constructor(
    @InjectRepository(WalletConnection)
    private walletRepo: Repository<WalletConnection>,
  ) {}

  async connectWallet(
    userId: string,
    publicKey: string,
    walletType: WalletType = WalletType.FREIGHTER,
  ): Promise<WalletConnection> {
    // Prevent duplicate connections for same user+address
    const existing = await this.walletRepo.findOne({
      where: { userId, publicKey },
    });

    if (existing) {
      if (existing.status === WalletStatus.ACTIVE) {
        throw new ConflictException('Wallet already connected');
      }
      // Re-activate a previously disconnected wallet
      existing.status = WalletStatus.ACTIVE;
      return this.walletRepo.save(existing);
    }

    const userWallets = await this.walletRepo.find({ where: { userId } });
    const isFirst = userWallets.length === 0;

    const wallet = this.walletRepo.create({
      userId,
      publicKey,
      walletType,
      status: WalletStatus.ACTIVE,
      isDefault: isFirst,
    });

    return this.walletRepo.save(wallet);
  }

  async disconnectWallet(userId: string, walletId: string): Promise<void> {
    const wallet = await this.walletRepo.findOne({
      where: { id: walletId, userId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    wallet.status = WalletStatus.DISCONNECTED;

    // If disconnecting the default, promote another active wallet
    if (wallet.isDefault) {
      wallet.isDefault = false;
      await this.walletRepo.save(wallet);

      const next = await this.walletRepo.findOne({
        where: { userId, status: WalletStatus.ACTIVE },
      });
      if (next) {
        next.isDefault = true;
        await this.walletRepo.save(next);
      }
    } else {
      await this.walletRepo.save(wallet);
    }
  }

  async setDefaultWallet(userId: string, walletId: string): Promise<WalletConnection> {
    const wallet = await this.walletRepo.findOne({
      where: { id: walletId, userId, status: WalletStatus.ACTIVE },
    });
    if (!wallet) throw new NotFoundException('Active wallet not found');

    // Clear existing default
    await this.walletRepo.update({ userId, isDefault: true }, { isDefault: false });

    wallet.isDefault = true;
    return this.walletRepo.save(wallet);
  }

  async getUserWallets(userId: string): Promise<WalletConnection[]> {
    return this.walletRepo.find({
      where: { userId, status: WalletStatus.ACTIVE },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async getDefaultWallet(userId: string): Promise<WalletConnection | null> {
    return this.walletRepo.findOne({
      where: { userId, isDefault: true, status: WalletStatus.ACTIVE },
    });
  }
}
