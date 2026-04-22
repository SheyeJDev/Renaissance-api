import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Player } from './entities/player.entity';

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private playerRepo: Repository<Player>,
  ) {}

  async create(dto: Partial<Player>): Promise<Player> {
    const exists = await this.playerRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    const player = this.playerRepo.create(dto);
    return this.playerRepo.save(player);
  }

  async findById(id: string): Promise<Player> {
    const player = await this.playerRepo.findOne({ where: { id } });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }

  async search(name: string): Promise<Player[]> {
    return this.playerRepo.find({
      where: { name: ILike(`%${name}%`) },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async getStats(id: string): Promise<Pick<Player, 'totalSpins' | 'totalWagered' | 'totalWon' | 'walletBalance'>> {
    const player = await this.findById(id);
    return {
      totalSpins: player.totalSpins,
      totalWagered: player.totalWagered,
      totalWon: player.totalWon,
      walletBalance: player.walletBalance,
    };
  }

  async updateMetadata(id: string, metadata: Record<string, any>): Promise<Player> {
    const player = await this.findById(id);
    player.metadata = { ...player.metadata, ...metadata };
    return this.playerRepo.save(player);
  }

  // Called internally by wallet/spin services
  async incrementStats(
    id: string,
    delta: { spins?: number; wagered?: number; won?: number },
    manager = this.playerRepo.manager,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(Player)
      .set({
        ...(delta.spins && { totalSpins: () => `"totalSpins" + ${delta.spins}` }),
        ...(delta.wagered && { totalWagered: () => `"totalWagered" + ${delta.wagered}` }),
        ...(delta.won && { totalWon: () => `"totalWon" + ${delta.won}` }),
      })
      .where('id = :id', { id })
      .execute();
  }
}