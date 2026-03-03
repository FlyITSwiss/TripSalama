<?php

declare(strict_types=1);

namespace TripSalama\Controllers;

use PDO;
use TripSalama\Helpers\PathHelper;

/**
 * Controller utilisateur (profil)
 */
class UserController
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Afficher la page de profil
     */
    public function profile(): void
    {
        $user = current_user();

        if (!$user) {
            redirect_to('login');
            return;
        }

        // Charger les informations complètes de l'utilisateur
        $stmt = $this->db->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$user['id']]);
        $userData = $stmt->fetch(PDO::FETCH_ASSOC);

        // Si conductrice, charger les infos véhicule
        $vehicle = null;
        if ($user['role'] === 'driver') {
            $stmt = $this->db->prepare('SELECT * FROM vehicles WHERE driver_id = ?');
            $stmt->execute([$user['id']]);
            $vehicle = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        // Compter les courses
        $stmt = $this->db->prepare('
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed
            FROM rides
            WHERE ' . ($user['role'] === 'driver' ? 'driver_id' : 'passenger_id') . ' = ?
        ');
        $stmt->execute([$user['id']]);
        $stats = $stmt->fetch(PDO::FETCH_ASSOC);

        $this->render('user/profile', [
            'pageTitle' => __('profile.title'),
            'currentPage' => 'profile',
            'userData' => $userData,
            'vehicle' => $vehicle,
            'stats' => $stats,
        ]);
    }

    /**
     * Afficher le formulaire d'édition du profil
     */
    public function editProfile(): void
    {
        $user = current_user();

        if (!$user) {
            redirect_to('login');
            return;
        }

        $stmt = $this->db->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$user['id']]);
        $userData = $stmt->fetch(PDO::FETCH_ASSOC);

        $vehicle = null;
        if ($user['role'] === 'driver') {
            $stmt = $this->db->prepare('SELECT * FROM vehicles WHERE driver_id = ?');
            $stmt->execute([$user['id']]);
            $vehicle = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        $this->render('user/edit-profile', [
            'pageTitle' => __('profile.edit'),
            'currentPage' => 'profile',
            'userData' => $userData,
            'vehicle' => $vehicle,
        ]);
    }

    /**
     * Mettre à jour le profil
     */
    public function updateProfile(): void
    {
        $user = current_user();

        if (!$user) {
            redirect_to('login');
            return;
        }

        $data = $_POST;

        // Valider les données
        $firstName = trim($data['first_name'] ?? '');
        $lastName = trim($data['last_name'] ?? '');
        $phone = trim($data['phone'] ?? '');

        if (empty($firstName) || empty($lastName)) {
            flash('error', __('validation.required_field'));
            redirect_to('profile/edit');
            return;
        }

        // Mettre à jour l'utilisateur
        $stmt = $this->db->prepare('
            UPDATE users
            SET first_name = ?, last_name = ?, phone = ?, updated_at = NOW()
            WHERE id = ?
        ');
        $stmt->execute([$firstName, $lastName, $phone, $user['id']]);

        // Mettre à jour la session
        $_SESSION['user']['first_name'] = $firstName;
        $_SESSION['user']['last_name'] = $lastName;
        $_SESSION['user']['phone'] = $phone;

        flash('success', __('msg.updated'));
        redirect_to('profile');
    }

    /**
     * Afficher le formulaire de changement de mot de passe
     */
    public function changePassword(): void
    {
        $user = current_user();

        if (!$user) {
            redirect_to('login');
            return;
        }

        $this->render('user/password', [
            'pageTitle' => __('profile.change_password'),
            'currentPage' => 'profile',
        ]);
    }

    /**
     * Traiter le changement de mot de passe
     */
    public function processChangePassword(): void
    {
        $user = current_user();

        if (!$user) {
            redirect_to('login');
            return;
        }

        $currentPassword = $_POST['current_password'] ?? '';
        $newPassword = $_POST['new_password'] ?? '';
        $confirmPassword = $_POST['confirm_password'] ?? '';

        // Valider les champs requis
        if (empty($currentPassword) || empty($newPassword) || empty($confirmPassword)) {
            flash('error', __('validation.required_field'));
            redirect_to('profile/password');
            return;
        }

        // Vérifier que les nouveaux mots de passe correspondent
        if ($newPassword !== $confirmPassword) {
            flash('error', __('validation.password_mismatch'));
            redirect_to('profile/password');
            return;
        }

        // Valider la longueur du mot de passe
        if (strlen($newPassword) < 8) {
            flash('error', __('validation.password_min_length'));
            redirect_to('profile/password');
            return;
        }

        // Récupérer le mot de passe actuel de l'utilisateur
        $stmt = $this->db->prepare('SELECT password FROM users WHERE id = ?');
        $stmt->execute([$user['id']]);
        $userData = $stmt->fetch(PDO::FETCH_ASSOC);

        // Vérifier le mot de passe actuel
        if (!$userData || !password_verify($currentPassword, $userData['password'])) {
            flash('error', __('validation.password_incorrect'));
            redirect_to('profile/password');
            return;
        }

        // Mettre à jour le mot de passe
        $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
        $stmt = $this->db->prepare('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?');
        $stmt->execute([$hashedPassword, $user['id']]);

        flash('success', __('profile.password_updated'));
        redirect_to('profile');
    }

    /**
     * Rendre une vue avec le layout principal
     */
    private function render(string $view, array $data = []): void
    {
        extract($data);

        $viewPath = PathHelper::getViewsPath() . '/' . $view . '.phtml';

        if (!file_exists($viewPath)) {
            throw new \Exception("View not found: $view");
        }

        ob_start();
        require $viewPath;
        $content = ob_get_clean();

        require PathHelper::getViewsPath() . '/layouts/main.phtml';
    }
}
