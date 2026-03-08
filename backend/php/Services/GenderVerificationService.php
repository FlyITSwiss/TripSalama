<?php

declare(strict_types=1);

namespace TripSalama\Services;

/**
 * Service de vérification du genre par IA
 * Utilise l'API Anthropic Claude Vision pour analyser les photos de visage
 * et déterminer si la personne est une femme
 *
 * @package TripSalama\Services
 */
class GenderVerificationService
{
    private const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
    private const MODEL = 'claude-sonnet-4-20250514';
    private const MAX_TOKENS = 1024;

    private ?string $apiKey;
    private LoggingService $logger;

    public function __construct()
    {
        $this->apiKey = $_ENV['ANTHROPIC_API_KEY'] ?? null;
        $this->logger = LoggingService::getInstance();
    }

    /**
     * Analyser une photo de visage pour déterminer le genre
     *
     * @param string $base64Image Image encodée en base64
     * @return array Résultat avec: success, is_female, confidence, can_proceed, message
     */
    public function analyzeGender(string $base64Image): array
    {
        if (empty($this->apiKey)) {
            $this->logger->warning('GenderVerificationService: API key not configured');
            return $this->getErrorResult(__('verification.ai_unavailable'));
        }

        try {
            $imageData = $this->extractBase64Data($base64Image);
            if ($imageData === null) {
                return $this->getErrorResult(__('verification.invalid_image'));
            }

            $mediaType = $this->getMediaType($base64Image);
            $prompt = $this->buildGenderAnalysisPrompt();

            $response = $this->callAnthropicAPI($imageData, $mediaType, $prompt);

            if ($response === null) {
                return $this->getErrorResult(__('verification.ai_error'));
            }

            return $this->parseGenderResponse($response);

        } catch (\Exception $e) {
            $this->logger->error('GenderVerificationService error: ' . $e->getMessage());
            return $this->getErrorResult(__('verification.ai_error'));
        }
    }

