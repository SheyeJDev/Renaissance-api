import { Injectable, Logger } from '@nestjs/common';

export type ContractEventHandler = (
  contractId: string,
  topics: string[],
  payload: Record<string, unknown>,
  txHash: string,
) => Promise<void>;

/**
 * Registry for contract event handlers.
 * Decouples the event listener from specific game modules (spin, nft-rewards, etc.)
 * by allowing each module to register its own handler by event topic prefix.
 */
@Injectable()
export class EventHandlerRegistry {
  private readonly logger = new Logger(EventHandlerRegistry.name);
  private readonly handlers = new Map<string, ContractEventHandler>();

  register(topicPrefix: string, handler: ContractEventHandler): void {
    this.handlers.set(topicPrefix, handler);
    this.logger.debug(`Registered event handler for topic prefix: ${topicPrefix}`);
  }

  unregister(topicPrefix: string): void {
    this.handlers.delete(topicPrefix);
  }

  async dispatch(
    contractId: string,
    topics: string[],
    payload: Record<string, unknown>,
    txHash: string,
  ): Promise<boolean> {
    const matchedTopic = topics.find((t) => this.handlers.has(t));
    if (!matchedTopic) {
      return false;
    }
    const handler = this.handlers.get(matchedTopic)!;
    await handler(contractId, topics, payload, txHash);
    return true;
  }

  hasHandler(topicPrefix: string): boolean {
    return this.handlers.has(topicPrefix);
  }
}
