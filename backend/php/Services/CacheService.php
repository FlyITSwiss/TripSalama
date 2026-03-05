<?php

declare(strict_types=1);

namespace TripSalama\Services;

/**
 * Service de cache utilisant Redis
 *
 * Fallback vers APCu ou fichiers si Redis n'est pas disponible.
 * Usage:
 *   $cache = new CacheService();
 *   $cache->set('key', $value, 3600); // TTL en secondes
 *   $value = $cache->get('key');
 *   $cache->delete('key');
 *   $cache->clear();
 */
class CacheService
{
    private const DEFAULT_TTL = 3600; // 1 heure
    private const CACHE_PREFIX = 'tripsalama:';

    private ?\Redis $redis = null;
    private string $driver = 'none';
    private string $fileCachePath;

    public function __construct()
    {
        $this->fileCachePath = defined('STORAGE_PATH')
            ? STORAGE_PATH . '/cache'
            : sys_get_temp_dir() . '/tripsalama_cache';

        $this->initializeDriver();
    }

    /**
     * Initialiser le driver de cache
     */
    private function initializeDriver(): void
    {
        // Essayer Redis en premier
        if ($this->initRedis()) {
            $this->driver = 'redis';
            return;
        }

        // Fallback vers APCu
        if (function_exists('apcu_enabled') && apcu_enabled()) {
            $this->driver = 'apcu';
            return;
        }

        // Fallback vers fichiers
        $this->driver = 'file';
        if (!is_dir($this->fileCachePath)) {
            mkdir($this->fileCachePath, 0755, true);
        }
    }

    /**
     * Initialiser Redis
     */
    private function initRedis(): bool
    {
        if (!extension_loaded('redis')) {
            return false;
        }

        try {
            $host = config('redis_host', '127.0.0.1');
            $port = (int) config('redis_port', 6379);
            $password = config('redis_password', null);
            $database = (int) config('redis_database', 0);

            $this->redis = new \Redis();
            $this->redis->connect($host, $port, 2.0); // 2 sec timeout

            if ($password) {
                $this->redis->auth($password);
            }

            $this->redis->select($database);
            $this->redis->ping();

            return true;
        } catch (\Exception $e) {
            $this->redis = null;
            return false;
        }
    }

    /**
     * Obtenir le driver actif
     */
    public function getDriver(): string
    {
        return $this->driver;
    }

    /**
     * Recuperer une valeur du cache
     */
    public function get(string $key, mixed $default = null): mixed
    {
        $prefixedKey = self::CACHE_PREFIX . $key;

        switch ($this->driver) {
            case 'redis':
                $value = $this->redis->get($prefixedKey);
                if ($value === false) {
                    return $default;
                }
                return $this->unserialize($value);

            case 'apcu':
                $success = false;
                $value = apcu_fetch($prefixedKey, $success);
                return $success ? $value : $default;

            case 'file':
                return $this->getFromFile($key, $default);

            default:
                return $default;
        }
    }

    /**
     * Stocker une valeur dans le cache
     */
    public function set(string $key, mixed $value, int $ttl = self::DEFAULT_TTL): bool
    {
        $prefixedKey = self::CACHE_PREFIX . $key;

        switch ($this->driver) {
            case 'redis':
                $serialized = $this->serialize($value);
                return $this->redis->setex($prefixedKey, $ttl, $serialized);

            case 'apcu':
                return apcu_store($prefixedKey, $value, $ttl);

            case 'file':
                return $this->setToFile($key, $value, $ttl);

            default:
                return false;
        }
    }

    /**
     * Supprimer une cle du cache
     */
    public function delete(string $key): bool
    {
        $prefixedKey = self::CACHE_PREFIX . $key;

        switch ($this->driver) {
            case 'redis':
                return $this->redis->del($prefixedKey) > 0;

            case 'apcu':
                return apcu_delete($prefixedKey);

            case 'file':
                return $this->deleteFile($key);

            default:
                return false;
        }
    }

    /**
     * Verifier si une cle existe
     */
    public function has(string $key): bool
    {
        $prefixedKey = self::CACHE_PREFIX . $key;

        switch ($this->driver) {
            case 'redis':
                return $this->redis->exists($prefixedKey) > 0;

            case 'apcu':
                return apcu_exists($prefixedKey);

            case 'file':
                return $this->get($key) !== null;

            default:
                return false;
        }
    }

