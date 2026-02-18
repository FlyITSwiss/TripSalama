<?php

declare(strict_types=1);

namespace TripSalama\Controllers;

use PDO;
use TripSalama\Services\AuthService;
use TripSalama\Helpers\PathHelper;

/**
 * Controller d'authentification
 */
class AuthController
{
    private PDO $db;
    private AuthService $authService;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->authService = new AuthService($db);
    }

    /**
     * Afficher la page de connexion
     */
    public function showLogin(): void
    {
        // Si deja connecte, rediriger vers le dashboard
        if (is_authenticated()) {
            $this->redirectToDashboard();
            return;
        }

        $this->render('auth/login', [
            'pageTitle' => __('auth.login'),
        ]);
    }

    /**
     * Afficher le choix d'inscription
     */
    public function showRegisterChoice(): void
    {
        if (is_authenticated()) {
            $this->redirectToDashboard();
            return;
        }

        $this->render('auth/register-choice', [
            'pageTitle' => __('auth.register'),
        ]);
    }

    /**
     * Afficher le formulaire d'inscription passagere
     */
    public function showRegisterPassenger(): void
    {
        if (is_authenticated()) {
            $this->redirectToDashboard();
            return;
        }

        $this->render('auth/register-passenger', [
            'pageTitle' => __('auth.register_passenger'),
        ]);
    }

    /**
     * Afficher le formulaire d'inscription conductrice
     */
    public function showRegisterDriver(): void
    {
        if (is_authenticated()) {
            $this->redirectToDashboard();
            return;
        }

        $this->render('auth/register-driver', [
            'pageTitle' => __('auth.register_driver'),
        ]);
    }

    /**
     * Traiter la connexion
     */
    public function processLogin(): void
    {
        // Verifier CSRF
        if (!verify_csrf($_POST['_csrf_token'] ?? '')) {
            flash('error', __('error.csrf'));
            redirect_to('login');
        }

        $email = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';

        if (empty($email) || empty($password)) {
            flash('error', __('msg.login_failed'));
            redirect_to('login');
        }

        $result = $this->authService->login($email, $password);

        if (!$result['success']) {
            flash('error', __('msg.login_failed'));
            redirect_to('login');
        }

        // Stocker l'utilisateur en session
        $_SESSION['user'] = $result['user'];

        flash('success', __('msg.login_success'));
        $this->redirectToDashboard();
    }

    /**
     * Traiter l'inscription passagere
     */
    public function processRegisterPassenger(): void
    {
        $this->processRegister('passenger');
    }

    /**
     * Traiter l'inscription conductrice
     */
    public function processRegisterDriver(): void
    {
        $this->processRegister('driver');
    }

    /**
     * Traiter l'inscription (commun)
     */
    private function processRegister(string $role): void
    {
        // Verifier CSRF
        if (!verify_csrf($_POST['_csrf_token'] ?? '')) {
            flash('error', __('error.csrf'));
            redirect_to('register/' . $role);
        }

        $data = [
            'email' => trim($_POST['email'] ?? ''),
            'password' => $_POST['password'] ?? '',
            'password_confirm' => $_POST['password_confirm'] ?? '',
            'first_name' => trim($_POST['first_name'] ?? ''),
            'last_name' => trim($_POST['last_name'] ?? ''),
            'phone' => trim($_POST['phone'] ?? ''),
            'role' => $role,
        ];

        // Donnees vehicule pour conductrice
        if ($role === 'driver') {
            $data['vehicle'] = [
                'brand' => trim($_POST['vehicle_brand'] ?? ''),
                'model' => trim($_POST['vehicle_model'] ?? ''),
                'color' => trim($_POST['vehicle_color'] ?? ''),
                'license_plate' => trim($_POST['vehicle_license_plate'] ?? ''),
                'year' => !empty($_POST['vehicle_year']) ? (int)$_POST['vehicle_year'] : null,
            ];
        }

        $result = $this->authService->register($data);

        if (!$result['success']) {
            // Afficher la premiere erreur
            $firstError = reset($result['errors']);
            flash('error', __('validation.' . $firstError));
            redirect_to('register/' . $role);
        }

        // Connecter automatiquement
        $loginResult = $this->authService->login($data['email'], $data['password']);

        if ($loginResult['success']) {
            $_SESSION['user'] = $loginResult['user'];
        }

        flash('success', __('msg.register_success'));
        $this->redirectToDashboard();
    }

    /**
     * Afficher la page de vérification d'identité
     */
    public function showIdentityVerification(): void
    {
        // Vérifier que l'utilisateur est connecté
        if (!is_authenticated()) {
            redirect_to('login');
            return;
        }

        $user = current_user();

        // Vérifier si déjà vérifié
        if ($user['identity_verification_status'] === 'verified') {
            $this->redirectToDashboard();
            return;
        }

        $this->render('auth/identity-verification', [
            'pageTitle' => __('verification.title'),
            'user' => $user,
        ]);
    }

    /**
     * Deconnexion
     */
    public function logout(): void
    {
        $this->authService->logout();
        flash('success', __('msg.logout_success'));
        redirect_to('login');
    }

    /**
     * Rediriger vers le dashboard selon le role
     */
    private function redirectToDashboard(): void
    {
        $user = current_user();

        if (!$user) {
            redirect_to('login');
        }

        switch ($user['role']) {
            case 'driver':
                redirect_to('driver/dashboard');
                break;
            case 'admin':
                redirect_to('admin/dashboard');
                break;
            default:
                redirect_to('passenger/dashboard');
        }
    }

    /**
     * Rendre une vue
     */
    private function render(string $view, array $data = []): void
    {
        extract($data);

        $viewPath = PathHelper::getViewsPath() . '/' . $view . '.phtml';

        if (!file_exists($viewPath)) {
            throw new \Exception("View not found: $view");
        }

        // Capturer le contenu
        ob_start();
        require $viewPath;
        $content = ob_get_clean();

        // Pour les pages auth, utiliser un layout minimal
        if (strpos($view, 'auth/') === 0) {
            echo $content;
        } else {
            // Layout principal
            require PathHelper::getViewsPath() . '/layouts/main.phtml';
        }
    }

    // === API Methods ===

    /**
     * API: Connexion
     */
    public function apiLogin(): void
    {
        $data = getRequestData();

        $email = trim($data['email'] ?? '');
        $password = $data['password'] ?? '';

        if (empty($email) || empty($password)) {
            errorResponse(__('msg.login_failed'), 400);
        }

        $result = $this->authService->login($email, $password);

        if (!$result['success']) {
            errorResponse(__('msg.login_failed'), 401);
        }

        $_SESSION['user'] = $result['user'];

        successResponse($result['user'], __('msg.login_success'));
    }

    /**
     * API: Inscription
     */
    public function apiRegister(): void
    {
        $data = getRequestData();

        $result = $this->authService->register($data);

        if (!$result['success']) {
            $errors = array_map(fn($e) => __('validation.' . $e), $result['errors']);
            errorResponse(__('error.validation'), 400, $errors);
        }

        // Connecter automatiquement
        $loginResult = $this->authService->login($data['email'], $data['password']);

        if ($loginResult['success']) {
            $_SESSION['user'] = $loginResult['user'];
        }

        successResponse(['user_id' => $result['user_id']], __('msg.register_success'));
    }

    /**
     * API: Deconnexion
     */
    public function apiLogout(): void
    {
        $this->authService->logout();
        successResponse(null, __('msg.logout_success'));
    }

    /**
     * API: Utilisateur courant
     */
    public function apiMe(): void
    {
        $user = $this->authService->getCurrentUser();

        if (!$user) {
            errorResponse(__('error.unauthorized'), 401);
        }

        // Retirer le hash du mot de passe
        unset($user['password_hash']);

        successResponse($user);
    }
}
