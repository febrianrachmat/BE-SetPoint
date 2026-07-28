import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEvent,
  DomainEventPublisher,
} from './domain-event.publisher';

export type DomainEventHandler = (
  event: DomainEvent,
) => Promise<void> | void;

/**
 * In-process publisher: log + fan-out to subscribers.
 * Swap later for queue/Audit without changing domain services.
 */
@Injectable()
export class LoggingDomainEventPublisher implements DomainEventPublisher {
  private readonly logger = new Logger('DomainEvents');
  private readonly handlers = new Map<string, DomainEventHandler[]>();

  subscribe(eventName: string, handler: DomainEventHandler): void {
    const list = this.handlers.get(eventName) ?? [];
    list.push(handler);
    this.handlers.set(eventName, list);
  }

  async publish<TPayload extends object>(
    event: DomainEvent<TPayload>,
  ): Promise<void> {
    this.logger.log(
      `${event.name} @ ${event.occurredAt} ${JSON.stringify(event.payload)}`,
    );

    const list = this.handlers.get(event.name) ?? [];
    for (const handler of list) {
      try {
        await handler(event as DomainEvent);
      } catch (err) {
        this.logger.error(
          `Handler failed for ${event.name}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }
}
