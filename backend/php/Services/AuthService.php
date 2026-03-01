<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;
use TripSalama\Models\User;
use TripSalama\Models\Vehicle;
use TripSalama\Helpers\ValidationHelper;

/**
 * Service d'authentification
 */
class AuthService
{
    private PDO $db;
    private User $userModel;
    private Vehicle $vehicleModel;

    // Remember me cookie settings (30 days - standard)
    private const REMEMBER_COOKIE_NAME = 'tripsalama_remember';
    private const REMEMBER_TOKEN_EXPIRY_DAYS = 30;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->userModel = new User($db);
        $this->vehicleModel = new Vehicle($db);
    }

    /**
     * Inscrire un nouvel utilisateur
     */
    public function register(array $data): array
    {
        $errors = $this->validateRegistration($data);

        if (!empty($errors)) {
            return ['success' => false, 'errors' => $errors];
        }

        // Verifier si l'email existe
        if ($this->userModel->emailExists($data['email'])) {
            return ['success' => false, 'errors' => ['email' => 'email_taken']];
        }

        try {
            $this->db->beginTransaction();

            // Creer l'utilisateur
            $userId = $this->userModel->create([
                'email' => $data['email'],
                'password_hash' => $this->hashPassword($data['password']),
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'phone' => $data['phone'] ?? null,
                'role' => $data['role'] ?? 'passenger',
            ]);

            // Si conductrice, creer le vehicule
            if (($data['role'] ?? 'passenger') === 'driver' && !empty($data['vehicle'])) {
                $this->vehicleModel->create([
                    'driver_id' => $userId,
                    'brand' => $data['vehicle']['brand'],
                    'model' => $data['vehicle']['model'],
                    'color' => $data['vehicle']['color'],
                    'license_plate' => $data['vehicle']['license_plate'],
                    'year' => $data['vehicle']['year'] ?? null,
                ]);

                // Creer le statut conductrice
                $stmt = $this->db->prepare('
                    INSERT INTO driver_status (driver_id, is_available, current_lat, current_lng)
                    VALUES (:driver_id, 0, NULL, NULL)
                ');
                $stmt->execute(['driver_id' => $userId]);
            }

            $this->db->commit();

            return ['success' => true, 'user_id' => $userId];

        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Connecter un utilisateur
     */
    public function login(string $email, string $password): array
    {
        $user = $this->userModel->findByEmail($email);

        if (!$user) {
            return ['success' => false, 'error' => 'login_failed'];
        }

        if (!$this->verifyPassword($password, $user['password_hash'])) {
            return ['success' => false, 'error' => 'login_failed'];
        }

        if (!$user['is_active']) {
            return ['success' => false, 'error' => 'account_disabled'];
        }

        // Mettre a jour la derniere connexion
        $this->userModel->updateLastLogin((int)$user['id']);

        // Preparer les donnees de session
        $sessionUser = [
            'id' => (int)$user['id'],
            'email' => $user['email'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'role' => $user['role'],
            'avatar_path' => $user['avatar_path'],
            'is_verified' => (bool)$user['is_verified'],
        ];

        return ['success' => true, 'user' => $sessionUser];
    }

    /**
     * Deconnecter l'utilisateur
     */
    public function logout(): void
    {
        // Effacer le token "Remember Me" si présent
        if (isset($_SESSION['user']['id'])) {
            $this->clearRememberTokens((int)$_SESSION['user']['id']);
        }

        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );
        }

        session_destroy();
    }

    /**
     * Obtenir l'utilisateur courant
     */
    public function getCurrentUser(): ?array
    {
        if (!isset($_SESSION['user']['id'])) {
            return null;
        }

        return $this->userModel->findById((int)$_SESSION['user']['id']);
    }

    /**
     * Valider les donnees d'inscription
     */
    private function validateRegistration(array $data): array
    {
        $errors = [];

        // Email
        if (empty($data['email'])) {
            $errors['email'] = 'required_field';
        } elseif (!ValidationHelper::isValidEmail($data['email'])) {
            $errors['email'] = 'email_invalid';
        }

        // Mot de passe
        if (empty($data['password'])) {
            $errors['password'] = 'required_field';
        } else {
            $passwordErrors = ValidationHelper::validatePassword($data['password']);
            if (!empty($passwordErrors)) {
                $errors['password'] = $passwordErrors[0];
            }
        }

        // Confirmation mot de passe
        if (isset($data['password_confirm']) && $data['password'] !== $data['password_confirm']) {
            $errors['password_confirm'] = 'password_mismatch';
        }

        // Prenom
        if (empty($data['first_name'])) {
            $errors['first_name'] = 'required_field';
        }

        // Nom
        if (empty($data['last_name'])) {
            $errors['last_name'] = 'required_field';
        }

        // Telephone (optionnel mais valide si fourni)
        if (!empty($data['phone']) && !ValidationHelper::isValidPhone($data['phone'])) {
            $errors['phone'] = 'phone_invalid';
        }

        // Vehicule (pour conductrices)
        if (($data['role'] ?? 'passenger') === 'driver') {
            if (empty($data['vehicle']['brand'])) {
                $errors['vehicle_brand'] = 'required_field';
            }
            if (empty($data['vehicle']['model'])) {
                $errors['vehicle_model'] = 'required_field';
            }
            if (empty($data['vehicle']['color'])) {
                $errors['vehicle_color'] = 'required_field';
            }
            if (empty($data['vehicle']['license_plate'])) {
                $errors['vehicle_license_plate'] = 'required_field';
            }
        }

        return $errors;
    }

    /**
     * Hasher un mot de passe
     */
    public function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_DEFAULT);
    }

    /**
     * Verifier un mot de passe
     */
    public function verifyPassword(string $password, string $hash): bool
    {
        return password_verify($password, $hash);
    }

    // ========================================
    // REMEMBER ME FUNCTIONALITY
    // ========================================

    /**
     * Créer un token "Remember Me" pour l'utilisateur
     */
    public function createRememberToken(int $userId): void
    {
        // Générer un token sécurisé
        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token);

        // Date d'expiration (30 jours)
        $expiresAt = date('Y-m-d H:i:s', strtotime('+' . self::REMEMBER_TOKEN_EXPIRY_DAYS . ' days'));

        // Supprimer les anciens tokens de cet utilisateur (limite à 5 appareils)
        $this->cleanupOldTokens($userId);

        // Insérer le nouveau token
        $stmt = $this->db->prepare('
            INSERT INTO remember_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
            VALUES (?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $userId,
            $tokenHash,
            $expiresAt,
            $_SERVER['HTTP_USER_AGENT'] ?? null,
            $_SERVER['REMOTE_ADDR'] ?? null
        ]);

        // Définir le cookie
        $this->setRememberCookie($userId . ':' . $token, self::REMEMBER_TOKEN_EXPIRY_DAYS);
    }

    /**
     * Valider un token "Remember Me" et reconnecter l'utilisateur
     */
    public function validateRememberToken(): bool
    {
        $cookie = $_COOKIE[self::REMEMBER_COOKIE_NAME] ?? null;

        if (!$cookie) {
            return false;
        }

        // Le cookie contient "userId:token"
        $parts = explode(':', $cookie, 2);
        if (count($parts) !== 2) {
            $this->clearRememberCookie();
            return false;
        }

        [$userId, $token] = $parts;
        $userId = (int)$userId;
        $tokenHash = hash('sha256', $token);

        // Vérifier le token en base
        $stmt = $this->db->prepare('
            SELECT rt.*, u.is_active
            FROM remember_tokens rt
            JOIN users u ON u.id = rt.user_id
            WHERE rt.user_id = ?
              AND rt.token_hash = ?
              AND rt.expires_at > NOW()
        ');
        $stmt->execute([$userId, $tokenHash]);
        $tokenData = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$tokenData || !$tokenData['is_active']) {
            $this->clearRememberCookie();
            return false;
        }

        // Récupérer l'utilisateur et le connecter
        $user = $this->userModel->findById($userId);
        if (!$user) {
            $this->clearRememberCookie();
            return false;
        }

        // Créer la session
        $_SESSION['user'] = [
            'id' => (int)$user['id'],
            'email' => $user['email'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'role' => $user['role'],
            'avatar_path' => $user['avatar_path'] ?? null,
            'is_verified' => (bool)$user['is_verified'],
        ];

        // Mettre à jour la dernière connexion
        $this->userModel->updateLastLogin($userId);

        // Rotation du token (sécurité)
        $this->deleteRememberToken($tokenHash);
        $this->createRememberToken($userId);

        return true;
    }

    /**
     * Supprimer tous les tokens "Remember Me" de l'utilisateur
     */
    public function clearRememberTokens(int $userId): void
    {
        $stmt = $this->db->prepare('DELETE FROM remember_tokens WHERE user_id = ?');
        $stmt->execute([$userId]);
        $this->clearRememberCookie();
    }

    /**
     * Supprimer un token spécifique
     */
    private function deleteRememberToken(string $tokenHash): void
    {
        $stmt = $this->db->prepare('DELETE FROM remember_tokens WHERE token_hash = ?');
        $stmt->execute([$tokenHash]);
    }

    /**
     * Nettoyer les anciens tokens (garder max 5 par utilisateur)
     */
    private function cleanupOldTokens(int $userId): void
    {
        // Supprimer les tokens expirés
        $stmt = $this->db->prepare('DELETE FROM remember_tokens WHERE user_id = ? AND expires_at < NOW()');
        $stmt->execute([$userId]);

        // Garder seulement les 4 plus récents (le 5ème sera le nouveau)
        $stmt = $this->db->prepare('
            DELETE FROM remember_tokens
            WHERE user_id = ?
              AND id NOT IN (
                  SELECT id FROM (
                      SELECT id FROM remember_tokens
                      WHERE user_id = ?
                      ORDER BY created_at DESC
                      LIMIT 4
                  ) AS recent
              )
        ');
        $stmt->execute([$userId, $userId]);
    }

    /**
     * Définir le cookie "Remember Me"
     */
    private function setRememberCookie(string $value, int $days): void
    {
        $expiry = time() + ($days * 24 * 60 * 60);
        $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        $basePath = config('base_path', '') ?: '/';

        setcookie(
            self::REMEMBER_COOKIE_NAME,
            $value,
            [
                'expires' => $expiry,
                'path' => $basePath,
                'domain' => '',
                'secure' => $secure,
                'httponly' => true,
                'samesite' => 'Lax'
            ]
        );
    }

    /**
     * Supprimer le cookie "Remember Me"
     */
    private function clearRememberCookie(): void
    {
        $basePath = config('base_path', '') ?: '/';

        setcookie(
            self::REMEMBER_COOKIE_NAME,
            '',
            [
                'expires' => time() - 3600,
                'path' => $basePath,
                'domain' => '',
                'secure' => true,
                'httponly' => true,
                'samesite' => 'Lax'
            ]
        );

        unset($_COOKIE[self::REMEMBER_COOKIE_NAME]);
    }

    // ========================================
    // PASSWORD RESET FUNCTIONALITY
    // ========================================

    /**
     * Creer un token de reset de mot de passe
     */
    public function createPasswordResetToken(string $email): array
    {
        $user = $this->userModel->findByEmail($email);

        // Always return success to prevent email enumeration
        if (!$user) {
            return ['success' => true, 'message' => 'reset_email_sent'];
        }

        // Generate secure token
        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token);
        $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));

        // Delete existing reset tokens for this user
        $stmt = $this->db->prepare('DELETE FROM password_resets WHERE user_id = ?');
        $stmt->execute([$user['id']]);

        // Insert new token
        $stmt = $this->db->prepare('
            INSERT INTO password_resets (user_id, token_hash, expires_at)
            VALUES (?, ?, ?)
        ');
        $stmt->execute([$user['id'], $tokenHash, $expiresAt]);

        // In production, send email with reset link
        // For now, log the token for testing
        error_log("Password reset token for {$email}: {$token}");

        return [
            'success' => true,
            'message' => 'reset_email_sent',
            'token' => $token // Only for testing, remove in production
        ];
    }

    /**
     * Verifier un token de reset
     */
    public function verifyPasswordResetToken(string $token): bool
    {
        $tokenHash = hash('sha256', $token);

        $stmt = $this->db->prepare('
            SELECT * FROM password_resets
            WHERE token_hash = ? AND expires_at > NOW()
        ');
        $stmt->execute([$tokenHash]);

        return $stmt->fetch(\PDO::FETCH_ASSOC) !== false;
    }

    /**
     * Reinitialiser le mot de passe
     */
    public function resetPassword(string $token, string $newPassword): array
    {
        $tokenHash = hash('sha256', $token);

        // Get the reset request
        $stmt = $this->db->prepare('
            SELECT * FROM password_resets
            WHERE token_hash = ? AND expires_at > NOW()
        ');
        $stmt->execute([$tokenHash]);
        $resetData = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$resetData) {
            return ['success' => false, 'error' => 'invalid_token'];
        }

        // Validate new password
        $passwordErrors = ValidationHelper::validatePassword($newPassword);
        if (!empty($passwordErrors)) {
            return ['success' => false, 'error' => $passwordErrors[0]];
        }

        // Update password
        $passwordHash = $this->hashPassword($newPassword);
        $stmt = $this->db->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $stmt->execute([$passwordHash, $resetData['user_id']]);

        // Delete used token
        $stmt = $this->db->prepare('DELETE FROM password_resets WHERE user_id = ?');
        $stmt->execute([$resetData['user_id']]);

        // Clear all remember tokens (security)
        $this->clearRememberTokens((int)$resetData['user_id']);

        return ['success' => true];
    }
}
