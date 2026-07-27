import { Global, Module } from '@nestjs/common';
import { DOMAIN_EVENT_PUBLISHER } from './domain-event.publisher';
import { LoggingDomainEventPublisher } from './logging-domain-event.publisher';

@Global()
@Module({
  providers: [
    LoggingDomainEventPublisher,
    {
      provide: DOMAIN_EVENT_PUBLISHER,
      useExisting: LoggingDomainEventPublisher,
    },
  ],
  exports: [DOMAIN_EVENT_PUBLISHER],
})
export class DomainEventsModule {}
