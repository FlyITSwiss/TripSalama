<?php

declare(strict_types=1);

namespace TripSalama\Services;

/**
 * Service de détection automatique du pays et gestion des devises
 * Détecte France (EUR) et Maroc (MAD) via coordonnées GPS
 */
class CountryDetectionService
{
    /**
     * Pays supportés avec leurs coordonnées bounding box approximatives
     */
    private const COUNTRY_BOUNDS = [
        'FR' => [
            'min_lat' => 41.3,
            'max_lat' => 51.1,
            'min_lng' => -5.1,
            'max_lng' => 9.6,
        ],
        'MA' => [
            'min_lat' => 27.6,
            'max_lat' => 35.9,
            'min_lng' => -13.2,
            'max_lng' => -1.0,
        ],
    ];

    private ?string $detectedCountry = null;
    private ?array $countryConfig = null;

    /**
     * Détecter le pays à partir des coordonnées GPS
     */
    public function detectFromCoordinates(float $lat, float $lng): ?string
    {
        // Vérifier d'abord les bounding boxes
        foreach (self::COUNTRY_BOUNDS as $countryCode => $bounds) {
            if ($this->isInBounds($lat, $lng, $bounds)) {
                $this->detectedCountry = $countryCode;
                $this->countryConfig = config('countries.' . $countryCode);
                $this->storeInSession($countryCode);
                return $countryCode;
            }
        }

        // Si pas dans les bounds, utiliser Nominatim pour reverse geocoding
        $countryCode = $this->reverseGeocodeCountry($lat, $lng);

        if ($countryCode && $this->isSupported($countryCode)) {
            $this->detectedCountry = $countryCode;
            $this->countryConfig = config('countries.' . $countryCode);
            $this->storeInSession($countryCode);
            return $countryCode;
        }

        return null;
    }

    /**
     * Vérifier si les coordonnées sont dans les limites
     */
    private function isInBounds(float $lat, float $lng, array $bounds): bool
    {
        return $lat >= $bounds['min_lat']
            && $lat <= $bounds['max_lat']
            && $lng >= $bounds['min_lng']
            && $lng <= $bounds['max_lng'];
    }

    /**
     * Reverse geocoding via Nominatim (fallback)
     */
    private function reverseGeocodeCountry(float $lat, float $lng): ?string
    {
        $url = sprintf(
            'https://nominatim.openstreetmap.org/reverse?format=json&lat=%f&lon=%f&zoom=3&addressdetails=1',
            $lat,
            $lng
        );

        $context = stream_context_create([
            'http' => [
                'header' => "User-Agent: TripSalama/1.0\r\n",
                'timeout' => 5,
            ],
        ]);

        $response = @file_get_contents($url, false, $context);

        if ($response === false) {
            return null;
        }

        $data = json_decode($response, true);

        return $data['address']['country_code'] ?? null;
    }

    /**
     * Vérifier si un pays est supporté
     */
    public function isSupported(string $countryCode): bool
    {
        $countries = config('countries', []);
        return isset($countries[strtoupper($countryCode)]);
    }

    /**
     * Obtenir la configuration du pays actuel
     */
    public function getCurrentCountryConfig(): array
    {
        // Priorité : session > détecté > défaut
        $countryCode = $_SESSION['country'] ?? $this->detectedCountry ?? config('default_country', 'FR');
        $countries = config('countries', []);

        return $countries[$countryCode] ?? $countries[config('default_country', 'FR')] ?? [];
    }

    /**
     * Obtenir le code pays actuel
     */
    public function getCurrentCountryCode(): string
    {
        return $_SESSION['country'] ?? $this->detectedCountry ?? config('default_country', 'FR');
    }

    /**
     * Obtenir la devise actuelle
     */
    public function getCurrentCurrency(): string
    {
        $config = $this->getCurrentCountryConfig();
        return $config['currency'] ?? 'EUR';
    }

    /**
     * Obtenir le symbole de devise actuel
     */
    public function getCurrentCurrencySymbol(): string
    {
        $config = $this->getCurrentCountryConfig();
        return $config['currency_symbol'] ?? '€';
    }

    /**
     * Obtenir la configuration pricing du pays actuel
     */
    public function getCurrentPricing(): array
    {
        $config = $this->getCurrentCountryConfig();
        return $config['pricing'] ?? config('pricing', []);
    }

    /**
     * Formater un prix selon la devise du pays
     */
    public function formatPrice(float $amount): string
    {
        $config = $this->getCurrentCountryConfig();

        $decimalSep = $config['decimal_separator'] ?? ',';
        $thousandsSep = $config['thousands_separator'] ?? ' ';
        $symbol = $config['currency_symbol'] ?? '€';
        $position = $config['currency_position'] ?? 'after';

        $formatted = number_format($amount, 2, $decimalSep, $thousandsSep);

        if ($position === 'before') {
            return $symbol . ' ' . $formatted;
        }

        return $formatted . ' ' . $symbol;
    }

    /**
     * Définir manuellement le pays
     */
    public function setCountry(string $countryCode): bool
    {
        $countryCode = strtoupper($countryCode);

        if (!$this->isSupported($countryCode)) {
            return false;
        }

        $this->detectedCountry = $countryCode;
        $this->countryConfig = config('countries.' . $countryCode);
        $this->storeInSession($countryCode);

        return true;
    }

    /**
     * Stocker le pays en session
     */
    private function storeInSession(string $countryCode): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            $_SESSION['country'] = strtoupper($countryCode);
        }
    }

    /**
     * Obtenir tous les pays supportés
     */
    public function getSupportedCountries(): array
    {
        $countries = config('countries', []);
        $result = [];

        foreach ($countries as $code => $config) {
            $result[$code] = [
                'code' => $code,
                'name' => $config['name'],
                'currency' => $config['currency'],
                'currency_symbol' => $config['currency_symbol'],
            ];
        }

        return $result;
    }

    /**
     * Obtenir la timezone du pays actuel
     */
    public function getCurrentTimezone(): string
    {
        $config = $this->getCurrentCountryConfig();
        return $config['timezone'] ?? 'Europe/Paris';
    }
}
