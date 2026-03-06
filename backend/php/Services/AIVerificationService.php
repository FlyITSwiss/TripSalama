<?php

declare(strict_types=1);

namespace TripSalama\Services;

use TripSalama\Helpers\PathHelper;

/**
 * Service de vérification d'identité par IA
 * Utilise l'API Anthropic Claude Vision pour analyser les photos en temps réel
 *
 * @package TripSalama\Services
 */
class AIVerificationService
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
     * Analyser une image pour vérifier l'identité
     *
     * @param string $base64Image Image encodée en base64 (avec ou sans préfixe data:image)
     * @return array Résultat de l'analyse avec clés: success, is_female, confidence, is_real_person, analysis_details
     */
    public function analyzeIdentityPhoto(string $base64Image): array
    {
        // Vérifier si l'API est configurée
        if (empty($this->apiKey)) {
            $this->logger->warning('AIVerificationService: API key not configured, using fallback mode');
            return $this->getFallbackResult();
        }

        try {
            // Extraire les données base64 pures
            $imageData = $this->extractBase64Data($base64Image);
            if ($imageData === null) {
                return $this->getErrorResult(__('verification.invalid_image'));
            }

            // Déterminer le type MIME
            $mediaType = $this->getMediaType($base64Image);

            // Construire le prompt d'analyse
            $prompt = $this->buildAnalysisPrompt();

            // Appeler l'API Anthropic
            $response = $this->callAnthropicAPI($imageData, $mediaType, $prompt);

            if ($response === null) {
                return $this->getFallbackResult();
            }

            // Parser la réponse de l'IA
            return $this->parseAIResponse($response);

        } catch (\Exception $e) {
            $this->logger->error('AIVerificationService error: ' . $e->getMessage());
            return $this->getFallbackResult();
        }
    }

    /**
     * Analyse en temps réel (streaming) - retourne des mises à jour progressives
     *
     * @param string $base64Image Image encodée en base64
     * @param callable $onProgress Callback appelé avec les mises à jour
     * @return array Résultat final de l'analyse
     */
    public function analyzeWithProgress(string $base64Image, callable $onProgress): array
    {
        // Étape 1: Validation de l'image
        $onProgress(['step' => 1, 'message' => __('verification.step_validating'), 'progress' => 10]);

        $imageData = $this->extractBase64Data($base64Image);
        if ($imageData === null) {
            return $this->getErrorResult(__('verification.invalid_image'));
        }

        // Étape 2: Préparation de l'analyse
        $onProgress(['step' => 2, 'message' => __('verification.step_preparing'), 'progress' => 25]);

        if (empty($this->apiKey)) {
            $onProgress(['step' => 3, 'message' => __('verification.step_analyzing'), 'progress' => 50]);
            usleep(500000); // Simulation 0.5s
            $onProgress(['step' => 4, 'message' => __('verification.step_verifying'), 'progress' => 75]);
            usleep(500000);
            $onProgress(['step' => 5, 'message' => __('verification.step_complete'), 'progress' => 100]);
            return $this->getFallbackResult();
        }

        // Étape 3: Analyse IA
        $onProgress(['step' => 3, 'message' => __('verification.step_analyzing'), 'progress' => 40]);

        $mediaType = $this->getMediaType($base64Image);
        $prompt = $this->buildAnalysisPrompt();

        // Étape 4: Appel API
        $onProgress(['step' => 4, 'message' => __('verification.step_verifying'), 'progress' => 60]);

        $response = $this->callAnthropicAPI($imageData, $mediaType, $prompt);

        // Étape 5: Traitement du résultat
        $onProgress(['step' => 5, 'message' => __('verification.step_processing'), 'progress' => 85]);

        if ($response === null) {
            $onProgress(['step' => 6, 'message' => __('verification.step_complete'), 'progress' => 100]);
            return $this->getFallbackResult();
        }

        $result = $this->parseAIResponse($response);

        // Étape finale
        $onProgress(['step' => 6, 'message' => __('verification.step_complete'), 'progress' => 100]);

        return $result;
    }

    /**
     * Extraire les données base64 pures (sans préfixe data:image)
     */
    private function extractBase64Data(string $base64Image): ?string
    {
        // Si l'image contient le préfixe data:image
        if (strpos($base64Image, 'data:image') === 0) {
            $parts = explode(',', $base64Image);
            if (count($parts) !== 2) {
                return null;
            }
            return $parts[1];
        }

        // Sinon c'est déjà du base64 pur
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
     * Construire le prompt d'analyse pour Claude
     */
    private function buildAnalysisPrompt(): string
    {
        return <<<PROMPT
Analyse cette photo d'identité pour vérifier si elle montre une personne réelle de sexe féminin.

IMPORTANT: Tu dois répondre UNIQUEMENT en JSON valide, sans aucun texte avant ou après.

Critères d'analyse:
1. Est-ce une photo d'une personne réelle (pas un dessin, une photo d'écran, une image imprimée, ou une manipulation) ?
2. Le visage est-il clairement visible et bien éclairé ?
3. La personne sur la photo est-elle de sexe féminin ?
4. Y a-t-il des signes de manipulation ou de fraude ?

Réponds EXACTEMENT dans ce format JSON:
{
    "is_real_person": true/false,
    "is_female": true/false,
    "confidence": 0.0-1.0,
    "face_visible": true/false,
    "good_lighting": true/false,
    "potential_fraud": true/false,
    "fraud_indicators": [],
    "recommendation": "approve" | "manual_review" | "reject",
    "reason": "courte explication"
}
PROMPT;
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
     * Parser la réponse de l'IA
     */
    private function parseAIResponse(array $response): array
    {
        // Extraire le texte de la réponse
        $content = $response['content'][0]['text'] ?? '';

        // Tenter de parser le JSON
        $jsonStart = strpos($content, '{');
        $jsonEnd = strrpos($content, '}');

        if ($jsonStart === false || $jsonEnd === false) {
            $this->logger->warning('AI response does not contain valid JSON: ' . $content);
            return $this->getFallbackResult();
        }

        $jsonStr = substr($content, $jsonStart, $jsonEnd - $jsonStart + 1);
        $analysis = json_decode($jsonStr, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->logger->warning('Failed to parse AI JSON response: ' . $jsonStr);
            return $this->getFallbackResult();
        }

        // Construire le résultat standardisé
        $isApproved = ($analysis['recommendation'] ?? '') === 'approve'
            && ($analysis['is_female'] ?? false) === true
            && ($analysis['is_real_person'] ?? false) === true
            && ($analysis['confidence'] ?? 0) >= 0.75;

        $needsManualReview = ($analysis['recommendation'] ?? '') === 'manual_review'
            || ($analysis['potential_fraud'] ?? false) === true
            || ($analysis['confidence'] ?? 0) < 0.75;

        return [
            'success' => true,
            'is_female' => $analysis['is_female'] ?? false,
            'is_real_person' => $analysis['is_real_person'] ?? false,
            'confidence' => (float)($analysis['confidence'] ?? 0),
            'face_visible' => $analysis['face_visible'] ?? false,
            'good_lighting' => $analysis['good_lighting'] ?? false,
            'potential_fraud' => $analysis['potential_fraud'] ?? false,
            'fraud_indicators' => $analysis['fraud_indicators'] ?? [],
            'recommendation' => $isApproved ? 'approve' : ($needsManualReview ? 'manual_review' : 'reject'),
            'reason' => $analysis['reason'] ?? '',
            'auto_approved' => $isApproved,
            'needs_manual_review' => $needsManualReview,
            'analysis_source' => 'anthropic_claude'
        ];
    }

    /**
     * Résultat de fallback quand l'API n'est pas disponible
     */
    private function getFallbackResult(): array
    {
        return [
            'success' => true,
            'is_female' => null,
            'is_real_person' => null,
            'confidence' => 0.0,
            'face_visible' => null,
            'good_lighting' => null,
            'potential_fraud' => false,
            'fraud_indicators' => [],
            'recommendation' => 'manual_review',
            'reason' => __('verification.manual_review_required'),
            'auto_approved' => false,
            'needs_manual_review' => true,
            'analysis_source' => 'fallback'
        ];
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
            'recommendation' => 'reject',
            'reason' => $message,
            'auto_approved' => false,
            'needs_manual_review' => false,
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