    /**
     * Construire le prompt d'analyse de genre
     */
    private function buildGenderAnalysisPrompt(): string
    {
        return <<<PROMPT
Analyse cette photo pour déterminer si la personne visible est une femme.

IMPORTANT: Tu dois répondre UNIQUEMENT en JSON valide, sans aucun texte avant ou après.

Critères d'analyse:
1. Est-ce une photo d'une personne réelle (pas un dessin, une photo d'écran, ou une manipulation) ?
2. Le visage est-il clairement visible ?
3. La personne sur la photo est-elle une femme adulte ?
4. Y a-t-il des signes de manipulation ou de fraude ?

Réponds EXACTEMENT dans ce format JSON:
{
    "is_real_person": true/false,
    "is_female": true/false,
    "is_adult": true/false,
    "confidence": 0.0-1.0,
    "face_visible": true/false,
    "potential_fraud": true/false,
    "fraud_indicators": [],
    "reason": "courte explication en français"
}
PROMPT;
    }

    /**
     * Parser la réponse de l'IA pour l'analyse de genre
     */
    private function parseGenderResponse(array $response): array
    {
        $content = $response['content'][0]['text'] ?? '';

        $jsonStart = strpos($content, '{');
        $jsonEnd = strrpos($content, '}');

        if ($jsonStart === false || $jsonEnd === false) {
            $this->logger->warning('AI response does not contain valid JSON: ' . $content);
            return $this->getErrorResult(__('verification.ai_parse_error'));
        }

        $jsonStr = substr($content, $jsonStart, $jsonEnd - $jsonStart + 1);
        $analysis = json_decode($jsonStr, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->logger->warning('Failed to parse AI JSON response: ' . $jsonStr);
            return $this->getErrorResult(__('verification.ai_parse_error'));
        }

        $isRealPerson = $analysis['is_real_person'] ?? false;
        $isFemale = $analysis['is_female'] ?? false;
        $isAdult = $analysis['is_adult'] ?? false;
        $confidence = (float)($analysis['confidence'] ?? 0);
        $faceVisible = $analysis['face_visible'] ?? false;
        $potentialFraud = $analysis['potential_fraud'] ?? false;

        // Déterminer si la personne peut procéder
        $canProceed = $isRealPerson
            && $isFemale
            && $isAdult
            && $faceVisible
            && !$potentialFraud
            && $confidence >= 0.75;

        // Message personnalisé selon le résultat
        $message = $this->buildResultMessage($analysis, $canProceed);

        return [
            'success' => true,
            'is_female' => $isFemale,
            'is_real_person' => $isRealPerson,
            'is_adult' => $isAdult,
            'confidence' => $confidence,
            'face_visible' => $faceVisible,
            'potential_fraud' => $potentialFraud,
            'can_proceed' => $canProceed,
            'reason' => $analysis['reason'] ?? '',
            'message' => $message,
            'analysis_source' => 'anthropic_claude'
        ];
    }

    /**
     * Construire un message de résultat personnalisé
     */
    private function buildResultMessage(array $analysis, bool $canProceed): string
    {
        if ($canProceed) {
            return __('verification.gender_verified_female');
        }

        if (!($analysis['is_real_person'] ?? true)) {
            return __('verification.not_real_person');
        }

        if (!($analysis['face_visible'] ?? true)) {
            return __('verification.face_not_visible');
        }

        if ($analysis['potential_fraud'] ?? false) {
            return __('verification.fraud_detected');
        }

        if (!($analysis['is_female'] ?? false)) {
            return __('verification.men_not_allowed');
        }

        if (!($analysis['is_adult'] ?? true)) {
            return __('verification.must_be_adult');
        }

        if (($analysis['confidence'] ?? 0) < 0.75) {
            return __('verification.low_confidence');
        }

        return __('verification.verification_failed');
    }

    /**
     * Extraire les données base64 pures
     */
    private function extractBase64Data(string $base64Image): ?string
    {
        if (strpos($base64Image, 'data:image') === 0) {
            $parts = explode(',', $base64Image);
            if (count($parts) !== 2) {
                return null;
            }
            return $parts[1];
        }
        return $base64Image;
    }

    /**
     * Déterminer le type MIME de l'image
     */
    private function getMediaType(string $base64Image): string
    {
        if (preg_match('/data:image\/(\w+);base64/', $base64Image, $matches)) {
            $type = strtolower($matches[1]);
            return match ($type) {
                'jpeg', 'jpg' => 'image/jpeg',
                'png' => 'image/png',
                'gif' => 'image/gif',
                'webp' => 'image/webp',
                default => 'image/jpeg'
            };
        }
        return 'image/jpeg';
    }

    /**
     * Appeler l'API Anthropic Claude Vision
     */
    private function callAnthropicAPI(string $imageData, string $mediaType, string $prompt): ?array
    {
        $payload = [
            'model' => self::MODEL,
            'max_tokens' => self::MAX_TOKENS,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'image',
                            'source' => [
                                'type' => 'base64',
                                'media_type' => $mediaType,
                                'data' => $imageData
                            ]
                        ],
                        [
                            'type' => 'text',
                            'text' => $prompt
                        ]
                    ]
                ]
            ]
        ];

        $ch = curl_init(self::ANTHROPIC_API_URL);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'x-api-key: ' . $this->apiKey,
                'anthropic-version: 2023-06-01'
            ],
            CURLOPT_POSTFIELDS => json_encode($payload)
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            $this->logger->error('Anthropic API curl error: ' . $error);
            return null;
        }

        if ($httpCode !== 200) {
            $this->logger->error('Anthropic API HTTP error: ' . $httpCode . ' - ' . $response);
            return null;
        }

        $decoded = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->logger->error('Anthropic API JSON decode error: ' . json_last_error_msg());
            return null;
        }

        return $decoded;
    }

    /**
     * Résultat d'erreur
     */
    private function getErrorResult(string $message): array
    {
        return [
            'success' => false,
            'is_female' => null,
            'is_real_person' => null,
            'confidence' => 0.0,
            'can_proceed' => false,
            'message' => $message,
            'analysis_source' => 'error'
        ];
    }

    /**
     * Vérifier si le service IA est configuré
     */
    public function isConfigured(): bool
    {
        return !empty($this->apiKey);
    }
}
