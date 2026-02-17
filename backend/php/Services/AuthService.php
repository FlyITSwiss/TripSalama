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
}
