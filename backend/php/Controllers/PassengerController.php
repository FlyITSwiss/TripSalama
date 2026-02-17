<?php

declare(strict_types=1);

namespace TripSalama\Controllers;

use PDO;
use TripSalama\Models\Ride;
use TripSalama\Services\RideService;
use TripSalama\Helpers\PathHelper;

/**
 * Controller pour les passageres
 */
class PassengerController
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Dashboard passagere
     */
    public function dashboard(): void
    {
        $user = current_user();

        // Statistiques
        $rideModel = new Ride($this->db);
        $stats = [
            'total_rides' => $rideModel->countByPassenger((int)$user['id']),
            'this_month' => $rideModel->countByPassenger((int)$user['id'], 'month'),
        ];

        // Course en cours
        $activeRide = $rideModel->getActiveByPassenger((int)$user['id']);

        $this->render('passenger/dashboard', [
            'pageTitle' => __('nav.dashboard'),
            'currentPage' => 'dashboard',
            'user' => $user,
            'stats' => $stats,
            'activeRide' => $activeRide,
        ]);
    }

    /**
     * Page de reservation
     */
    public function bookRide(): void
    {
        $this->render('passenger/book-ride', [
            'pageTitle' => __('booking.title'),
            'currentPage' => 'book',
            'includeMap' => true,
            'pageJs' => ['modules/map-controller.js', 'modules/booking.js', 'components/address-autocomplete.js'],
        ]);
    }

    /**
     * Suivi d'une course
     */
    public function trackRide(string $id): void
    {
        $rideId = (int)$id;
        $user = current_user();

        $rideModel = new Ride($this->db);
        $ride = $rideModel->findById($rideId);

        if (!$ride || (int)$ride['passenger_id'] !== (int)$user['id']) {
            flash('error', __('error.not_found'));
            redirect_to('passenger/dashboard');
        }

        $this->render('passenger/ride-tracking', [
            'pageTitle' => __('ride.title'),
            'currentPage' => 'ride',
            'includeMap' => true,
            'ride' => $ride,
            'pageJs' => ['modules/map-controller.js', 'modules/ride-tracker.js', 'modules/vehicle-simulator.js'],
        ]);
    }

    /**
     * Historique des courses
     */
    public function history(): void
    {
        $user = current_user();

        $rideModel = new Ride($this->db);
        $rides = $rideModel->getByPassenger((int)$user['id']);

        $this->render('passenger/history', [
            'pageTitle' => __('history.title'),
            'currentPage' => 'history',
            'rides' => $rides,
        ]);
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

        ob_start();
        require $viewPath;
        $content = ob_get_clean();

        require PathHelper::getViewsPath() . '/layouts/main.phtml';
    }
}
