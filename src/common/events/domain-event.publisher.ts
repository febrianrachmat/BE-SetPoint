export type DomainEvent<TPayload extends object = Record<string, unknown>> = {
  name: string;
  occurredAt: string;
  payload: TPayload;
};

export const DOMAIN_EVENT_PUBLISHER = Symbol('DOMAIN_EVENT_PUBLISHER');

export type DomainEventHandler = (
  event: DomainEvent,
) => Promise<void> | void;

export interface DomainEventPublisher {
  publish<TPayload extends object>(
    event: DomainEvent<TPayload>,
  ): Promise<void> | void;
  subscribe?(eventName: string, handler: DomainEventHandler): void;
}
