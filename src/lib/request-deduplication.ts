// Request deduplication utility
interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

class RequestDeduplicator {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Clean up expired requests
    this.cleanupExpiredRequests();

    // Check if there's already a pending request for this key
    const existing = this.pendingRequests.get(key);
    if (existing) {
      console.log(`Deduplicating request for key: ${key}`);
      return existing.promise;
    }

    // Create new request
    const promise = requestFn();
    const pendingRequest: PendingRequest = {
      promise,
      timestamp: Date.now()
    };

    this.pendingRequests.set(key, pendingRequest);

    try {
      const result = await promise;
      return result;
    } finally {
      // Remove from pending requests when done
      this.pendingRequests.delete(key);
    }
  }

  private cleanupExpiredRequests() {
    const now = Date.now();
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.REQUEST_TIMEOUT) {
        console.log(`Cleaning up expired request for key: ${key}`);
        this.pendingRequests.delete(key);
      }
    }
  }

  // Get current pending requests count (for monitoring)
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  // Get pending request keys (for debugging)
  getPendingKeys(): string[] {
    return Array.from(this.pendingRequests.keys());
  }
}

// Create a singleton instance
export const requestDeduplicator = new RequestDeduplicator();

// Helper function for order updates
export function deduplicateOrderUpdate(orderId: string, updates: any, requestFn: () => Promise<any>) {
  const key = `order-update-${orderId}-${JSON.stringify(updates)}`;
  return requestDeduplicator.deduplicate(key, requestFn);
} 