<?php

declare(strict_types=1);

namespace TripSalama\Controllers;

use PDO;
use TripSalama\Models\Ride;
use TripSalama\Models\Vehicle;
use TripSalama\Helpers\PathHelper;

/**
 * Controller pour les conductrices
 */
class DriverController
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Dashboard conductrice
     */
    public function dashboard(): void
    {
        $user = current_user();
        $driverId = (int)$user['id'];

        // Statut de disponibilite
        $status = $this->getDriverStatus($driverId);

        // Statistiques
        $rideModel = new Ride($this->db);
        $stats = [
            'total_rides' => $rideModel->countByDriver($driverId),
            'this_month' => $rideModel->countByDriver($driverId, 'month'),
        ];

        // Course en cours
        $activeRide = $rideModel->getActiveByDriver($driverId);

        // Courses en attente (si disponible)
        $pendingRides = [];
        if ($status['is_available'] && !$activeRide) {
            $pendingRides = $rideModel->getPending(
                (float)($status['current_lat'] ?? 46.2044),
                (float)($status['current_lng'] ?? 6.1432)
            );
        }

        // Vehicule
        $vehicleModel = new Vehicle($this->db);
        $vehicle = $vehicleModel->findByDriver($driverId);

        $this->render('driver/dashboard', [
            'pageTitle' => __('driver.title'),
            'currentPage' => 'dashboard',
            'includeMap' => true,
            'user' => $user,
            'status' => $status,
            'stats' => $stats,
            'activeRide' => $activeRide,
            'pendingRides' => $pendingRides,
            'vehicle' => $vehicle,
            'pageJs' => ['modules/map-controller.js', 'modules/driver-dashboard.js'],
        ]);
    }

    /**
     * Details d'une course
     */
    public function rideDetails(string $id): void
    {
        $rideId = (int)$id;
        $user = current_user();

        $rideModel = new Ride($this->db);
        $ride = $rideModel->findById($rideId);

        if (!$ride || (int)$ride['driver_id'] !== (int)$user['id']) {
            flash('error', __('error.not_found'));
            redirect_to('driver/dashboard');
        }

        $this->render('driver/ride-details', [
            'pageTitle' => __('ride.title'),
            'currentPage' => 'ride',
            'includeMap' => true,
            'ride' => $ride,
        ]);
    }

    /**
     * Navigation vers une course
     */
    public function navigation(string $id): void
    {
        $rideId = (int)$id;
        $user = current_user();

        $rideModel = new Ride($this->db);
        $ride = $rideModel->findById($rideId);

        if (!$ride || (int)$ride['driver_id'] !== (int)$user['id']) {
            flash('error', __('error.not_found'));
            redirect_to('driver/dashboard');
        }

        $this->render('driver/navigation', [
            'pageTitle' => __('driver.go_to_passenger'),
            'currentPage' => 'navigation',
            'includeMap' => true,
            'ride' => $ride,
            'pageJs' => ['modules/map-controller.js', 'modules/driver-navigation.js', 'modules/vehicle-simulator.js'],
        ]);
    }

    /**
     * Obtenir le statut de la conductrice
     */
    private function getDriverStatus(int $driverId): array
    {
        $stmt = $this->db->prepare('SELECT * FROM driver_status WHERE driver_id = :id');
        $stmt->execute(['id' => $driverId]);
        $status = $stmt->fetch();

        if (!$status) {
            // Creer un statut par defaut
            $stmt = $this->db->prepare('
                INSERT INTO driver_status (driver_id, is_available, current_lat, current_lng)
                VALUES (:id, 0, NULL, NULL)
            ');
            $stmt->execute(['id' => $driverId]);

            return [
                'is_available' => false,
                'current_lat' => null,
                'current_lng' => null,
            ];
        }

        return $status;
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
