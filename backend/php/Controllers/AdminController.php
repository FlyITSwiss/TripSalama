<?php

declare(strict_types=1);

namespace TripSalama\Controllers;

use PDO;
use TripSalama\Helpers\PathHelper;

/**
 * Controller pour l'administration
 */
class AdminController
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Dashboard admin
     */
    public function dashboard(): void
    {
        $stats = $this->getSystemStats();

        $this->render('admin/dashboard', [
            'pageTitle' => __('admin.dashboard'),
            'currentPage' => 'admin-dashboard',
            'stats' => $stats,
        ]);
    }

    /**
     * Page des paramètres
     */
    public function settings(): void
    {
        $settings = $this->getAllSettings();
        $smsStats = $this->getSMSStats();
        $sosStats = $this->getSOSStats();

        $this->render('admin/settings', [
            'pageTitle' => __('admin.settings'),
            'currentPage' => 'admin-settings',
            'settings' => $settings,
            'smsStats' => $smsStats,
            'sosStats' => $sosStats,
        ]);
    }

    /**
     * Mettre à jour les paramètres
     */
    public function updateSettings(): void
    {
        $data = $_POST;

        // Mise à jour des settings
        $settingsToUpdate = [
            'pin_verification_enabled' => filter_var($data['pin_verification_enabled'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'dashcam_required' => filter_var($data['dashcam_required'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'sos_auto_call_enabled' => filter_var($data['sos_auto_call_enabled'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'sms_enabled' => filter_var($data['sms_enabled'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'max_pin_attempts' => (int) ($data['max_pin_attempts'] ?? 3),
            'pin_expiry_minutes' => (int) ($data['pin_expiry_minutes'] ?? 10),
            'sos_recording_max_duration' => (int) ($data['sos_recording_max_duration'] ?? 300),
            'checklist_required' => filter_var($data['checklist_required'] ?? false, FILTER_VALIDATE_BOOLEAN),
        ];

        foreach ($settingsToUpdate as $key => $value) {
            $this->saveSetting($key, is_bool($value) ? ($value ? '1' : '0') : (string) $value);
        }

        flash('success', __('msg.settings_saved'));
        redirect_to('admin/settings');
    }

    /**
     * Obtenir toutes les settings
     */
    private function getAllSettings(): array
    {
        $this->ensureSettingsTableExists();

        $stmt = $this->db->query('SELECT setting_key, setting_value FROM app_settings');
        $settings = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }

        // Valeurs par défaut
        return array_merge([
            'pin_verification_enabled' => '1',
            'dashcam_required' => '1',
            'sos_auto_call_enabled' => '0',
            'sms_enabled' => '1',
            'max_pin_attempts' => '3',
            'pin_expiry_minutes' => '10',
            'sos_recording_max_duration' => '300',
            'checklist_required' => '1',
        ], $settings);
    }

    /**
     * Sauvegarder un setting
     */
    private function saveSetting(string $key, string $value): void
    {
        $stmt = $this->db->prepare('
            INSERT INTO app_settings (setting_key, setting_value)
            VALUES (:key, :value)
            ON DUPLICATE KEY UPDATE setting_value = :value2, updated_at = NOW()
        ');
        $stmt->execute([
            'key' => $key,
            'value' => $value,
            'value2' => $value,
        ]);
    }

    /**
     * Créer la table settings si nécessaire
     */
    private function ensureSettingsTableExists(): void
    {
        $this->db->exec('
            CREATE TABLE IF NOT EXISTS app_settings (
                id INT PRIMARY KEY AUTO_INCREMENT,
                setting_key VARCHAR(100) NOT NULL UNIQUE,
                setting_value TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_key (setting_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ');
    }

    /**
     * Obtenir les statistiques système
     */
    private function getSystemStats(): array
    {
        // Comptage utilisateurs
        $stmt = $this->db->query('SELECT COUNT(*) as count, role FROM users GROUP BY role');
        $usersByRole = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $usersByRole[$row['role']] = (int) $row['count'];
        }

        // Courses aujourd'hui
        $stmt = $this->db->query('SELECT COUNT(*) FROM rides WHERE DATE(created_at) = CURDATE()');
        $ridesToday = (int) $stmt->fetchColumn();

        // Courses total
        $stmt = $this->db->query('SELECT COUNT(*) FROM rides');
        $ridesTotal = (int) $stmt->fetchColumn();

        // Alertes SOS actives
        $stmt = $this->db->query("SELECT COUNT(*) FROM sos_alerts WHERE status = 'active'");
        $activeAlerts = (int) $stmt->fetchColumn();

        return [
            'users_by_role' => $usersByRole,
            'rides_today' => $ridesToday,
            'rides_total' => $ridesTotal,
            'active_alerts' => $activeAlerts,
        ];
    }

    /**
     * Statistiques SMS
     */
    private function getSMSStats(): array
    {
        try {
            $stmt = $this->db->query('
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today,
                    message_type
                FROM sms_logs
                GROUP BY message_type
            ');

            $stats = ['total' => 0, 'today' => 0, 'by_type' => []];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $stats['total'] += (int) $row['total'];
                $stats['today'] += (int) $row['today'];
                $stats['by_type'][$row['message_type']] = [
                    'total' => (int) $row['total'],
                    'today' => (int) $row['today'],
                ];
            }

            return $stats;
        } catch (\Exception $e) {
            return ['total' => 0, 'today' => 0, 'by_type' => []];
        }
    }

    /**
     * Statistiques SOS
     */
    private function getSOSStats(): array
    {
        try {
            // Alertes par statut
            $stmt = $this->db->query('
                SELECT status, COUNT(*) as count
                FROM sos_alerts
                GROUP BY status
            ');
            $byStatus = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $byStatus[$row['status']] = (int) $row['count'];
            }

            // Enregistrements
            $stmt = $this->db->query('
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN DATE(recorded_at) = CURDATE() THEN 1 ELSE 0 END) as today,
                    SUM(file_size_bytes) as total_size
                FROM sos_recordings
            ');
            $recordings = $stmt->fetch(PDO::FETCH_ASSOC);

            return [
                'by_status' => $byStatus,
                'recordings' => [
                    'total' => (int) ($recordings['total'] ?? 0),
                    'today' => (int) ($recordings['today'] ?? 0),
                    'total_size_mb' => round((int) ($recordings['total_size'] ?? 0) / (1024 * 1024), 2),
                ],
            ];
        } catch (\Exception $e) {
            return ['by_status' => [], 'recordings' => ['total' => 0, 'today' => 0, 'total_size_mb' => 0]];
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

        ob_start();
        require $viewPath;
        $content = ob_get_clean();

        require PathHelper::getViewsPath() . '/layouts/main.phtml';
    }
}