    /**
     * Vider tout le cache
     */
    public function clear(): bool
    {
        switch ($this->driver) {
            case 'redis':
                $keys = $this->redis->keys(self::CACHE_PREFIX . '*');
                if (!empty($keys)) {
                    $this->redis->del(...$keys);
                }
                return true;

            case 'apcu':
                return apcu_clear_cache();

            case 'file':
                return $this->clearFileCache();

            default:
                return false;
        }
    }

    /**
     * Get or set (cache-aside pattern)
     */
    public function remember(string $key, int $ttl, callable $callback): mixed
    {
        $value = $this->get($key);

        if ($value !== null) {
            return $value;
        }

        $value = $callback();
        $this->set($key, $value, $ttl);

        return $value;
    }

    /**
     * Incrementer une valeur
     */
    public function increment(string $key, int $value = 1): int|false
    {
        $prefixedKey = self::CACHE_PREFIX . $key;

        switch ($this->driver) {
            case 'redis':
                return $this->redis->incrBy($prefixedKey, $value);

            case 'apcu':
                return apcu_inc($prefixedKey, $value);

            default:
                $current = (int) $this->get($key, 0);
                $new = $current + $value;
                $this->set($key, $new);
                return $new;
        }
    }

    /**
     * Tags pour invalidation groupee (Redis uniquement)
     */
    public function setWithTags(string $key, mixed $value, array $tags, int $ttl = self::DEFAULT_TTL): bool
    {
        $result = $this->set($key, $value, $ttl);

        if ($this->driver === 'redis' && $result) {
            foreach ($tags as $tag) {
                $tagKey = self::CACHE_PREFIX . 'tag:' . $tag;
                $this->redis->sAdd($tagKey, $key);
                $this->redis->expire($tagKey, $ttl + 3600); // Tag expire apres les cles
            }
        }

        return $result;
    }

    /**
     * Invalider toutes les cles d'un tag
     */
    public function invalidateTag(string $tag): int
    {
        if ($this->driver !== 'redis') {
            return 0;
        }

        $tagKey = self::CACHE_PREFIX . 'tag:' . $tag;
        $keys = $this->redis->sMembers($tagKey);
        $count = 0;

        foreach ($keys as $key) {
            if ($this->delete($key)) {
                $count++;
            }
        }

        $this->redis->del($tagKey);
        return $count;
    }

    // ============================================
    // HELPERS INTERNES
    // ============================================

    private function serialize(mixed $value): string
    {
        return serialize($value);
    }

    private function unserialize(string $value): mixed
    {
        return unserialize($value);
    }

    private function getCacheFilePath(string $key): string
    {
        $hash = md5($key);
        return $this->fileCachePath . '/' . $hash . '.cache';
    }

    private function getFromFile(string $key, mixed $default): mixed
    {
        $path = $this->getCacheFilePath($key);

        if (!file_exists($path)) {
            return $default;
        }

        $content = file_get_contents($path);
        if ($content === false) {
            return $default;
        }

        $data = unserialize($content);
        if (!is_array($data) || !isset($data['expires'], $data['value'])) {
            return $default;
        }

        if ($data['expires'] !== 0 && $data['expires'] < time()) {
            unlink($path);
            return $default;
        }

        return $data['value'];
    }

    private function setToFile(string $key, mixed $value, int $ttl): bool
    {
        $path = $this->getCacheFilePath($key);
        $data = [
            'expires' => $ttl > 0 ? time() + $ttl : 0,
            'value' => $value
        ];

        return file_put_contents($path, serialize($data), LOCK_EX) !== false;
    }

    private function deleteFile(string $key): bool
    {
        $path = $this->getCacheFilePath($key);
        if (file_exists($path)) {
            return unlink($path);
        }
        return true;
    }

    private function clearFileCache(): bool
    {
        if (!is_dir($this->fileCachePath)) {
            return true;
        }

        $files = glob($this->fileCachePath . '/*.cache');
        foreach ($files as $file) {
            unlink($file);
        }

        return true;
    }
}
