<?php

declare(strict_types=1);

namespace TripSalama\Services;

/**
 * Service OCR pour cartes d'identité
 * Utilise l'API Anthropic Claude Vision pour extraire les informations
 * des cartes d'identité (nom, prénom, date de naissance, etc.)
 *
 * @package TripSalama\Services
 */
class IDCardOCRService
{
    private const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
    private const MODEL = 'claude-sonnet-4-20250514';
    private const MAX_TOKENS = 2048;

    private ?string $apiKey;
    private LoggingService $logger;

    public function __construct()
    {
        $this->apiKey = $_ENV['ANTHROPIC_API_KEY'] ?? null;
        $this->logger = LoggingService::getInstance();
    }

    /**
     * Extraire les informations d'une carte d'identité
     *
     * @param string $base64Image Image de la carte d'identité en base64
     * @return array Données extraites: success, data (first_name, last_name, birth_date, etc.)
     */
    public function extractIDData(string $base64Image): array
    {
        if (empty($this->apiKey)) {
            $this->logger->warning('IDCardOCRService: API key not configured');
            return $this->getErrorResult(__('verification.ai_unavailable'));
        }

        try {
            $imageData = $this->extractBase64Data($base64Image);
            if ($imageData === null) {
                return $this->getErrorResult(__('verification.invalid_image'));
            }

            $mediaType = $this->getMediaType($base64Image);
            $prompt = $this->buildOCRPrompt();

            $response = $this->callAnthropicAPI($imageData, $mediaType, $prompt);

            if ($response === null) {
                return $this->getErrorResult(__('verification.ai_error'));
            }

            return $this->parseOCRResponse($response);

        } catch (\Exception $e) {
            $this->logger->error('IDCardOCRService error: ' . $e->getMessage());
            return $this->getErrorResult(__('verification.ai_error'));
        }
    }

    /**
     * Vérifier que la carte d'identité appartient à une femme
     *
     * @param string $base64Image Image de la carte d'identité
     * @return array Résultat avec is_female et données extraites
     */
    public function verifyFemaleID(string $base64Image): array
    {
        $result = $this->extractIDData($base64Image);

        if (!$result['success']) {
            return $result;
        }

        $data = $result['data'];

        // Vérifier le sexe sur la carte
        $gender = strtoupper($data['gender'] ?? '');
        $isFemale = in_array($gender, ['F', 'FEMININ', 'FÉMININ', 'FEMALE', 'W', 'WOMAN']);

        // Vérifier aussi via le titre de civilité si présent
        $civility = strtoupper($data['civility'] ?? '');
        if (!$isFemale && in_array($civility, ['MME', 'MADAME', 'MLLE', 'MADEMOISELLE', 'MS', 'MRS', 'MISS'])) {
            $isFemale = true;
        }

        $result['is_female'] = $isFemale;
        $result['can_proceed'] = $isFemale && $result['is_valid_id'];

        if (!$isFemale) {
            $result['message'] = __('verification.id_not_female');
        }

        return $result;
    }

