<?php

declare(strict_types=1);

namespace TripSalama\Models;

use PDO;

/**
 * Model User
 * Gestion des utilisateurs (passageres et conductrices)
 */
class User
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Trouver un utilisateur par ID
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('
            SELECT u.*,
                   AVG(r.passenger_rating) as avg_rating_as_driver,
                   COUNT(DISTINCT rides.id) as total_rides
            FROM users u
            LEFT JOIN rides ON (u.role = "passenger" AND rides.passenger_id = u.id)
                            OR (u.role = "driver" AND rides.driver_id = u.id)
            LEFT JOIN ratings r ON rides.id = r.ride_id AND u.role = "driver"
            WHERE u.id = :id
            GROUP BY u.id
        ');
        $stmt->execute(['id' => $id]);
        $user = $stmt->fetch();

        return $user ?: null;
    }

    /**
     * Trouver un utilisateur par email
     */
    public function findByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE email = :email');
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        return $user ?: null;
    }

    /**
     * Creer un nouvel utilisateur
     */
    public function create(array $data): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_verified, is_active)
            VALUES (:email, :password_hash, :first_name, :last_name, :phone, :role, :is_verified, :is_active)
        ');

        $stmt->execute([
            'email' => $data['email'],
            'password_hash' => $data['password_hash'],
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'phone' => $data['phone'] ?? null,
            'role' => $data['role'] ?? 'passenger',
            'is_verified' => $data['role'] === 'passenger' ? 1 : 0, // Passageres auto-verifiees
            'is_active' => 1,
        ]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Mettre a jour un utilisateur
     */
    public function update(int $id, array $data): bool
    {
        $fields = [];
        $params = ['id' => $id];

        $allowedFields = ['first_name', 'last_name', 'phone', 'avatar_path', 'is_verified', 'is_active'];

        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                $fields[] = "$field = :$field";
                $params[$field] = $data[$field];
            }
        }

        if (empty($fields)) {
            return false;
        }

        $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $stmt = $this->db->prepare($sql);

        return $stmt->execute($params);
    }

    /**
     * Mettre a jour le mot de passe
     */
    public function updatePassword(int $id, string $passwordHash): bool
    {
        $stmt = $this->db->prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
        return $stmt->execute(['id' => $id, 'hash' => $passwordHash]);
    }

    /**
     * Mettre a jour la derniere connexion
     */
    public function updateLastLogin(int $id): bool
    {
        $stmt = $this->db->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id');
        return $stmt->execute(['id' => $id]);
    }

    /**
     * Obtenir les utilisateurs par role
     */
    public function getByRole(string $role, bool $activeOnly = true): array
    {
        $sql = 'SELECT * FROM users WHERE role = :role';
        if ($activeOnly) {
            $sql .= ' AND is_active = 1';
        }
        $sql .= ' ORDER BY created_at DESC';

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['role' => $role]);

        return $stmt->fetchAll();
    }

    /**
     * Verifier si un email existe deja
     */
    public function emailExists(string $email, ?int $excludeId = null): bool
    {
        $sql = 'SELECT COUNT(*) FROM users WHERE email = :email';
        $params = ['email' => $email];

        if ($excludeId !== null) {
            $sql .= ' AND id != :id';
            $params['id'] = $excludeId;
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return (int)$stmt->fetchColumn() > 0;
    }

    /**
     * Obtenir les statistiques d'un utilisateur
     */
    public function getStats(int $id): array
    {
        $stmt = $this->db->prepare('
            SELECT
                COUNT(DISTINCT r.id) as total_rides,
                COUNT(DISTINCT CASE WHEN r.status = "completed" THEN r.id END) as completed_rides,
                AVG(rat.passenger_rating) as avg_rating
            FROM users u
            LEFT JOIN rides r ON (u.role = "passenger" AND r.passenger_id = u.id)
                              OR (u.role = "driver" AND r.driver_id = u.id)
            LEFT JOIN ratings rat ON r.id = rat.ride_id
            WHERE u.id = :id
        ');
        $stmt->execute(['id' => $id]);

        return $stmt->fetch() ?: [
            'total_rides' => 0,
            'completed_rides' => 0,
            'avg_rating' => null
        ];
    }
}
