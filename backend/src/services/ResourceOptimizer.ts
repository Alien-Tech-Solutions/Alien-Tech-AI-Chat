import * as os from 'os';
import { logger } from '../utils/logger';

export interface ResourceMetrics {
  cpu: {
    usage: number;           // 0-100 percentage
    loadAverage: number[];   // 1, 5, 15 minute averages
    cores: number;
    availableParallelism: number;
  };
  memory: {
    used: number;            // bytes
    free: number;            // bytes
    total: number;           // bytes
    usagePercent: number;    // 0-100
    heapUsed: number;        // Node.js heap
    heapTotal: number;
    external: number;
  };
  disk: {
    pendingWrites: number;
    writeQueueSize: number;
    avgWriteLatency: number; // ms
  };
  optimization: {
    shouldBatchWrites: boolean;
    recommendedBatchSize: number;
    shouldThrottle: boolean;
    throttleDelay: number;   // ms
    maxConcurrentOperations: number;
  };
}

export interface WriteOperation {
  id: string;
  type: 'conversation' | 'memory' | 'context' | 'journal';
  data: any;
  priority: 'high' | 'normal' | 'low';
  timestamp: number;
  retries: number;
}

export interface BatchConfig {
  maxBatchSize: number;
  maxWaitTime: number;       // ms
  minBatchSize: number;
  adaptiveBatching: boolean;
}

export class ResourceOptimizer {
  private static instance: ResourceOptimizer;
  
  // Write queue for batching
  private writeQueue: WriteOperation[] = [];
  private batchConfig: BatchConfig = {
    maxBatchSize: 50,
    maxWaitTime: 1000,       // 1 second max wait
    minBatchSize: 5,
    adaptiveBatching: true
  };
  
  // Metrics tracking
  private lastCpuUsage: { user: number; system: number } = { user: 0, system: 0 };
  private writeLatencies: number[] = [];
  private maxLatencyHistory = 100;
  
  // Throttling state
  private isThrottling = false;
  private throttleEndTime = 0;
  
  // Batch processing timer
  private batchTimer: NodeJS.Timeout | null = null;
  private batchCallback: ((operations: WriteOperation[]) => Promise<void>) | null = null;

  private constructor() {
    this.initializeCpuTracking();
    logger.info('ResourceOptimizer initialized');
  }

  static getInstance(): ResourceOptimizer {
    if (!ResourceOptimizer.instance) {
      ResourceOptimizer.instance = new ResourceOptimizer();
    }
    return ResourceOptimizer.instance;
  }

  /**
   * Initialize CPU usage tracking
   */
  private initializeCpuTracking(): void {
    const cpuUsage = process.cpuUsage();
    this.lastCpuUsage = {
      user: cpuUsage.user,
      system: cpuUsage.system
    };
  }

  /**
   * Get current resource metrics
   */
  getResourceMetrics(): ResourceMetrics {
    const cpuMetrics = this.getCpuMetrics();
    const memoryMetrics = this.getMemoryMetrics();
    const diskMetrics = this.getDiskMetrics();
    const optimization = this.calculateOptimization(cpuMetrics, memoryMetrics, diskMetrics);

    return {
      cpu: cpuMetrics,
      memory: memoryMetrics,
      disk: diskMetrics,
      optimization
    };
  }

  /**
   * Get CPU metrics
   */
  private getCpuMetrics(): ResourceMetrics['cpu'] {
    const cpuUsage = process.cpuUsage(this.lastCpuUsage as any);
    this.lastCpuUsage = {
      user: cpuUsage.user,
      system: cpuUsage.system
    };

    // Calculate CPU usage percentage (rough estimate)
    const totalUsage = cpuUsage.user + cpuUsage.system;
    const usagePercent = Math.min(100, (totalUsage / 1000000) * 10); // Normalize

    const loadAverage = os.loadavg();
    const cores = os.cpus().length;

    return {
      usage: Math.round(usagePercent * 100) / 100,
      loadAverage: loadAverage.map(avg => Math.round(avg * 100) / 100),
      cores,
      availableParallelism: Math.max(1, cores - Math.ceil(loadAverage[0]))
    };
  }