    /**
     * Construire le prompt OCR pour l'extraction de données
     */
    private function buildOCRPrompt(): string
    {
        return <<<PROMPT
Analyse cette image d'une pièce d'identité (carte d'identité, passeport, permis de conduire) et extrait toutes les informations visibles.

IMPORTANT: Tu dois répondre UNIQUEMENT en JSON valide, sans aucun texte avant ou après.

Informations à extraire:
1. Type de document (carte d'identité, passeport, permis)
2. Pays émetteur
3. Nom de famille
4. Prénom(s)
5. Date de naissance (format YYYY-MM-DD)
6. Lieu de naissance
7. Sexe (M ou F)
8. Nationalité
9. Numéro du document
10. Date d'expiration
11. Adresse (si présente)
12. Titre de civilité (M., Mme, etc.)

Vérifie également:
- Est-ce une vraie pièce d'identité ?
- Le document est-il lisible ?
- Y a-t-il des signes de falsification ?

Réponds EXACTEMENT dans ce format JSON:
{
    "is_valid_id": true/false,
    "document_type": "carte_identite" | "passeport" | "permis_conduire" | "autre",
    "country": "FR" | "CH" | "MA" | etc.,
    "data": {
        "last_name": "...",
        "first_name": "...",
        "birth_date": "YYYY-MM-DD",
        "birth_place": "...",
        "gender": "F" | "M",
        "nationality": "...",
        "document_number": "...",
        "expiry_date": "YYYY-MM-DD",
        "address": "...",
        "civility": "Mme" | "M." | etc.
    },
    "is_readable": true/false,
    "potential_fraud": true/false,
    "fraud_indicators": [],
    "confidence": 0.0-1.0,
    "reason": "courte explication en français"
}
PROMPT;
    }

    /**
     * Parser la réponse OCR de l'IA
     */
    private function parseOCRResponse(array $response): array
    {
        $content = $response['content'][0]['text'] ?? '';

        $jsonStart = strpos($content, '{');
        $jsonEnd = strrpos($content, '}');

        if ($jsonStart === false || $jsonEnd === false) {
            $this->logger->warning('OCR AI response does not contain valid JSON: ' . $content);
            return $this->getErrorResult(__('verification.ai_parse_error'));
        }

        $jsonStr = substr($content, $jsonStart, $jsonEnd - $jsonStart + 1);
        $analysis = json_decode($jsonStr, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->logger->warning('Failed to parse OCR AI JSON response: ' . $jsonStr);
            return $this->getErrorResult(__('verification.ai_parse_error'));
        }

        $isValidId = $analysis['is_valid_id'] ?? false;
        $isReadable = $analysis['is_readable'] ?? false;
        $potentialFraud = $analysis['potential_fraud'] ?? false;
        $confidence = (float)($analysis['confidence'] ?? 0);
        $data = $analysis['data'] ?? [];

        // Normaliser les données
        $normalizedData = $this->normalizeExtractedData($data);

        // Vérifier si on a assez d'informations
        $hasRequiredFields = !empty($normalizedData['last_name'])
            && !empty($normalizedData['first_name'])
            && !empty($normalizedData['birth_date']);

        $canProceed = $isValidId
            && $isReadable
            && !$potentialFraud
            && $hasRequiredFields
            && $confidence >= 0.7;

        $message = $this->buildOCRResultMessage($analysis, $canProceed, $hasRequiredFields);

        return [
            'success' => true,
            'is_valid_id' => $isValidId,
            'is_readable' => $isReadable,
            'document_type' => $analysis['document_type'] ?? 'unknown',
            'country' => $analysis['country'] ?? 'unknown',
            'data' => $normalizedData,
            'potential_fraud' => $potentialFraud,
            'fraud_indicators' => $analysis['fraud_indicators'] ?? [],
            'confidence' => $confidence,
            'can_proceed' => $canProceed,
            'reason' => $analysis['reason'] ?? '',
            'message' => $message,
            'analysis_source' => 'anthropic_claude'
        ];
    }

    /**
     * Normaliser les données extraites
     */
    private function normalizeExtractedData(array $data): array
    {
        return [
            'last_name' => $this->normalizeName($data['last_name'] ?? ''),
            'first_name' => $this->normalizeName($data['first_name'] ?? ''),
            'birth_date' => $this->normalizeDate($data['birth_date'] ?? ''),
            'birth_place' => trim($data['birth_place'] ?? ''),
            'gender' => strtoupper(trim($data['gender'] ?? '')),
            'nationality' => trim($data['nationality'] ?? ''),
            'document_number' => strtoupper(preg_replace('/\s+/', '', $data['document_number'] ?? '')),
            'expiry_date' => $this->normalizeDate($data['expiry_date'] ?? ''),
            'address' => trim($data['address'] ?? ''),
            'civility' => trim($data['civility'] ?? '')
        ];
    }

    /**
     * Normaliser un nom (majuscules, trim)
     */
    private function normalizeName(string $name): string
    {
        $name = trim($name);
        // Convertir en title case pour les prénoms
        return mb_convert_case($name, MB_CASE_TITLE, 'UTF-8');
    }

    /**
     * Normaliser une date au format YYYY-MM-DD
     */
    private function normalizeDate(string $date): string
    {
        $date = trim($date);
        if (empty($date)) {
            return '';
        }

        // Essayer différents formats
        $formats = ['Y-m-d', 'd/m/Y', 'd-m-Y', 'd.m.Y'];
        foreach ($formats as $format) {
            $parsed = \DateTime::createFromFormat($format, $date);
            if ($parsed !== false) {
                return $parsed->format('Y-m-d');
            }
        }

        return $date;
    }

    /**
     * Construire un message de résultat pour l'OCR
     */
    private function buildOCRResultMessage(array $analysis, bool $canProceed, bool $hasRequiredFields): string
    {
        if ($canProceed) {
            return __('verification.id_verified');
        }

        if (!($analysis['is_valid_id'] ?? true)) {
            return __('verification.invalid_id_document');
        }

        if (!($analysis['is_readable'] ?? true)) {
            return __('verification.id_not_readable');
        }

        if ($analysis['potential_fraud'] ?? false) {
            return __('verification.id_fraud_detected');
        }

        if (!$hasRequiredFields) {
            return __('verification.id_missing_info');
        }

        if (($analysis['confidence'] ?? 0) < 0.7) {
            return __('verification.id_low_confidence');
        }

        return __('verification.id_verification_failed');
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
            CURLOPT_TIMEOUT => 45,
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
            'is_valid_id' => false,
            'data' => [],
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
