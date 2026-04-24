import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { MatchCancelledEvent } from '../matches/events/match-cancelled.event';
import { BetSettlementService } from './bet-settlement.service';

@EventsHandler(MatchCancelledEvent)
export class MatchCancelledEventHandler implements IEventHandler<MatchCancelledEvent> {
  constructor(private readonly betSettlementService: BetSettlementService) {}

  async handle(event: MatchCancelledEvent): Promise<void> {
    await this.betSettlementService.enqueueMatchRefund(event.matchId, null, {
      source: 'match_cancelled_listener',
      cancelledAt: event.cancelledAt.toISOString(),
    });
  }
}