  /**
   * Get memory metrics
   */
  private getMemoryMetrics(): ResourceMetrics['memory'] {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const heapUsage = process.memoryUsage();

    return {
      used: usedMemory,
      free: freeMemory,
      total: totalMemory,
      usagePercent: Math.round((usedMemory / totalMemory) * 100 * 100) / 100,
      heapUsed: heapUsage.heapUsed,
      heapTotal: heapUsage.heapTotal,
      external: heapUsage.external
    };
  }

  /**
   * Get disk write metrics
   */
  private getDiskMetrics(): ResourceMetrics['disk'] {
    const avgLatency = this.writeLatencies.length > 0
      ? this.writeLatencies.reduce((a, b) => a + b, 0) / this.writeLatencies.length
      : 0;

    return {
      pendingWrites: this.writeQueue.length,
      writeQueueSize: this.writeQueue.reduce((size, op) => size + JSON.stringify(op.data).length, 0),
      avgWriteLatency: Math.round(avgLatency * 100) / 100
    };
  }

  /**
   * Calculate optimization recommendations
   */
  private calculateOptimization(
    cpu: ResourceMetrics['cpu'],
    memory: ResourceMetrics['memory'],
    disk: ResourceMetrics['disk']
  ): ResourceMetrics['optimization'] {
    // Determine if we should batch writes
    const shouldBatchWrites = 
      cpu.usage > 50 || 
      memory.usagePercent > 70 ||
      disk.pendingWrites > 10;

    // Calculate recommended batch size based on resources
    let recommendedBatchSize = this.batchConfig.maxBatchSize;
    if (memory.usagePercent > 80) {
      recommendedBatchSize = Math.max(5, Math.floor(recommendedBatchSize * 0.5));
    }
    if (cpu.usage > 70) {
      recommendedBatchSize = Math.max(5, Math.floor(recommendedBatchSize * 0.7));
    }

    // Determine if we should throttle
    const shouldThrottle = cpu.usage > 80 || memory.usagePercent > 85;
    let throttleDelay = 0;
    if (shouldThrottle) {
      throttleDelay = Math.min(500, Math.floor((cpu.usage - 70) * 10));
    }

    // Max concurrent operations based on available parallelism
    const maxConcurrentOperations = Math.max(1, Math.min(
      cpu.availableParallelism,
      Math.floor((100 - memory.usagePercent) / 10)
    ));

    return {
      shouldBatchWrites,
      recommendedBatchSize,
      shouldThrottle,
      throttleDelay,
      maxConcurrentOperations
    };
  }

