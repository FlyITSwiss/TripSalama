<?php

declare(strict_types=1);

namespace TripSalama\Services;

use TripSalama\Helpers\PathHelper;

class LoggingService
{
    private static ?self $instance = null;
    private string $logsPath;
    private string $requestId;
    private ?int $userId;
    private array $metrics = [];
    private float $startTime;
    
    public const LEVEL_DEBUG = "debug";
    public const LEVEL_INFO = "info";
    public const LEVEL_WARNING = "warning";
    public const LEVEL_ERROR = "error";
    public const LEVEL_CRITICAL = "critical";

    private function __construct()
    {
        $this->logsPath = PathHelper::getLogsPath();
        $this->requestId = $this->generateRequestId();
        $this->userId = null;
        $this->startTime = microtime(true);
        if (!is_dir($this->logsPath)) {
            mkdir($this->logsPath, 0755, true);
        }
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function setUserId(?int $userId): void
    {
        $this->userId = $userId;
    }

    public function getRequestId(): string
    {
        return $this->requestId;
    }

    public function debug(string $message, array $context = []): void
    {
        $this->log(self::LEVEL_DEBUG, $message, $context);
    }

    public function info(string $message, array $context = []): void
    {
        $this->log(self::LEVEL_INFO, $message, $context);
    }

    public function warning(string $message, array $context = []): void
    {
        $this->log(self::LEVEL_WARNING, $message, $context);
    }

    public function error(string $message, array $context = []): void
    {
        $this->log(self::LEVEL_ERROR, $message, $context, "error");
    }

    public function critical(string $message, array $context = []): void
    {
        $this->log(self::LEVEL_CRITICAL, $message, $context, "error");
    }

    public function security(string $message, array $context = []): void
    {
        $this->log(self::LEVEL_WARNING, $message, $context, "security");
    }

    public function access(string $endpoint, string $method, int $statusCode, float $duration): void
    {
        $entry = [
            "timestamp" => date("Y-m-d H:i:s"),
            "request_id" => $this->requestId,
            "user_id" => $this->userId,
            "method" => $method,
            "endpoint" => $endpoint,
            "status" => $statusCode,
            "duration_ms" => round($duration * 1000, 2),
            "ip" => $this->getClientIp(),
            "user_agent" => $_SERVER["HTTP_USER_AGENT"] ?? "unknown",
        ];
        $this->writeLog("access", json_encode($entry));
    }

    public function startMetric(string $name): void
    {
        $this->metrics[$name] = ["start" => microtime(true)];
    }

    public function endMetric(string $name, array $context = []): float
    {
        if (!isset($this->metrics[$name])) {
            return 0;
        }
        $duration = microtime(true) - $this->metrics[$name]["start"];
        $entry = [
            "timestamp" => date("Y-m-d H:i:s"),
            "request_id" => $this->requestId,
            "metric" => $name,
            "duration_ms" => round($duration * 1000, 2),
            "context" => $context,
        ];
        $this->writeLog("performance", json_encode($entry));
        unset($this->metrics[$name]);
        return $duration;
    }

    public function recordMetric(string $name, float $value, string $unit = "ms"): void
    {
        $entry = [
            "timestamp" => date("Y-m-d H:i:s"),
            "request_id" => $this->requestId,
            "metric" => $name,
            "value" => $value,
            "unit" => $unit,
        ];
        $this->writeLog("performance", json_encode($entry));
    }

    public function logException(\Throwable $e, array $context = []): void
    {
        $errorContext = array_merge($context, [
            "exception" => get_class($e),
            "message" => $e->getMessage(),
            "code" => $e->getCode(),
            "file" => $e->getFile(),
            "line" => $e->getLine(),
            "trace" => $e->getTraceAsString(),
        ]);
        $this->critical("Exception: " . $e->getMessage(), $errorContext);
    }

    public function rotateLogs(int $maxDays = 30): int
    {
        $deleted = 0;
        $cutoff = strtotime("-{$maxDays} days");
        $files = glob($this->logsPath . "/*.log");
        foreach ($files as $file) {
            if (filemtime($file) < $cutoff) {
                unlink($file);
                $deleted++;
            }
        }
        $this->info("Log rotation completed", ["deleted_files" => $deleted]);
        return $deleted;
    }

    public function getStats(?string $date = null): array
    {
        $date = $date ?? date("Y-m-d");
        $stats = ["date" => $date, "errors" => 0, "warnings" => 0, "requests" => 0, "avg_response_ms" => 0];
        
        $errorFile = $this->logsPath . "/error-" . $date . ".log";
        if (file_exists($errorFile)) {
            $stats["errors"] = count(file($errorFile));
        }
        
        $accessFile = $this->logsPath . "/access-" . $date . ".log";
        if (file_exists($accessFile)) {
            $lines = file($accessFile);
            $stats["requests"] = count($lines);
            $totalDuration = 0;
            foreach ($lines as $line) {
                $data = json_decode($line, true);
                if (isset($data["duration_ms"])) {
                    $totalDuration += $data["duration_ms"];
                }
            }
            if ($stats["requests"] > 0) {
                $stats["avg_response_ms"] = round($totalDuration / $stats["requests"], 2);
            }
        }
        return $stats;
    }

    public function healthCheck(): array
    {
        return [
            "status" => "healthy",
            "timestamp" => date("c"),
            "request_id" => $this->requestId,
            "uptime_ms" => round((microtime(true) - $this->startTime) * 1000, 2),
            "logs_writable" => is_writable($this->logsPath),
            "php_version" => PHP_VERSION,
            "memory_usage_mb" => round(memory_get_usage(true) / 1024 / 1024, 2),
            "peak_memory_mb" => round(memory_get_peak_usage(true) / 1024 / 1024, 2),
        ];
    }

    private function log(string $level, string $message, array $context = [], string $logType = "app"): void
    {
        if ($level === self::LEVEL_DEBUG && ($_ENV["APP_DEBUG"] ?? "false") !== "true") {
            return;
        }
        $entry = [
            "timestamp" => date("Y-m-d H:i:s"),
            "level" => strtoupper($level),
            "request_id" => $this->requestId,
            "user_id" => $this->userId,
            "message" => $message,
        ];
        if (!empty($context)) {
            $entry["context"] = $context;
        }
        $this->writeLog($logType, json_encode($entry));
    }

    private function writeLog(string $type, string $content): void
    {
        $filename = $this->logsPath . "/" . $type . "-" . date("Y-m-d") . ".log";
        file_put_contents($filename, $content . "\n", FILE_APPEND | LOCK_EX);
    }

    private function generateRequestId(): string
    {
        return substr(bin2hex(random_bytes(8)), 0, 16);
    }

    private function getClientIp(): string
    {
        $headers = ["HTTP_CF_CONNECTING_IP", "HTTP_X_FORWARDED_FOR", "HTTP_X_REAL_IP", "REMOTE_ADDR"];
        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ip = explode(",", $_SERVER[$header])[0];
                return trim($ip);
            }
        }
        return "unknown";
    }
}
