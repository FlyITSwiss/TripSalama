<?php
/**
 * Script de mise à jour AuthController avec Rate Limiting
 */

$content = <<<'PHP'
<?php

declare(strict_types=1);

namespace TripSalama\Controllers;

use PDO;
use TripSalama\Services\AuthService;
use TripSalama\Services\RateLimitService;
use TripSalama\Helpers\PathHelper;

/**
 * Controller d'authentification avec protection rate limiting
 */
class AuthController
{
    private PDO $db;
    private AuthService $authService;
    private RateLimitService $rateLimitService;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->authService = new AuthService($db);
        $this->rateLimitService = new RateLimitService($db);
    }

    public function showLogin(): void
    {
        if (is_authenticated()) {
            $this->redirectToDashboard();
            return;
        }
        $this->render('auth/login', ['pageTitle' => __('auth.login')]);
    }

    public function showRegisterChoice(): void
    {
        if (is_authenticated()) {
            $this->redirectToDashboard();
            return;
        }
        $this->render('auth/register-choice', ['pageTitle' => __('auth.register')]);
    }

    public function showRegisterPassenger(): void
    {
        if (is_authenticated()) {
            $this->redirectToDashboard();
            return;
        }
        $this->render('auth/register-passenger', ['pageTitle' => __('auth.register_passenger')]);
    }

    public function showRegisterDriver(): void
    {
        if (is_authenticated()) {
            $this->redirectToDashboard();
            return;
        }
        $this->render('auth/register-driver', ['pageTitle' => __('auth.register_driver')]);
    }

    public function processLogin(): void
    {
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

        // Rate Limiting
        $rateLimitKey = RateLimitService::generateKey($email);
        if (!$this->rateLimitService->isAllowed($rateLimitKey, 'login')) {
            $retryAfter = $this->rateLimitService->getRetryAfter($rateLimitKey, 'login');
            $minutes = (int) ceil($retryAfter / 60);
            flash('error', __('error.too_many_attempts', ['minutes' => $minutes]));
            redirect_to('login');
        }

        $result = $this->authService->login($email, $password);

        if (!$result['success']) {
            $this->rateLimitService->hit($rateLimitKey, 'login');
            $remaining = $this->rateLimitService->getRemainingAttempts($rateLimitKey, 'login');

            if ($remaining > 0) {
                flash('error', __('msg.login_failed_attempts', ['remaining' => $remaining]));
            } else {
                flash('error', __('error.account_locked'));
            }
            redirect_to('login');
        }

        $this->rateLimitService->clear($rateLimitKey, 'login');
        $_SESSION['user'] = $result['user'];
        flash('success', __('msg.login_success'));
        $this->redirectToDashboard();
    }

    public function processRegisterPassenger(): void
    {
        $this->processRegister('passenger');
    }

    public function processRegisterDriver(): void
    {
        $this->processRegister('driver');
    }

    private function processRegister(string $role): void
    {
        if (!verify_csrf($_POST['_csrf_token'] ?? '')) {
            flash('error', __('error.csrf'));
            redirect_to('register/' . $role);
        }

        $email = trim($_POST['email'] ?? '');

        // Rate Limiting
        $rateLimitKey = RateLimitService::generateKey($email ?: 'anonymous');
        if (!$this->rateLimitService->isAllowed($rateLimitKey, 'register')) {
            $retryAfter = $this->rateLimitService->getRetryAfter($rateLimitKey, 'register');
            $minutes = (int) ceil($retryAfter / 60);
            flash('error', __('error.too_many_attempts', ['minutes' => $minutes]));
            redirect_to('register/' . $role);
        }

        $data = [
            'email' => $email,
            'password' => $_POST['password'] ?? '',
            'password_confirm' => $_POST['password_confirm'] ?? '',
            'first_name' => trim($_POST['first_name'] ?? ''),
            'last_name' => trim($_POST['last_name'] ?? ''),
            'phone' => trim($_POST['phone'] ?? ''),
            'role' => $role,
        ];

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
            $this->rateLimitService->hit($rateLimitKey, 'register');
            $firstError = reset($result['errors']);
            flash('error', __('validation.' . $firstError));
            redirect_to('register/' . $role);
        }

        $this->rateLimitService->clear($rateLimitKey, 'register');

        $loginResult = $this->authService->login($data['email'], $data['password']);
        if ($loginResult['success']) {
            $_SESSION['user'] = $loginResult['user'];
        }

        flash('success', __('msg.register_success'));
        $this->redirectToDashboard();
    }

    public function showIdentityVerification(): void
    {
        if (!is_authenticated()) {
            redirect_to('login');
            return;
        }

        $user = current_user();
        if (isset($user['identity_verification_status']) && $user['identity_verification_status'] === 'verified') {
            $this->redirectToDashboard();
            return;
        }

        $this->render('auth/identity-verification', [
            'pageTitle' => __('verification.title'),
            'user' => $user,
        ]);
    }

    public function logout(): void
    {
        $this->authService->logout();
        flash('success', __('msg.logout_success'));
        redirect_to('login');
    }

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

        if (strpos($view, 'auth/') === 0) {
            echo $content;
        } else {
            require PathHelper::getViewsPath() . '/layouts/main.phtml';
        }
    }

    // === API Methods ===

    public function apiLogin(): void
    {
        $data = getRequestData();
        $email = trim($data['email'] ?? '');
        $password = $data['password'] ?? '';

        if (empty($email) || empty($password)) {
            errorResponse(__('msg.login_failed'), 400);
        }

        $rateLimitKey = RateLimitService::generateKey($email);
        if (!$this->rateLimitService->isAllowed($rateLimitKey, 'login')) {
            $retryAfter = $this->rateLimitService->getRetryAfter($rateLimitKey, 'login');
            header('Retry-After: ' . $retryAfter);
            errorResponse(__('error.too_many_attempts'), 429);
        }

        $result = $this->authService->login($email, $password);

        if (!$result['success']) {
            $this->rateLimitService->hit($rateLimitKey, 'login');
            $remaining = $this->rateLimitService->getRemainingAttempts($rateLimitKey, 'login');
            errorResponse(__('msg.login_failed'), 401, ['remaining_attempts' => $remaining]);
        }

        $this->rateLimitService->clear($rateLimitKey, 'login');
        $_SESSION['user'] = $result['user'];
        successResponse($result['user'], __('msg.login_success'));
    }

    public function apiRegister(): void
    {
        $data = getRequestData();
        $email = trim($data['email'] ?? '');

        $rateLimitKey = RateLimitService::generateKey($email ?: 'anonymous');
        if (!$this->rateLimitService->isAllowed($rateLimitKey, 'register')) {
            $retryAfter = $this->rateLimitService->getRetryAfter($rateLimitKey, 'register');
            header('Retry-After: ' . $retryAfter);
            errorResponse(__('error.too_many_attempts'), 429);
        }

        $result = $this->authService->register($data);

        if (!$result['success']) {
            $this->rateLimitService->hit($rateLimitKey, 'register');
            $errors = array_map(fn($e) => __('validation.' . $e), $result['errors']);
            errorResponse(__('error.validation'), 400, $errors);
        }

        $this->rateLimitService->clear($rateLimitKey, 'register');

        $loginResult = $this->authService->login($data['email'], $data['password']);
        if ($loginResult['success']) {
            $_SESSION['user'] = $loginResult['user'];
        }

        successResponse(['user_id' => $result['user_id']], __('msg.register_success'));
    }

    public function apiLogout(): void
    {
        $this->authService->logout();
        successResponse(null, __('msg.logout_success'));
    }

    public function apiMe(): void
    {
        $user = $this->authService->getCurrentUser();

        if (!$user) {
            errorResponse(__('error.unauthorized'), 401);
        }

        unset($user['password_hash']);
        successResponse($user);
    }
}
PHP;

$targetPath = __DIR__ . '/../backend/php/Controllers/AuthController.php';
file_put_contents($targetPath, $content);
echo "AuthController updated successfully!\n";
