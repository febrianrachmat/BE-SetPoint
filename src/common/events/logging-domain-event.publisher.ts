import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEvent,
  DomainEventPublisher,
} from './domain-event.publisher';

/**
 * MVP publisher: log only.
 * Replace later with AuditLog / notification / queue adapters
 * without changing domain services.
 */
@Injectable()
export class LoggingDomainEventPublisher implements DomainEventPublisher {
  private readonly logger = new Logger('DomainEvents');

  publish<TPayload extends object>(event: DomainEvent<TPayload>): void {
    this.logger.log(
      `${event.name} @ ${event.occurredAt} ${JSON.stringify(event.payload)}`,
    );
  }
}
