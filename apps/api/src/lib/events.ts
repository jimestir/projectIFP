import { EventEmitter } from "node:events";

export type PharmacyEventType =
  | "inventory.updated"
  | "reservation.created"
  | "reservation.updated";

export type PharmacyEvent = {
  type: PharmacyEventType;
  pharmacyId: string;
  payload: Record<string, unknown>;
  at: string;
};

class PharmacyEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  publish(event: Omit<PharmacyEvent, "at">) {
    const full: PharmacyEvent = {
      ...event,
      at: new Date().toISOString(),
    };
    this.emitter.emit(event.pharmacyId, full);
    this.emitter.emit("*", full);
  }

  subscribe(pharmacyId: string, listener: (event: PharmacyEvent) => void) {
    this.emitter.on(pharmacyId, listener);
    return () => {
      this.emitter.off(pharmacyId, listener);
    };
  }
}

export const pharmacyEvents = new PharmacyEventBus();
