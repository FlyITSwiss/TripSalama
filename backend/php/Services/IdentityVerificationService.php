<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;
use TripSalama\Models\IdentityVerification;
use TripSalama\Models\User;
use TripSalama\Helpers\PathHelper;

/**
 * Service de vérification d'identité
 * Gère la soumission et validation des photos d'identité
 * Utilise l'IA (Anthropic Claude Vision) pour l'analyse automatique
 */
class IdentityVerificationService
{
    private PDO $db;
    private IdentityVerification $verificationModel;
    private User $userModel;
    private AIVerificationService $aiService;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->verificationModel = new IdentityVerification($db);
        $this->userModel = new User($db);
        $this->aiService = new AIVerificationService();
    }

    /**
     * Soumettre une vérification d'identité avec analyse IA
     *
     * @param int $userId ID de l'utilisateur
     * @param string $base64Image Image encodée en base64
     * @param float|null $localConfidence Niveau de confiance locale face-api.js (0.0 - 1.0)
     * @param string|null $localResult Résultat détection locale (female/male/unknown)
     * @return array ['success' => bool, 'status' => string, 'message' => string, 'analysis' => array]
     */
    public function submitVerification(
        int $userId,
        string $base64Image,
        ?float $localConfidence = null,
        ?string $localResult = null
    ): array {
        try {
            // Valider l'image base64
            if (strpos($base64Image, 'data:image') !== 0) {
                return [
                    'success' => false,
                    'status' => 'error',
                    'message' => __('validation.invalid_file_type'),
                ];
            }

            // Extraire les données de l'image
            $imageData = explode(',', $base64Image);
            if (count($imageData) !== 2) {
                return [
                    'success' => false,
                    'status' => 'error',
                    'message' => __('validation.invalid_file_type'),
                ];
            }

            // Déterminer l'extension
            preg_match('/data:image\/(\w+);base64/', $imageData[0], $matches);
            $extension = $matches[1] ?? 'jpg';

            // Décoder l'image
            $imageContent = base64_decode($imageData[1]);
            if ($imageContent === false) {
                return [
                    'success' => false,
                    'status' => 'error',
                    'message' => __('error.generic'),
                ];
            }

            // Vérifier la taille (max 5MB)
            if (strlen($imageContent) > 5 * 1024 * 1024) {
                return [
                    'success' => false,
                    'status' => 'error',
                    'message' => __('validation.file_too_large'),
                ];
            }

            // =============================================
            // ANALYSE IA AVEC ANTHROPIC CLAUDE VISION
            // =============================================
            $aiAnalysis = $this->aiService->analyzeIdentityPhoto($base64Image);

            // Créer le dossier de vérifications pour cet utilisateur
            $verificationsPath = PathHelper::getUploadsPath() . '/verifications/' . $userId;
            if (!is_dir($verificationsPath)) {
                mkdir($verificationsPath, 0755, true);
            }

            // Générer un nom de fichier unique
            $filename = 'identity_' . time() . '_' . uniqid() . '.' . $extension;
            $fullPath = $verificationsPath . '/' . $filename;
            $relativePath = 'verifications/' . $userId . '/' . $filename;

            // Sauvegarder l'image
            if (file_put_contents($fullPath, $imageContent) === false) {
                return [
                    'success' => false,
                    'status' => 'error',
                    'message' => __('error.generic'),
                ];
            }

            // Utiliser les résultats de l'IA pour déterminer le statut
            $aiConfidence = $aiAnalysis['confidence'] ?? 0.0;
            $isFemale = $aiAnalysis['is_female'] ?? false;
            $isRealPerson = $aiAnalysis['is_real_person'] ?? false;
            $recommendation = $aiAnalysis['recommendation'] ?? 'manual_review';
            $analysisSource = $aiAnalysis['analysis_source'] ?? 'unknown';

            // Créer l'enregistrement de vérification avec les données IA
            $verificationId = $this->verificationModel->create(
                $userId,
                $relativePath,
                $aiConfidence,
                $isFemale ? 'female' : ($isRealPerson ? 'male' : 'unknown')
            );

            // Déterminer le statut final basé sur l'analyse IA
            $finalStatus = 'manual_review';
            $verifiedAt = null;

            if ($recommendation === 'approve' && $isFemale && $isRealPerson && $aiConfidence >= 0.80) {
                $finalStatus = 'verified';
                $verifiedAt = date('Y-m-d H:i:s');
            } elseif ($recommendation === 'reject') {
                $finalStatus = 'rejected';
            }

            // Mettre à jour le statut de l'utilisateur
            $this->userModel->update($userId, [
                'identity_photo_path' => $relativePath,
                'identity_verification_status' => $finalStatus,
            ]);

            // Si vérifié, mettre à jour la date
            if ($verifiedAt !== null) {
                $stmt = $this->db->prepare('
                    UPDATE users
                    SET identity_verified_at = :verified_at
                    WHERE id = :id
                ');
                $stmt->execute([
                    'id' => $userId,
                    'verified_at' => $verifiedAt,
                ]);
            }

            // Message selon le résultat
            $message = match ($finalStatus) {
                'verified' => __('verification.success_message'),
                'rejected' => $aiAnalysis['reason'] ?? __('verification.rejected_message'),
                default => __('verification.pending_message'),
            };

            return [
                'success' => $finalStatus !== 'rejected',
                'status' => $finalStatus,
                'message' => $message,
                'verification_id' => $verificationId,
                'analysis' => [
                    'is_female' => $isFemale,
                    'is_real_person' => $isRealPerson,
                    'confidence' => $aiConfidence,
                    'recommendation' => $recommendation,
                    'source' => $analysisSource,
                    'reason' => $aiAnalysis['reason'] ?? null,
                ],
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'status' => 'error',
                'message' => __('error.generic'),
            ];
        }
    }

    /**
     * Obtenir le statut de vérification d'un utilisateur
     */
    public function getVerificationStatus(int $userId): array
    {
        $verification = $this->verificationModel->findByUserId($userId);
        $user = $this->userModel->findById($userId);

        if (!$user) {
            return [
                'status' => 'pending',
                'verified_at' => null,
            ];
        }

        return [
            'status' => $user['identity_verification_status'] ?? 'pending',
            'verified_at' => $user['identity_verified_at'] ?? null,
            'verification' => $verification,
        ];
    }

    /**
     * Approuver une vérification (admin)
     */
    public function approveVerification(int $verificationId, int $adminId): bool
    {
        $verification = $this->verificationModel->findById($verificationId);

        if (!$verification) {
            return false;
        }

        // Mettre à jour la vérification
        $result = $this->verificationModel->approveByAdmin($verificationId, $adminId);

        if ($result) {
            // Mettre à jour l'utilisateur
            $this->userModel->update((int)$verification['user_id'], [
                'identity_verification_status' => 'verified',
            ]);

            $stmt = $this->db->prepare('
                UPDATE users
                SET identity_verified_at = NOW()
                WHERE id = :id
            ');
            $stmt->execute(['id' => $verification['user_id']]);
        }

        return $result;
    }

    /**
     * Rejeter une vérification (admin)
     */
    public function rejectVerification(int $verificationId, int $adminId, string $reason): bool
    {
        $verification = $this->verificationModel->findById($verificationId);

        if (!$verification) {
            return false;
        }

        // Mettre à jour la vérification
        $result = $this->verificationModel->rejectByAdmin($verificationId, $adminId, $reason);

        if ($result) {
            // Mettre à jour l'utilisateur
            $this->userModel->update((int)$verification['user_id'], [
                'identity_verification_status' => 'rejected',
            ]);
        }

        return $result;
    }

    /**
     * Obtenir les vérifications en attente
     */
    public function getPendingVerifications(): array
    {
        return $this->verificationModel->getPendingManualReviews();
    }

    /**
     * Obtenir les statistiques
     */
    public function getStats(): array
    {
        return $this->verificationModel->getStats();
    }
}
