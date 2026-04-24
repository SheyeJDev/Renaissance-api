export class MatchCancelledEvent {
  constructor(
    public readonly matchId: string,
    public readonly cancelledAt: Date,
  ) {}
}
