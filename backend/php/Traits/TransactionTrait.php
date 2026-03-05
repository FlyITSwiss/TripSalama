<?php

declare(strict_types=1);

namespace TripSalama\Traits;

use PDO;

/**
 * Trait for database transaction management
 *
 * Provides consistent transaction handling across Services and Models
 * with automatic rollback on exceptions.
 *
 * Usage:
 *
 *     use TripSalama\Traits\TransactionTrait;
 *
 *     class MyService {
 *         use TransactionTrait;
 *
 *         private PDO $db;
 *
 *         public function doSomethingCritical(): array {
 *             return $this->transaction($this->db, function() {
 *                 // Multiple database operations here
 *                 $this->model->insert($data);
 *                 $this->otherModel->update($id, $data);
 *                 return ['success' => true];
 *             });
 *         }
 *     }
 */
trait TransactionTrait
{
    /**
     * Execute a callback within a database transaction
     *
     * @param PDO $db Database connection
     * @param callable $callback The operations to execute within the transaction
     * @return mixed The return value of the callback
     * @throws \Throwable Re-throws any exception after rollback
     */
    protected function transaction(PDO $db, callable $callback): mixed
    {
        // Check if we're already in a transaction (nested call)
        $isNested = $db->inTransaction();

        if (!$isNested) {
            $db->beginTransaction();
        }

        try {
            $result = $callback();

            if (!$isNested) {
                $db->commit();
            }

            return $result;
        } catch (\Throwable $e) {
            if (!$isNested && $db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Execute multiple callbacks as a single atomic transaction
     *
     * All callbacks must succeed, or all will be rolled back.
     *
     * @param PDO $db Database connection
     * @param array<callable> $callbacks Array of callbacks to execute
     * @return array<mixed> Array of results from each callback
     * @throws \Throwable Re-throws any exception after rollback
     */
    protected function atomicBatch(PDO $db, array $callbacks): array
    {
        return $this->transaction($db, function () use ($callbacks) {
            $results = [];
            foreach ($callbacks as $key => $callback) {
                $results[$key] = $callback();
            }
            return $results;
        });
    }

    /**
     * Execute a callback with automatic savepoint for partial rollback
     *
     * Allows rolling back to a savepoint without affecting the outer transaction.
     * Useful for optional operations that can fail without failing the whole transaction.
     *
     * @param PDO $db Database connection
     * @param string $savepoint Savepoint name
     * @param callable $callback The operations to execute
     * @param mixed $defaultOnError Value to return if savepoint rollback occurs
     * @return mixed The return value of the callback or $defaultOnError
     */
    protected function withSavepoint(
        PDO $db,
        string $savepoint,
        callable $callback,
        mixed $defaultOnError = null
    ): mixed {
        if (!$db->inTransaction()) {
            // Not in transaction, start one
            return $this->transaction($db, $callback);
        }

        // Create savepoint
        $db->exec("SAVEPOINT {$savepoint}");

        try {
            $result = $callback();
            $db->exec("RELEASE SAVEPOINT {$savepoint}");
            return $result;
        } catch (\Throwable $e) {
            $db->exec("ROLLBACK TO SAVEPOINT {$savepoint}");

            // Log the error but don't throw
            if (function_exists('app_log')) {
                app_log('warning', "Savepoint {$savepoint} rolled back: " . $e->getMessage());
            }

            return $defaultOnError;
        }
    }

    /**
     * Execute a callback with retry logic for transient failures
     *
     * Useful for handling deadlocks or lock wait timeouts.
     *
     * @param PDO $db Database connection
     * @param callable $callback The operations to execute
     * @param int $maxRetries Maximum number of retry attempts
     * @param int $retryDelayMs Delay between retries in milliseconds
     * @return mixed The return value of the callback
     * @throws \Throwable After all retries are exhausted
     */
    protected function transactionWithRetry(
        PDO $db,
        callable $callback,
        int $maxRetries = 3,
        int $retryDelayMs = 100
    ): mixed {
        $lastException = null;

        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            try {
                return $this->transaction($db, $callback);
            } catch (\PDOException $e) {
                $lastException = $e;

                // Check if it's a retryable error (deadlock or lock wait timeout)
                $isRetryable = (
                    str_contains($e->getMessage(), 'Deadlock') ||
                    str_contains($e->getMessage(), 'Lock wait timeout') ||
                    $e->getCode() === '40001' || // Serialization failure
                    $e->getCode() === '40P01'    // Deadlock detected
                );

                if (!$isRetryable || $attempt === $maxRetries) {
                    throw $e;
                }

                // Exponential backoff
                usleep($retryDelayMs * 1000 * $attempt);
            }
        }

        throw $lastException;
    }
}