  /**
   * Queue a write operation for batching
   */
  queueWrite(operation: Omit<WriteOperation, 'id' | 'timestamp' | 'retries'>): string {
    const id = `write_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const writeOp: WriteOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      retries: 0
    };

    // Insert based on priority
    if (operation.priority === 'high') {
      this.writeQueue.unshift(writeOp);
    } else {
      this.writeQueue.push(writeOp);
    }

    // Start batch timer if not already running
    this.scheduleBatchProcessing();

    logger.debug(`Queued write operation: ${id}, queue size: ${this.writeQueue.length}`);
    return id;
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatchProcessing(): void {
    if (this.batchTimer) return;

    const metrics = this.getResourceMetrics();
    const waitTime = metrics.optimization.shouldBatchWrites 
      ? this.batchConfig.maxWaitTime 
      : Math.min(100, this.batchConfig.maxWaitTime);

    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, waitTime);
  }

  /**
   * Process queued writes as a batch
   */
  async processBatch(): Promise<void> {
    this.batchTimer = null;

    if (this.writeQueue.length === 0) return;

    const metrics = this.getResourceMetrics();
    const batchSize = Math.min(
      this.writeQueue.length,
      metrics.optimization.recommendedBatchSize
    );

    // Extract batch from queue
    const batch = this.writeQueue.splice(0, batchSize);

    // Apply throttling if needed
    if (metrics.optimization.shouldThrottle) {
      await this.delay(metrics.optimization.throttleDelay);
    }

    // Process batch
    const startTime = Date.now();
    try {
      if (this.batchCallback) {
        await this.batchCallback(batch);
      }

      const latency = Date.now() - startTime;
      this.recordWriteLatency(latency);

      logger.debug(`Processed batch of ${batch.length} writes in ${latency}ms`);
    } catch (error) {
      logger.error('Batch processing failed:', error);
      
      // Re-queue failed operations with retry count
      for (const op of batch) {
        if (op.retries < 3) {
          op.retries++;
          this.writeQueue.push(op);
        } else {
          logger.error(`Dropping write operation after 3 retries: ${op.id}`);
        }
      }
    }

    // Schedule next batch if queue not empty
    if (this.writeQueue.length > 0) {
      this.scheduleBatchProcessing();
    }
  }

  /**
   * Set batch processing callback
   */
  setBatchCallback(callback: (operations: WriteOperation[]) => Promise<void>): void {
    this.batchCallback = callback;
  }

  /**
   * Record write latency for metrics
   */
  private recordWriteLatency(latency: number): void {
    this.writeLatencies.push(latency);
    if (this.writeLatencies.length > this.maxLatencyHistory) {
      this.writeLatencies.shift();
    }
  }

  /**
   * Delay helper for throttling
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): {
    queueLength: number;
    pendingByType: Record<string, number>;
    pendingByPriority: Record<string, number>;
    estimatedProcessingTime: number;
  } {
    const pendingByType: Record<string, number> = {};
    const pendingByPriority: Record<string, number> = {};

    for (const op of this.writeQueue) {
      pendingByType[op.type] = (pendingByType[op.type] || 0) + 1;
      pendingByPriority[op.priority] = (pendingByPriority[op.priority] || 0) + 1;
    }

    const avgLatency = this.writeLatencies.length > 0
      ? this.writeLatencies.reduce((a, b) => a + b, 0) / this.writeLatencies.length
      : 50; // Default estimate

    const metrics = this.getResourceMetrics();
    const estimatedBatches = Math.ceil(this.writeQueue.length / metrics.optimization.recommendedBatchSize);
    const estimatedProcessingTime = estimatedBatches * avgLatency;

    return {
      queueLength: this.writeQueue.length,
      pendingByType,
      pendingByPriority,
      estimatedProcessingTime
    };
  }

  /**
   * Force flush all pending writes
   */
  async flushQueue(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    while (this.writeQueue.length > 0) {
      await this.processBatch();
    }

    logger.info('Write queue flushed');
  }

  /**
   * Update batch configuration
   */
  updateBatchConfig(config: Partial<BatchConfig>): void {
    this.batchConfig = { ...this.batchConfig, ...config };
    logger.info('Batch config updated:', this.batchConfig);
  }

  /**
   * Get optimization recommendations based on current load
   */
  getOptimizationRecommendations(): string[] {
    const metrics = this.getResourceMetrics();
    const recommendations: string[] = [];

    if (metrics.cpu.usage > 80) {
      recommendations.push('High CPU usage - consider reducing concurrent AI operations');
    }

    if (metrics.memory.usagePercent > 80) {
      recommendations.push('High memory usage - consider clearing old context caches');
    }

    if (metrics.disk.pendingWrites > 20) {
      recommendations.push('Large write queue - batching enabled for performance');
    }

    if (metrics.disk.avgWriteLatency > 100) {
      recommendations.push('High write latency - consider database optimization');
    }

    if (metrics.cpu.loadAverage[0] > metrics.cpu.cores) {
      recommendations.push('System overloaded - reducing parallel operations');
    }

    return recommendations;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.writeQueue = [];
    this.writeLatencies = [];
    logger.info('ResourceOptimizer cleaned up');
  }
}

export default ResourceOptimizer;
