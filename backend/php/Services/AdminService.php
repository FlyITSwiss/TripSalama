<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;

/**
 * Service Administration
 * Dashboard, statistiques et gestion de la plateforme
 */
class AdminService
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Obtenir les statistiques du dashboard
     */
    public function getDashboardStats(): array
    {
        // Statistiques utilisateurs
        $userStats = $this->db->query('
            SELECT
                COUNT(*) as total_users,
                COUNT(CASE WHEN role = "passenger" THEN 1 END) as total_passengers,
                COUNT(CASE WHEN role = "driver" THEN 1 END) as total_drivers,
                COUNT(CASE WHEN role = "driver" AND is_verified = 1 THEN 1 END) as verified_drivers,
                COUNT(CASE WHEN role = "driver" AND is_online = 1 THEN 1 END) as online_drivers,
                COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as new_users_week,
                COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_users_month
            FROM users
            WHERE role IN ("passenger", "driver")
        ')->fetch(PDO::FETCH_ASSOC);

        // Statistiques courses
        $rideStats = $this->db->query('
            SELECT
                COUNT(*) as total_rides,
                COUNT(CASE WHEN status = "completed" THEN 1 END) as completed_rides,
                COUNT(CASE WHEN status = "cancelled" THEN 1 END) as cancelled_rides,
                COUNT(CASE WHEN status IN ("searching", "pending", "accepted", "in_progress") THEN 1 END) as active_rides,
                COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as rides_today,
                COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as rides_week,
                COALESCE(AVG(rating), 0) as avg_rating
            FROM rides
        ')->fetch(PDO::FETCH_ASSOC);

        // Statistiques financières
        $financeStats = $this->db->query('
            SELECT
                COALESCE(SUM(CASE WHEN status = "completed" THEN final_price ELSE 0 END), 0) as total_revenue,
                COALESCE(SUM(CASE WHEN status = "completed" THEN commission_amount ELSE 0 END), 0) as total_commissions,
                COALESCE(SUM(CASE WHEN status = "completed" THEN tip_amount ELSE 0 END), 0) as total_tips,
                COALESCE(SUM(CASE WHEN status = "completed" AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN final_price ELSE 0 END), 0) as revenue_today,
                COALESCE(SUM(CASE WHEN status = "completed" AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN final_price ELSE 0 END), 0) as revenue_week,
                COALESCE(SUM(CASE WHEN status = "completed" AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN final_price ELSE 0 END), 0) as revenue_month
            FROM rides
        ')->fetch(PDO::FETCH_ASSOC);

        // Statistiques wallets
        $walletStats = $this->db->query('
            SELECT
                COUNT(*) as total_wallets,
                COALESCE(SUM(balance), 0) as total_balance,
                COALESCE(AVG(balance), 0) as avg_balance
            FROM wallets
        ')->fetch(PDO::FETCH_ASSOC);

        // Alertes SOS actives
        $sosCount = $this->db->query('
            SELECT COUNT(*) FROM sos_alerts WHERE status = "active"
        ')->fetchColumn();

        return [
            'users' => $userStats,
            'rides' => $rideStats,
            'finance' => $financeStats,
            'wallets' => $walletStats,
            'active_sos_alerts' => (int) $sosCount,
            'generated_at' => date('Y-m-d H:i:s'),
        ];
    }

    /**
     * Obtenir les revenus par période
     */
    public function getRevenueByPeriod(string $period = 'daily', int $limit = 30): array
    {
        $groupBy = match ($period) {
            'hourly' => 'DATE_FORMAT(created_at, "%Y-%m-%d %H:00")',
            'daily' => 'DATE(created_at)',
            'weekly' => 'YEARWEEK(created_at)',
            'monthly' => 'DATE_FORMAT(created_at, "%Y-%m")',
            default => 'DATE(created_at)',
        };

        $stmt = $this->db->prepare("
            SELECT
                {$groupBy} as period,
                COUNT(*) as rides_count,
                SUM(final_price) as revenue,
                SUM(commission_amount) as commissions,
                SUM(tip_amount) as tips,
                AVG(final_price) as avg_fare
            FROM rides
            WHERE status = 'completed'
            GROUP BY period
            ORDER BY period DESC
            LIMIT :limit
        ");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        return array_reverse($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    /**
     * Obtenir les conductrices avec leurs statistiques
     */
    public function getDriversWithStats(int $page = 1, int $perPage = 20, ?string $status = null): array
    {
        $offset = ($page - 1) * $perPage;
        $statusCondition = '';
        $params = [];

        if ($status === 'online') {
            $statusCondition = 'AND u.is_online = 1';
        } elseif ($status === 'verified') {
            $statusCondition = 'AND u.is_verified = 1';
        } elseif ($status === 'pending') {
            $statusCondition = 'AND u.is_verified = 0';
        }

        $stmt = $this->db->prepare("
            SELECT
                u.id, u.first_name, u.last_name, u.email, u.phone,
                u.profile_photo, u.is_verified, u.is_online, u.rating,
                u.created_at,
                COUNT(DISTINCT r.id) as total_rides,
                COUNT(DISTINCT CASE WHEN r.status = 'completed' THEN r.id END) as completed_rides,
                COALESCE(SUM(CASE WHEN r.status = 'completed' THEN r.driver_earnings ELSE 0 END), 0) as total_earnings,
                COALESCE(AVG(r.rating), 0) as avg_rating,
                v.brand as vehicle_brand, v.model as vehicle_model, v.license_plate
            FROM users u
            LEFT JOIN rides r ON u.id = r.driver_id
            LEFT JOIN vehicles v ON u.id = v.driver_id AND v.is_active = 1
            WHERE u.role = 'driver'
            {$statusCondition}
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT :limit OFFSET :offset
        ");

        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $drivers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Total count
        $totalStmt = $this->db->query("
            SELECT COUNT(*) FROM users WHERE role = 'driver' " . str_replace('AND u.', 'AND ', $statusCondition)
        );
        $total = (int) $totalStmt->fetchColumn();

        return [
            'drivers' => $drivers,
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => (int) ceil($total / $perPage),
            ],
        ];
    }

    /**
     * Obtenir les passagères avec leurs statistiques
     */
    public function getPassengersWithStats(int $page = 1, int $perPage = 20): array
    {
        $offset = ($page - 1) * $perPage;

        $stmt = $this->db->prepare('
            SELECT
                u.id, u.first_name, u.last_name, u.email, u.phone,
                u.profile_photo, u.created_at,
                COUNT(DISTINCT r.id) as total_rides,
                COALESCE(SUM(CASE WHEN r.status = "completed" THEN r.final_price ELSE 0 END), 0) as total_spent,
                w.balance as wallet_balance,
                (SELECT COUNT(*) FROM referrals WHERE referrer_id = u.id AND status = "completed") as referrals_count
            FROM users u
            LEFT JOIN rides r ON u.id = r.passenger_id
            LEFT JOIN wallets w ON u.id = w.user_id
            WHERE u.role = "passenger"
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT :limit OFFSET :offset
        ');

        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $passengers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $total = (int) $this->db->query('SELECT COUNT(*) FROM users WHERE role = "passenger"')->fetchColumn();

        return [
            'passengers' => $passengers,
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => (int) ceil($total / $perPage),
            ],
        ];
    }

    /**
     * Obtenir les courses avec filtres
     */
    public function getRides(
        int $page = 1,
        int $perPage = 20,
        ?string $status = null,
        ?string $dateFrom = null,
        ?string $dateTo = null
    ): array {
        $offset = ($page - 1) * $perPage;
        $conditions = [];
        $params = [];

        if ($status) {
            $conditions[] = 'r.status = :status';
            $params['status'] = $status;
        }

        if ($dateFrom) {
            $conditions[] = 'r.created_at >= :date_from';
            $params['date_from'] = $dateFrom;
        }

        if ($dateTo) {
            $conditions[] = 'r.created_at <= :date_to';
            $params['date_to'] = $dateTo . ' 23:59:59';
        }

        $whereClause = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

        $sql = "
            SELECT
                r.*,
                p.first_name as passenger_name, p.phone as passenger_phone,
                d.first_name as driver_name, d.phone as driver_phone,
                v.brand as vehicle_brand, v.model as vehicle_model, v.license_plate
            FROM rides r
            LEFT JOIN users p ON r.passenger_id = p.id
            LEFT JOIN users d ON r.driver_id = d.id
            LEFT JOIN vehicles v ON r.driver_id = v.driver_id AND v.is_active = 1
            {$whereClause}
            ORDER BY r.created_at DESC
            LIMIT :limit OFFSET :offset
        ";

        $stmt = $this->db->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue(":{$key}", $value);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rides = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Count total
        $countSql = "SELECT COUNT(*) FROM rides r {$whereClause}";
        $countStmt = $this->db->prepare($countSql);
        foreach ($params as $key => $value) {
            $countStmt->bindValue(":{$key}", $value);
        }
        $countStmt->execute();
        $total = (int) $countStmt->fetchColumn();

        return [
            'rides' => $rides,
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => (int) ceil($total / $perPage),
            ],
        ];
    }

    /**
     * Obtenir les alertes SOS
     */
    public function getSOSAlerts(int $page = 1, int $perPage = 20, ?string $status = null): array
    {
        $offset = ($page - 1) * $perPage;
        $statusCondition = $status ? "WHERE s.status = :status" : '';

        $sql = "
            SELECT
                s.*,
                u.first_name as user_name, u.phone as user_phone,
                r.pickup_address, r.dropoff_address,
                d.first_name as driver_name
            FROM sos_alerts s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN rides r ON s.ride_id = r.id
            LEFT JOIN users d ON r.driver_id = d.id
            {$statusCondition}
            ORDER BY s.created_at DESC
            LIMIT :limit OFFSET :offset
        ";

        $stmt = $this->db->prepare($sql);
        if ($status) {
            $stmt->bindValue(':status', $status);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Vérifier/Activer une conductrice
     */
    public function verifyDriver(int $driverId): bool
    {
        $stmt = $this->db->prepare('
            UPDATE users
            SET is_verified = 1, verified_at = NOW()
            WHERE id = :id AND role = "driver"
        ');

        return $stmt->execute(['id' => $driverId]);
    }

    /**
     * Suspendre un utilisateur
     */
    public function suspendUser(int $userId, ?string $reason = null): bool
    {
        $this->db->beginTransaction();

        try {
            // Désactiver l'utilisateur
            $stmt = $this->db->prepare('
                UPDATE users
                SET is_active = 0, is_online = 0
                WHERE id = :id
            ');
            $stmt->execute(['id' => $userId]);

            // Logger la suspension
            $stmt = $this->db->prepare('
                INSERT INTO user_suspensions (user_id, reason, suspended_by, created_at)
                VALUES (:user_id, :reason, :admin_id, NOW())
            ');
            $stmt->execute([
                'user_id' => $userId,
                'reason' => $reason,
                'admin_id' => current_user()['id'] ?? null,
            ]);

            $this->db->commit();
            return true;
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Réactiver un utilisateur
     */
    public function reactivateUser(int $userId): bool
    {
        $stmt = $this->db->prepare('
            UPDATE users SET is_active = 1 WHERE id = :id
        ');

        return $stmt->execute(['id' => $userId]);
    }

    /**
     * Obtenir les transactions avec filtres
     */
    public function getTransactions(
        int $page = 1,
        int $perPage = 20,
        ?string $type = null,
        ?string $dateFrom = null,
        ?string $dateTo = null
    ): array {
        $offset = ($page - 1) * $perPage;
        $conditions = [];
        $params = [];

        if ($type) {
            $conditions[] = 't.type = :type';
            $params['type'] = $type;
        }

        if ($dateFrom) {
            $conditions[] = 't.created_at >= :date_from';
            $params['date_from'] = $dateFrom;
        }

        if ($dateTo) {
            $conditions[] = 't.created_at <= :date_to';
            $params['date_to'] = $dateTo . ' 23:59:59';
        }

        $whereClause = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

        $sql = "
            SELECT
                t.*,
                u.first_name, u.last_name, u.email
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            {$whereClause}
            ORDER BY t.created_at DESC
            LIMIT :limit OFFSET :offset
        ";

        $stmt = $this->db->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue(":{$key}", $value);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Totals
        $totalsSql = "
            SELECT
                COUNT(*) as count,
                COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_credits,
                COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_debits
            FROM transactions t
            {$whereClause}
        ";

        $totalsStmt = $this->db->prepare($totalsSql);
        foreach ($params as $key => $value) {
            $totalsStmt->bindValue(":{$key}", $value);
        }
        $totalsStmt->execute();
        $totals = $totalsStmt->fetch(PDO::FETCH_ASSOC);

        return [
            'transactions' => $transactions,
            'totals' => $totals,
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => (int) $totals['count'],
                'total_pages' => (int) ceil((int) $totals['count'] / $perPage),
            ],
        ];
    }

    /**
     * Obtenir les statistiques géographiques
     */
    public function getGeographicStats(): array
    {
        // Zones les plus actives (basé sur les pickups)
        $hotspots = $this->db->query('
            SELECT
                ROUND(pickup_lat, 2) as lat,
                ROUND(pickup_lng, 2) as lng,
                COUNT(*) as ride_count
            FROM rides
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY lat, lng
            ORDER BY ride_count DESC
            LIMIT 20
        ')->fetchAll(PDO::FETCH_ASSOC);

        // Distribution par ville (basé sur les adresses)
        $cityDistribution = $this->db->query('
            SELECT
                SUBSTRING_INDEX(pickup_address, ",", -1) as city,
                COUNT(*) as ride_count
            FROM rides
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY city
            ORDER BY ride_count DESC
            LIMIT 10
        ')->fetchAll(PDO::FETCH_ASSOC);

        return [
            'hotspots' => $hotspots,
            'city_distribution' => $cityDistribution,
        ];
    }

    /**
     * Obtenir les KPIs clés
     */
    public function getKPIs(): array
    {
        // Taux de conversion (recherches -> courses complétées)
        $conversionRate = $this->db->query('
            SELECT
                COUNT(CASE WHEN status = "completed" THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as rate
            FROM rides
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ')->fetchColumn();

        // Temps moyen d'attente
        $avgWaitTime = $this->db->query('
            SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, started_at)) as avg_wait
            FROM rides
            WHERE status = "completed"
            AND started_at IS NOT NULL
            AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ')->fetchColumn();

        // Rétention utilisateurs
        $retention = $this->db->query('
            SELECT
                COUNT(DISTINCT CASE WHEN ride_count > 1 THEN passenger_id END) * 100.0 /
                NULLIF(COUNT(DISTINCT passenger_id), 0) as retention_rate
            FROM (
                SELECT passenger_id, COUNT(*) as ride_count
                FROM rides
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY passenger_id
            ) sub
        ')->fetchColumn();

        // Valeur moyenne par course
        $avgRideValue = $this->db->query('
            SELECT AVG(final_price) as avg_value
            FROM rides
            WHERE status = "completed"
            AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ')->fetchColumn();

        return [
            'conversion_rate' => round((float) $conversionRate, 1),
            'avg_wait_time_minutes' => round((float) $avgWaitTime, 1),
            'retention_rate' => round((float) $retention, 1),
            'avg_ride_value' => round((float) $avgRideValue, 2),
        ];
    }
}
